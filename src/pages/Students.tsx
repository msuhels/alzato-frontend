import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { studentsService, StudentListItem } from '../services/students';
import { paymentsService, PaymentListItem } from '../services/payments';
import ConfirmDialog from '../components/ConfirmDialog';
import TableSkeleton from '../components/TableSkeleton';
import { useAuth } from '../hooks/useAuth';
import ColumnFilterMenu from '../components/ColumnFilterMenu';
import { ZONES, ASSOCIATE_WISE_INSTALLMENTS, PAYMENT_RECEIVED_IN_OPTIONS, AK_APPROVAL_OPTIONS } from '../lib/constants';
import { parseInstallmentStructure } from '../lib/dateUtils';

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

  // Load column filters from localStorage on mount
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('students-column-filters');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [akEdits, setAkEdits] = useState<Record<string | number, { ak_remarks?: string; ak_approval?: string }>>({});
  const [savingPayments, setSavingPayments] = useState<Record<string | number, boolean>>({});
  const tableRef = useRef<HTMLTableElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const barScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(3600);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

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
          // Combine separate amount filter keys into amt_${n} for backend
          if (key.match(/^(total_amt|amt1|amt2|amt3|amt4)_(\d+)$/)) {
            const match = key.match(/^(total_amt|amt1|amt2|amt3|amt4)_(\d+)$/);
            if (match) {
              const instNum = match[2];
              const backendKey = `amt_${instNum}`;
              if (!columnFiltersPayload[backendKey]) {
                columnFiltersPayload[backendKey] = [];
              }
              // Merge values, avoiding duplicates
              values.forEach(v => {
                if (!columnFiltersPayload[backendKey].includes(v)) {
                  columnFiltersPayload[backendKey].push(v);
                }
              });
            }
          } else if (key.match(/^(date1|date2|date3|date4)_(\d+)$/)) {
            // Combine date1_${n}, date2_${n}, date3_${n}, date4_${n} into date_${n} for backend
            const match = key.match(/^(date1|date2|date3|date4)_(\d+)$/);
            if (match) {
              const instNum = match[2];
              const backendKey = `date_${instNum}`;
              if (!columnFiltersPayload[backendKey]) {
                columnFiltersPayload[backendKey] = [];
              }
              // Merge values, avoiding duplicates
              values.forEach(v => {
                if (!columnFiltersPayload[backendKey].includes(v)) {
                  columnFiltersPayload[backendKey].push(v);
                }
              });
            }
          } else {
            columnFiltersPayload[key] = values;
          }
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

      // Trust backend ordering; do not re-sort students on the frontend.
      setAllStudents(items || []);
      setTotal(totalCount || 0);
      // payments are included per student
      const mapped: Record<string | number, PaymentListItem[]> = {};
      (items || []).forEach((s) => {
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

  // Save column filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('students-column-filters', JSON.stringify(columnFilters));
    } catch (e) {
      console.warn('Failed to save filters to localStorage', e);
    }
  }, [columnFilters]);

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
    [1, 2, 3, 4].forEach((i) => {
      paymentSeeds[`total_amt_${i}`] = [];
      paymentSeeds[`amt1_${i}`] = [];
      paymentSeeds[`amt2_${i}`] = [];
      paymentSeeds[`amt3_${i}`] = [];
      paymentSeeds[`amt4_${i}`] = [];
      paymentSeeds[`date_${i}`] = [];
      paymentSeeds[`date1_${i}`] = [];
      paymentSeeds[`date2_${i}`] = [];
      paymentSeeds[`date3_${i}`] = [];
      paymentSeeds[`date4_${i}`] = [];
      paymentSeeds[`recv_${i}`] = PAYMENT_RECEIVED_IN_OPTIONS;
      paymentSeeds[`remarks_${i}`] = [];
      paymentSeeds[`ak_remarks_${i}`] = [];
      paymentSeeds[`ak_approval_${i}`] = [...AK_APPROVAL_OPTIONS];
    });

    // Build payment options from the prefetched option pool, grouped by installment_number
    const paymentOptions: Record<string, string[]> = {};
    Object.entries(optionPayments).forEach(([_, list]) => {
      // Group payments by installment_number
      const grouped: Record<number, PaymentListItem[]> = {};
      list.forEach((payment) => {
        const instNum = payment.installment_number || 0;
        if (instNum >= 1 && instNum <= 4) {
          if (!grouped[instNum]) grouped[instNum] = [];
          grouped[instNum].push(payment);
        }
      });
      
      // Process each installment group
      [1, 2, 3, 4].forEach((instNum) => {
        const payments = grouped[instNum] || [];
        if (payments.length > 0) {
          // Calculate total amount for this installment
          const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
          paymentOptions[`total_amt_${instNum}`] = [...(paymentOptions[`total_amt_${instNum}`] || []), normalizeValue(totalAmount)];

          // For AMOUNT 1 (first payment)
          if (payments[0]) {
            paymentOptions[`amt1_${instNum}`] = [...(paymentOptions[`amt1_${instNum}`] || []), normalizeValue(payments[0].amount)];
          }

          // For AMOUNT 2 (second payment if exists)
          if (payments[1]) {
            paymentOptions[`amt2_${instNum}`] = [...(paymentOptions[`amt2_${instNum}`] || []), normalizeValue(payments[1].amount)];
          }

          // For AMOUNT 3 (third payment if exists)
          if (payments[2]) {
            paymentOptions[`amt3_${instNum}`] = [...(paymentOptions[`amt3_${instNum}`] || []), normalizeValue(payments[2].amount)];
          }

          // For AMOUNT 4 (fourth payment if exists)
          if (payments[3]) {
            paymentOptions[`amt4_${instNum}`] = [...(paymentOptions[`amt4_${instNum}`] || []), normalizeValue(payments[3].amount)];
          }
          // For dates, use latest date
          const latestDate = payments.sort((a, b) => {
            const da = new Date(a.installment_date).getTime();
            const db = new Date(b.installment_date).getTime();
            return db - da;
          })[0]?.installment_date;
          paymentOptions[`date_${instNum}`] = [...(paymentOptions[`date_${instNum}`] || []), normalizeValue(latestDate)];
          // For date1 (first payment date)
          if (payments[0]) {
            paymentOptions[`date1_${instNum}`] = [...(paymentOptions[`date1_${instNum}`] || []), normalizeValue(payments[0].installment_date)];
          }
          // For date2 (second payment date if exists)
          if (payments[1]) {
            paymentOptions[`date2_${instNum}`] = [...(paymentOptions[`date2_${instNum}`] || []), normalizeValue(payments[1].installment_date)];
          }
          // For date3 (third payment date if exists)
          if (payments[2]) {
            paymentOptions[`date3_${instNum}`] = [...(paymentOptions[`date3_${instNum}`] || []), normalizeValue(payments[2].installment_date)];
          }
          // For date4 (fourth payment date if exists)
          if (payments[3]) {
            paymentOptions[`date4_${instNum}`] = [...(paymentOptions[`date4_${instNum}`] || []), normalizeValue(payments[3].installment_date)];
          }
          // For other fields, use latest payment values
          const latest = payments[0];
          paymentOptions[`recv_${instNum}`] = [...(paymentOptions[`recv_${instNum}`] || []), normalizeValue(latest?.payment_recieved_in)];
          paymentOptions[`remarks_${instNum}`] = [...(paymentOptions[`remarks_${instNum}`] || []), normalizeValue(latest?.remarks)];
          paymentOptions[`ak_remarks_${instNum}`] = [...(paymentOptions[`ak_remarks_${instNum}`] || []), normalizeValue(latest?.ak_remarks)];
          paymentOptions[`ak_approval_${instNum}`] = [...(paymentOptions[`ak_approval_${instNum}`] || []), normalizeValue(latest?.ak_approval)];
        }
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
      source_of_student: build([], s => s.source_of_student ?? ''),
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

  const handleClearAllFilters = () => {
    setColumnFilters({});
    setCurrentPage(1);
    try {
      localStorage.removeItem('students-column-filters');
    } catch (e) {
      console.warn('Failed to clear filters from localStorage', e);
    }
  };

  const hasActiveFilters = useMemo(() => {
    return Object.values(columnFilters).some(values => values && values.length > 0);
  }, [columnFilters]);

  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  const baseColumns = showBulkUi ? (user?.role === 'user' ? 9 : 10) : (user?.role === 'user' ? 8 : 9);
  const paymentColumns = 4 * 26; // 4 installments * 26 fields each (Inst Total, Inst Pending, Amount 1-4 blocks (6 cols each))
  const skeletonColumns = baseColumns + paymentColumns;
  const paymentHeaderClass = "px-3 py-1.5 text-xs font-semibold text-gray-custom-600 text-center whitespace-nowrap min-w-[150px]";
  const paymentCellClass = "px-3 py-2 text-gray-custom-600 text-center whitespace-nowrap min-w-[150px]";
  // Unfreeze student name column on screens smaller than 9.5 inches (viewport width < 1024px)
  const nameStickyHeaderClass = isSmallScreen
    ? "px-3 py-2 text-xs font-semibold text-gray-custom-600 select-none"
    : (showBulkUi
      ? "sticky left-[52px] z-20 bg-white shadow-[2px_0_4px_rgba(0,0,0,0.04)]"
      : "sticky left-0 z-20 bg-white shadow-[2px_0_4px_rgba(0,0,0,0.04)]");
  const nameStickyCellClass = isSmallScreen
    ? "p-4 min-w-[220px] whitespace-nowrap"
    : (showBulkUi
      ? "sticky left-[52px] z-5 bg-white"
      : "sticky left-0 z-5 bg-white");

  useEffect(() => {
    const updateScrollWidth = () => {
      setScrollWidth(tableRef.current?.scrollWidth || 3600);
    };

    updateScrollWidth();
    window.addEventListener('resize', updateScrollWidth);
    return () => window.removeEventListener('resize', updateScrollWidth);
  }, [allStudents, columnFilters, sortBy, sortDir, paymentsByStudent, loading]);

  // Detect screen size - unfreeze column on screens smaller than 9.5 inches (viewport width < 1024px)
  useEffect(() => {
    const checkScreenSize = () => {
      // 9.5 inch screens typically have viewport width around 768px (portrait) or 1024px (landscape)
      // Using 1024px as threshold to detect screens smaller than 9.5 inches
      setIsSmallScreen(window.innerWidth < 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const syncHorizontalScroll = (from: 'table' | 'bar') => {
    const source = from === 'table' ? tableScrollRef.current : barScrollRef.current;
    const target = from === 'table' ? barScrollRef.current : tableScrollRef.current;
    if (!source || !target) return;
    if (target.scrollLeft !== source.scrollLeft) {
      target.scrollLeft = source.scrollLeft;
    }
  };

  const formatCurrency = (value?: number) =>
    (value ?? 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

  function formatDateDisplay(date?: string) {
    if (!date) return '-';
    const d = new Date(date);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB');
  }

  // Group payments by installment_number (1-4)
  const getPaymentsByInstallment = (studentId: string | number) => {
    const list = paymentsByStudent[studentId] || [];
    const grouped: Record<number, PaymentListItem[]> = {};
    list.forEach((payment) => {
      const instNum = payment.installment_number || 0;
      if (instNum >= 1 && instNum <= 4) {
        if (!grouped[instNum]) grouped[instNum] = [];
        grouped[instNum].push(payment);
      }
    });
    // Sort each group by date (latest first)
    Object.keys(grouped).forEach((key) => {
      const num = Number(key);
      grouped[num].sort((a, b) => {
        const da = new Date(a.installment_date).getTime();
        const db = new Date(b.installment_date).getTime();
        // Oldest first so that AMOUNT 1 is the earlier payment, AMOUNT 2 the later one
        return da - db;
      });
    });
    return grouped;
  };

  // Get processed data for a specific installment number
  const getInstallmentData = (studentId: string | number, installmentNumber: number, student?: StudentListItem) => {
    const grouped = getPaymentsByInstallment(studentId);
    const payments = grouped[installmentNumber] || [];

    // Get target amount for this installment from package structure
    const packageStructure = student?.associate_wise_installments;
    const installmentTargets = parseInstallmentStructure(packageStructure);
    const targetAmount = installmentTargets[installmentNumber - 1] || 0; // installmentNumber is 1-based, array is 0-based

    // Calculate total amount paid for this installment
    const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Calculate pending amount: target - total paid
    const pendingAmount = Math.max(0, targetAmount - totalAmount);

    // If no payments and no target amount, return null
    if (payments.length === 0 && targetAmount === 0) return null;

    // Get dates
    const amount1Date = payments[0]?.installment_date;
    const amount2Date = payments[1]?.installment_date;
    const amount3Date = payments[2]?.installment_date;
    const amount4Date = payments[3]?.installment_date;

    // Get amounts
    const amount1 = payments[0]?.amount || 0;
    const amount2 = payments[1]?.amount || 0;
    const amount3 = payments[2]?.amount || 0;
    const amount4 = payments[3]?.amount || 0;

    // Values for each payment separately
    const p1 = payments[0];
    const p2 = payments[1];
    const p3 = payments[2];
    const p4 = payments[3];

    const amount1ReceivedIn = p1?.payment_recieved_in || '';
    const amount2ReceivedIn = p2?.payment_recieved_in || '';
    const amount3ReceivedIn = p3?.payment_recieved_in || '';
    const amount4ReceivedIn = p4?.payment_recieved_in || '';

    const amount1Remarks = p1?.remarks || '';
    const amount2Remarks = p2?.remarks || '';
    const amount3Remarks = p3?.remarks || '';
    const amount4Remarks = p4?.remarks || '';

    const amount1AkRemarks = p1?.ak_remarks || '';
    const amount2AkRemarks = p2?.ak_remarks || '';
    const amount3AkRemarks = p3?.ak_remarks || '';
    const amount4AkRemarks = p4?.ak_remarks || '';

    // Use actual stored AK approval values for each amount
    const amount1AkApproval = p1?.ak_approval || '';
    const amount2AkApproval = p2?.ak_approval || '';
    const amount3AkApproval = p3?.ak_approval || '';
    const amount4AkApproval = p4?.ak_approval || '';

    // Use latest payment's other remarks where we still need per-installment context
    const latest = payments[payments.length - 1] || payments[0];
    const instRemarks = latest?.installment_remarks || '';
    const accRemarks = latest?.accounting_remarks || '';

    return {
      totalAmount,
      pendingAmount,
      amount1,
      amount2,
      amount3,
      amount4,
      amount1Date,
      amount2Date,
      amount3Date,
      amount4Date,
      receivedIn: latest?.payment_recieved_in || '',
      akApproval: amount1AkApproval, // keep compatibility for existing usages
      remarks: latest?.remarks || '',
      installmentRemarks: instRemarks,
      accountingRemarks: accRemarks,
      akRemarks: latest?.ak_remarks || '',
      // New per-amount fields
      amount1ReceivedIn,
      amount2ReceivedIn,
      amount3ReceivedIn,
      amount4ReceivedIn,
      amount1Remarks,
      amount2Remarks,
      amount3Remarks,
      amount4Remarks,
      amount1AkRemarks,
      amount2AkRemarks,
      amount3AkRemarks,
      amount4AkRemarks,
      amount1AkApproval,
      amount2AkApproval,
      amount3AkApproval,
      amount4AkApproval,
      payments, // Keep original payments for editing
    };
  };

  const saveAkChanges = async (
    payment: PaymentListItem,
    patch: Partial<Pick<PaymentListItem, 'ak_remarks' | 'ak_approval'>>
  ) => {
    if (!payment?.id) return;
    const paymentId = payment.id;
    const studentKey = payment.student_id;
    setSavingPayments(prev => ({ ...prev, [paymentId]: true }));
    try {
      await paymentsService.update(paymentId, patch);
      setPaymentsByStudent(prev => {
        const list = prev[studentKey] || [];
        const nextList = list.map(p => (p.id === paymentId ? { ...p, ...patch } : p));
        return { ...prev, [studentKey]: nextList };
      });
      setOptionPayments(prev => {
        const list = prev[studentKey] || [];
        const nextList = list.map(p => (p.id === paymentId ? { ...p, ...patch } : p));
        return { ...prev, [studentKey]: nextList };
      });
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to update payment');
    } finally {
      setSavingPayments(prev => {
        const next = { ...prev };
        delete next[paymentId];
        return next;
      });
    }
  };

  const canEditAk = user?.role !== 'user';
  const preventEnterSubmit = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
    }
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

  // suffix to add at the installment
  const suffixes = ["", "st", "nd", "rd", "th"];

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
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
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
          {hasActiveFilters && (
            <button
              onClick={handleClearAllFilters}
              className="rounded-md border border-gray-custom-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-custom-700 hover:bg-gray-custom-50 transition-colors whitespace-nowrap"
            >
              Clear Filters
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <div className="relative pb-24">
          <div
            className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            ref={tableScrollRef}
            onScroll={() => syncHorizontalScroll('table')}
          >
            {loading ? (
              <div className="min-w-[3600px]">
                <TableSkeleton rows={10} columns={skeletonColumns} />
              </div>
            ) : (
              <table ref={tableRef} className="w-full min-w-[3600px] text-left">
                <thead>
                  <tr className="border-b border-gray-custom-300 bg-gray-custom-50">
                    {showBulkUi && (
                      <th rowSpan={3} className="px-3 py-2">
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
                    <th rowSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-custom-600 select-none">
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
                    <th rowSpan={3} className={nameStickyHeaderClass}>
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

                    <th rowSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-custom-600 select-none">
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
                    <th rowSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-custom-600 select-none">
                      <ColumnFilterMenu
                        label="SOURCE OF STUDENT"
                        options={columnOptions.source_of_student}
                        selectedValues={columnFilters.source_of_student || []}
                        onApply={(values) => handleColumnFilterChange('source_of_student', values)}
                        onSort={(dir) => handleSort('source_of_student', dir)}
                        sortDir={sortBy === 'source_of_student' ? sortDir : null}
                        enableOptions={false}
                      />
                    </th>
                    <th rowSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-custom-600 select-none">
                      <ColumnFilterMenu
                        label="PACKAGE"
                        options={columnOptions.associate_wise_installments}
                        selectedValues={columnFilters.associate_wise_installments || []}
                        onApply={(values) => handleColumnFilterChange('associate_wise_installments', values)}
                        onSort={(dir) => handleSort('associate_wise_installments', dir)}
                        sortDir={sortBy === 'associate_wise_installments' ? sortDir : null}
                        enableOptions={true}
                      />
                    </th>
                    <th rowSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-custom-600 select-none">
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
                    <th rowSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-custom-600 select-none">
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
                    <th rowSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-custom-600 select-none border-r-2 border-gray-custom-300">
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
                    {[1, 2, 3, 4].map((n) => (
                      <th
                        key={`installment-header-${n}`}
                        colSpan={26}
                        className={`px-3 py-1.5 text-xs font-bold text-gray-custom-700 text-center bg-gray-custom-100 border-l-4 border-gray-custom-300`}
                      >
                        INSTALLMENT {n}
                      </th>
                    ))}
                    {user?.role !== 'user' && (
                      <th rowSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-custom-600 text-center whitespace-nowrap">
                        Actions
                      </th>
                    )}
                  </tr>
                  {/* Middle header row: Inst Total / Inst Pending, then group into Amount 1 and Amount 2 */}
                  <tr className="border-b border-gray-custom-300 bg-white">
                    {[1, 2, 3, 4].flatMap((n) => ([
                      <th
                        key={`inst-total-${n}`}
                        rowSpan={2}
                        className={`${paymentHeaderClass} border-l-4 border-gray-custom-300`}
                      >
                        {n}{suffixes[n]} Installment Received
                      </th>,
                      <th
                        key={`inst-pending-${n}`}
                        rowSpan={2}
                        className={`${paymentHeaderClass} border-r-2 border-gray-custom-300`}
                      >
                        {n}{suffixes[n]} Installment Pending
                      </th>,
                      <th key={`amount1-group-${n}`} colSpan={6} className={paymentHeaderClass}>
                        Amount 1
                      </th>,
                      <th
                        key={`amount2-group-${n}`}
                        colSpan={6}
                        className={`${paymentHeaderClass} border-l-2 border-gray-custom-300`}
                      >
                        Amount 2
                      </th>,
                      <th
                        key={`amount3-group-${n}`}
                        colSpan={6}
                        className={`${paymentHeaderClass} border-l-2 border-gray-custom-300`}
                      >
                        Amount 3
                      </th>,
                      <th
                        key={`amount4-group-${n}`}
                        colSpan={6}
                        className={`${paymentHeaderClass} border-l-2 border-gray-custom-300`}
                      >
                        Amount 4
                      </th>,
                    ]))}
                  </tr>
                  {/* Bottom header row: individual columns under Amount 1 and Amount 2, each with its own details */}
                  <tr className="border-b border-gray-custom-300 bg-white">
                    {[1, 2, 3, 4].flatMap((n) => ([
                      <th key={`amount1-date-${n}`} className={paymentHeaderClass}>
                        <ColumnFilterMenu
                          label="1st Amount Date"
                          options={columnOptions[`date1_${n}`] || []}
                          selectedValues={columnFilters[`date1_${n}`] || []}
                          onApply={(values) => handleColumnFilterChange(`date1_${n}`, values)}
                          onSort={(dir) => handleSort(`date1_${n}`, dir)}
                          sortDir={sortBy === `date1_${n}` ? sortDir : null}
                          enableOptions={false}
                          rangeType="date"
                        />
                      </th>,
                      <th key={`amount1-${n}`} className={paymentHeaderClass}>
                        <ColumnFilterMenu
                          label="1st Amount"
                          options={columnOptions[`amt1_${n}`] || []}
                          selectedValues={columnFilters[`amt1_${n}`] || []}
                          onApply={(values) => handleColumnFilterChange(`amt1_${n}`, values)}
                          onSort={(dir) => handleSort(`amt_${n}`, dir)}
                          sortDir={sortBy === `amt_${n}` ? sortDir : null}
                          enableOptions={false}
                          rangeType="number"
                        />
                      </th>,
                      <th key={`amount1-recv-${n}`} className={paymentHeaderClass}>
                        1st Received In
                      </th>,
                      <th key={`amount1-ak-approval-${n}`} className={paymentHeaderClass}>
                        1st AK's Approval
                      </th>,
                      <th key={`amount1-ak-remarks-${n}`} className={paymentHeaderClass}>
                        1st AK's Remarks
                      </th>,
                      <th key={`amount1-remarks-${n}`} className={paymentHeaderClass}>
                        1st Remarks
                      </th>,
                      <th key={`amount2-date-${n}`} className={`${paymentHeaderClass} border-l-2 border-gray-custom-300`}>
                        <ColumnFilterMenu
                          label="2nd Amount Date"
                          options={columnOptions[`date2_${n}`] || []}
                          selectedValues={columnFilters[`date2_${n}`] || []}
                          onApply={(values) => handleColumnFilterChange(`date2_${n}`, values)}
                          onSort={(dir) => handleSort(`date2_${n}`, dir)}
                          sortDir={sortBy === `date2_${n}` ? sortDir : null}
                          enableOptions={false}
                          rangeType="date"
                        />
                      </th>,
                      <th key={`amount2-${n}`} className={paymentHeaderClass}>
                        <ColumnFilterMenu
                          label="2nd Amount"
                          options={columnOptions[`amt2_${n}`] || []}
                          selectedValues={columnFilters[`amt2_${n}`] || []}
                          onApply={(values) => handleColumnFilterChange(`amt2_${n}`, values)}
                          onSort={(dir) => handleSort(`amt_${n}`, dir)}
                          sortDir={sortBy === `amt_${n}` ? sortDir : null}
                          enableOptions={false}
                          rangeType="number"
                        />
                      </th>,
                      <th key={`amount2-recv-${n}`} className={paymentHeaderClass}>
                        2nd Received In
                      </th>,
                      <th key={`amount2-ak-approval-${n}`} className={paymentHeaderClass}>
                        2nd AK's Approval
                      </th>,
                      <th key={`amount2-ak-remarks-${n}`} className={paymentHeaderClass}>
                        2nd AK's Remarks
                      </th>,
                      <th key={`amount2-remarks-${n}`} className={paymentHeaderClass}>
                        2nd Remarks
                      </th>,
                      <th key={`amount3-date-${n}`} className={`${paymentHeaderClass} border-l-2 border-gray-custom-300`}>
                        <ColumnFilterMenu
                          label="3rd Amount Date"
                          options={columnOptions[`date3_${n}`] || []}
                          selectedValues={columnFilters[`date3_${n}`] || []}
                          onApply={(values) => handleColumnFilterChange(`date3_${n}`, values)}
                          onSort={(dir) => handleSort(`date3_${n}`, dir)}
                          sortDir={sortBy === `date3_${n}` ? sortDir : null}
                          enableOptions={false}
                          rangeType="date"
                        />
                      </th>,
                      <th key={`amount3-${n}`} className={paymentHeaderClass}>
                        <ColumnFilterMenu
                          label="3rd Amount"
                          options={columnOptions[`amt3_${n}`] || []}
                          selectedValues={columnFilters[`amt3_${n}`] || []}
                          onApply={(values) => handleColumnFilterChange(`amt3_${n}`, values)}
                          onSort={(dir) => handleSort(`amt_${n}`, dir)}
                          sortDir={sortBy === `amt_${n}` ? sortDir : null}
                          enableOptions={false}
                          rangeType="number"
                        />
                      </th>,
                      <th key={`amount3-recv-${n}`} className={paymentHeaderClass}>
                        3rd Received In
                      </th>,
                      <th key={`amount3-ak-approval-${n}`} className={paymentHeaderClass}>
                        3rd AK's Approval
                      </th>,
                      <th key={`amount3-ak-remarks-${n}`} className={paymentHeaderClass}>
                        3rd AK's Remarks
                      </th>,
                      <th key={`amount3-remarks-${n}`} className={paymentHeaderClass}>
                        3rd Remarks
                      </th>,
                      <th key={`amount4-date-${n}`} className={`${paymentHeaderClass} border-l-2 border-gray-custom-300`}>
                        <ColumnFilterMenu
                          label="4th Amount Date"
                          options={columnOptions[`date4_${n}`] || []}
                          selectedValues={columnFilters[`date4_${n}`] || []}
                          onApply={(values) => handleColumnFilterChange(`date4_${n}`, values)}
                          onSort={(dir) => handleSort(`date4_${n}`, dir)}
                          sortDir={sortBy === `date4_${n}` ? sortDir : null}
                          enableOptions={false}
                          rangeType="date"
                        />
                      </th>,
                      <th key={`amount4-${n}`} className={paymentHeaderClass}>
                        <ColumnFilterMenu
                          label="4th Amount"
                          options={columnOptions[`amt4_${n}`] || []}
                          selectedValues={columnFilters[`amt4_${n}`] || []}
                          onApply={(values) => handleColumnFilterChange(`amt4_${n}`, values)}
                          onSort={(dir) => handleSort(`amt_${n}`, dir)}
                          sortDir={sortBy === `amt_${n}` ? sortDir : null}
                          enableOptions={false}
                          rangeType="number"
                        />
                      </th>,
                      <th key={`amount4-recv-${n}`} className={paymentHeaderClass}>
                        4th Received In
                      </th>,
                      <th key={`amount4-ak-approval-${n}`} className={paymentHeaderClass}>
                        4th AK's Approval
                      </th>,
                      <th key={`amount4-ak-remarks-${n}`} className={paymentHeaderClass}>
                        4th AK's Remarks
                      </th>,
                      <th key={`amount4-remarks-${n}`} className={paymentHeaderClass}>
                        4th Remarks
                      </th>,
                    ]))}
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
                      className="border-b border-gray-custom-300 last:border-b-0 hover:bg-gray-custom-50"
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
                      <td
                        className={`${nameStickyCellClass} cursor-pointer hover:bg-gray-custom-100 px-3`}
                        onClick={() => navigate(`/students/${student.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={student.name} />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-custom-800 truncate">{student.name}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-gray-custom-600 whitespace-nowrap min-w-[120px]">{student.zone || '-'}</td>
                      <td className="p-4 text-gray-custom-600 whitespace-nowrap min-w-[150px]">{student.source_of_student || '-'}</td>
                      <td className="p-4 text-gray-custom-600 whitespace-nowrap min-w-[120px]">{student.associate_wise_installments || '-'}</td>
                      <td className="p-4 text-gray-custom-600 whitespace-nowrap min-w-[120px]">{formatCurrency(student.total_amount)}</td>
                      <td className="p-4 text-gray-custom-600 whitespace-nowrap min-w-[120px]">{formatCurrency(student.recieved_amount ?? student.received_amount)}</td>
                      <td className="p-4 text-gray-custom-600 whitespace-nowrap min-w-[120px] border-r-2 border-gray-custom-300">{formatCurrency(student.net_amount)}</td>
                      {[1, 2, 3, 4].flatMap((instNum) => {
                        const instData = getInstallmentData(student.id, instNum, student);
                        const borderClass = 'border-l-4 border-gray-custom-300';
                        if (!instData) {
                          return [
                            <td key={`inst-total-${student.id}-${instNum}`} className={`${paymentCellClass} ${borderClass}`}>-</td>,
                            <td key={`inst-pending-${student.id}-${instNum}`} className={`${paymentHeaderClass} border-r-2 border-gray-custom-300`}>-</td>,
                            <td key={`amt1-date-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt1-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt1-recv-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt1-ak-approval-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt1-ak-remarks-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt1-remarks-${student.id}-${instNum}`} className={`${paymentHeaderClass} border-r-2 border-gray-custom-300`}>-</td>,
                            <td key={`amt2-date-${student.id}-${instNum}`} className={`${paymentCellClass} border-l-2 border-gray-custom-500`}>-</td>,
                            <td key={`amt2-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt2-recv-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt2-ak-approval-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt2-ak-remarks-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt2-remarks-${student.id}-${instNum}`} className={`${paymentHeaderClass} border-r-2 border-gray-custom-300`}>-</td>,
                            <td key={`amt3-date-${student.id}-${instNum}`} className={`${paymentCellClass} border-l-2 border-gray-custom-500`}>-</td>,
                            <td key={`amt3-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt3-recv-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt3-ak-approval-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt3-ak-remarks-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt3-remarks-${student.id}-${instNum}`} className={`${paymentHeaderClass} border-r-2 border-gray-custom-300`}>-</td>,
                            <td key={`amt4-date-${student.id}-${instNum}`} className={`${paymentCellClass} border-l-2 border-gray-custom-500`}>-</td>,
                            <td key={`amt4-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt4-recv-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt4-ak-approval-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt4-ak-remarks-${student.id}-${instNum}`} className={paymentCellClass}>-</td>,
                            <td key={`amt4-remarks-${student.id}-${instNum}`} className={`${paymentHeaderClass} border-r-2 border-gray-custom-300`}>-</td>,
                          ];
                        }
                        const latestPayment = instData.payments[0];
                        const secondPayment = instData.payments[1];
                        return [
                          <td key={`inst-total-${student.id}-${instNum}`} className={`${paymentCellClass} ${borderClass}`}>
                            {formatCurrency(instData.totalAmount)}
                          </td>,
                          <td key={`inst-pending-${student.id}-${instNum}`} className={`${paymentHeaderClass} border-r-2 border-gray-custom-300`}>
                            {formatCurrency(instData.pendingAmount)}
                          </td>,
                          <td key={`amt1-date-${student.id}-${instNum}`} className={paymentCellClass}>
                            {formatDateDisplay(instData.amount1Date)}
                          </td>,
                          <td key={`amt1-${student.id}-${instNum}`} className={paymentCellClass}>
                            {instData.amount1 > 0 ? formatCurrency(instData.amount1) : '-'}
                          </td>,
                          <td key={`amt1-recv-${student.id}-${instNum}`} className={paymentCellClass}>
                            {instData.amount1ReceivedIn || '-'}
                          </td>,
                          <td key={`ak-approval-${student.id}-${instNum}`} className={paymentCellClass}>
                            {!latestPayment ? (
                              '-'
                            ) : canEditAk ? (
                              <select
                                value={akEdits[latestPayment.id]?.ak_approval ?? instData.amount1AkApproval ?? ''}
                                disabled={!!savingPayments[latestPayment.id]}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={preventEnterSubmit}
                                onChange={(e) => {
                                  const nextVal = e.target.value;
                                  setAkEdits((prev) => ({
                                    ...prev,
                                    [latestPayment.id]: { ...prev[latestPayment.id], ak_approval: nextVal },
                                  }));
                                  if ((instData.amount1AkApproval ?? '') !== nextVal) {
                                    saveAkChanges(latestPayment, { ak_approval: nextVal });
                                  }
                                }}
                                className="w-full rounded border border-gray-custom-300 bg-white px-2 py-1 text-sm text-gray-custom-700 focus:border-primary focus:outline-none"
                              >
                                <option value="">Select</option>
                                {AK_APPROVAL_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              instData.amount1AkApproval || '-'
                            )}
                          </td>,
                          <td key={`ak-remarks-${student.id}-${instNum}`} className={paymentCellClass}>
                            {!latestPayment ? (
                              '-'
                            ) : canEditAk ? (
                              <input
                                type="text"
                                value={akEdits[latestPayment.id]?.ak_remarks ?? latestPayment.ak_remarks ?? ''}
                                disabled={!!savingPayments[latestPayment.id]}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={preventEnterSubmit}
                                onChange={(e) =>
                                  setAkEdits((prev) => ({
                                    ...prev,
                                    [latestPayment.id]: { ...prev[latestPayment.id], ak_remarks: e.target.value },
                                  }))
                                }
                                onBlur={() => {
                                  const nextVal = akEdits[latestPayment.id]?.ak_remarks ?? latestPayment.ak_remarks ?? '';
                                  if ((latestPayment.ak_remarks ?? '') !== nextVal) {
                                    saveAkChanges(latestPayment, { ak_remarks: nextVal });
                                  }
                                }}
                                className="w-full rounded border border-gray-custom-300 bg-white px-2 py-1 text-sm text-gray-custom-700 focus:border-primary focus:outline-none"
                              />
                            ) : (
                              latestPayment.ak_remarks || '-'
                            )}
                          </td>,
                          <td key={`remarks-${student.id}-${instNum}`} className={`${paymentHeaderClass} border-r-2 border-gray-custom-300`}>
                            {instData.amount1Remarks || '-'}
                          </td>,
                          <td key={`amt2-date-${student.id}-${instNum}`} className={`${paymentCellClass} border-l-2 border-gray-custom-500`}>
                            {formatDateDisplay(instData.amount2Date)}
                          </td>,
                          <td key={`amt2-${student.id}-${instNum}`} className={paymentCellClass}>
                            {instData.amount2 > 0 ? formatCurrency(instData.amount2) : '-'}
                          </td>,
                          <td key={`amt2-recv-${student.id}-${instNum}`} className={paymentCellClass}>
                            {instData.amount2ReceivedIn || '-'}
                          </td>,
                          <td key={`amt2-ak-approval-${student.id}-${instNum}`} className={paymentCellClass}>
                            {!secondPayment ? (
                              '-'
                            ) : canEditAk ? (
                              <select
                                value={akEdits[secondPayment.id]?.ak_approval ?? instData.amount2AkApproval ?? ''}
                                disabled={!!savingPayments[secondPayment.id]}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={preventEnterSubmit}
                                onChange={(e) => {
                                  const nextVal = e.target.value;
                                  setAkEdits((prev) => ({
                                    ...prev,
                                    [secondPayment.id]: { ...prev[secondPayment.id], ak_approval: nextVal },
                                  }));
                                  if ((instData.amount2AkApproval ?? '') !== nextVal) {
                                    saveAkChanges(secondPayment, { ak_approval: nextVal });
                                  }
                                }}
                                className="w-full rounded border border-gray-custom-300 bg-white px-2 py-1 text-sm text-gray-custom-700 focus:border-primary focus:outline-none"
                              >
                                <option value="">Select</option>
                                {AK_APPROVAL_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              instData.amount2AkApproval || '-'
                            )}
                          </td>,
                          <td key={`amt2-ak-remarks-${student.id}-${instNum}`} className={paymentCellClass}>
                            {!secondPayment ? (
                              '-'
                            ) : canEditAk ? (
                              <input
                                type="text"
                                value={akEdits[secondPayment.id]?.ak_remarks ?? secondPayment.ak_remarks ?? ''}
                                disabled={!!savingPayments[secondPayment.id]}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={preventEnterSubmit}
                                onChange={(e) =>
                                  setAkEdits((prev) => ({
                                    ...prev,
                                    [secondPayment.id]: { ...prev[secondPayment.id], ak_remarks: e.target.value },
                                  }))
                                }
                                onBlur={() => {
                                  const nextVal = akEdits[secondPayment.id]?.ak_remarks ?? secondPayment.ak_remarks ?? '';
                                  if ((secondPayment.ak_remarks ?? '') !== nextVal) {
                                    saveAkChanges(secondPayment, { ak_remarks: nextVal });
                                  }
                                }}
                                className="w-full rounded border border-gray-custom-300 bg-white px-2 py-1 text-sm text-gray-custom-700 focus:border-primary focus:outline-none"
                              />
                            ) : (
                              instData.amount2AkRemarks || '-'
                            )}
                          </td>,
                          <td key={`amt2-remarks-${student.id}-${instNum}`} className={`${paymentHeaderClass} border-r-2 border-gray-custom-300`}>
                            {instData.amount2Remarks || '-'}
                          </td>,
                          <td key={`amt3-date-${student.id}-${instNum}`} className={`${paymentCellClass} border-l-2 border-gray-custom-500`}>
                            {formatDateDisplay(instData.amount3Date)}
                          </td>,
                          <td key={`amt3-${student.id}-${instNum}`} className={paymentCellClass}>
                            {instData.amount3 > 0 ? formatCurrency(instData.amount3) : '-'}
                          </td>,
                          <td key={`amt3-recv-${student.id}-${instNum}`} className={paymentCellClass}>
                            {instData.amount3ReceivedIn || '-'}
                          </td>,
                          <td key={`amt3-ak-approval-${student.id}-${instNum}`} className={paymentCellClass}>
                            {!instData.payments[2] ? (
                              '-'
                            ) : canEditAk ? (
                              <select
                                value={akEdits[instData.payments[2].id]?.ak_approval ?? instData.amount3AkApproval ?? ''}
                                disabled={!!savingPayments[instData.payments[2].id]}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={preventEnterSubmit}
                                onChange={(e) => {
                                  const nextVal = e.target.value;
                                  setAkEdits((prev) => ({
                                    ...prev,
                                    [instData.payments[2].id]: { ...prev[instData.payments[2].id], ak_approval: nextVal },
                                  }));
                                  if ((instData.amount3AkApproval ?? '') !== nextVal) {
                                    saveAkChanges(instData.payments[2], { ak_approval: nextVal });
                                  }
                                }}
                                className="w-full rounded border border-gray-custom-300 bg-white px-2 py-1 text-sm text-gray-custom-700 focus:border-primary focus:outline-none"
                              >
                                <option value="">Select</option>
                                {AK_APPROVAL_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              instData.amount3AkApproval || '-'
                            )}
                          </td>,
                          <td key={`amt3-ak-remarks-${student.id}-${instNum}`} className={paymentCellClass}>
                            {!instData.payments[2] ? (
                              '-'
                            ) : canEditAk ? (
                              <input
                                type="text"
                                value={akEdits[instData.payments[2].id]?.ak_remarks ?? instData.payments[2].ak_remarks ?? ''}
                                disabled={!!savingPayments[instData.payments[2].id]}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={preventEnterSubmit}
                                onChange={(e) =>
                                  setAkEdits((prev) => ({
                                    ...prev,
                                    [instData.payments[2].id]: { ...prev[instData.payments[2].id], ak_remarks: e.target.value },
                                  }))
                                }
                                onBlur={() => {
                                  const nextVal = akEdits[instData.payments[2].id]?.ak_remarks ?? instData.payments[2].ak_remarks ?? '';
                                  if ((instData.payments[2].ak_remarks ?? '') !== nextVal) {
                                    saveAkChanges(instData.payments[2], { ak_remarks: nextVal });
                                  }
                                }}
                                className="w-full rounded border border-gray-custom-300 bg-white px-2 py-1 text-sm text-gray-custom-700 focus:border-primary focus:outline-none"
                              />
                            ) : (
                              instData.payments[2].ak_remarks || '-'
                            )}
                          </td>,
                          <td key={`amt3-remarks-${student.id}-${instNum}`} className={`${paymentHeaderClass} border-r-2 border-gray-custom-300`}>
                            {instData.amount3Remarks || '-'}
                          </td>,
                          <td key={`amt4-date-${student.id}-${instNum}`} className={`${paymentCellClass} border-l-2 border-gray-custom-500`}>
                            {formatDateDisplay(instData.amount4Date)}
                          </td>,
                          <td key={`amt4-${student.id}-${instNum}`} className={paymentCellClass}>
                            {instData.amount4 > 0 ? formatCurrency(instData.amount4) : '-'}
                          </td>,
                          <td key={`amt4-recv-${student.id}-${instNum}`} className={paymentCellClass}>
                            {instData.amount4ReceivedIn || '-'}
                          </td>,
                          <td key={`amt4-ak-approval-${student.id}-${instNum}`} className={paymentCellClass}>
                            {!instData.payments[3] ? (
                              '-'
                            ) : canEditAk ? (
                              <select
                                value={akEdits[instData.payments[3].id]?.ak_approval ?? instData.amount4AkApproval ?? ''}
                                disabled={!!savingPayments[instData.payments[3].id]}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={preventEnterSubmit}
                                onChange={(e) => {
                                  const nextVal = e.target.value;
                                  setAkEdits((prev) => ({
                                    ...prev,
                                    [instData.payments[3].id]: { ...prev[instData.payments[3].id], ak_approval: nextVal },
                                  }));
                                  if ((instData.amount4AkApproval ?? '') !== nextVal) {
                                    saveAkChanges(instData.payments[3], { ak_approval: nextVal });
                                  }
                                }}
                                className="w-full rounded border border-gray-custom-300 bg-white px-2 py-1 text-sm text-gray-custom-700 focus:border-primary focus:outline-none"
                              >
                                <option value="">Select</option>
                                {AK_APPROVAL_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              instData.amount4AkApproval || '-'
                            )}
                          </td>,
                          <td key={`amt4-ak-remarks-${student.id}-${instNum}`} className={paymentCellClass}>
                            {!instData.payments[3] ? (
                              '-'
                            ) : canEditAk ? (
                              <input
                                type="text"
                                value={akEdits[instData.payments[3].id]?.ak_remarks ?? instData.payments[3].ak_remarks ?? ''}
                                disabled={!!savingPayments[instData.payments[3].id]}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={preventEnterSubmit}
                                onChange={(e) =>
                                  setAkEdits((prev) => ({
                                    ...prev,
                                    [instData.payments[3].id]: { ...prev[instData.payments[3].id], ak_remarks: e.target.value },
                                  }))
                                }
                                onBlur={() => {
                                  const nextVal = akEdits[instData.payments[3].id]?.ak_remarks ?? instData.payments[3].ak_remarks ?? '';
                                  if ((instData.payments[3].ak_remarks ?? '') !== nextVal) {
                                    saveAkChanges(instData.payments[3], { ak_remarks: nextVal });
                                  }
                                }}
                                className="w-full rounded border border-gray-custom-300 bg-white px-2 py-1 text-sm text-gray-custom-700 focus:border-primary focus:outline-none"
                              />
                            ) : (
                              instData.payments[3].ak_remarks || '-'
                            )}
                          </td>,
                          <td key={`amt4-remarks-${student.id}-${instNum}`} className={`${paymentHeaderClass} border-r-2 border-gray-custom-300`}>
                            {instData.amount4Remarks || '-'}
                          </td>,
                        ];
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

          <div className="sticky bottom-[-15px] left-0 right-0 bg-white pt-2 border-gray-custom-300 z-30">
            <div
              className="overflow-x-auto"
              ref={barScrollRef}
              onScroll={() => syncHorizontalScroll('bar')}
            >
              <div className="h-3" style={{ width: `${scrollWidth}px` }} />
            </div>
            <div className="flex items-center justify-between pt-3">
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
