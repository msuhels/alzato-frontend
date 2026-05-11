import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentsService, PaymentListItem } from '../services/payments';
import { studentsService } from '../services/students';
import TableSkeleton from '../components/TableSkeleton';
import { formatDate } from '../lib/dateUtils';
import { formatINR } from '../lib/currency';
import { AkApprovalStatus } from '../types';
import { AK_APPROVAL_OPTIONS } from '../lib/constants';
import LoadingSpinner from '../components/LoadingSpinner';
import { Info } from 'lucide-react';

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

const UpdatesPage = () => {
  const [items, setItems] = useState<PaymentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentNames, setStudentNames] = useState<Record<number, string>>({});
  const [studentAssociateInstallments, setStudentAssociateInstallments] = useState<Record<number, string>>({});
  const [akApprovals, setAkApprovals] = useState<Record<number, AkApprovalStatus | null>>({});
  const [akRemarks, setAkRemarks] = useState<Record<number, string>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const navigate = useNavigate();
  const markReadTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const markReadFlags = useRef<Record<number, { approval: boolean; remarks: boolean }>>({});
  const tableRef = useRef<HTMLTableElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const barScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(2000);

  /* [COMMENTED OUT - ORIGINAL FUNCTIONALITY - START]
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await paymentsService.listUnread({ limit: 100, offset: 0 });
        setItems(res.items || []);
        
        // Fetch student names and associate installments for all unique student IDs
        const studentIds = [...new Set((res.items || []).map(item => item.student_id).filter((id): id is number => id !== undefined && id !== null))];
        const namesMap: Record<number, string> = {};
        const associateInstallmentsMap: Record<number, string> = {};
        
        await Promise.all(
          studentIds.map(async (studentId) => {
            try {
              const { student } = await studentsService.get(studentId);
              namesMap[studentId] = student?.name || '-';
              associateInstallmentsMap[studentId] = student?.associate_wise_installments || '-';
            } catch {
              namesMap[studentId] = '-';
              associateInstallmentsMap[studentId] = '-';
            }
          })
        );
        
        setStudentNames(namesMap);
        setStudentAssociateInstallments(associateInstallmentsMap);
        
        // Extract AK approval and remarks from payments directly
        const approvalMap: Record<number, AkApprovalStatus | null> = {};
        const remarksMap: Record<number, string> = {};
        
        (res.items || []).forEach((payment) => {
          const paymentId = typeof payment.id === 'number' ? payment.id : parseInt(String(payment.id));
          if (payment.ak_approval && ['Completed', 'No', 'Partial', 'Suspense'].includes(payment.ak_approval)) {
            approvalMap[paymentId] = payment.ak_approval as AkApprovalStatus;
          }
          if (payment.ak_remarks) {
            remarksMap[paymentId] = payment.ak_remarks;
          }
        });
        
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
  [COMMENTED OUT - ORIGINAL FUNCTIONALITY - END] */

  // [NEW FUNCTIONALITY] - Fetch payments from last 24 hours
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Calculate date 24 hours ago
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const createdFrom = twentyFourHoursAgo.toISOString().split('T')[0]; // Format: YYYY-MM-DD

        const res = await paymentsService.list({
          limit: 100,
          offset: 0,
          created_from: createdFrom
        });
        setItems(res.items || []);

        // Fetch student names and associate installments for all unique student IDs
        const studentIds = [...new Set((res.items || []).map(item => item.student_id).filter((id): id is number => id !== undefined && id !== null))];
        const namesMap: Record<number, string> = {};
        const associateInstallmentsMap: Record<number, string> = {};

        await Promise.all(
          studentIds.map(async (studentId) => {
            try {
              const { student } = await studentsService.get(studentId);
              namesMap[studentId] = student?.name || '-';
              associateInstallmentsMap[studentId] = student?.associate_wise_installments || '-';
            } catch {
              namesMap[studentId] = '-';
              associateInstallmentsMap[studentId] = '-';
            }
          })
        );

        setStudentNames(namesMap);
        setStudentAssociateInstallments(associateInstallmentsMap);

        // Extract AK approval and remarks from payments directly
        const approvalMap: Record<number, AkApprovalStatus | null> = {};
        const remarksMap: Record<number, string> = {};

        (res.items || []).forEach((payment) => {
          const paymentId = typeof payment.id === 'number' ? payment.id : parseInt(String(payment.id));
          if (payment.ak_approval && ['Completed', 'No', 'Partial', 'Suspense'].includes(payment.ak_approval)) {
            approvalMap[paymentId] = payment.ak_approval as AkApprovalStatus;
          }
          if (payment.ak_remarks) {
            remarksMap[paymentId] = payment.ak_remarks;
          }
        });

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

  const markReadAndRemove = async (paymentId: number | string) => {
    try {
      await paymentsService.markRead(paymentId);
      setItems((prev) => prev.filter((item) => String(item.id) !== String(paymentId)));
      window.dispatchEvent(new Event('activityLog:updated'));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to mark payment as read');
    }
  };

  const scheduleMarkRead = (paymentId: number | string, changed: { approval?: boolean; remarks?: boolean }) => {
    const idNum = typeof paymentId === 'number' ? paymentId : parseInt(String(paymentId));
    const existingFlags = markReadFlags.current[idNum] || { approval: false, remarks: false };
    const nextFlags = {
      approval: existingFlags.approval || !!changed.approval,
      remarks: existingFlags.remarks || !!changed.remarks,
    };
    markReadFlags.current[idNum] = nextFlags;

    if (markReadTimers.current[idNum]) {
      clearTimeout(markReadTimers.current[idNum]);
    }

    const delay = nextFlags.approval && nextFlags.remarks ? 30_000 : 120_000;
    markReadTimers.current[idNum] = setTimeout(() => {
      markReadAndRemove(paymentId);
      delete markReadTimers.current[idNum];
      delete markReadFlags.current[idNum];
    }, delay);
  };

  useEffect(() => {
    return () => {
      Object.values(markReadTimers.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  const updateAkField = async (paymentId: number | string, payload: { ak_approval?: string; ak_remarks?: string }) => {
    setSavingIds((prev) => new Set(prev).add(typeof paymentId === 'number' ? paymentId : parseInt(String(paymentId))));
    try {
      await paymentsService.updateAkFields(paymentId, payload);

      const idNum = typeof paymentId === 'number' ? paymentId : parseInt(String(paymentId));
      if (payload.ak_approval !== undefined) {
        setAkApprovals((prev) => ({ ...prev, [idNum]: payload.ak_approval as AkApprovalStatus }));
      }
      if (payload.ak_remarks !== undefined) {
        setAkRemarks((prev) => ({ ...prev, [idNum]: payload.ak_remarks ?? '' }));
      }

      scheduleMarkRead(paymentId, { approval: payload.ak_approval !== undefined, remarks: payload.ak_remarks !== undefined });
      window.dispatchEvent(new Event('activityLog:updated'));
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to update AK fields');
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        const idNum = typeof paymentId === 'number' ? paymentId : parseInt(String(paymentId));
        next.delete(idNum);
        return next;
      });
    }
  };

  // Calculate installment counts per student
  const installmentCounts = useMemo(() => {
    const counts: Record<number, Record<number, number>> = {};

    items.forEach((item) => {
      const studentId = typeof item.student_id === 'number' ? item.student_id : parseInt(String(item.student_id));
      const installmentNum = item.installment_number;

      if (studentId && installmentNum !== undefined) {
        if (!counts[studentId]) {
          counts[studentId] = {};
        }
        counts[studentId][installmentNum] = (counts[studentId][installmentNum] || 0) + 1;
      }
    });

    return counts;
  }, [items]);

  // Update scroll width when table changes
  useEffect(() => {
    const updateScrollWidth = () => {
      setScrollWidth(tableRef.current?.scrollWidth || 2000);
    };

    updateScrollWidth();
    window.addEventListener('resize', updateScrollWidth);
    return () => window.removeEventListener('resize', updateScrollWidth);
  }, [items, loading]);

  // Sync horizontal scroll between table and scrollbar
  const syncHorizontalScroll = (from: 'table' | 'bar') => {
    const source = from === 'table' ? tableScrollRef.current : barScrollRef.current;
    const target = from === 'table' ? barScrollRef.current : tableScrollRef.current;
    if (!source || !target) return;
    if (target.scrollLeft !== source.scrollLeft) {
      target.scrollLeft = source.scrollLeft;
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
          <div className="min-w-[2000px]">
            <TableSkeleton rows={8} columns={12} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-custom-500 py-8">No updates yet.</div>
        ) : (
          <div className="relative pb-24">
            <div
              className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              ref={tableScrollRef}
              onScroll={() => syncHorizontalScroll('table')}
            >
              <table ref={tableRef} className="w-full min-w-[2000px] text-left">
                <thead>
                  <tr className="border-b border-gray-custom-200">
                    <th className="p-4 text-sm font-semibold text-gray-custom-500 whitespace-nowrap">Student Name</th>
                    <th className="p-4 text-sm font-semibold text-gray-custom-500 whitespace-nowrap">Term package</th>
                    <th className="p-4 text-sm font-semibold text-gray-custom-500 whitespace-nowrap">Date</th>
                    <th className="p-4 text-sm font-semibold text-gray-custom-500 whitespace-nowrap">Installment</th>
                    <th className="p-4 text-sm font-semibold text-gray-custom-500 whitespace-nowrap">Installment count</th>
                    <th className="p-4 text-sm font-semibold text-gray-custom-500 whitespace-nowrap">Amount</th>
                    <th className="p-4 text-sm font-semibold text-gray-custom-500 whitespace-nowrap">Purpose</th>
                    <th className="p-4 text-sm font-semibold text-gray-custom-500 whitespace-nowrap">Received In</th>
                    <th className="p-4 text-sm font-semibold text-gray-custom-500 whitespace-nowrap">Remarks</th>
                    <th className="p-4 text-sm font-semibold text-gray-custom-500 whitespace-nowrap">AK Approval</th>
                    <th className="p-4 text-sm font-semibold text-gray-custom-500 whitespace-nowrap">AK Remarks</th>
                    {/* <th className="p-4 text-sm font-semibold text-gray-custom-500 whitespace-nowrap">Created At</th> */}
                    <th className="p-4 text-sm font-semibold text-gray-custom-500 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const paymentId = typeof item.id === 'number' ? item.id : parseInt(String(item.id));
                    const akApproval = akApprovals[paymentId] || item.ak_approval || null;
                    const studentId = typeof item.student_id === 'number' ? item.student_id : parseInt(String(item.student_id));
                    const installmentNum = item.installment_number;
                    const installmentCount = installmentNum !== undefined && installmentCounts[studentId]
                      ? installmentCounts[studentId][installmentNum] || 0
                      : 0;

                    return (
                      <tr key={item.id} className="border-b border-gray-custom-200 last:border-b-0">
                        <td className="p-4 text-gray-custom-800 whitespace-nowrap">
                          {item.student_id ? (
                            <button
                              className="text-left text-primary hover:underline flex items-center gap-2"
                              onClick={() => navigate(`/students/${item.student_id}`)}
                            >
                              {studentNames[studentId] ? (
                                studentNames[studentId]
                              ) : (
                                <>
                                  <LoadingSpinner size="sm" />
                                  <span className="text-gray-custom-500">Loading...</span>
                                </>
                              )}
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-4 text-gray-custom-600 whitespace-nowrap">
                          {studentAssociateInstallments[studentId] || '-'}
                        </td>
                        <td className="p-4 text-gray-custom-600 whitespace-nowrap">{formatDate(item.installment_date)}</td>
                        <td className="p-4 text-gray-custom-700 font-medium whitespace-nowrap">#{item.installment_number || '-'}</td>
                        <td className="p-4 text-gray-custom-600 whitespace-nowrap text-center">
                          {installmentCount > 0 ? (
                            `Installment ${item.installment_number} - ${installmentCount}`

                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-4 text-gray-custom-800 font-medium whitespace-nowrap">{formatINR(item.amount)}</td>
                        <td className="p-4 text-gray-custom-600 whitespace-nowrap">{item.purpose || '-'}</td>
                        <td className="p-4 text-gray-custom-600 whitespace-nowrap">{item.payment_recieved_in || '-'}</td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <RemarksTooltip remarks={item.remarks} />
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <select
                            className="rounded border border-gray-custom-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            value={akApproval || ''}
                            disabled={savingIds.has(paymentId)}
                            onChange={(e) => updateAkField(item.id, { ak_approval: e.target.value })}
                          >
                            <option value="">Select</option>
                            {AK_APPROVAL_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <input
                            className="w-full rounded border border-gray-custom-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            value={akRemarks[paymentId] ?? item.ak_remarks ?? ''}
                            disabled={savingIds.has(paymentId)}
                            onChange={(e) => {
                              const value = e.target.value;
                              setAkRemarks((prev) => ({ ...prev, [paymentId]: value }));
                            }}
                            onBlur={(e) => updateAkField(item.id, { ak_remarks: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                updateAkField(item.id, { ak_remarks: (e.target as HTMLInputElement).value });
                              }
                            }}
                            placeholder="Enter remarks..."
                          />
                        </td>
                        {/* <td className="p-4 text-gray-custom-600 whitespace-nowrap">{formatDate(item.created_at)}</td> */}
                        <td className="p-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-3">
                            {item.student_id ? (
                              <button
                                onClick={async () => {
                                  navigate(`/students/${item.student_id}/payments/${item.id}/edit`, {
                                    state: { fromUpdates: true, payment: item }
                                  });
                                }}
                                className="text-primary font-medium hover:underline whitespace-nowrap"
                              >
                                Edit
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

            <div className="sticky bottom-[-15px] left-0 right-0 bg-white pt-2 border-gray-custom-200 z-30">
              <div
                className="overflow-x-auto"
                ref={barScrollRef}
                onScroll={() => syncHorizontalScroll('bar')}
              >
                <div className="h-3" style={{ width: `${scrollWidth}px` }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdatesPage;

