import { useState, useMemo, useEffect, useRef } from 'react';
import { formatINR } from '../lib/currency';
import { formatDate } from '../lib/dateUtils';
import { Link } from 'react-router-dom';
import { paymentsService, PaymentListItem } from '../services/payments';
import { studentsService, StudentListItem } from '../services/students';
import { AkApprovalStatus } from '../types';
import { ChevronLeft, ChevronRight, Info, Trash } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../hooks/useAuth';
import { PAYMENT_RECEIVED_IN_OPTIONS, PAYMENT_PURPOSES, AK_APPROVAL_OPTIONS, PAYMENT_DEPARTMENTS } from '../lib/constants';
import TableSkeleton from '../components/TableSkeleton';
import ColumnFilterMenu from '../components/ColumnFilterMenu';

// type PaymentTab = 'ALL' | 'Installment' | 'Other';

const studentMap = new Map<string | number, StudentListItem>();

const PaymentsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // const [activeTab, setActiveTab] = useState<PaymentTab>('ALL');
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string | number>>(new Set());
  const [bulkApprovalStatus, setBulkApprovalStatus] = useState<AkApprovalStatus | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | number | null>(null);
  

  // Filters / Sorting
  const [searchText, setSearchText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [sortBy, setSortBy] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  
  // Load column filters from localStorage on mount
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('payments-column-filters');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  // search-only UI

  // Track last requested parameter signature to avoid duplicate fetches in StrictMode
  const lastRequestKeyRef = useRef<string | null>(null);

  // Save column filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('payments-column-filters', JSON.stringify(columnFilters));
    } catch (e) {
      console.warn('Failed to save filters to localStorage', e);
    }
  }, [columnFilters]);

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build backend column filters payload
      const filtersPayload = Object.entries(columnFilters || {}).reduce<Record<string, string[]>>((acc, [key, values]) => {
        if (!values || values.length === 0) return acc;
        acc[key] = values.map(v => v === '(Blanks)' ? '__BLANK__' : v);
        return acc;
      }, {});

      const params: any = {
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
      };

      // Send all filters to backend
      if (Object.keys(filtersPayload).length > 0) {
        params.column_filters = JSON.stringify(filtersPayload);
      }
      if (bankFilter) params.payment_recieved_in = bankFilter;
      if (dateFrom) params.installment_from = dateFrom;
      if (dateTo) params.installment_to = dateTo;
      if (searchText.trim()) params.q = searchText.trim();
      if (sortBy) {
        params.sort_by = sortBy;
        params.sort_dir = sortDir;
      }

      // Load filtered payments from backend
      const { items, total } = await paymentsService.list(params);
      setPayments(items);
      setTotal(total || 0);
      
      // Load students for display (only for current page payments)
      const studentIds = Array.from(new Set(items.map(p => p.student_id).filter(Boolean)));
      if (studentIds.length > 0) {
        // Fetch students in batches if needed
        const { items: students } = await studentsService.list({ 
          limit: 10000, // Large limit to get all students
          offset: 0, 
          q: undefined 
        });
        
        // Update student map with fetched students
        students.forEach(s => studentMap.set(s.id, s));
      }
      
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load payments');
      setPayments([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const requestDelete = (id: string | number) => {
    setSelectedPaymentId(id);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedPaymentId) return;
    setConfirming(true);
    try {
      await paymentsService.remove(selectedPaymentId);
      // Refresh all payments
      await fetchPayments();
    } finally {
      setConfirming(false);
      setConfirmOpen(false);
      setSelectedPaymentId(null);
    }
  };

  // Reset to page 1 when filters, search, or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [columnFilters, bankFilter, dateFrom, dateTo, searchText, sortBy, sortDir]);

  useEffect(() => {
    // Reload from backend whenever filters, search, sort, or page changes
    const key = JSON.stringify({ columnFilters, bankFilter, dateFrom, dateTo, searchText, sortBy, sortDir, currentPage });
    if (lastRequestKeyRef.current === key) return;
    lastRequestKeyRef.current = key;
    fetchPayments();
  }, [columnFilters, bankFilter, dateFrom, dateTo, searchText, sortBy, sortDir, currentPage]);

  // search-only UI: clear handled via manual backspace; no separate handler

  const normalizeValue = (value?: string | number | null) => {
    const str = value === null || value === undefined ? '' : String(value).trim();
    return str || '(Blanks)';
  };

  const columnValueGetters: Record<string, (p: PaymentListItem) => string> = {
    student_name: (p) => normalizeValue(studentMap.get(p.student_id)?.name || ''),
    date: (p) => normalizeValue(formatDate(p.installment_date)),
    payment_type: (p) => normalizeValue(p.payment_type),
    installment: (p) => normalizeValue(p.installment_number),
    amount: (p) => normalizeValue(p.amount),
    purpose: (p) => normalizeValue(p.purpose),
    payment_recieved_in: (p) => normalizeValue(p.payment_recieved_in),
    remarks: (p) => normalizeValue(p.remarks),
    ak_approval: (p) => normalizeValue(p.ak_approval),
    ak_remarks: (p) => normalizeValue(p.ak_remarks),
  };

  const columnOptions = useMemo(() => {
    const build = (seed: readonly string[], getter: (p: PaymentListItem) => string) => {
      return Array.from(new Set([...seed.map(normalizeValue), ...payments.map(getter)])).sort((a, b) => a.localeCompare(b));
    };
    return {
      student_name: [],
      date: [],
      payment_type: build(PAYMENT_DEPARTMENTS, columnValueGetters.payment_type),
      installment: [],
      amount: [],
      purpose: build(PAYMENT_PURPOSES, columnValueGetters.purpose),
      payment_recieved_in: build(PAYMENT_RECEIVED_IN_OPTIONS, columnValueGetters.payment_recieved_in),
      remarks: [],
      ak_approval: build(AK_APPROVAL_OPTIONS, columnValueGetters.ak_approval),
      ak_remarks: [],
    };
  }, [payments]);

  // All filtering is now done on the backend
  // Payments returned from backend are already filtered and sorted
  const filteredPayments = payments;
  
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));

  // const handleTabChange = (tab: PaymentTab) => {
  //   setActiveTab(tab);
  //   setCurrentPage(1);
  // };

  const handleColumnFilterChange = (column: string, values: string[]) => {
    setColumnFilters(prev => ({ ...prev, [column]: values }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleClearAllFilters = () => {
    setColumnFilters({});
    setCurrentPage(1);
    try {
      localStorage.removeItem('payments-column-filters');
    } catch (e) {
      console.warn('Failed to clear filters from localStorage', e);
    }
  };

  const hasActiveFilters = useMemo(() => {
    return Object.values(columnFilters).some(values => values && values.length > 0);
  }, [columnFilters]);

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

  // const tabs: { name: PaymentTab, label: string, count: number }[] = [
  //   { name: 'ALL', label: 'All Payments', count: filteredCounts.all },
  //   { name: 'Installment', label: 'Installment', count: filteredCounts.installment },
  //   { name: 'Other', label: 'Other', count: filteredCounts.other },
  // ];

  
  const handleSelectPayment = (id: string | number, checked: boolean) => {
    setSelectedPaymentIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return newSet;
    });
  };

    const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPaymentIds(new Set(payments.map(p => p.id)));
    } else {
      setSelectedPaymentIds(new Set());
    }
  };

    const handleBulkUpdate = async () => {
    if (!bulkApprovalStatus || selectedPaymentIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const updates = Array.from(selectedPaymentIds).map(id =>
        paymentsService.update(id, { ak_approval: bulkApprovalStatus })
      );
      await Promise.all(updates);
      setSelectedPaymentIds(new Set());
      setBulkApprovalStatus(null);
      await fetchPayments();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update approvals');
    } finally {
      setBulkUpdating(false);
    }
  };

  useEffect(() => {
    setSelectedPaymentIds(new Set());
  }, [columnFilters, bankFilter, dateFrom, dateTo, searchText, sortBy, sortDir, currentPage]);


  const renderTableForTab = () => {
    // Payments are already filtered and paginated by backend
    return (
      <AllPaymentsTable
        payments={filteredPayments}
        isAdmin={isAdmin}
        onDelete={requestDelete}
        onSort={handleSort}
        columnOptions={columnOptions}
        columnFilters={columnFilters}
        onFilterChange={handleColumnFilterChange}
        sortBy={sortBy}
        sortDir={sortDir}
        selectedPaymentIds={selectedPaymentIds}
        onSelectPayment={handleSelectPayment}
        onSelectAll={handleSelectAll}
      />
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-custom-900 mb-6">All Payments</h1>
      <div className="rounded-lg bg-white p-6 shadow-sm">
        {/* Filters */}
        <div className="flex items-end justify-between mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
          <div>
            <label htmlFor="searchInput" className="block text-sm font-medium text-gray-custom-700 mb-1">Search</label>
            <input
              type="text"
              id="searchInput"
              value={searchText}
              onChange={(e) => { 
                setSearchText(e.target.value); 
                setCurrentPage(1); 
              }}
              placeholder="Search (student, enrollment, purpose, remarks, accounting remarks)"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-custom-700 mb-1">From Date</label>
            <input
              type="date"
              id="dateFrom"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="dateTo" className="block text-sm font-medium text-gray-custom-700 mb-1">To Date</label>
            <input
              type="date"
              id="dateTo"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="bankFilter" className="block text-sm font-medium text-gray-custom-700 mb-1">Bank</label>
            <select
              id="bankFilter"
              value={bankFilter}
              onChange={(e) => { setBankFilter(e.target.value); setCurrentPage(1); }}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Banks</option>
              {PAYMENT_RECEIVED_IN_OPTIONS.map(bank => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
          </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleClearAllFilters}
              className="ml-4 rounded-md border border-gray-custom-300 bg-white px-4 py-2 text-sm font-semibold text-gray-custom-700 hover:bg-gray-custom-50 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
        {/* Tabs hidden per request; showing all payments only */}
        {/* <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.name}
                onClick={() => handleTabChange(tab.name)}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.name
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label} <span className="ml-1.5 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">{tab.count}</span>
              </button>
            ))}
          </nav>
        </div> */}

        {/* bulk selection of payments and update the AK approval in one action */}

        {selectedPaymentIds.size > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex gap-10">
              <div>
                <p className="text-sm font-semibold text-gray-custom-900">
                  {selectedPaymentIds.size} student{selectedPaymentIds.size !== 1 ? 's' : ''} selected
                </p>
                <p className="text-sm text-gray-custom-600">Update Ak's Approval</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label htmlFor="bulkApprovalStatus" className="sr-only">AK Approval Status</label>
                <select
                  id="bulkApprovalStatus"
                  value={bulkApprovalStatus ?? ''}
                  onChange={(e) => setBulkApprovalStatus(e.target.value as AkApprovalStatus)}
                  className="rounded-md border border-gray-custom-300 bg-white px-3 py-2 text-sm text-gray-custom-900 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select AK approval</option>
                  {AK_APPROVAL_OPTIONS.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <button
                  onClick={handleBulkUpdate}
                  disabled={!bulkApprovalStatus || bulkUpdating}
                  className="min-w-[180px] rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkUpdating ? 'Applying...' : 'Apply to selected'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6">
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          {loading ? (
            <TableSkeleton rows={10} columns={isAdmin ? 10 : 9} />
          ) : payments.length === 0 ? (
            <div className="text-center text-gray-custom-500 py-8">No records found.</div>
          ) : (
            renderTableForTab()
          )}
        </div>
        <ConfirmDialog
          open={confirmOpen}
          title="Delete payment?"
          description={`This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleDelete}
          onCancel={() => { if (!confirming) { setConfirmOpen(false); setSelectedPaymentId(null); } }}
          confirming={confirming}
        />
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={total}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </div>
  );
};

// --- Reusable Components for Payments Page ---

const RemarksTooltip = ({ remarks }: { remarks?: string }) => {
  if (!remarks) return <span className="text-gray-custom-400">-</span>;
  return (
    <div className="group relative flex items-center justify-center">
      <Info size={16} className="text-gray-custom-500 cursor-pointer" />
      <div className="absolute bottom-full z-10 mb-2 hidden w-64 rounded-md bg-gray-custom-800 p-2 text-xs text-white group-hover:block">
        {remarks}
      </div>
    </div>
  );
};

const ApprovalStatusBadge = ({ status }: { status: AkApprovalStatus }) => {
  const statusStyles: Record<AkApprovalStatus, string> = {
    'Completed': 'bg-green-100 text-green-800',
    'No': 'bg-red-100 text-red-800',
    'Partial': 'bg-yellow-100 text-yellow-800',
    'Suspense': 'bg-gray-100 text-gray-800',
  };
  return <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status]}`}>{status}</span>;
}

const StudentCell = ({ studentId, paymentId }: { studentId: string | number; paymentId?: string | number }) => {
    const student = studentMap.get(studentId);
    if (!student) {
      console.warn(`Student not found for ID: ${studentId} (type: ${typeof studentId})`);
      console.log('Available student IDs:', Array.from(studentMap.keys()));
      return <td className="p-3 text-gray-custom-600">Unknown Student</td>;
    }

    return (
        <td className="p-3">
            <Link to={`/students/${student.id}`} state={paymentId ? { highlightPaymentId: paymentId } : undefined} className="group flex items-center gap-3">
                <div className="font-medium text-gray-custom-800 group-hover:text-primary group-hover:underline">{student.name}</div>
            </Link>
        </td>
    );
};

const PaginationControls = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }: any) => {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="flex items-center justify-between pt-4 mt-4 border-t">
          <p className="text-sm text-gray-custom-600">
            Showing {startItem}-{endItem} of {totalItems}
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex items-center gap-1 rounded-md border bg-white px-3 py-1.5 text-sm font-medium text-gray-custom-600 hover:bg-gray-custom-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button 
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 rounded-md border bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
    );
};

// --- Table Components ---

const AllPaymentsTable = ({
  payments,
  isAdmin,
  onDelete,
  onSort,
  columnOptions,
  columnFilters,
  onFilterChange,
  sortBy,
  sortDir,
  selectedPaymentIds,
  onSelectPayment,
  onSelectAll,
}: { 
  payments: PaymentListItem[]; 
  isAdmin: boolean; 
  onDelete: (id: string | number) => void;
  onSort: (column: string, dir?: 'asc' | 'desc') => void;
  columnOptions: Record<string, string[]>;
  columnFilters: Record<string, string[]>;
  onFilterChange: (column: string, values: string[]) => void;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  selectedPaymentIds: Set<string | number>;
  onSelectPayment: (id: string | number, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
}) => {
    const allSelected = payments.length > 0 && payments.every(p => selectedPaymentIds.has(p.id));
    const someSelected = payments.some(p => selectedPaymentIds.has(p.id));
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left">
                <thead className="bg-gray-custom-50">
                    <tr className="border-b border-gray-custom-200">
                      <th className="p-3 text-sm font-semibold text-gray-custom-500">
                         <label htmlFor="">Select ALL</label>
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected && !allSelected;
                            }}
                            onChange={(e) => onSelectAll(e.target.checked)}
                            className="rounded ml-5 border-gray-custom-300"
                          />
                         
                        </th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500 select-none">
                          <ColumnFilterMenu
                            label="Student Name"
                            options={[]}
                            selectedValues={[]}
                            onApply={() => {}}
                            onSort={(dir) => onSort('student_name', dir)}
                            sortDir={sortBy === 'student_name' ? sortDir : null}
                            enableOptions={false}
                          />
                        </th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500 select-none">
                          <ColumnFilterMenu
                            label="Date"
                            options={[]}
                            selectedValues={columnFilters.date || []}
                            onApply={(values) => onFilterChange('date', values)}
                            onSort={(dir) => onSort('date', dir)}
                            sortDir={sortBy === 'date' ? sortDir : null}
                            enableOptions={false}
                            isDate
                            rangeType="date"
                          />
                        </th>
                        {/* <th className="p-3 text-sm font-semibold text-gray-custom-500 select-none">
                          <ColumnFilterMenu
                            label="Payment Type"
                            options={columnOptions.payment_type || []}
                            selectedValues={columnFilters.payment_type || []}
                            onApply={(values) => onFilterChange('payment_type', values)}
                            onSort={(dir) => onSort('payment_type', dir)}
                            sortDir={sortBy === 'payment_type' ? sortDir : null}
                            enableOptions={true}
                          />
                        </th> */}
                        <th className="p-3 text-sm font-semibold text-gray-custom-500 select-none">
                          <ColumnFilterMenu
                            label="Installment"
                            options={[]}
                            selectedValues={columnFilters.installment || []}
                            onApply={(values) => onFilterChange('installment', values)}
                            onSort={(dir) => onSort('installment', dir)}
                            sortDir={sortBy === 'installment' ? sortDir : null}
                            enableOptions={false}
                            rangeType="number"
                          />
                        </th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500 select-none">
                          <ColumnFilterMenu
                            label="Amount"
                            options={[]}
                            selectedValues={columnFilters.amount || []}
                            onApply={(values) => onFilterChange('amount', values)}
                            onSort={(dir) => onSort('amount', dir)}
                            sortDir={sortBy === 'amount' ? sortDir : null}
                            enableOptions={false}
                            rangeType="number"
                          />
                        </th>
                        
                        <th className="p-3 text-sm font-semibold text-gray-custom-500 select-none">
                          <ColumnFilterMenu
                            label="Purpose"
                            options={columnOptions.purpose || []}
                            selectedValues={columnFilters.purpose || []}
                            onApply={(values) => onFilterChange('purpose', values)}
                            onSort={(dir) => onSort('purpose', dir)}
                            sortDir={sortBy === 'purpose' ? sortDir : null}
                            enableOptions={true}
                          />
                        </th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500 select-none">
                          <ColumnFilterMenu
                            label="Received In"
                            options={columnOptions.payment_recieved_in || []}
                            selectedValues={columnFilters.payment_recieved_in || []}
                            onApply={(values) => onFilterChange('payment_recieved_in', values)}
                            onSort={(dir) => onSort('payment_recieved_in', dir)}
                            sortDir={sortBy === 'payment_recieved_in' ? sortDir : null}
                            enableOptions={true}
                          />
                        </th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500 select-none">
                          <ColumnFilterMenu
                            label="Remarks"
                            options={[]}
                            selectedValues={[]}
                            onApply={() => {}}
                            onSort={(dir) => onSort('remarks', dir)}
                            sortDir={sortBy === 'remarks' ? sortDir : null}
                            enableOptions={false}
                          />
                        </th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500 select-none">
                          <ColumnFilterMenu
                            label="AK Approval"
                            options={columnOptions.ak_approval || []}
                            selectedValues={columnFilters.ak_approval || []}
                            onApply={(values) => onFilterChange('ak_approval', values)}
                            onSort={(dir) => onSort('ak_approval', dir)}
                            sortDir={sortBy === 'ak_approval' ? sortDir : null}
                            enableOptions={true}
                          />
                        </th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500 select-none">
                          <ColumnFilterMenu
                            label="AK Remarks"
                            options={[]}
                            selectedValues={[]}
                            onApply={() => {}}
                            onSort={(dir) => onSort('ak_remarks', dir)}
                            sortDir={sortBy === 'ak_remarks' ? sortDir : null}
                            enableOptions={false}
                          />
                        </th>
                        {isAdmin && (
                          <th className="p-3 text-sm font-semibold text-gray-custom-500 text-center">Actions</th>
                        )}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map(p => (
                        <tr key={p.id}>
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={selectedPaymentIds.has(p.id)}
                                onChange={(e) => onSelectPayment(p.id, e.target.checked)}
                                className="rounded ml-5 border-gray-custom-300"
                              />
                            </td>
                            <StudentCell studentId={p.student_id} paymentId={p.id} />
                            <td className="p-3 text-gray-custom-600">{formatDate(p.installment_date)}</td>
                            {/* <td className="p-3 text-gray-custom-600">{p.payment_type || '-'}</td> */}
                            <td className="p-3 text-gray-custom-600 font-medium">#{p.installment_number}</td>
                            <td className="p-3 text-gray-custom-800 font-medium">{formatINR(p.amount)}</td>
                            
                            <td className="p-3 text-gray-custom-600">{p.purpose || '-'}</td>
                            <td className="p-3 text-gray-custom-600">{p.payment_recieved_in}</td>
                            <td className="p-3 text-center"><RemarksTooltip remarks={p.remarks} /></td>
                            <td className="p-3">{p.ak_approval ? <ApprovalStatusBadge status={p.ak_approval as AkApprovalStatus} /> : <span className="text-gray-custom-400">-</span>}</td>
                            <td className="p-3 text-center"><RemarksTooltip remarks={p.ak_remarks} /></td>
                            {isAdmin && (
                              <td className="p-3 text-center space-x-2">
                                  <Link to={`/students/${p.student_id}/payments/${p.id}/edit`} state={{ payment: p }} onClick={() => { try { localStorage.setItem('last-payment', JSON.stringify(p)); } catch {} }} className="inline-flex items-center justify-center px-2 py-1 text-sm font-medium text-primary hover:underline">
                                      Edit
                                  </Link>
                                  <button onClick={() => onDelete(p.id)} className="inline-flex items-center justify-center px-2 py-1 text-sm font-medium text-red-600 hover:underline">
                                    <Trash size={14} className="mr-1" /> Delete
                                  </button>
                              </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// Deprecated specialized tables removed in favor of AllPaymentsTable for consistency across tabs

export default PaymentsPage;
