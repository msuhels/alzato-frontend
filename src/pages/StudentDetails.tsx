import { useMemo, useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AkApprovalStatus } from '../types';
import { formatINR } from '../lib/currency';
import { studentsService } from '../services/students';
import { paymentsService, PaymentListItem } from '../services/payments';
import { Plus, Edit, Trash2, Info } from 'lucide-react';
import { STUDENT_CATEGORIES, ZONES } from '../lib/constants';

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
    'Yes': 'bg-green-100 text-green-800',
    'No': 'bg-red-100 text-red-800',
    'Yes-P': 'bg-yellow-100 text-yellow-800',
    'Suspense': 'bg-gray-100 text-gray-800',
  };
  return <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status]}`}>{status}</span>;
}

type PaymentTab = 'ALL' | 'Application' | 'CIMEA' | 'Legal';

const StudentDetailsPage = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<PaymentTab>('ALL');
  const [studentName, setStudentName] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [zone, setZone] = useState<string>('');
  const [intakeYear, setIntakeYear] = useState<string>('');
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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
        setPayments(paymentsRes.items || []);
      } catch {}
    }
    load();
  }, [studentId]);

  const applicationPayments = useMemo(() => payments.filter(p => (p.payment_type || '').toLowerCase() === 'application'), [payments]);
  const cimeaPayments = useMemo(() => payments.filter(p => (p.payment_type || '').toLowerCase() === 'cimea'), [payments]);
  const legalPayments = useMemo(() => payments.filter(p => (p.payment_type || '').toLowerCase() === 'legal'), [payments]);

  if (!studentId) {
    return <div className="text-center">Student not found. <Link to="/students" className="text-primary">Go back</Link></div>;
  }

  const tabs: { name: PaymentTab, label: string, count: number }[] = [
    { name: 'ALL', label: 'All Payments', count: payments.length },
    { name: 'Application', label: 'Application', count: applicationPayments.length },
    { name: 'CIMEA', label: 'CIMEA', count: cimeaPayments.length },
    { name: 'Legal', label: 'Legal', count: legalPayments.length },
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
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowEdit(true)} className="rounded-lg p-2 hover:bg-gray-custom-100"><Edit className="h-5 w-5 text-gray-custom-600" /></button>
            <button className="rounded-lg p-2 hover:bg-gray-custom-100"><Trash2 className="h-5 w-5 text-red-500" /></button>
          </div>
        </div>
        {showEdit && (
          <EditStudentModal
            initial={{ name: studentName, email: '', phone: '', category, zone, intakeYear }}
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
                });
                setStudentName(values.name);
                setCategory(values.category || '');
                setZone(values.zone || '');
                setIntakeYear(values.intakeYear || '');
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
                {activeTab === 'ALL' && <AllPaymentsTable payments={payments} />}
                {activeTab === 'Application' && (applicationPayments.length > 0 ? <ApplicationTable payments={applicationPayments} /> : <NoPaymentsForTab />)}
                {activeTab === 'CIMEA' && (cimeaPayments.length > 0 ? <SharedPaymentsTable payments={cimeaPayments} /> : <NoPaymentsForTab />)}
                {activeTab === 'Legal' && (legalPayments.length > 0 ? <SharedPaymentsTable payments={legalPayments} /> : <NoPaymentsForTab />)}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const NoPaymentsForTab = () => (
    <p className="text-center text-gray-500 py-8">No payments in this category.</p>
);

const AllPaymentsTable = ({ payments }: { payments: PaymentListItem[] }) => (
    <div className="overflow-x-auto border rounded-lg">
        <table className="w-full min-w-[1000px] text-left">
            <thead className="bg-gray-custom-50">
                <tr className="border-b border-gray-custom-200">
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Date</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Payment Type</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Purpose</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Amount</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Received In</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">Remarks</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">AK's Approval</th>
                    <th className="p-3 text-sm font-semibold text-gray-custom-500">AK's Remarks</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {payments.map(p => (
                    <tr key={p.id}>
                        <td className="p-3 text-gray-custom-600">{p.installment_date}</td>
                        <td className="p-3 text-gray-custom-600">{p.payment_type || '-'}</td>
                        <td className="p-3 text-gray-custom-800">{p.purpose || '-'}</td>
                        <td className="p-3 text-gray-custom-800 font-medium">{formatINR(p.amount)}</td>
                        <td className="p-3 text-gray-custom-600">{p.payment_recieved_in}</td>
                        <td className="p-3 text-center"><RemarksTooltip remarks={p.remarks} /></td>
                        <td className="p-3">{p.ak_approval ? <ApprovalStatusBadge status={p.ak_approval as AkApprovalStatus} /> : <span className="text-gray-custom-400">-</span>}</td>
                        <td className="p-3 text-center"><RemarksTooltip remarks={p.ak_remarks} /></td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const ApplicationTable = ({ payments }: { payments: PaymentListItem[] }) => (
    <div>
        <div className="overflow-x-auto border rounded-lg">
            <table className="w-full min-w-[1100px] text-left">
                <thead className="bg-gray-custom-50">
                    <tr className="border-b border-gray-custom-200">
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Date</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Payment Type</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Purpose</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Amount</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Received In</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Remarks</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">AK's Approval</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">AK's Remarks</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map(p => (
                        <tr key={p.id}>
                            <td className="p-3 text-gray-custom-600">{p.installment_date}</td>
                            <td className="p-3 text-gray-custom-600">{p.payment_type || '-'}</td>
                            <td className="p-3 text-gray-custom-800">{p.purpose || '-'}</td>
                            <td className="p-3 text-gray-custom-600">{formatINR(p.amount)}</td>
                            <td className="p-3 text-gray-custom-600">{p.payment_recieved_in}</td>
                            <td className="p-3 text-center"><RemarksTooltip remarks={p.remarks} /></td>
                            <td className="p-3">{p.ak_approval ? <ApprovalStatusBadge status={p.ak_approval as AkApprovalStatus} /> : <span className="text-gray-custom-400">-</span>}</td>
                            <td className="p-3 text-center"><RemarksTooltip remarks={p.ak_remarks} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

const SharedPaymentsTable = ({ payments }: { payments: PaymentListItem[] }) => (
    <div>
        <div className="overflow-x-auto border rounded-lg">
            <table className="w-full min-w-[1100px] text-left">
                <thead className="bg-gray-custom-50">
                    <tr className="border-b border-gray-custom-200">
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Date</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Payment Type</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Purpose</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Amount</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Received In</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">Remarks</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">AK's Approval</th>
                        <th className="p-3 text-sm font-semibold text-gray-custom-500">AK's Remarks</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map(p => (
                        <tr key={p.id}>
                            <td className="p-3 text-gray-custom-600">{p.installment_date}</td>
                            <td className="p-3 text-gray-custom-600">{p.payment_type || '-'}</td>
                            <td className="p-3 text-gray-custom-800 font-medium">{p.purpose}</td>
                            <td className="p-3 text-gray-custom-600">{formatINR(p.amount)}</td>
                            <td className="p-3 text-gray-custom-600">{p.payment_recieved_in}</td>
                            <td className="p-3 text-center"><RemarksTooltip remarks={p.remarks} /></td>
                            <td className="p-3">{p.ak_approval ? <ApprovalStatusBadge status={p.ak_approval as AkApprovalStatus} /> : <span className="text-gray-custom-400">-</span>}</td>
                            <td className="p-3 text-center"><RemarksTooltip remarks={p.ak_remarks} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

// Legacy aliases no longer used

export default StudentDetailsPage;

type EditValues = { name: string; email?: string; phone?: string; category?: string; zone?: string; intakeYear?: string };

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
