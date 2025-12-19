import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { studentsService, StudentListItem } from '../services/students';
import { paymentsService, PaymentListItem } from '../services/payments';
import { PAYMENT_PURPOSES, PAYMENT_RECEIVED_IN_OPTIONS, AK_APPROVAL_OPTIONS, PAYMENT_DEPARTMENTS } from '../lib/constants';
import { getNextInstallmentNumber, parseInstallmentStructure, calculateInstallmentProgress, calculateWaterfallPreview } from '../lib/dateUtils';
import { ArrowLeft, Building, FileText } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const AddPaymentPage = () => {
  const navigate = useNavigate();
  const { studentId } = useParams<{ studentId: string }>();
  const { user } = useAuth();
  const isAdmin = (user?.role === 'admin');
  const [studentName, setStudentName] = useState<string>('');
  const [studentData, setStudentData] = useState<StudentListItem | null>(null);
  const [existingPayments, setExistingPayments] = useState<PaymentListItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [depositAmount, setDepositAmount] = useState<string>('');
  // Track purposes for each installment in waterfall preview
  const [installmentPurposes, setInstallmentPurposes] = useState<Record<number, string>>({});
  
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
        setStudentData(student);
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
    const receivedIn = (form.querySelector('#receivedIn') as HTMLSelectElement | null)?.value;
    const aksApprovalEl = (form.querySelector('#aksApproval') as HTMLSelectElement | null);
    const aksApproval = isAdmin ? (aksApprovalEl?.value) : 'No';
    const aksRemarks = isAdmin ? (form.querySelector('#aksRemarks') as HTMLTextAreaElement | null)?.value : undefined;
    const purpose = (form.querySelector('#purpose') as HTMLSelectElement | null)?.value;
    const remarks = (form.querySelector('#remarks') as HTMLTextAreaElement | null)?.value;
    const paymentType = department || undefined;
    
    // For Installment payments, always use waterfall distribution
    // For Other payments, use standard mode
    if (department === 'Installment') {
      // Get amount from the amount field
      const amountInput = form.querySelector('#amount') as HTMLInputElement | null;
      const amount = amountInput ? parseFloat(amountInput.value) : 0;
      
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount');
        setIsSubmitting(false);
        return;
      }

      // Validate that all installments in preview have purposes selected
      if (waterfallPreview && waterfallPreview.length > 0) {
        const missingPurposes = waterfallPreview.filter(item => !installmentPurposes[item.installmentNumber]);
        if (missingPurposes.length > 0) {
          alert(`Please select purpose for all installments in the distribution preview`);
          setIsSubmitting(false);
          return;
        }
      }
      
      // Get installment number (optional, for display only - won't affect distribution logic)
      const userInstallmentNumberStr = (form.querySelector('#installmentNumber') as HTMLInputElement | null)?.value;
      const userInstallmentNumber = userInstallmentNumberStr ? parseInt(userInstallmentNumberStr, 10) : undefined;
      
      try {
        // Always send amount (backend will handle waterfall distribution automatically)
        // Also send installment purposes map for backend to use
        await paymentsService.create({
          student_id: studentId as string,
          installment_date: date,
          amount: amount, // Backend will automatically distribute this
          installment_number: userInstallmentNumber, // Optional, for reference only
          payment_recieved_in: receivedIn || undefined,
          ak_approval: isAdmin ? (aksApproval || "No") : 'No',
          ak_remarks: isAdmin ? (aksRemarks || undefined) : undefined,
          purpose: purpose || undefined, // Main form purpose (for first installment)
          installment_purposes: waterfallPreview && waterfallPreview.length > 0 ? installmentPurposes : undefined, // Map of installment_number -> purpose
          remarks: remarks || undefined,
          payment_type: paymentType,
        });
        navigate(`/students/${studentId}`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    
    // Standard mode for Other payments
    const amountInput = form.querySelector('#amount') as HTMLInputElement | null;
    const amount = amountInput ? parseFloat(amountInput.value) : 0;
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
        ak_approval: isAdmin ? (aksApproval || "No") : 'No',
        ak_remarks: isAdmin ? (aksRemarks || undefined) : undefined,
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

  // Calculate waterfall preview for Installment payments
  // Show preview when amount is entered in the amount field
  const waterfallPreview = React.useMemo(() => {
    if (department !== 'Installment' || !studentData?.associate_wise_installments) {
      return null;
    }
    
    // Get amount from depositAmount state (updated when user types in amount field)
    if (!depositAmount) return null;
    
    const deposit = parseFloat(depositAmount);
    if (isNaN(deposit) || deposit <= 0) return null;
    
    const installmentTargets = parseInstallmentStructure(studentData.associate_wise_installments);
    if (installmentTargets.length === 0) return null;
    
    // Filter payments to only include Installment type
    const installmentPayments = existingPayments.filter(p => 
      (p.payment_type || '').toLowerCase() === 'installment'
    );
    
    const progress = calculateInstallmentProgress(installmentPayments);
    return calculateWaterfallPreview(deposit, installmentTargets, progress, installmentPayments);
  }, [department, depositAmount, studentData, existingPayments]);

  // Update installment purposes when main form purpose changes
  const handleMainPurposeChange = (purpose: string) => {
    if (waterfallPreview && waterfallPreview.length > 0) {
      // Set first installment purpose to main form purpose
      setInstallmentPurposes(prev => ({
        ...prev,
        [waterfallPreview[0].installmentNumber]: purpose
      }));
    }
  };

  const renderFormForDepartment = () => {
    switch (department) {
      case 'Installment':
        return (
          <AccountingForm 
            isAdmin={isAdmin} 
            setDepositAmount={setDepositAmount}
            waterfallPreview={waterfallPreview}
            installmentPurposes={installmentPurposes}
            setInstallmentPurposes={setInstallmentPurposes}
            onMainPurposeChange={handleMainPurposeChange}
          />
        );
      case 'Other':
        return <OtherForm isAdmin={isAdmin} />;
      default:
        return null;
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
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

const AccountingForm = ({ 
  isAdmin, 
  setDepositAmount,
  waterfallPreview,
  installmentPurposes,
  setInstallmentPurposes,
  onMainPurposeChange
}: { 
  isAdmin: boolean;
  setDepositAmount: (val: string) => void;
  waterfallPreview: Array<{ installmentNumber: number; amount: number; target: number; alreadyPaid: number }> | null;
  installmentPurposes: Record<number, string>;
  setInstallmentPurposes: (purposes: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => void;
  onMainPurposeChange?: (purpose: string) => void;
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Waterfall Distribution Info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-gray-custom-700">
          <span className="font-semibold">Automatic Distribution:</span> The amount you enter will be automatically distributed across installments based on the student's package structure.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Left Column */}
        <div className="space-y-4">
            <div>
                <label htmlFor="date" className="block text-sm font-medium leading-6 text-gray-custom-900">Date</label>
                <input type="date" id="date" required className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary" />
            </div>
            <div>
              <label htmlFor="amount" className="block text-sm font-medium leading-6 text-gray-custom-900">Amount</label>
              <input 
                type="number" 
                id="amount" 
                step="0.01" 
                required 
                className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary" 
                placeholder="Enter payment amount"
                onChange={(e) => {
                  // Update depositAmount for preview calculation
                  setDepositAmount(e.target.value);
                }}
              />
              <p className="mt-1 text-xs text-gray-custom-500">
                This amount will be automatically distributed across installments based on package structure
              </p>
            </div>
            <div>
                <label htmlFor="purpose" className="block text-sm font-medium leading-6 text-gray-custom-900">Purpose</label>
                <select 
                  id="purpose" 
                  defaultValue="" 
                  required
                  onChange={(e) => {
                    const purpose = e.target.value;
                    if (onMainPurposeChange) {
                      onMainPurposeChange(purpose);
                    }
                  }}
                  className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary"
                >
                    <option value="">Select</option>
                    {PAYMENT_PURPOSES.map(opt => <option key={opt}>{opt}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-custom-500">
                  This purpose will be applied to the first installment in the distribution
                </p>
            </div>
            <div>
                <label htmlFor="installmentNumber" className="block text-sm font-medium leading-6 text-gray-custom-900">Installment Number</label>
                <input 
                  type="number" 
                  id="installmentNumber" 
                  min={1} 
                  placeholder="e.g. 1" 
                  className="mt-1.5 block w-full rounded-md border-0 py-2 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary" 
                />
                <p className="mt-1 text-xs text-gray-custom-500">
                  (Optional - distribution is calculated automatically based on package structure)
                </p>
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
        </div>
      </div>

      {/* Waterfall Preview */}
      {waterfallPreview && waterfallPreview.length > 0 && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-custom-900 mb-3">Distribution Preview</h3>
          <div className="space-y-4">
            {waterfallPreview.map((item, index) => {
              const isFirst = index === 0;
              const currentPurpose = installmentPurposes[item.installmentNumber] || '';
              
              return (
                <div key={item.installmentNumber} className="p-3 bg-white rounded border border-green-200">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-custom-900">
                        Installment {item.installmentNumber}: {formatCurrency(item.amount)}
                      </span>
                      <span className="text-xs text-gray-custom-500 ml-2">
                        ({formatCurrency(item.alreadyPaid)} / {formatCurrency(item.target)})
                      </span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-custom-700 mb-1">
                      Purpose {isFirst ? '(from main form)' : '*'}
                    </label>
                    {isFirst ? (
                      <div className="text-sm text-gray-custom-600 bg-gray-50 p-2 rounded border border-gray-200">
                        {currentPurpose || <span className="text-gray-custom-400 italic">Select purpose in main form</span>}
                      </div>
                    ) : (
                      <select
                        value={currentPurpose}
                        onChange={(e) => {
                          setInstallmentPurposes(prev => ({
                            ...prev,
                            [item.installmentNumber]: e.target.value
                          }));
                        }}
                        required
                        className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary"
                      >
                        <option value="">Select Purpose</option>
                        {PAYMENT_PURPOSES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="pt-2 mt-2 border-t border-green-300">
              <div className="flex justify-between items-center font-semibold">
                <span className="text-gray-custom-900">Total Distributed:</span>
                <span className="text-gray-custom-900">
                  {formatCurrency(waterfallPreview.reduce((sum, item) => sum + item.amount, 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
