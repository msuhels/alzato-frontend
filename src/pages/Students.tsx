import  { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { studentsService, StudentListItem } from '../services/students';
import { paymentsService, PaymentListItem } from '../services/payments';
import ConfirmDialog from '../components/ConfirmDialog';
import TableSkeleton from '../components/TableSkeleton';
import { useAuth } from '../hooks/useAuth';
import ColumnFilterMenu from '../components/ColumnFilterMenu';
import { ZONES, ASSOCIATE_WISE_INSTALLMENTS, PAYMENT_RECEIVED_IN_OPTIONS, AK_APPROVAL_OPTIONS } from '../lib/constants';

const Avatar = ({ name }: { name: string }) => {
  const avatarColors = [
    'bg-orange-400', 'bg-pink-500', 'bg-blue-500', 'bg-green-500', 'bg-indigo-500', 'bg-red-500'
  ];
  const code = name.charCodeAt(name.length - 1);
  const color = avatarColors[code % avatarColors.length];
  const avatarFallback = name.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase();
  
  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white font-bold ${color}`}>
      {avatarFallback}
    </div>
  );
};

const StudentsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [allStudents, setAllStudents] = useState<StudentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; failed: number; errors?: Array<{ rowNumber: number; message: string }> } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputId = 'students-import-file';
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const showBulkUi = false; // feature temporarily hidden
  const showSampleCsv = false; // temporarily hide Sample CSV button
  const [paymentsByStudent, setPaymentsByStudent] = useState<Record<string | number, PaymentListItem[]>>({});
  const [optionPool, setOptionPool] = useState<StudentListItem[]>([]);
  const [optionPayments, setOptionPayments] = useState<Record<string | number, PaymentListItem[]>>({});
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

  const downloadBlob = (blob: Blob, fallbackName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportCsv = async (file: File) => {
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const text = await file.text();
      const res = await paymentsService.importCsv(text);
      setImportResult(res);
      await fetchStudents();
    } catch (e: any) {
      setImportError(e?.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const triggerImportFile = () => {
    const input = document.getElementById(fileInputId) as HTMLInputElement | null;
    input?.click();
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const blob = await paymentsService.exportCsv({});
      downloadBlob(blob, `alzato-students-export-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadSample = async () => {
    try {
      const { blob, filename } = await paymentsService.downloadSampleCsv();
      downloadBlob(blob, filename || 'alzato-sample-import-export.csv');
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Sample download failed');
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const columnFiltersPayload: Record<string, string[]> = {};
      Object.entries(columnFilters).forEach(([key, values]) => {
        if (values && values.length > 0) {
          columnFiltersPayload[key] = values;
        }
      });

      const { items, total: totalCount } = await studentsService.list({
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
        include_payments: true,
        column_filters: columnFiltersPayload,
        q: searchTerm.trim() || undefined,
        sort_by: sortBy || undefined,
        sort_dir: sortBy ? sortDir : undefined,
      });
      // Helper to sort payments consistently
      const sortPayments = (list: PaymentListItem[] = []) => {
        return [...list].sort((a, b) => {
          const ia = a.installment_number || 0;
          const ib = b.installment_number || 0;
          if (ia !== ib) return ia - ib;
          const da = new Date(a.installment_date).getTime();
          const db = new Date(b.installment_date).getTime();
          if (!Number.isNaN(da) && !Number.isNaN(db) && da !== db) return da - db;
          return (a.id as number) - (b.id as number);
        });
      };

      const getPaymentAtSlot = (student: StudentListItem, slotIndex: number) => {
        const sorted = sortPayments(student.payments || []);
        return sorted[slotIndex] as PaymentListItem | undefined;
      };

      // Client-side fallback sorting for payment columns (amt/date/recv/remarks/etc.)
      const paymentSortMatch = sortBy?.match(/^(amt|date|recv|remarks|inst_remarks|acc_remarks|ak_remarks|ak_approval)_([1-4])$/);
      const sortedItems = paymentSortMatch
        ? [...(items || [])].sort((a, b) => {
            const [, prefix, slotStr] = paymentSortMatch;
            const slotIdx = Number(slotStr) - 1;
            const pa = getPaymentAtSlot(a, slotIdx);
            const pb = getPaymentAtSlot(b, slotIdx);

            const safeStr = (v: any) => (v ?? '').toString().toLowerCase();

            let av: any = null;
            let bv: any = null;
            switch (prefix) {
              case 'amt':
                av = Number(pa?.amount) || 0;
                bv = Number(pb?.amount) || 0;
                break;
              case 'date':
                av = new Date(pa?.installment_date || '').getTime() || 0;
                bv = new Date(pb?.installment_date || '').getTime() || 0;
                break;
              case 'recv':
                av = safeStr(pa?.payment_recieved_in);
                bv = safeStr(pb?.payment_recieved_in);
                break;
              case 'remarks':
                av = safeStr(pa?.remarks);
                bv = safeStr(pb?.remarks);
                break;
              case 'inst_remarks':
                av = safeStr(pa?.installment_remarks);
                bv = safeStr(pb?.installment_remarks);
                break;
              case 'acc_remarks':
                av = safeStr(pa?.accounting_remarks);
                bv = safeStr(pb?.accounting_remarks);
                break;
              case 'ak_remarks':
                av = safeStr(pa?.ak_remarks);
                bv = safeStr(pb?.ak_remarks);
                break;
              case 'ak_approval':
                av = safeStr(pa?.ak_approval);
                bv = safeStr(pb?.ak_approval);
                break;
              default:
                return 0;
            }

            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
          })
        : items;

      setAllStudents(sortedItems);
      setTotal(totalCount || 0);
      // payments are included per student
      const mapped: Record<string | number, PaymentListItem[]> = {};
      sortedItems.forEach((s) => {
        if (Array.isArray(s.payments)) {
          mapped[s.id] = sortPayments(s.payments);
        }
      });
      setPaymentsByStudent(mapped);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load students');
      setAllStudents([]);
      setTotal(0);
      setPaymentsByStudent({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, [searchTerm, sortBy, sortDir, columnFilters, currentPage]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, sortBy, sortDir, columnFilters]);

  // Fetch a larger pool once for column dropdown values so users can see all options, not only current page.
  useEffect(() => {
    const fetchOptions = async () => {
          try {
        const { items } = await studentsService.list({
          limit: 5000,
              offset: 0,
          include_payments: true,
            });
        setOptionPool(items || []);
        const mapped: Record<string | number, PaymentListItem[]> = {};
        (items || []).forEach((s) => {
        if (Array.isArray(s.payments)) {
          const sorted = [...s.payments].sort((a, b) => {
            const ia = a.installment_number || 0;
            const ib = b.installment_number || 0;
            if (ia !== ib) return ia - ib;
            const da = new Date(a.installment_date).getTime();
            const db = new Date(b.installment_date).getTime();
            if (!Number.isNaN(da) && !Number.isNaN(db) && da !== db) return da - db;
            return (a.id as number) - (b.id as number);
          });
          mapped[s.id] = sorted;
        }
        });
        setOptionPayments(mapped);
      } catch (e) {
        console.warn('Failed to prefetch filter options', e);
      }
    };
    fetchOptions();
  }, []);

  const normalizeValue = (value?: string | number | null) => {
    const str = value === null || value === undefined ? '' : String(value).trim();
    return str || '(Blanks)';
  };

  const columnOptions: Record<string, string[]> = useMemo(() => {
    const build = (seed: Array<string | number>, getter: (s: StudentListItem) => string | number | null | undefined) => {
      const fromData = optionPool.map(s => normalizeValue(getter(s)));
      return Array.from(new Set([...seed.map(normalizeValue), ...fromData])).sort((a, b) => a.localeCompare(b));
    };
    const amountSeed: Array<string | number> = [];
    const paymentSeeds: Record<string, string[]> = {};
    [1,2,3,4].forEach((i) => {
      paymentSeeds[`amt_${i}`] = [];
      paymentSeeds[`date_${i}`] = [];
      paymentSeeds[`recv_${i}`] = PAYMENT_RECEIVED_IN_OPTIONS;
      paymentSeeds[`remarks_${i}`] = [];
      paymentSeeds[`inst_remarks_${i}`] = [];
      paymentSeeds[`acc_remarks_${i}`] = [];
      paymentSeeds[`ak_remarks_${i}`] = [];
      paymentSeeds[`ak_approval_${i}`] = [...AK_APPROVAL_OPTIONS];
    });

    // Build payment options from the prefetched option pool.
    const paymentOptions: Record<string, string[]> = {};
    Object.entries(optionPayments).forEach(([_, list]) => {
      [0,1,2,3].forEach((idx) => {
        const inst = list?.[idx];
        const i = idx + 1;
        paymentOptions[`amt_${i}`] = [...(paymentOptions[`amt_${i}`] || []), normalizeValue(inst?.amount)];
        paymentOptions[`date_${i}`] = [...(paymentOptions[`date_${i}`] || []), normalizeValue(inst?.installment_date)];
        paymentOptions[`recv_${i}`] = [...(paymentOptions[`recv_${i}`] || []), normalizeValue(inst?.payment_recieved_in)];
        paymentOptions[`remarks_${i}`] = [...(paymentOptions[`remarks_${i}`] || []), normalizeValue(inst?.remarks)];
        paymentOptions[`inst_remarks_${i}`] = [...(paymentOptions[`inst_remarks_${i}`] || []), normalizeValue(inst?.installment_remarks)];
        paymentOptions[`acc_remarks_${i}`] = [...(paymentOptions[`acc_remarks_${i}`] || []), normalizeValue(inst?.accounting_remarks)];
        paymentOptions[`ak_remarks_${i}`] = [...(paymentOptions[`ak_remarks_${i}`] || []), normalizeValue(inst?.ak_remarks)];
        paymentOptions[`ak_approval_${i}`] = [...(paymentOptions[`ak_approval_${i}`] || []), normalizeValue(inst?.ak_approval)];
      });
    });

    const mergedPaymentOptions: Record<string, string[]> = {};
    Object.keys(paymentSeeds).forEach((key) => {
      const seed = paymentSeeds[key] || [];
      const vals = paymentOptions[key] || [];
      mergedPaymentOptions[key] = Array.from(new Set([...seed.map(normalizeValue), ...vals])).filter(Boolean).sort((a, b) => a.localeCompare(b));
    });

    return {
      enrollment_number: [],
      name: [],
      zone: build(ZONES, s => s.zone),
      associate_wise_installments: build(ASSOCIATE_WISE_INSTALLMENTS, s => s.associate_wise_installments),
      total_amount: build(amountSeed, s => s.total_amount ?? 0),
      recieved_amount: build(amountSeed, s => s.recieved_amount ?? s.received_amount ?? 0),
      net_amount: build(amountSeed, s => s.net_amount ?? 0),
      ...mergedPaymentOptions,
    } as Record<string, string[]>;
  }, [optionPool, optionPayments]);

  const handleColumnFilterChange = (column: string, values: string[]) => {
    setColumnFilters(prev => ({ ...prev, [column]: values }));
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  const baseColumns = showBulkUi ? (user?.role === 'user' ? 8 : 9) : (user?.role === 'user' ? 7 : 8);
  const paymentColumns = 4 * 8; // 4 installments * 8 fields each (amount/date/etc., no inst column)
  const skeletonColumns = baseColumns + paymentColumns;
  const paymentHeaderClass = "p-4 text-sm font-semibold text-gray-custom-500 text-center whitespace-nowrap min-w-[150px]";
  const paymentCellClass = "p-4 text-gray-custom-600 text-center whitespace-nowrap min-w-[150px]";

  const formatCurrency = (value?: number) =>
    (value ?? 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

  function formatDateDisplay(date?: string) {
    if (!date) return '-';
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB');
  }

  const getInstallmentData = (studentId: string | number, index: number) => {
    const list = paymentsByStudent[studentId] || [];
    return list[index];
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const startItem = Math.min((currentPage - 1) * itemsPerPage + 1, total || 0);
  const endItem = Math.min(currentPage * itemsPerPage, total || 0);

  const handleSort = (column: string, dir?: 'asc' | 'desc') => {
    if (dir) {
      setSortBy(column);
      setSortDir(dir);
      return;
    }
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const askDelete = (id: string | number) => {
    setDeletingId(id);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await studentsService.remove(deletingId);
      // Optimistically remove from list to avoid extra refetch
      setAllStudents(prev => prev.filter(s => s.id !== deletingId));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to delete student');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setDeletingId(null);
      // Ensure list stays in sync
      fetchStudents();
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await studentsService.bulkDelete(ids);
      setAllStudents(prev => prev.filter(s => !selectedIds.has(s.id)));
      setSelectedIds(new Set());
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to delete selected students');
    } finally {
      setBulkDeleting(false);
      setBulkConfirmOpen(false);
      fetchStudents();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-custom-900">Students</h1>
        <div className="flex items-center gap-3">
          {user?.role !== 'user' && selectedIds.size > 0 && showBulkUi && (
            <button
              onClick={() => setBulkConfirmOpen(true)}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
            >
              Delete Selected ({selectedIds.size})
            </button>
          )}
          {user?.role !== 'user' && (
            <>
              {showSampleCsv && (
                <button onClick={handleDownloadSample} className="rounded-lg border px-3 py-2 text-sm font-semibold text-gray-custom-700 hover:bg-gray-custom-50">Sample CSV</button>
              )}
              <button onClick={handleExportCsv} disabled={exporting} className="rounded-lg border px-3 py-2 text-sm font-semibold text-gray-custom-700 hover:bg-gray-custom-50 disabled:opacity-50">{exporting ? 'Exporting…' : 'Export CSV'}</button>
              <button onClick={() => setShowImportDialog(true)} disabled={importing} className="rounded-lg border px-3 py-2 text-sm font-semibold text-gray-custom-700 hover:bg-gray-custom-50 disabled:opacity-50">{importing ? 'Importing…' : 'Import CSV'}</button>
              <input id={fileInputId} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { e.currentTarget.value = ''; handleImportCsv(f); } }} />
            </>
          )}
          <Link to="/students/new">
            <button className="flex items-center gap-2 rounded-lg bg-primary py-2 px-4 text-white font-semibold hover:bg-primary-dark transition-colors">
              <Plus size={20} />
              <span>Add New Student</span>
            </button>
          </Link>
        </div>
      </div>
      
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-custom-400" size={20} />
          <input 
            type="text" 
            placeholder="Search by name.."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-lg border bg-white py-2.5 pl-12 pr-4 focus:border-primary focus:outline-none"
          />
        </div>
        
        <div className="overflow-x-auto">
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          {loading ? (
            <TableSkeleton rows={10} columns={skeletonColumns} />
          ) : (
            <table className="w-full min-w-[3600px] text-left">
              <thead>
                <tr className="border-b border-gray-custom-200">
                  {showBulkUi && (
                    <th className="p-4">
                      <input
                        type="checkbox"
                        checked={allStudents.length > 0 && allStudents.every(s => selectedIds.has(s.id))}
                        onChange={(e) => {
                          e.stopPropagation();
                          const next = new Set(selectedIds);
                          const allOnPageIds = allStudents.map(s => s.id);
                          const allSelected = allOnPageIds.every(id => next.has(id));
                          if (allSelected) {
                            allOnPageIds.forEach(id => next.delete(id));
                          } else {
                            allOnPageIds.forEach(id => next.add(id));
                          }
                          setSelectedIds(next);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>
                  )}
                  <th className="p-4 text-sm font-semibold text-gray-custom-500 select-none">
                    <ColumnFilterMenu
                      label="Enrl. NO."
                      options={columnOptions.enrollment_number}
                      selectedValues={columnFilters.enrollment_number || []}
                      onApply={(values) => handleColumnFilterChange('enrollment_number', values)}
                      onSort={(dir) => handleSort('enrollment_number', dir)}
                      sortDir={sortBy === 'enrollment_number' ? sortDir : null}
                      enableOptions={false}
                    />
                  </th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500 select-none">
                    <ColumnFilterMenu
                      label="STUDENT NAME"
                      options={columnOptions.name}
                      selectedValues={columnFilters.name || []}
                      onApply={(values) => handleColumnFilterChange('name', values)}
                      onSort={(dir) => handleSort('name', dir)}
                      sortDir={sortBy === 'name' ? sortDir : null}
                      enableOptions={false}
                    />
                  </th>
                  
                  <th className="p-4 text-sm font-semibold text-gray-custom-500 select-none">
                    <ColumnFilterMenu
                      label="ZONE"
                      options={columnOptions.zone}
                      selectedValues={columnFilters.zone || []}
                      onApply={(values) => handleColumnFilterChange('zone', values)}
                      onSort={(dir) => handleSort('zone', dir)}
                      sortDir={sortBy === 'zone' ? sortDir : null}
                      enableOptions={true}
                    />
                  </th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500 select-none">
                    <ColumnFilterMenu
                      label="ASSOCIATE WISE"
                      options={columnOptions.associate_wise_installments}
                      selectedValues={columnFilters.associate_wise_installments || []}
                      onApply={(values) => handleColumnFilterChange('associate_wise_installments', values)}
                      onSort={(dir) => handleSort('associate_wise_installments', dir)}
                      sortDir={sortBy === 'associate_wise_installments' ? sortDir : null}
                      enableOptions={true}
                    />
                  </th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500 select-none">
                    <ColumnFilterMenu
                      label="TOTAL"
                      options={columnOptions.total_amount}
                      selectedValues={columnFilters.total_amount || []}
                      onApply={(values) => handleColumnFilterChange('total_amount', values)}
                      onSort={(dir) => handleSort('total_amount', dir)}
                      sortDir={sortBy === 'total_amount' ? sortDir : null}
                    enableOptions={false}
                    rangeType="number"
                    />
                  </th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500 select-none">
                    <ColumnFilterMenu
                      label="RECEIVED"
                      options={columnOptions.recieved_amount}
                      selectedValues={columnFilters.recieved_amount || []}
                      onApply={(values) => handleColumnFilterChange('recieved_amount', values)}
                      onSort={(dir) => handleSort('recieved_amount', dir)}
                      sortDir={sortBy === 'recieved_amount' ? sortDir : null}
                      enableOptions={false}
                      rangeType="number"
                    />
                  </th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500 select-none">
                    <ColumnFilterMenu
                      label="NET PENDING"
                      options={columnOptions.net_amount}
                      selectedValues={columnFilters.net_amount || []}
                      onApply={(values) => handleColumnFilterChange('net_amount', values)}
                      onSort={(dir) => handleSort('net_amount', dir)}
                      sortDir={sortBy === 'net_amount' ? sortDir : null}
                      enableOptions={false}
                      rangeType="number"
                    />
                  </th>
                  {[1,2,3,4].flatMap((n) => ([
                    <th key={`amount-${n}`} className={paymentHeaderClass}>
                      <ColumnFilterMenu
                        label={`Amount ${n}`}
                        options={columnOptions[`amt_${n}`] || []}
                        selectedValues={columnFilters[`amt_${n}`] || []}
                        onApply={(values) => handleColumnFilterChange(`amt_${n}`, values)}
                        onSort={(dir) => handleSort(`amt_${n}`, dir)}
                        sortDir={sortBy === `amt_${n}` ? sortDir : null}
                        enableOptions={false}
                        rangeType="number"
                      />
                    </th>,
                    <th key={`date-${n}`} className={paymentHeaderClass}>
                      <ColumnFilterMenu
                        label={`Installment Date ${n}`}
                        options={columnOptions[`date_${n}`] || []}
                        selectedValues={columnFilters[`date_${n}`] || []}
                        onApply={(values) => handleColumnFilterChange(`date_${n}`, values)}
                        onSort={(dir) => handleSort(`date_${n}`, dir)}
                        sortDir={sortBy === `date_${n}` ? sortDir : null}
                        enableOptions={false}
                        isDate
                        rangeType="date"
                      />
                    </th>,
                    <th key={`recv-${n}`} className={paymentHeaderClass}>
                      <ColumnFilterMenu
                        label={`Received In ${n}`}
                        options={columnOptions[`recv_${n}`] || []}
                        selectedValues={columnFilters[`recv_${n}`] || []}
                        onApply={(values) => handleColumnFilterChange(`recv_${n}`, values)}
                        onSort={(dir) => handleSort(`recv_${n}`, dir)}
                        sortDir={sortBy === `recv_${n}` ? sortDir : null}
                        enableOptions={true}
                      />
                    </th>,
                    <th key={`remarks-${n}`} className={paymentHeaderClass}>
                      <ColumnFilterMenu
                        label={`Remarks ${n}`}
                        options={columnOptions[`remarks_${n}`] || []}
                        selectedValues={columnFilters[`remarks_${n}`] || []}
                        onApply={(values) => handleColumnFilterChange(`remarks_${n}`, values)}
                        onSort={(dir) => handleSort(`remarks_${n}`, dir)}
                        sortDir={sortBy === `remarks_${n}` ? sortDir : null}
                        enableOptions={false}
                      />
                    </th>,
                    <th key={`inst-remarks-${n}`} className={paymentHeaderClass}>
                      <ColumnFilterMenu
                        label={`Installment Remarks ${n}`}
                        options={columnOptions[`inst_remarks_${n}`] || []}
                        selectedValues={columnFilters[`inst_remarks_${n}`] || []}
                        onApply={(values) => handleColumnFilterChange(`inst_remarks_${n}`, values)}
                        onSort={(dir) => handleSort(`inst_remarks_${n}`, dir)}
                        sortDir={sortBy === `inst_remarks_${n}` ? sortDir : null}
                        enableOptions={false}
                      />
                    </th>,
                    <th key={`acc-remarks-${n}`} className={paymentHeaderClass}>
                      <ColumnFilterMenu
                        label={`Accounting Remarks ${n}`}
                        options={columnOptions[`acc_remarks_${n}`] || []}
                        selectedValues={columnFilters[`acc_remarks_${n}`] || []}
                        onApply={(values) => handleColumnFilterChange(`acc_remarks_${n}`, values)}
                        onSort={(dir) => handleSort(`acc_remarks_${n}`, dir)}
                        sortDir={sortBy === `acc_remarks_${n}` ? sortDir : null}
                        enableOptions={false}
                      />
                    </th>,
                    <th key={`ak-remarks-${n}`} className={paymentHeaderClass}>
                      <ColumnFilterMenu
                        label={`AK Remarks ${n}`}
                        options={columnOptions[`ak_remarks_${n}`] || []}
                        selectedValues={columnFilters[`ak_remarks_${n}`] || []}
                        onApply={(values) => handleColumnFilterChange(`ak_remarks_${n}`, values)}
                        onSort={(dir) => handleSort(`ak_remarks_${n}`, dir)}
                        sortDir={sortBy === `ak_remarks_${n}` ? sortDir : null}
                        enableOptions={false}
                      />
                    </th>,
                    <th key={`ak-approval-${n}`} className={paymentHeaderClass}>
                      <ColumnFilterMenu
                        label={`AK Approval ${n}`}
                        options={columnOptions[`ak_approval_${n}`] || []}
                        selectedValues={columnFilters[`ak_approval_${n}`] || []}
                        onApply={(values) => handleColumnFilterChange(`ak_approval_${n}`, values)}
                        onSort={(dir) => handleSort(`ak_approval_${n}`, dir)}
                        sortDir={sortBy === `ak_approval_${n}` ? sortDir : null}
                        enableOptions={true}
                      />
                    </th>,
                  ]))}
                  {user?.role !== 'user' && (
                    <th className="p-4 text-sm font-semibold text-gray-custom-500 text-center whitespace-nowrap min-w-[140px]">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                  {allStudents.length === 0 ? (
                    <tr>
                      {showBulkUi && <td className="p-4" />}
                      <td className="p-4 text-center text-gray-custom-500" colSpan={skeletonColumns - (showBulkUi ? 1 : 0)}>
                        No records found. Clear or adjust filters to see results.
                      </td>
                    </tr>
                  ) : allStudents.map((student) => (
                  <tr 
                    key={student.id}
                    className="border-b border-gray-custom-200 last:border-b-0 hover:bg-gray-custom-50 cursor-pointer"
                    onClick={() => navigate(`/students/${student.id}`)}
                  >
                    {showBulkUi && (
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(student.id)}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) {
                              next.add(student.id);
                            } else {
                              next.delete(student.id);
                            }
                            setSelectedIds(next);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}
                    <td className="p-4 text-gray-custom-600 font-mono">{student.enrollment_number || '-'}</td>
                    <td className="p-4 min-w-[220px] whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar name={student.name} />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-custom-800 truncate">{student.name}</p>
                          <p className="text-sm text-gray-custom-500 truncate">{student.email}</p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4 text-gray-custom-600 whitespace-nowrap min-w-[120px]">{student.zone || '-'}</td>
                    <td className="p-4 text-gray-custom-600 whitespace-nowrap min-w-[120px]">{student.associate_wise_installments || '-'}</td>
                    <td className="p-4 text-gray-custom-600 whitespace-nowrap min-w-[120px]">{formatCurrency(student.total_amount)}</td>
                    <td className="p-4 text-gray-custom-600 whitespace-nowrap min-w-[120px]">{formatCurrency(student.recieved_amount ?? student.received_amount)}</td>
                    <td className="p-4 text-gray-custom-600 whitespace-nowrap min-w-[120px]">{formatCurrency(student.net_amount)}</td>
                    {[0,1,2,3].flatMap((idx) => {
                      const inst = getInstallmentData(student.id, idx);
                      return ([
                        <td key={`amt-${student.id}-${idx}`} className={paymentCellClass}>
                          {inst ? formatCurrency(inst.amount) : '-'}
                        </td>,
                        <td key={`date-${student.id}-${idx}`} className={paymentCellClass}>
                          {inst ? formatDateDisplay(inst.installment_date) : '-'}
                        </td>,
                        <td key={`recv-${student.id}-${idx}`} className={paymentCellClass}>
                          {inst?.payment_recieved_in || '-'}
                        </td>,
                        <td key={`remarks-${student.id}-${idx}`} className={paymentCellClass}>
                          {inst?.remarks || '-'}
                        </td>,
                        <td key={`inst-remarks-${student.id}-${idx}`} className={paymentCellClass}>
                          {inst?.installment_remarks || '-'}
                        </td>,
                        <td key={`acc-remarks-${student.id}-${idx}`} className={paymentCellClass}>
                          {inst?.accounting_remarks || '-'}
                        </td>,
                        <td key={`ak-remarks-${student.id}-${idx}`} className={paymentCellClass}>
                          {inst?.ak_remarks || '-'}
                        </td>,
                        <td key={`ak-approval-${student.id}-${idx}`} className={paymentCellClass}>
                          {inst?.ak_approval || '-'}
                        </td>,
                      ]);
                    })}
                    {user?.role !== 'user' && (
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-start gap-3 whitespace-nowrap">
                          {user?.role === 'admin' && (
                            <button
                              onClick={() => navigate(`/students/${student.id}/edit`)}
                              className="text-primary font-medium hover:underline"
                            >
                              Edit
                            </button>
                          )}
                          <span className="h-4 w-px bg-gray-custom-200" aria-hidden="true" />
                          <button
                            onClick={() => askDelete(student.id)}
                            className="text-red-500 font-medium hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-gray-custom-600">{total > 0 ? `Showing ${startItem}-${endItem} of ${total}` : 'Showing 0 of 0'}</p>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="flex items-center gap-1 rounded-md border bg-white px-3 py-1.5 text-sm font-medium text-gray-custom-600 hover:bg-gray-custom-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button 
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 rounded-md border bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete student?"
        description="This action cannot be undone. The student will be permanently removed."
        confirmText="Delete"
        cancelText="Cancel"
        confirming={deleting}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) { setConfirmOpen(false); setDeletingId(null); } }}
      />
      {showBulkUi && (
        <ConfirmDialog
          open={bulkConfirmOpen}
          title="Delete selected students?"
          description="This action cannot be undone. All selected students will be permanently removed."
          confirmText="Delete"
          cancelText="Cancel"
          confirming={bulkDeleting}
          onConfirm={confirmBulkDelete}
          onCancel={() => { if (!bulkDeleting) { setBulkConfirmOpen(false); } }}
        />
      )}
      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowImportDialog(false)} />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-custom-900">Import Payments CSV</h2>
              <p className="mt-1 text-sm text-gray-custom-500">Please read these instructions carefully before importing.</p>
            </div>
            <div className="rounded-lg border bg-gray-custom-50 p-4">
              <ul className="list-disc pl-5 text-sm text-gray-custom-700 space-y-2">
                <li>When importing for the first time, remove all existing students data before importing.</li>
                <li>Only CSV format is supported.</li>
                <li>Please follow the sample file format properly. Use the <button onClick={handleDownloadSample} className="text-primary underline">Sample CSV</button>.</li>
                <li><span className="font-semibold">Date format</span> should be <span className="font-mono">DD/MM/YYYY</span>.</li>
                <li><span className="font-semibold">enrollment_number</span> should look like: <span className="font-mono">#0001, #0002, … #0011 … #0102 … #2010 … #99999</span>.</li>
              </ul>
            </div>

            {(importing || importResult || importError) && (
              <div className="mt-4 rounded-lg border p-4">
                {importing && (
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-sm text-gray-custom-700">Importing… this may take a moment.</span>
                  </div>
                )}
                {!importing && importResult && (
                  <div className="text-sm text-gray-custom-700">
                    <p className="font-semibold text-gray-custom-900">Import completed</p>
                    <p className="mt-1">Inserted: <span className="font-mono">{importResult.inserted}</span>, Failed: <span className="font-mono">{importResult.failed}</span></p>
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-auto rounded bg-gray-custom-50 p-2">
                        <p className="font-medium">Errors:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {importResult.errors.map((er, idx) => (
                            <li key={idx} className="font-mono">Row {er.rowNumber}: {er.message}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {!importing && importError && (
                  <div className="text-sm text-red-600">
                    <p className="font-semibold">Import failed</p>
                    <p className="mt-1">{importError}</p>
                  </div>
                )}
              </div>
            )}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => { setShowImportDialog(false); setImportResult(null); setImportError(null); }} className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-custom-700 hover:bg-gray-custom-50">{importing ? 'Hide' : (importResult || importError) ? 'Done' : 'Cancel'}</button>
              <button onClick={() => { triggerImportFile(); }} disabled={importing} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">Choose CSV & Import</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default StudentsPage;
