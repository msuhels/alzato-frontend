import { } from 'react';
import { formatINR } from '../../lib/currency';
import { Link } from 'react-router-dom';
type RecentPayment = { id: string; studentId: string; amount: number; date: string; payment_type?: string };
type StudentLike = { id: string | number; name: string };

interface RecentPaymentsProps {
  payments: RecentPayment[];
  studentMap: Map<string, StudentLike>;
}

const RecentPayments = ({ payments, studentMap }: RecentPaymentsProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-custom-200">
            <th className="p-3 text-sm font-semibold text-gray-custom-500">Student</th>
            <th className="p-3 text-sm font-semibold text-gray-custom-500">Amount</th>
            <th className="p-3 text-sm font-semibold text-gray-custom-500">Date</th>
            <th className="p-3 text-sm font-semibold text-gray-custom-500">Payment Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {payments.map(payment => {
            const student = studentMap.get(String(payment.studentId));
            return (
              <tr key={payment.id}>
                <td className="p-3">
                  {student ? (
                     <Link to={`/students/${student.id}`} className="font-medium text-gray-custom-800 hover:text-primary hover:underline">
                        {student.name}
                     </Link>
                  ) : (
                    <span className="text-gray-custom-500">Unknown</span>
                  )}
                </td>
                <td className="p-3 font-medium text-gray-custom-900">{formatINR(payment.amount)}</td>
                <td className="p-3 text-gray-custom-600">{new Date(payment.date).toLocaleDateString()}</td>
                <td className="p-3 text-gray-custom-600">{payment.payment_type || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RecentPayments;
