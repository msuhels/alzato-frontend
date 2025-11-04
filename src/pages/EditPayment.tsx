import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { paymentsService, PaymentListItem } from '../services/payments';
import { PAYMENT_PURPOSES, PAYMENT_RECEIVED_IN_OPTIONS, AK_APPROVAL_OPTIONS } from '../lib/constants';
import { useAuth } from '../hooks/useAuth';

const EditPaymentPage = () => {
  const navigate = useNavigate();
  const { studentId, paymentId } = useParams<{ studentId: string; paymentId: string }>();
  const location = useLocation() as { state?: { payment?: PaymentListItem } };
  const { user } = useAuth();
  const isAdmin = (user?.role === 'admin');
  const lastPaymentRaw = typeof window !== 'undefined' ? localStorage.getItem('last-payment') : null;
  const lastPayment: PaymentListItem | null = lastPaymentRaw ? (() => { try { return JSON.parse(lastPaymentRaw); } catch { return null; } })() : null;
  const [payment, setPayment] = useState<PaymentListItem | null>(location.state?.payment || lastPayment || null);
  const [loading, setLoading] = useState<boolean>(!Boolean(location.state?.payment));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (payment) {
        // We already have initial data via navigation state; render immediately
        setLoading(false);
      }
      // If we already got the payment via Link state, still refresh in background for accuracy
      if (paymentId) {
        try {
          const res = await paymentsService.get(paymentId);
          const p: PaymentListItem | undefined = (res && (res.payment || res)) as any;
          if (!cancelled && p) setPayment(p);
          if (p) localStorage.setItem('last-payment', JSON.stringify(p));
        } catch (e) {
          // Fallback: some backends may not support GET /payments/:id. Try list by student and find the record
          try {
            if (studentId) {
              const { items } = await paymentsService.list({ student_id: studentId, limit: 200, offset: 0 });
              const found = items.find((itm: any) => String(itm.id) === String(paymentId));
              if (!cancelled && found) {
                setPayment(found as any);
                localStorage.setItem('last-payment', JSON.stringify(found));
              }
              else if (!cancelled && !payment) setPayment(null);
            } else if (!cancelled && !payment) {
              setPayment(null);
            }
          } catch {
            // Last resort: paginate globally through payments to find the item
            try {
              let offset = 0; const limit = 100;
              let found: any = null;
              while (offset <= 1000) { // cap to 1000 items scanned
                const { items } = await paymentsService.list({ limit, offset });
                if (!items || items.length === 0) break;
                found = items.find((itm: any) => String(itm.id) === String(paymentId));
                if (found) break;
                offset += limit;
              }
              if (!cancelled && found) {
                setPayment(found as any);
                localStorage.setItem('last-payment', JSON.stringify(found));
              } else if (!cancelled && !payment) {
                setPayment(null);
              }
            } catch {
              if (!cancelled && !payment) setPayment(null);
            }
          }
        } finally {
          if (!cancelled) {
            if (!payment) {
              // As a last resort, initialize a minimal editable payment to avoid blocking the user
              setPayment({
                id: paymentId as any,
                created_at: new Date().toISOString(),
                student_id: (studentId as any) || '',
                installment_date: new Date().toISOString().slice(0,10),
                amount: 0,
              } as any);
            }
            setLoading(false);
          }
        }
      }
    };
    // If we had no state, indicate loading until fetch completes
    if (!payment) setLoading(true);
    load();
    return () => { cancelled = true; };
  }, [paymentId]);

  if (!studentId) {
    return <div className="text-center">Student not found. <Link to="/students" className="text-primary">Go back</Link></div>;
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (!payment) return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-custom-900">Payment not found</h1>
        <button onClick={() => navigate(`/students/${studentId}`)} className="rounded-md bg-primary py-2 px-4 text-sm font-semibold text-white hover:bg-primary-dark">Back to Student</button>
      </div>
      <p className="text-gray-custom-600">We couldn’t load this payment. Please check the URL or try again.</p>
    </div>
  );

  const isInstallment = ((payment?.payment_type || '').trim().toLowerCase() === 'installment');

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-gray-custom-900 mb-2">Edit Payment</h1>
      <p className="text-gray-custom-600 mb-8">Payment ID: <span className="font-semibold text-gray-custom-800">{payment.id}</span></p>

      <form
        className="mx-auto max-w-3xl grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const date = (form.querySelector('#date') as HTMLInputElement).value;
          const amount = parseFloat((form.querySelector('#amount') as HTMLInputElement).value);
          const receivedIn = (form.querySelector('#receivedIn') as HTMLSelectElement | null)?.value;
          const sendFrom = (form.querySelector('#sendFrom') as HTMLSelectElement | null)?.value;
          const aksApproval = isAdmin ? ((form.querySelector('#aksApproval') as HTMLSelectElement | null)?.value) : 'No';
          const remarks = (form.querySelector('#remarks') as HTMLTextAreaElement | null)?.value;
          const akRemarks = (form.querySelector('#akRemarks') as HTMLTextAreaElement | null)?.value;
          const accountingRemarks = (form.querySelector('#accountingRemarks') as HTMLTextAreaElement | null)?.value;
          const applicationRemark = (form.querySelector('#applicationRemark') as HTMLTextAreaElement | null)?.value;
          const purpose = (form.querySelector('#purpose') as HTMLSelectElement | null)?.value;
          const installmentNumberStr = (form.querySelector('#installmentNumber') as HTMLInputElement).value;
          const installmentNumber = installmentNumberStr ? parseInt(installmentNumberStr, 10) : undefined;

          setSaving(true);
          try {
            const body: any = {
              installment_date: date,
              amount,
              payment_recieved_in: receivedIn || undefined,
              payment_send_from: sendFrom || undefined,
              // send alternate snake_case variant for compatibility
              payment_sent_from: sendFrom || undefined,
              ak_approval: aksApproval || undefined,
              remarks: remarks || undefined,
              purpose: purpose || undefined,
              installment_number: installmentNumber,
            };
            if (isInstallment) {
              // Send both snake_case variants to be compatible with differing backends
              body.ak_remarks = akRemarks ?? undefined;
              body.accounting_remarks = accountingRemarks ?? undefined;
              body.installment_remarks = applicationRemark ?? undefined;
            }
            await paymentsService.update(payment.id, body);
            navigate(`/students/${studentId}`);
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="sm:col-span-3">
          <label htmlFor="date" className="block text-sm font-medium leading-6 text-gray-custom-900">Date</label>
          <input defaultValue={payment.installment_date?.slice(0,10)} type="date" id="date" required className="mt-2 block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary" />
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="amount" className="block text-sm font-medium leading-6 text-gray-custom-900">Amount</label>
          <input defaultValue={payment.amount} type="number" id="amount" step="0.01" required className="mt-2 block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary" />
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="receivedIn" className="block text-sm font-medium leading-6 text-gray-custom-900">Payment Received In</label>
          <select id="receivedIn" defaultValue={payment.payment_recieved_in || ''} className="mt-2 block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary">
            <option value="">Select</option>
            {PAYMENT_RECEIVED_IN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="sendFrom" className="block text-sm font-medium leading-6 text-gray-custom-900">Payment Send From</label>
          <select id="sendFrom" defaultValue={(payment as any).payment_send_from || ''} className="mt-2 block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary">
            <option value="">Select</option>
            {PAYMENT_RECEIVED_IN_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="purpose" className="block text-sm font-medium leading-6 text-gray-custom-900">Purpose</label>
          <select id="purpose" defaultValue={payment.purpose || ''} className="mt-2 block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary">
            <option value="">Select</option>
            {PAYMENT_PURPOSES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="aksApproval" className="block text-sm font-medium leading-6 text-gray-custom-900">AK's Approval</label>
          <select id="aksApproval" defaultValue={isAdmin ? (payment.ak_approval || 'No') : (payment.ak_approval || 'No')} disabled={!isAdmin} className="mt-2 block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary disabled:bg-gray-100 disabled:cursor-not-allowed">
            <option value="">Select</option>
            {AK_APPROVAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>

        <div className="sm:col-span-3">
          <label htmlFor="installmentNumber" className="block text-sm font-medium leading-6 text-gray-custom-900">Installment Number</label>
          <input defaultValue={payment.installment_number || ''} type="number" id="installmentNumber" min={1} className="mt-2 block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary" />
        </div>

        <div className="sm:col-span-6">
          <label htmlFor="remarks" className="block text-sm font-medium leading-6 text-gray-custom-900">Remarks</label>
          <textarea id="remarks" defaultValue={payment.remarks || ''} rows={3} className="mt-2 block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary"></textarea>
        </div>

        {isInstallment && (
          <>
            <div className="sm:col-span-6">
              <label htmlFor="akRemarks" className="block text-sm font-medium leading-6 text-gray-custom-900">AK's Remarks</label>
              <textarea id="akRemarks" defaultValue={payment.ak_remarks || ''} rows={3} className="mt-2 block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary"></textarea>
            </div>
            <div className="sm:col-span-6">
              <label htmlFor="applicationRemark" className="block text-sm font-medium leading-6 text-gray-custom-900">Installment Remark</label>
              <textarea id="applicationRemark" defaultValue={(payment as any).installment_remarks || ''} rows={3} className="mt-2 block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary"></textarea>
            </div>
            <div className="sm:col-span-6">
              <label htmlFor="accountingRemarks" className="block text-sm font-medium leading-6 text-gray-custom-900">Accounting Remarks</label>
              <textarea id="accountingRemarks" defaultValue={payment.accounting_remarks || ''} rows={3} className="mt-2 block w-full rounded-md border-0 py-2.5 text-gray-custom-900 shadow-sm ring-1 ring-inset ring-gray-custom-300 focus:ring-2 focus:ring-inset focus:ring-primary"></textarea>
            </div>
          </>
        )}

        <div className="sm:col-span-6 mt-4 flex items-center justify-end gap-x-4 border-t border-gray-900/10 pt-6">
          <button type="button" onClick={() => navigate(`/students/${studentId}`)} className="text-sm font-semibold leading-6 text-gray-custom-900">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="rounded-md bg-primary py-2 px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditPaymentPage;


