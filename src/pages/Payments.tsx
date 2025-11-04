import { useState, useMemo, useEffect, useRef } from 'react';
import { formatINR } from '../lib/currency';
import { formatDate } from '../lib/dateUtils';
import { Link } from 'react-router-dom';
import { paymentsService, PaymentListItem } from '../services/payments';
import { studentsService, StudentListItem } from '../services/students';
import { AkApprovalStatus } from '../types';
import { ChevronLeft, ChevronRight, Info, Trash, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../hooks/useAuth';
import { PAYMENT_RECEIVED_IN_OPTIONS } from '../lib/constants';
import TableSkeleton from '../components/TableSkeleton';

type PaymentTab = 'ALL' | 'Installment' | 'Other' | 'Payout';

const studentMap = new Map<string | number, StudentListItem>();

const PaymentsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<PaymentTab>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
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
  // search-only UI

  // Track last requested parameter signature to avoid duplicate fetches in StrictMode
  const lastRequestKeyRef = useRef<string | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load all payments for client-side filtering
      const { items } = await paymentsService.list({
        limit: 1000, // Load a large number to get all payments
        offset: 0,
      });
      setPayments(items);
      
      // Load all students to populate the student map
      // Use a large limit to ensure we get all students
      const { items: students } = await studentsService.list({ 
        limit: 10000, // Use a very large limit to get all students
        offset: 0, 
        q: undefined 
      });
      
      // Clear and repopulate the student map
      studentMap.clear();
      students.forEach(s => studentMap.set(s.id, s));
      
      console.log('Loaded students:', students.length);
      console.log('Student IDs from payments:', Array.from(new Set(items.map(p => p.student_id))));
      console.log('Missing student IDs:', Array.from(new Set(items.map(p => p.student_id))).filter(id => !studentMap.has(id)));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load payments');
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

  useEffect(() => {
    // Load all payments once for client-side filtering and pagination
    const key = 'initial-load';
    if (lastRequestKeyRef.current === key) return;
    lastRequestKeyRef.current = key;
    fetchPayments();
  }, []); // Only run once on mount

  // search-only UI: clear handled via manual backspace; no separate handler

  // First compute base filtered payments without applying the active tab.
  const baseFilteredPayments = useMemo(() => {
    let result = payments;
    const q = searchText.trim().toLowerCase();
    if (q) {
      result = result.filter(p => {
        const student = studentMap.get(p.student_id);
        const studentName = (student?.name || '').toLowerCase();
        const enrollment = (student?.enrollment_number || '').toLowerCase();
        const purpose = (p.purpose || '').toLowerCase();
        const remarks = (p.remarks || '').toLowerCase();
        const akRemarks = (p.ak_remarks || '').toLowerCase();
        const installmentRemarks = ((p as any).installment_remarks || '').toLowerCase();
        const paymentTypeText = (p.payment_type || '').toLowerCase();
        const receivedInText = (p.payment_recieved_in || '').toLowerCase();
        return (
          studentName.includes(q) ||
          enrollment.includes(q) ||
          purpose.includes(q) ||
          remarks.includes(q) ||
          akRemarks.includes(q) ||
          installmentRemarks.includes(q) ||
          paymentTypeText.includes(q) ||
          receivedInText.includes(q)
        );
      });
    }
    // Date filter
    if (dateFrom) {
      result = result.filter(p => new Date(p.installment_date) >= new Date(dateFrom));
    }
    if (dateTo) {
      result = result.filter(p => new Date(p.installment_date) <= new Date(dateTo));
    }
    // Bank filter: match either Received In OR Send From (including legacy alias)
    if (bankFilter) {
      const target = bankFilter.toLowerCase();
      result = result.filter(p => {
        const received = (p.payment_recieved_in || '').toLowerCase();
        const sendFrom = ((p as any).payment_send_from || (p as any).payment_sent_from || '').toLowerCase();
        return received === target || sendFrom === target;
      });
    }
    return result;
  }, [payments, searchText, dateFrom, dateTo, bankFilter]);

  // Now apply the active tab and sorting for the visible list
  const filteredPayments = useMemo(() => {
    let result = baseFilteredPayments;
    if (activeTab !== 'ALL') {
      result = result.filter(p => (p.payment_type || '').toLowerCase() === activeTab.toLowerCase());
    }
    if (sortBy) {
      result = [...result].sort((a, b) => {
        let aValue: any;
        let bValue: any;
        switch (sortBy) {
          case 'student_name':
            aValue = studentMap.get(a.student_id)?.name || '';
            bValue = studentMap.get(b.student_id)?.name || '';
            break;
          case 'date':
            aValue = new Date(a.installment_date);
            bValue = new Date(b.installment_date);
            break;
          case 'installment':
            aValue = a.installment_number || 0;
            bValue = b.installment_number || 0;
            break;
          case 'amount':
            aValue = a.amount || 0;
            bValue = b.amount || 0;
            break;
          default:
            return 0;
        }
        if (aValue < bValue) return sortDir === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [baseFilteredPayments, activeTab, sortBy, sortDir]);

  // Calculate filtered counts for tabs
  const filteredCounts = useMemo(() => {
    const allFiltered = baseFilteredPayments;
    const installmentFiltered = allFiltered.filter(p => (p.payment_type || '').toLowerCase() === 'installment');
    const otherFiltered = allFiltered.filter(p => (p.payment_type || '').toLowerCase() === 'other');
    const payoutFiltered = allFiltered.filter(p => (p.payment_type || '').toLowerCase() === 'payout');
    
    return {
      all: allFiltered.length,
      installment: installmentFiltered.length,
      other: otherFiltered.length,
      payout: payoutFiltered.length,
    };
  }, [baseFilteredPayments]);

  // Paginate the filtered results
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredPayments.slice(startIndex, endIndex);
  }, [filteredPayments, currentPage, itemsPerPage]);
  
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / itemsPerPage));

  const handleTabChange = (tab: PaymentTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown size={16} className="text-gray-custom-400" />;
    }
    return sortDir === 'asc' ? 
      <ArrowUp size={16} className="text-primary" /> : 
      <ArrowDown size={16} className="text-primary" />;
  };

  const tabs: { name: PaymentTab, label: string, count: number }[] = [
    { name: 'ALL', label: 'All Payments', count: filteredCounts.all },
    { name: 'Installment', label: 'Installment', count: filteredCounts.installment },
    { name: 'Payout', label: 'Payout', count: filteredCounts.payout },
    { name: 'Other', label: 'Other', count: filteredCounts.other },
  ];

  const renderTableForTab = () => {
    const currentPayments = paginatedPayments;
    // Use a single table with full columns for all tabs for consistency
    return (
      <AllPaymentsTable
        payments={currentPayments}
        isAdmin={isAdmin}
        onDelete={requestDelete}
        onSort={handleSort}
        getSortIcon={getSortIcon}
      />
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-custom-900 mb-6">All Payments</h1>
      <div className="rounded-lg bg-white p-6 shadow-sm">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div>
            <label htmlFor="searchInput" className="block text-sm font-medium text-gray-custom-700 mb-1">Search</label>
            <input
              type="text"
              id="searchInput"
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
              placeholder="Search (student, enrollment, purpose, remarks)"
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
        <div className="border-b border-gray-200">
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
        </div>
        <div className="mt-6">
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          {loading ? (
            <TableSkeleton rows={10} columns={isAdmin ? 13 : 12} />
          ) : filteredPayments.length === 0 ? (
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
          totalItems={filteredPayments.length}
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

const AllPaymentsTable = ({ payments, isAdmin, onDelete, onSort, getSortIcon }: { 
  payments: PaymentListItem[]; 
  isAdmin: boolean; 
  onDelete: (id: string | number) => void;
  onSort: (column: string) => void;
  getSortIcon: (column: string) => React.ReactElement;
}) => {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left">
                <thead className="bg-gray-custom-50">
                    <tr className="border-b border-gray-custom-200">
                        <th 
                          className="p-3 text-sm font-semibold text-gray-custom-500 cursor-pointer hover:text-gray-custom-700 select-none"
                          onClick={() => onSort('student_name')}
                        >
                          <div className="flex items-center gap-2">
                            Student Name
                            {getSortIcon('student_name')}
                          </div>
                        </th>
                        <th 
                          className="p-3 text-sm font-semibold text-gray-custom-500 cursor-pointer hover:text-gray-custom-700 select-none"
                          onClick={() => onSort('date')}
                        >
                          <div className="flex items-center gap-2">
                            Date
                            {getSortIcon('date')}
                          </div>
                        </th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Payment Type</th>
                        <th 
                          className="p-3 text-sm font-semibold text-gray-custom-500 cursor-pointer hover:text-gray-custom-700 select-none"
                          onClick={() => onSort('installment')}
                        >
                          <div className="flex items-center gap-2">
                            Installment
                            {getSortIcon('installment')}
                          </div>
                        </th>
                        <th 
                          className="p-3 text-sm font-semibold text-gray-custom-500 cursor-pointer hover:text-gray-custom-700 select-none"
                          onClick={() => onSort('amount')}
                        >
                          <div className="flex items-center gap-2">
                            Amount
                            {getSortIcon('amount')}
                          </div>
                        </th>
                        
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Purpose</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Received In</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Send From</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Remarks</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Installment Remarks</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">AK Approval</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">AK Remarks</th>
                        {isAdmin && (
                          <th className="p-3 text-sm font-semibold text-gray-custom-500 text-center">Actions</th>
                        )}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map(p => (
                        <tr key={p.id}>
                            <StudentCell studentId={p.student_id} paymentId={p.id} />
                            <td className="p-3 text-gray-custom-600">{formatDate(p.installment_date)}</td>
                            <td className="p-3 text-gray-custom-600">{p.payment_type || '-'}</td>
                            <td className="p-3 text-gray-custom-600 font-medium">#{p.installment_number}</td>
                            <td className="p-3 text-gray-custom-800 font-medium">{formatINR(p.amount)}</td>
                            
                            <td className="p-3 text-gray-custom-600">{p.purpose || '-'}</td>
                            <td className="p-3 text-gray-custom-600">{p.payment_recieved_in}</td>
                            <td className="p-3 text-gray-custom-600">{p.payment_send_from || (p as any).payment_sent_from || '-'}</td>
                            <td className="p-3 text-center"><RemarksTooltip remarks={p.remarks} /></td>
                            <td className="p-3 text-center"><RemarksTooltip remarks={(p as any).installment_remarks} /></td>
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
