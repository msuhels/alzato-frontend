import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { activityLogService, ActivityLogItem } from '../services/activityLog';
import { studentsService } from '../services/students';
import { paymentsService } from '../services/payments';
import TableSkeleton from '../components/TableSkeleton';
import { formatDate } from '../lib/dateUtils';
import { AkApprovalStatus } from '../types';
import { AK_APPROVAL_OPTIONS } from '../lib/constants';

const ApprovalStatusBadge = ({ status }: { status: AkApprovalStatus }) => {
  const statusStyles: Record<AkApprovalStatus, string> = {
    'Completed': 'bg-green-100 text-green-800',
    'No': 'bg-red-100 text-red-800',
    'Partial': 'bg-yellow-100 text-yellow-800',
    'Suspense': 'bg-gray-100 text-gray-800',
  };
  return <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status]}`}>{status}</span>;
};

const UpdatesPage = () => {
  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentNames, setStudentNames] = useState<Record<number, string>>({});
  const [akApprovals, setAkApprovals] = useState<Record<number, AkApprovalStatus | null>>({});
  const [akRemarks, setAkRemarks] = useState<Record<number, string>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const navigate = useNavigate();
  const markReadTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const markReadFlags = useRef<Record<number, { approval: boolean; remarks: boolean }>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await activityLogService.list({ limit: 100, offset: 0, is_read: false });
        setItems(res.items || []);
        
        // Fetch student names for all unique student IDs
        const studentIds = [...new Set((res.items || []).map(item => item.student_id).filter((id): id is number => id !== undefined))];
        const namesMap: Record<number, string> = {};
        
        await Promise.all(
          studentIds.map(async (studentId) => {
            try {
              const { student } = await studentsService.get(studentId);
              namesMap[studentId] = student?.name || '-';
            } catch {
              namesMap[studentId] = '-';
            }
          })
        );
        
        setStudentNames(namesMap);
        
        // Fetch AK approval status for all payment-related items (payment_received and ak_approval_updated)
        const paymentItems = (res.items || []).filter(item => 
          (item.activity_type === 'payment_received' || item.activity_type === 'ak_approval_updated') && item.payment_id
        );
        const approvalMap: Record<number, AkApprovalStatus | null> = {};
        const remarksMap: Record<number, string> = {};
        
        // Get unique payment IDs to avoid duplicate fetches
        const uniquePaymentIds = [...new Set(paymentItems.map(item => item.payment_id).filter((id): id is number => id !== undefined))];
        
        await Promise.all(
          uniquePaymentIds.map(async (paymentId) => {
            try {
              const paymentRes = await paymentsService.get(paymentId);
              // Handle different response formats: { success: true, payment: {...} } or direct payment object
              const payment = (paymentRes as any)?.payment || paymentRes;
              if (payment?.ak_approval && ['Completed', 'No', 'Partial', 'Suspense'].includes(payment.ak_approval)) {
                approvalMap[paymentId] = payment.ak_approval as AkApprovalStatus;
              }
              if (payment?.ak_remarks) {
                remarksMap[paymentId] = payment.ak_remarks;
              }
            } catch (err) {
              // Payment fetch failed, try to parse from description for ak_approval_updated items
              const akItem = paymentItems.find(item => item.payment_id === paymentId && item.activity_type === 'ak_approval_updated');
              if (akItem) {
                const desc = akItem.description || '';
                const match = desc.match(/→\s*([^|]+)/);
                if (match) {
                  const status = match[1].trim();
                  if (status !== 'None' && ['Completed', 'No', 'Partial', 'Suspense'].includes(status)) {
                    approvalMap[paymentId] = status as AkApprovalStatus;
                  }
                }
              }
            }
          })
        );
        
        setAkApprovals(approvalMap);
        setAkRemarks(remarksMap);
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Failed to load updates');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const markReadAndRemove = async (activityId: number) => {
    try {
      await activityLogService.markRead(activityId);
      setItems((prev) => prev.filter((item) => item.id !== activityId));
      window.dispatchEvent(new Event('activityLog:updated'));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update activity');
    }
  };

  const scheduleMarkRead = (activityId: number, changed: { approval?: boolean; remarks?: boolean }) => {
    const existingFlags = markReadFlags.current[activityId] || { approval: false, remarks: false };
    const nextFlags = {
      approval: existingFlags.approval || !!changed.approval,
      remarks: existingFlags.remarks || !!changed.remarks,
    };
    markReadFlags.current[activityId] = nextFlags;

    if (markReadTimers.current[activityId]) {
      clearTimeout(markReadTimers.current[activityId]);
    }

    const delay = nextFlags.approval && nextFlags.remarks ? 30_000 : 120_000;
    markReadTimers.current[activityId] = setTimeout(() => {
      markReadAndRemove(activityId);
      delete markReadTimers.current[activityId];
      delete markReadFlags.current[activityId];
    }, delay);
  };

  useEffect(() => {
    return () => {
      Object.values(markReadTimers.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  const updateAkField = async (activityId: number, paymentId: number | undefined, payload: { ak_approval?: string; ak_remarks?: string }) => {
    if (!paymentId) {
      setError('Payment not found for this activity');
      return;
    }
    setSavingIds((prev) => new Set(prev).add(activityId));
    try {
      await activityLogService.updateAkFields(activityId, payload);

      if (payload.ak_approval !== undefined) {
        setAkApprovals((prev) => ({ ...prev, [paymentId]: payload.ak_approval as AkApprovalStatus }));
      }
      if (payload.ak_remarks !== undefined) {
        setAkRemarks((prev) => ({ ...prev, [paymentId]: payload.ak_remarks ?? '' }));
      }

      scheduleMarkRead(activityId, { approval: payload.ak_approval !== undefined, remarks: payload.ak_remarks !== undefined });
      window.dispatchEvent(new Event('activityLog:updated'));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update AK fields');
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(activityId);
        return next;
      });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-custom-900">Updates</h1>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        {loading ? (
          <TableSkeleton rows={8} columns={9} />
        ) : items.length === 0 ? (
          <div className="text-center text-gray-custom-500 py-8">No updates yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead>
                <tr className="border-b border-gray-custom-200">
                  <th className="p-4 text-sm font-semibold text-gray-custom-500">Student Name</th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500">Type</th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500">Title</th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500">Description</th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500">AK Approval</th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500">AK Remarks</th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500">Student ID</th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500">Payment ID</th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500">Created At</th>
                  <th className="p-4 text-sm font-semibold text-gray-custom-500 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const akApproval = item.payment_id ? akApprovals[item.payment_id] : null;
                  return (
                  <tr key={item.id} className="border-b border-gray-custom-200 last:border-b-0">
                    <td className="p-4 text-gray-custom-800">
                      {item.student_id ? (
                        <button
                          className="text-left text-primary hover:underline"
                          onClick={() => navigate(`/students/${item.student_id}`)}
                        >
                          {studentNames[item.student_id] || 'Loading...'}
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-4 text-gray-custom-700 whitespace-nowrap">{item.activity_type}</td>
                    <td className="p-4 text-gray-custom-800">{item.title || '-'}</td>
                    <td className="p-4 text-gray-custom-600">{item.description || '-'}</td>
                    <td className="p-4">
                      {item.payment_id ? (
                        <select
                          className="rounded border border-gray-custom-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          value={akApproval || ''}
                          disabled={savingIds.has(item.id)}
                          onChange={(e) => updateAkField(item.id, item.payment_id, { ak_approval: e.target.value })}
                        >
                          <option value="">Select</option>
                          {AK_APPROVAL_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-custom-400">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      {item.payment_id ? (
                        <input
                          className="w-full rounded border border-gray-custom-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          value={akRemarks[item.payment_id] ?? ''}
                          disabled={savingIds.has(item.id)}
                          onChange={(e) => {
                            const value = e.target.value;
                            setAkRemarks((prev) => ({ ...prev, [item.payment_id as number]: value }));
                          }}
                          onBlur={(e) => updateAkField(item.id, item.payment_id, { ak_remarks: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              updateAkField(item.id, item.payment_id, { ak_remarks: (e.target as HTMLInputElement).value });
                            }
                          }}
                        />
                      ) : (
                        <span className="text-gray-custom-400">-</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-custom-600">{item.student_id ?? '-'}</td>
                    <td className="p-4 text-gray-custom-600">{item.payment_id ?? '-'}</td>
                    <td className="p-4 text-gray-custom-600 whitespace-nowrap">{formatDate(item.created_at)}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        {item.activity_type === 'student_added' && item.student_id ? (
                          <button
                            onClick={async () => {
                              navigate(`/students/${item.student_id}/edit`, {
                                state: { fromUpdates: true, activityId: item.id },
                              });
                            }}
                            className="text-primary font-medium hover:underline whitespace-nowrap"
                          >
                            Edit Student
                          </button>
                        ) : item.activity_type === 'payment_received' && item.student_id && item.payment_id ? (
                          <button
                            onClick={async () => {
                              navigate(`/students/${item.student_id}/payments/${item.payment_id}/edit`, {
                                state: { fromUpdates: true, activityId: item.id }
                              });
                            }}
                            className="text-primary font-medium hover:underline whitespace-nowrap"
                          >
                            Edit
                          </button>
                        ) : item.activity_type === 'ak_approval_updated' && item.student_id && item.payment_id ? (
                          <button
                            onClick={async () => {
                              navigate(`/students/${item.student_id}/payments/${item.payment_id}/edit`, {
                                state: { fromUpdates: true, activityId: item.id }
                              });
                            }}
                            className="text-primary font-medium hover:underline whitespace-nowrap"
                          >
                            View Payment
                          </button>
                        ) : (
                          <span className="text-gray-custom-400">-</span>
                        )}
                        <button
                          onClick={() => markReadAndRemove(item.id)}
                          className="text-sm text-gray-custom-500 hover:text-gray-custom-700 whitespace-nowrap"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdatesPage;

