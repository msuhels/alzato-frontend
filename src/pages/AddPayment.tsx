import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { studentsService } from '../services/students';
import { paymentsService, PaymentListItem } from '../services/payments';
import { PAYMENT_PURPOSES, PAYMENT_RECEIVED_IN_OPTIONS, AK_APPROVAL_OPTIONS, PAYMENT_DEPARTMENTS } from '../lib/constants';
import { getNextInstallmentNumber } from '../lib/dateUtils';
import { ArrowLeft, Building, FileText } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const AddPaymentPage = () => {
  const navigate = useNavigate();
  const { studentId } = useParams<{ studentId: string }>();
  const { user } = useAuth();
  const isAdmin = (user?.role === 'admin');
  const [studentName, setStudentName] = useState<string>('');
  const [existingPayments, setExistingPayments] = useState<PaymentListItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    async function load() {
      if (!studentId) return;
      try {
        const [{ student }, { items: payments }] = await Promise.all([
          studentsService.get(studentId),
          paymentsService.list({ student_id: studentId, limit: 100 })
        ]);
        setStudentName(student?.name || '');
        setExistingPayments(payments);
      } catch {}
    }
    load();
  }, [studentId]);
  // Default to Installment to skip selection screen for now
  const [department, setDepartment] = useState<typeof PAYMENT_DEPARTMENTS[number] | null>('Installment');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // prevent double submit
    setIsSubmitting(true);
    const form = e.target as HTMLFormElement;
    const date = (form.querySelector('#date') as HTMLInputElement).value;
    const amountInput = form.querySelector('#amount') as HTMLInputElement | null;
    const amount = amountInput ? parseFloat(amountInput.value) : 0;
    const receivedIn = (form.querySelector('#receivedIn') as HTMLSelectElement | null)?.value;
    const aksApprovalEl = (form.querySelector('#aksApproval') as HTMLSelectElement | null);
    const aksApproval = isAdmin ? (aksApprovalEl?.value) : 'No';
    const appRemarks = (form.querySelector('#appRemarks') as HTMLTextAreaElement | null)?.value;
    const aksRemarks = isAdmin ? (form.querySelector('#aksRemarks') as HTMLTextAreaElement | null)?.value : undefined;
    const accRemarks = (form.querySelector('#accRemarks') as HTMLTextAreaElement | null)?.value;
    const purpose = (form.querySelector('#purpose') as HTMLSelectElement | null)?.value;
    const remarks = (form.querySelector('#remarks') as HTMLTextAreaElement | null)?.value;
    const paymentType = department || undefined;
    const userInstallmentNumberStr = (form.querySelector('#installmentNumber') as HTMLInputElement | null)?.value;
    const userInstallmentNumber = userInstallmentNumberStr ? parseInt(userInstallmentNumberStr, 10) : undefined;
    const installmentNumber = userInstallmentNumber ?? (paymentType ? getNextInstallmentNumber(existingPayments, paymentType) : undefined);

    try {
      await paymentsService.create({
        student_id: studentId as string,
        installment_date: date,
        installment_number: installmentNumber,
        amount,
        payment_recieved_in: receivedIn || undefined,
        // also send alternate key used by some backends
        ak_approval: isAdmin ? (aksApproval || "No") : 'No',
        ak_remarks: isAdmin ? (aksRemarks || undefined) : undefined,
        installment_remarks: appRemarks || undefined,
        accounting_remarks: accRemarks || undefined,
        purpose: purpose || undefined,
        remarks: remarks || undefined,
        payment_type: paymentType,
      });
      navigate(`/students/${studentId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!studentId) {
    return <div className="text-center">Student not found. <Link to="/students" className="text-primary">Go back</Link></div>;
  }

  const renderFormForDepartment = () => {
    switch (department) {
      case 'Installment':
        return <AccountingForm isAdmin={isAdmin} />;
      case 'Other':
        return <OtherForm isAdmin={isAdmin} />;
      default:
        return null;
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      {department && (
        <button onClick={() => setDepartment(null)} className="flex items-center gap-2 text-sm font-semibold text-gray-custom-600 hover:text-gray-custom-900 mb-4">
          <ArrowLeft size={16} />
          Back to Department Selection
        </button>
      )}
      <h1 className="text-2xl font-bold text-gray-custom-900 mb-2">
        {department ? `New ${department} Payment` : 'Add New Payment'}
      </h1>
      <p className="text-gray-custom-600 mb-2">For <span className="font-semibold text-gray-custom-800">{studentName || 'Student'}</span></p>
      {/* {department && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Next Installment:</span> This will be installment #{getNextInstallmentNumber(existingPayments, department)} for {department} payments
          </p>
        </div>
      )} */}
      
      {department ? (
        <form onSubmit={handleSubmit} className="mx-auto max-w-7xl">
          {renderFormForDepartment()}
          <div className="mt-6 flex items-center justify-end gap-x-4 border-t border-gray-900/10 pt-4">
            <button type="button" onClick={() => navigate(`/students/${studentId}`)} className="text-sm font-semibold leading-6 text-gray-custom-900">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className={`rounded-md bg-primary py-2 px-4 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary-dark'}`}>
              {isSubmitting ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        </form>
      ) : (
        <DepartmentSelector onSelect={setDepartment} />
      )}
    </div>
  );
};

