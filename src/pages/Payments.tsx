import { useState, useMemo, useEffect } from 'react';
import { formatINR } from '../lib/currency';
import { Link } from 'react-router-dom';
import { paymentsService, PaymentListItem } from '../services/payments';
import { studentsService, StudentListItem } from '../services/students';
import { AkApprovalStatus } from '../types';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';

type PaymentTab = 'ALL' | 'Application' | 'CIMEA' | 'Legal';

const studentMap = new Map<string | number, StudentListItem>();

const PaymentsPage = () => {
  const [activeTab, setActiveTab] = useState<PaymentTab>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const { items, total } = await paymentsService.list({
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
      });
      setPayments(items);
      setTotal(total);
      // Preload minimal student map
      const studentIds = Array.from(new Set(items.map(p => p.student_id)));
      const { items: students } = await studentsService.list({ limit: studentIds.length, offset: 0, q: undefined });
      students.forEach(s => studentMap.set(s.id, s));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, [currentPage]);

  const filteredPayments = useMemo(() => {
    if (activeTab === 'ALL') return payments;
    return payments.filter(p => (p.payment_type || '').toLowerCase() === activeTab.toLowerCase());
  }, [activeTab, payments]);

  const paginatedPayments = filteredPayments;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));

  const handleTabChange = (tab: PaymentTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const applicationPayments = payments.filter(p => (p.payment_type || '').toLowerCase() === 'application');
  const cimeaPayments = payments.filter(p => (p.payment_type || '').toLowerCase() === 'cimea');
  const legalPayments = payments.filter(p => (p.payment_type || '').toLowerCase() === 'legal');

  const tabs: { name: PaymentTab, label: string, count: number }[] = [
    { name: 'ALL', label: 'All Payments', count: total },
    { name: 'Application', label: 'Application', count: applicationPayments.length },
    { name: 'CIMEA', label: 'CIMEA', count: cimeaPayments.length },
    { name: 'Legal', label: 'Legal', count: legalPayments.length },
  ];

  const renderTableForTab = () => {
    const currentPayments = paginatedPayments;
    switch (activeTab) {
      case 'ALL':
        return <AllPaymentsTable payments={currentPayments} />;
      case 'Application':
        return <ApplicationTable payments={currentPayments} />;
      case 'CIMEA':
        return <CimeaTable payments={currentPayments} />;
      case 'Legal':
        return <LegalTable payments={currentPayments} />;
      default:
        return null;
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-custom-900 mb-6">All Payments</h1>
      <div className="rounded-lg bg-white p-6 shadow-sm">
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
          {loading && <p className="text-sm text-gray-custom-500 mb-4">Loading…</p>}
          {renderTableForTab()}
        </div>
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
    'Yes': 'bg-green-100 text-green-800',
    'No': 'bg-red-100 text-red-800',
    'Yes-P': 'bg-yellow-100 text-yellow-800',
    'Suspense': 'bg-gray-100 text-gray-800',
  };
  return <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status]}`}>{status}</span>;
}

const StudentCell = ({ studentId }: { studentId: string | number }) => {
    const student = studentMap.get(studentId);
    if (!student) return <td className="p-3 text-gray-custom-600">Unknown Student</td>;

    return (
        <td className="p-3">
            <Link to={`/students/${student.id}`} className="group flex items-center gap-3">
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

const AllPaymentsTable = ({ payments }: { payments: PaymentListItem[] }) => (
    <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
            <thead className="bg-gray-custom-50">
                <tr className="border-b border-gray-custom-200">
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Student Name</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Date</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Payment Type</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Amount</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Details</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Received In</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {payments.map(p => (
                    <tr key={p.id}>
                        <StudentCell studentId={p.student_id} />
                        <td className="p-3 text-gray-custom-600">{p.installment_date}</td>
                        <td className="p-3 text-gray-custom-600">{p.payment_type || '-'}</td>
                        <td className="p-3 text-gray-custom-800 font-medium">{formatINR(p.amount)}</td>
                        <td className="p-3 text-gray-custom-600">{p.purpose ? p.purpose : (p.ak_approval ? <ApprovalStatusBadge status={p.ak_approval as AkApprovalStatus} /> : '-')}</td>
                        <td className="p-3 text-gray-custom-600">{p.payment_recieved_in}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const ApplicationTable = ({ payments }: { payments: PaymentListItem[] }) => (
    <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left">
            <thead className="bg-gray-custom-50">
                <tr className="border-b border-gray-custom-200">
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Student Name</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Date</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Amount</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">AK's Approval</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Received In</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">App. Remarks</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">AK's Remarks</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Acc. Remarks</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {payments.map(p => (
                    <tr key={p.id}>
                        <StudentCell studentId={p.student_id} />
                        <td className="p-3 text-gray-custom-600">{p.installment_date}</td>
                        <td className="p-3 text-gray-custom-600">{formatINR(p.amount)}</td>
                        <td className="p-3"><ApprovalStatusBadge status={p.ak_approval as AkApprovalStatus} /></td>
                        <td className="p-3 text-gray-custom-600">{p.payment_recieved_in}</td>
                        <td className="p-3 text-center"><RemarksTooltip remarks={undefined} /></td>
                        <td className="p-3 text-center"><RemarksTooltip remarks={p.ak_remarks} /></td>
                        <td className="p-3 text-center"><RemarksTooltip remarks={undefined} /></td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const SharedPaymentsTable = ({ payments }: { payments: PaymentListItem[] }) => (
    <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
            <thead className="bg-gray-custom-50">
                <tr className="border-b border-gray-custom-200">
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Student Name</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Date</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Purpose</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Amount</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Received In</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Remarks</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {payments.map(p => (
                    <tr key={p.id}>
                        <StudentCell studentId={p.student_id} />
                        <td className="p-3 text-gray-custom-600">{p.installment_date}</td>
                        <td className="p-3 text-gray-custom-800 font-medium">{p.purpose}</td>
                        <td className="p-3 text-gray-custom-600">{formatINR(p.amount)}</td>
                        <td className="p-3 text-gray-custom-600">{p.payment_recieved_in}</td>
                        <td className="p-3 text-center"><RemarksTooltip remarks={p.remarks} /></td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const CimeaTable = ({ payments }: { payments: PaymentListItem[] }) => <SharedPaymentsTable payments={payments} />;
const LegalTable = ({ payments }: { payments: PaymentListItem[] }) => <SharedPaymentsTable payments={payments} />;

export default PaymentsPage;
