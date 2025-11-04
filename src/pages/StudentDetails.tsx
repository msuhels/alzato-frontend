import { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { AkApprovalStatus } from '../types';
import { formatINR } from '../lib/currency';
import { formatDate } from '../lib/dateUtils';
import { studentsService } from '../services/students';
import { paymentsService, PaymentListItem } from '../services/payments';
import { Plus, Edit, Trash2, Info, Pencil } from 'lucide-react';
import { STUDENT_CATEGORIES, ZONES, ASSOCIATE_WISE_INSTALLMENTS } from '../lib/constants';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../hooks/useAuth';

const Avatar = ({ name, size = 'lg' }: { name: string; size?: 'lg' | 'sm' }) => {
  const avatarColors = ['bg-orange-400', 'bg-pink-500', 'bg-blue-500', 'bg-green-500', 'bg-indigo-500', 'bg-red-500'];
  const code = name.charCodeAt(name.length - 1);
  const color = avatarColors[code % avatarColors.length];
  const sizeClasses = size === 'lg' ? 'h-24 w-24 text-4xl' : 'h-10 w-10';
  const avatarFallback = name.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase();
  
  return (
    <div className={`flex items-center justify-center rounded-full font-bold text-white ${color} ${sizeClasses}`}>
      {avatarFallback}
    </div>
  );
};

const RemarksTooltip = ({ remarks }: { remarks?: string }) => {
  if (!remarks) return <span className="text-gray-custom-400">-</span>;
  return (
    <div className="group relative flex items-center">
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

type PaymentTab = 'ALL' | 'Installment' | 'Other' | 'Payout';

const StudentDetailsPage = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<PaymentTab>('ALL');
  const [studentName, setStudentName] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [zone, setZone] = useState<string>('');
  const [intakeYear, setIntakeYear] = useState<string>('');
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
  const [associateWiseInstallments, setAssociateWiseInstallments] = useState<string>('');
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);
  const [paymentDeleting, setPaymentDeleting] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | number | null>(null);
  const [highlightedPaymentId, setHighlightedPaymentId] = useState<string | number | null>(null);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [netAmount, setNetAmount] = useState<number>(0);
  const [totalPayoutAmount, setTotalPayoutAmount] = useState<number>(0);

  const loadedRef = useRef(false);
  const fetchPaymentsForStudent = async () => {
    if (!studentId) return;
    try {
      const paymentsRes = await paymentsService.list({ limit: 100, offset: 0, student_id: studentId });
      setPayments(paymentsRes.items || []);
      // Also refresh rollup fields from backend so header cards match list view
      try {
        const { student } = await studentsService.get(studentId);
        setTotalAmount(Number(student?.total_amount || 0));
        const receivedRaw = (student?.recieved_amount ?? student?.received_amount ?? 0);
        setReceivedAmount(Number(receivedRaw));
        setTotalPayoutAmount(Number(student?.total_payout_amount || 0));
        const netRaw = (student?.net_amount ?? 0);
        setNetAmount(Number(netRaw));
      } catch {}
    } catch {}
  };

  useEffect(() => {
    if (loadedRef.current) return; // guard against duplicate in StrictMode
    loadedRef.current = true;
    async function load() {
      if (!studentId) return;
      try {
        const [{ student }, paymentsRes] = await Promise.all([
          studentsService.get(studentId),
          paymentsService.list({ limit: 100, offset: 0, student_id: studentId }),
        ]);
        setStudentName(student?.name || '');
        setCategory(student?.category || '');
        setZone(student?.zone || '');
        setIntakeYear(student?.intake_year || '');
        setAssociateWiseInstallments(student?.associate_wise_installments || '');
        setTotalAmount(Number(student?.total_amount || 0));
        // Read the DB field exactly (recieved_amount), fallback to received_amount if present
        const receivedRaw = (student?.recieved_amount ?? student?.received_amount ?? 0);
        setReceivedAmount(Number(receivedRaw));
        const netRaw = (student?.net_amount ?? 0);
        setNetAmount(Number(netRaw));
        setTotalPayoutAmount(Number(student?.total_payout_amount || 0));
        setPayments(paymentsRes.items || []);
        const stateHighlight = (location as any)?.state?.highlightPaymentId;
        if (stateHighlight) {
          setHighlightedPaymentId(stateHighlight);
        }
      } catch {}
    }
    load();
  }, [studentId]);

  useEffect(() => {
    if (!highlightedPaymentId) return;
    const el = document.getElementById(`payment-${highlightedPaymentId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedPaymentId, payments]);

  const sortByInstallmentAsc = (list: PaymentListItem[]) => {
    return [...list].sort((a, b) => {
      const ai = a.installment_number ?? Number.MAX_SAFE_INTEGER;
      const bi = b.installment_number ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      const ad = new Date(a.installment_date).getTime();
      const bd = new Date(b.installment_date).getTime();
      return ad - bd;
    });
  };

  const installmentPayments = useMemo(() => sortByInstallmentAsc(payments.filter(p => (p.payment_type || '').toLowerCase() === 'installment')), [payments]);
  const otherPayments = useMemo(() => sortByInstallmentAsc(payments.filter(p => (p.payment_type || '').toLowerCase() === 'other')), [payments]);
  const payoutPayments = useMemo(() => payments.filter(p => (p.payment_type || '').toLowerCase() === 'payout'), [payments]);

  const groupedSortedAll = useMemo(() => {
    const order: Record<string, number> = { installment: 0, other: 1, payout: 2 };
    const clone = [...payments];
    return clone.sort((a, b) => {
      const ta = (a.payment_type || '').toLowerCase();
      const tb = (b.payment_type || '').toLowerCase();
      const ga = order[ta] ?? 99;
      const gb = order[tb] ?? 99;
      if (ga !== gb) return ga - gb;
      const ai = a.installment_number ?? Number.MAX_SAFE_INTEGER;
      const bi = b.installment_number ?? Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      const ad = new Date(a.installment_date).getTime();
      const bd = new Date(b.installment_date).getTime();
      return ad - bd;
    });
  }, [payments]);


  const requestPaymentDelete = (id: string | number) => {
    if (!isAdmin) return;
    setSelectedPaymentId(id);
    setPaymentConfirmOpen(true);
  };

  const handlePaymentDelete = async () => {
    if (!selectedPaymentId) return;
    setPaymentDeleting(true);
    try {
      await paymentsService.remove(selectedPaymentId);
      await fetchPaymentsForStudent();
    } finally {
      setPaymentDeleting(false);
      setPaymentConfirmOpen(false);
      setSelectedPaymentId(null);
    }
  };

  if (!studentId) {
    return <div className="text-center">Student not found. <Link to="/students" className="text-primary">Go back</Link></div>;
  }

  const tabs: { name: PaymentTab, label: string, count: number }[] = [
    { name: 'ALL', label: 'All Payments', count: payments.length },
    { name: 'Installment', label: `Installment`, count: installmentPayments.length },
    { name: 'Payout', label: `Payout`, count: payoutPayments.length },
    { name: 'Other', label: `Other`, count: otherPayments.length },
  ];

  return (
    <div className="space-y-8">
      {/* Student Info Card */}
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-6 md:flex-row">
          <Avatar name={studentName} size="lg" />
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-bold text-gray-custom-900">{studentName}</h1>
            <p className="text-gray-custom-500"></p>
            <div className="mt-2 flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-1 text-sm text-gray-custom-600">
              <span>{category}</span>
              <span className="hidden md:inline">&bull;</span>
              <span>{zone} Zone</span>
              <span className="hidden md:inline">&bull;</span>
              <span>Intake {intakeYear ? new Date(intakeYear).getFullYear() : '-'}</span>
              {associateWiseInstallments && (
                <>
                  <span className="hidden md:inline">&bull;</span>
                  <span>Assoc. Installments: {associateWiseInstallments}</span>
                </>
              )}
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-gray-custom-200 p-3">
                <p className="text-xs text-gray-custom-500">Total Amount</p>
                <p className="text-lg font-semibold text-gray-custom-900">{formatINR(totalAmount)}</p>
              </div>
              <div className="rounded-lg border border-gray-custom-200 p-3">
                <p className="text-xs text-gray-custom-500">Received Amount</p>
                <p className="text-lg font-semibold text-gray-custom-900">{formatINR(receivedAmount)}</p>
              </div>
              <div className="rounded-lg border border-gray-custom-200 p-3">
                <p className="text-xs text-gray-custom-500">Total Payout Amount</p>
                <p className="text-lg font-semibold text-gray-custom-900">{formatINR(totalPayoutAmount)}</p>
              </div>
              <div className="rounded-lg border border-gray-custom-200 p-3">
                <p className="text-xs text-gray-custom-500">Net Pending</p>
                <p className="text-lg font-semibold text-gray-custom-900">{formatINR(netAmount)}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <button onClick={() => setShowEdit(true)} className="rounded-lg p-2 hover:bg-gray-custom-100"><Edit className="h-5 w-5 text-gray-custom-600" /></button>
            )}
            {user?.role !== 'user' && (
              <button onClick={() => setConfirmOpen(true)} className="rounded-lg p-2 hover:bg-gray-custom-100"><Trash2 className="h-5 w-5 text-red-500" /></button>
            )}
          </div>
        </div>
        <ConfirmDialog
          open={confirmOpen}
          title="Delete student?"
          description="This action cannot be undone. The student will be permanently removed."
          confirmText="Delete"
          cancelText="Cancel"
          confirming={deleting}
          onConfirm={async () => {
            if (!studentId) return;
            setDeleting(true);
            try {
              await studentsService.remove(studentId);
              navigate('/students');
            } finally {
              setDeleting(false);
              setConfirmOpen(false);
            }
          }}
          onCancel={() => { if (!deleting) setConfirmOpen(false); }}
        />
        {showEdit && (
            <EditStudentModal
            initial={{ name: studentName, email: '', phone: '', category, zone, intakeYear, associateWiseInstallments }}
            onClose={() => setShowEdit(false)}
            onSave={async (values) => {
              if (!studentId) return;
              setSaving(true);
              try {
                await studentsService.update(studentId, {
                  name: values.name,
                  email: values.email || undefined,
                  phone: values.phone || undefined,
                  category: values.category || undefined,
                  zone: values.zone || undefined,
                  intake_year: values.intakeYear || undefined,
                  associate_wise_installments: values.associateWiseInstallments || undefined,
                });
                setStudentName(values.name);
                setCategory(values.category || '');
                setZone(values.zone || '');
                setIntakeYear(values.intakeYear || '');
                setAssociateWiseInstallments(values.associateWiseInstallments || '');
                setShowEdit(false);
              } finally {
                setSaving(false);
              }
            }}
            saving={saving}
          />
        )}
      </div>

      {/* Payment History */}
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-custom-900 mb-4 md:mb-0">Payment History</h2>
              <button onClick={() => navigate(`/students/${studentId}/payments/new`)} className="flex items-center justify-center gap-2 rounded-lg bg-primary py-2 px-4 text-white font-semibold hover:bg-primary-dark transition-colors">
            <Plus size={20} />
            <span>Add Payment</span>
          </button>
        </div>
        
        <div>
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
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
            {payments.length === 0 && <p className="text-center text-gray-500 py-8">No payment records found for this student.</p>}
            {payments.length > 0 && (
              <>
                {activeTab === 'ALL' && <AllPaymentsTable payments={groupedSortedAll} highlightedPaymentId={highlightedPaymentId} isAdmin={isAdmin} onDelete={requestPaymentDelete} />}
                {activeTab === 'Installment' && (installmentPayments.length > 0 ? <SharedPaymentsTable payments={installmentPayments} highlightedPaymentId={highlightedPaymentId} isAdmin={isAdmin} onDelete={requestPaymentDelete} /> : <NoPaymentsForTab />)}
                {activeTab === 'Other' && (otherPayments.length > 0 ? <SharedPaymentsTable payments={otherPayments} highlightedPaymentId={highlightedPaymentId} isAdmin={isAdmin} onDelete={requestPaymentDelete} /> : <NoPaymentsForTab />)}
                {activeTab === 'Payout' && (payoutPayments.length > 0 ? <SharedPaymentsTable payments={payoutPayments} highlightedPaymentId={highlightedPaymentId} isAdmin={isAdmin} onDelete={requestPaymentDelete} /> : <NoPaymentsForTab />)}
                {activeTab === 'Installment' && (installmentPayments.length > 0 ? <SharedPaymentsTable payments={installmentPayments} highlightedPaymentId={highlightedPaymentId} isAdmin={isAdmin} onDelete={requestPaymentDelete} /> : <NoPaymentsForTab />)}
                {activeTab === 'Other' && (otherPayments.length > 0 ? <SharedPaymentsTable payments={otherPayments} highlightedPaymentId={highlightedPaymentId} isAdmin={isAdmin} onDelete={requestPaymentDelete} /> : <NoPaymentsForTab />)}
                {activeTab === 'Payout' && (payoutPayments.length > 0 ? <SharedPaymentsTable payments={payoutPayments} highlightedPaymentId={highlightedPaymentId} isAdmin={isAdmin} onDelete={requestPaymentDelete} /> : <NoPaymentsForTab />)}
              </>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={paymentConfirmOpen}
        title="Delete payment?"
        description="This action cannot be undone. The payment will be removed."
        confirmText="Delete"
        cancelText="Cancel"
        confirming={paymentDeleting}
        onConfirm={handlePaymentDelete}
        onCancel={() => { if (!paymentDeleting) { setPaymentConfirmOpen(false); setSelectedPaymentId(null); } }}
      />
    </div>
  );
};

const NoPaymentsForTab = () => (
    <p className="text-center text-gray-500 py-8">No payments in this category.</p>
);

const AllPaymentsTable = ({ payments, highlightedPaymentId, isAdmin, onDelete }: { payments: PaymentListItem[]; highlightedPaymentId?: string | number | null; isAdmin: boolean; onDelete: (id: string | number) => void }) => {
    return (
        <div className="overflow-x-auto border rounded-lg">
            <table className="w-full min-w-[1300px] text-left">
                <thead className="bg-gray-custom-50">
                    <tr className="border-b border-gray-custom-200">
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Date</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Payment Type</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Installment</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Purpose</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Amount</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Received In</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Send From</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Send From</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Remarks</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Installment Remarks</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">AK's Approval</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">AK's Remarks</th>
                        {isAdmin && (
                          <th className="p-3 text-sm font-semibold text-gray-custom-500">Actions</th>
                        )}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map(p => (
                        <tr key={p.id} id={`payment-${p.id}`} className={highlightedPaymentId === p.id ? 'bg-primary/10 ring-2 ring-primary' : undefined}>
                            <td className="p-3 text-gray-custom-600">{formatDate(p.installment_date)}</td>
                            <td className="p-3 text-gray-custom-600">{p.payment_type || '-'}</td>
                            <td className="p-3 text-gray-custom-600 font-medium">#{p.installment_number}</td>
                            <td className="p-3 text-gray-custom-800">{p.purpose || '-'}</td>
                            <td className="p-3 text-gray-custom-800 font-medium">{formatINR(p.amount)}</td>
                            <td className="p-3 text-gray-custom-600">{p.payment_recieved_in}</td>
                            <td className="p-3 text-gray-custom-600">{p.payment_send_from || (p as any).payment_sent_from || '-'}</td>
                            <td className="p-3 text-gray-custom-600">{p.payment_send_from || (p as any).payment_sent_from || '-'}</td>
                            <td className="p-3 text-center"><RemarksTooltip remarks={p.remarks} /></td>
                            <td className="p-3 text-center"><RemarksTooltip remarks={(p as any).installment_remarks} /></td>
                            <td className="p-3">{p.ak_approval ? <ApprovalStatusBadge status={p.ak_approval as AkApprovalStatus} /> : <span className="text-gray-custom-400">-</span>}</td>
                            <td className="p-3 text-center"><RemarksTooltip remarks={p.ak_remarks} /></td>
                            {isAdmin && (
                              <td className="p-3 text-center space-x-2">
                                  <Link to={`/students/${p.student_id}/payments/${p.id}/edit`} state={{ payment: p }} className="inline-flex items-center justify-center p-1.5 rounded-md text-gray-custom-500 hover:text-primary hover:bg-gray-custom-100 transition-colors">
                                      <Pencil size={16} />
                                  </Link>
                                  <button onClick={() => onDelete(p.id)} className="inline-flex items-center justify-center p-1.5 rounded-md text-red-600 hover:bg-red-50">
                                    <Trash2 size={16} />
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

// Removed specialized InstallmentTable; using SharedPaymentsTable for all non-ALL tabs for consistent columns

const SharedPaymentsTable = ({ payments, highlightedPaymentId, isAdmin, onDelete }: { payments: PaymentListItem[]; highlightedPaymentId?: string | number | null; isAdmin: boolean; onDelete: (id: string | number) => void }) => {
    return (
        <div>
            <div className="overflow-x-auto border rounded-lg">
                <table className="w-full min-w-[1400px] text-left">
                    <thead className="bg-gray-custom-50">
                        <tr className="border-b border-gray-custom-200">
                            <th className="p-3 text-sm font-semibold text-gray-custom-500">Date</th>
                            <th className="p-3 text-sm font-semibold text-gray-custom-500">Payment Type</th>
                            <th className="p-3 text-sm font-semibold text-gray-custom-500">Installment</th>
                            <th className="p-3 text-sm font-semibold text-gray-custom-500">Purpose</th>
                            <th className="p-3 text-sm font-semibold text-gray-custom-500">Amount</th>
                            <th className="p-3 text-sm font-semibold text-gray-custom-500">Received In</th>
                            <th className="p-3 text-sm font-semibold text-gray-custom-500">Send From</th>
                            <th className="p-3 text-sm font-semibold text-gray-custom-500">Remarks</th>
                            <th className="p-3 text-sm font-semibold text-gray-custom-500">Installment Remarks</th>
                            <th className="p-3 text-sm font-semibold text-gray-custom-500">AK's Approval</th>
                            <th className="p-3 text-sm font-semibold text-gray-custom-500">AK's Remarks</th>
                            {isAdmin && (
                              <th className="p-3 text-sm font-semibold text-gray-custom-500">Actions</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {payments.map(p => (
                            <tr key={p.id} id={`payment-${p.id}`} className={highlightedPaymentId === p.id ? 'bg-primary/10 ring-2 ring-primary' : undefined}>
                                <td className="p-3 text-gray-custom-600">{formatDate(p.installment_date)}</td>
                                <td className="p-3 text-gray-custom-600">{p.payment_type || '-'}</td>
                                <td className="p-3 text-gray-custom-600 font-medium">#{p.installment_number}</td>
                                <td className="p-3 text-gray-custom-800">{p.purpose || '-'}</td>
                                <td className="p-3 text-gray-custom-800 font-medium">{formatINR(p.amount)}</td>
                                <td className="p-3 text-gray-custom-600">{p.payment_recieved_in}</td>
                                <td className="p-3 text-gray-custom-600">{p.payment_send_from || (p as any).payment_sent_from || '-'}</td>
                                <td className="p-3 text-center"><RemarksTooltip remarks={p.remarks} /></td>
                                <td className="p-3 text-center"><RemarksTooltip remarks={(p as any).installment_remarks} /></td>
                                <td className="p-3">{p.ak_approval ? <ApprovalStatusBadge status={p.ak_approval as AkApprovalStatus} /> : <span className="text-gray-custom-400">-</span>}</td>
                                <td className="p-3 text-center"><RemarksTooltip remarks={p.ak_remarks} /></td>
                                {isAdmin && (
                                  <td className="p-3 text-center space-x-2">
                                      <Link to={`/students/${p.student_id}/payments/${p.id}/edit`} state={{ payment: p }} className="inline-flex items-center justify-center p-1.5 rounded-md text-gray-custom-500 hover:text-primary hover:bg-gray-custom-100 transition-colors">
                                          <Pencil size={16} />
                                      </Link>
                                      <button onClick={() => onDelete(p.id)} className="inline-flex items-center justify-center p-1.5 rounded-md text-red-600 hover:bg-red-50">
                                        <Trash2 size={16} />
                                      </button>
                                  </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Legacy aliases no longer used

const OtherTable = ({ payments, highlightedPaymentId, isAdmin, onDelete }: { payments: PaymentListItem[]; highlightedPaymentId?: string | number | null; isAdmin: boolean; onDelete: (id: string | number) => void }) => <SharedPaymentsTable payments={payments} highlightedPaymentId={highlightedPaymentId} isAdmin={isAdmin} onDelete={onDelete} />;

const PayoutTable = ({ payments, highlightedPaymentId, isAdmin, onDelete }: { payments: PaymentListItem[]; highlightedPaymentId?: string | number | null; isAdmin: boolean; onDelete: (id: string | number) => void }) => <SharedPaymentsTable payments={payments} highlightedPaymentId={highlightedPaymentId} isAdmin={isAdmin} onDelete={onDelete} />;

export default StudentDetailsPage;

type EditValues = { name: string; email?: string; phone?: string; category?: string; zone?: string; intakeYear?: string; associateWiseInstallments?: string };

const EditStudentModal = ({ initial, onClose, onSave, saving }: { initial: EditValues; onClose: () => void; onSave: (values: EditValues) => Promise<void>; saving: boolean }) => {
  const [values, setValues] = useState<EditValues>(initial);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-custom-900 mb-4">Edit Student</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave(values);
          }}
          className="grid grid-cols-1 gap-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-custom-700">Name</label>
            <input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} required className="mt-1 w-full rounded-md border px-3 py-2 focus:border-primary focus:outline-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-custom-700">Email</label>
              <input type="email" value={values.email || ''} onChange={(e) => setValues({ ...values, email: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-custom-700">Phone</label>
              <input value={values.phone || ''} onChange={(e) => setValues({ ...values, phone: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 focus:border-primary focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-custom-700">Category</label>
              <select value={values.category || ''} onChange={(e) => setValues({ ...values, category: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 focus:border-primary focus:outline-none">
                <option value="">Select</option>
                {STUDENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-custom-700">Zone</label>
              <select value={values.zone || ''} onChange={(e) => setValues({ ...values, zone: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 focus:border-primary focus:outline-none">
                <option value="">Select</option>
                {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-custom-700">Associate Wise Installments</label>
            <select value={values.associateWiseInstallments || ''} onChange={(e) => setValues({ ...values, associateWiseInstallments: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 focus:border-primary focus:outline-none">
              <option value="">Select</option>
              {ASSOCIATE_WISE_INSTALLMENTS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-custom-700">Associate Wise Installments</label>
            <select value={values.associateWiseInstallments || ''} onChange={(e) => setValues({ ...values, associateWiseInstallments: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 focus:border-primary focus:outline-none">
              <option value="">Select</option>
              {ASSOCIATE_WISE_INSTALLMENTS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-custom-700">Intake Year</label>
            <input type="date" value={values.intakeYear || ''} onChange={(e) => setValues({ ...values, intakeYear: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 focus:border-primary focus:outline-none" />
          </div>
          <div className="mt-4 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="text-sm font-medium text-gray-custom-700 hover:underline">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