const DepartmentSelector = ({ onSelect }: { onSelect: (dept: typeof PAYMENT_DEPARTMENTS[number]) => void }) => {
    const departmentOptions = [
        { name: 'Installment', icon: Building, description: "Record installment payments and manage approvals." },
        { name: 'Other', icon: FileText, description: "Handle other fees and miscellaneous payments." },
    ];
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {departmentOptions.map(opt => (
                <button
                    key={opt.name}
                    onClick={() => onSelect(opt.name as typeof PAYMENT_DEPARTMENTS[number])}
                    className="flex flex-col items-center justify-center text-center p-6 border rounded-lg hover:shadow-lg hover:border-primary transition-all duration-200"
                >
                    <opt.icon className="h-12 w-12 text-primary mb-4" />
                    <h3 className="font-semibold text-gray-custom-800">{opt.name}</h3>
                    <p className="text-sm text-gray-custom-500 mt-2">{opt.description}</p>
                </button>
            ))}
        </div>
    );
};

// --- Department Specific Forms ---

const AccountingForm = ({ isAdmin }: { isAdmin: boolean }) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Left Column */}
        <div className="space-y-4">
            <div>
                <label htmlFor="date" className="block text-sm font-medium leading-6 text-gray-custom-900">Date</label>
                <input type="date" id="date" required className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary" />
            </div>
            <div>
                <label htmlFor="amount" className="block text-sm font-medium leading-6 text-gray-custom-900">Amount</label>
                <input type="number" id="amount" step="0.01" required className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary" />
            </div>
            <div>
                <label htmlFor="purpose" className="block text-sm font-medium leading-6 text-gray-custom-900">Purpose</label>
                <select id="purpose" defaultValue="" className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary">
                    <option value="">Select</option>
                    {PAYMENT_PURPOSES.map(opt => <option key={opt}>{opt}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="installmentNumber" className="block text-sm font-medium leading-6 text-gray-custom-900">Installment Number</label>
                <input type="number" id="installmentNumber" min={1} placeholder="e.g. 1" className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary" />
            </div>
            <div>
                <label htmlFor="receivedIn" className="block text-sm font-medium leading-6 text-gray-custom-900">Payment Received In</label>
                <select id="receivedIn" defaultValue="" required className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary">
                    <option value="">Select</option>
                    {PAYMENT_RECEIVED_IN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="aksApproval" className="block text-sm font-medium leading-6 text-gray-custom-900">AK's Approval</label>
                <select id="aksApproval" required disabled={!isAdmin} defaultValue={'No'} className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary disabled:bg-gray-100 disabled:cursor-not-allowed">
                    {AK_APPROVAL_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                </select>
            </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
            <div>
                <label htmlFor="remarks" className="block text-sm font-medium leading-6 text-gray-custom-900">Remarks</label>
                <textarea id="remarks" rows={1} className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary"></textarea>
            </div>
            <div>
                <label htmlFor="appRemarks" className="block text-sm font-medium leading-6 text-gray-custom-900">Installment Remarks</label>
                <textarea id="appRemarks" rows={1} className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary"></textarea>
            </div>
            {isAdmin && (
                <div>
                    <label htmlFor="aksRemarks" className="block text-sm font-medium leading-6 text-gray-custom-900">AK's Remarks</label>
                    <textarea
                        id="aksRemarks"
                        rows={1}
                        className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary"
                    ></textarea>
                </div>
            )}
            <div>
                <label htmlFor="accRemarks" className="block text-sm font-medium leading-6 text-gray-custom-900">Accounting Remarks</label>
                <textarea id="accRemarks" rows={1} className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary"></textarea>
            </div>
        </div>
    </div>
);

const OtherForm = ({ isAdmin }: { isAdmin: boolean }) => <SharedForm isAdmin={isAdmin} />;

const SharedForm = ({ isAdmin }: { isAdmin: boolean }) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Left Column */}
        <div className="space-y-4">
            <div>
                <label htmlFor="date" className="block text-sm font-medium leading-6 text-gray-custom-900">Date</label>
                <input type="date" id="date" required className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary" />
            </div>
            <div>
                <label htmlFor="amount" className="block text-sm font-medium leading-6 text-gray-custom-900">Amount</label>
                <input type="number" id="amount" step="0.01" required className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary" />
            </div>
            <div>
                <label htmlFor="purpose" className="block text-sm font-medium leading-6 text-gray-custom-900">Purpose</label>
                <select id="purpose" defaultValue="" required className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary">
                    <option value="">Select</option>
                    {PAYMENT_PURPOSES.map(opt => <option key={opt}>{opt}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="installmentNumber" className="block text-sm font-medium leading-6 text-gray-custom-900">Installment Number</label>
                <input type="number" id="installmentNumber" min={1} placeholder="e.g. 1" className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary" />
            </div>
            <div>
                <label htmlFor="receivedIn" className="block text-sm font-medium leading-6 text-gray-custom-900">Payment Received In</label>
                <select id="receivedIn" defaultValue="" required className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary">
                    <option value="">Select</option>
                    {PAYMENT_RECEIVED_IN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="aksApproval" className="block text-sm font-medium leading-6 text-gray-custom-900">AK's Approval</label>
                <select id="aksApproval" required disabled={!isAdmin} defaultValue={'No'} className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary disabled:bg-gray-100 disabled:cursor-not-allowed">
                    {AK_APPROVAL_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
                </select>
            </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
            <div>
                <label htmlFor="remarks" className="block text-sm font-medium leading-6 text-gray-custom-900">Remarks</label>
                <textarea id="remarks" rows={4} className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary"></textarea>
            </div>
        </div>
    </div>
);

export default AddPaymentPage;
