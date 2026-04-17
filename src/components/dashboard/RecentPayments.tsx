import { useMemo, useState } from "react";
import { formatINR } from "../../lib/currency";
import { Link } from "react-router-dom";

type RecentPayment = {
  id: string;
  studentId: string;
  amount: number;
  date: string;
  payment_type?: string;
  created_at: string;
  payment_recieved_in?: string;
};
type StudentLike = { id: string | number; name: string };

interface RecentPaymentsProps {
  payments: RecentPayment[];
  studentMap: Map<string, StudentLike>;
}

const RecentPayments = ({ payments, studentMap }: RecentPaymentsProps) => {
  const [selectedBank, setSelectedBank] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedOption, setSelectedOption] = useState("Today");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string } | null>(null); 

  const itemsPerPage = 10;

  const banks: string[] = [
    "All",
    ...new Set(
      payments
        .map((p) => p.payment_recieved_in)
        .filter((bank): bank is string => Boolean(bank)),
    ),
  ];

  // ✅ Sort (latest first)
  const sortedPayments = useMemo(() => {
    return [...payments].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [payments]);

  // ✅ Filter for date rangle and today section
const filteredPayments = useMemo(() => {
  let result = [...sortedPayments];

  // ✅ Bank filter
  if (selectedBank !== "All") {
    result = result.filter((p) => p.payment_recieved_in === selectedBank);
  }

  // ✅ Date filter
  if (selectedOption === "Today") {
    const today = new Date().toDateString();

    result = result.filter(
      (p) => new Date(p.date).toDateString() === today
    );
  }

  if (selectedOption === "Custom" && appliedRange) {
    const from = new Date(appliedRange.from).setHours(0, 0, 0, 0);
    const to = new Date(appliedRange.to).setHours(23, 59, 59, 999);

    result = result.filter((p) => {
      const paymentDate = new Date(p.date).getTime();
      return paymentDate >= from && paymentDate <= to;
    });
  }

  return result;
}, [sortedPayments, selectedBank, selectedOption, appliedRange]);


// filter for bank only comment it when you use filters for date range and today section
// const filteredPayments = useMemo(() => {
//   let result = [...sortedPayments];

//   if (selectedBank !== "All") {
//     result = result.filter((p) => p.payment_recieved_in === selectedBank);
//   }

//   return result;
// }, [sortedPayments, selectedBank]);



  // ✅ Pagination
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);

  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );


  // ✅ Get min and max date for date picker limits
  const { minDate, maxDate } = useMemo(() => {
  if (payments.length === 0) {
    return { minDate: "", maxDate: "" };
  }

  const dates = payments.map((p) => new Date(p.date));

  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));

  const format = (d: Date) => d.toISOString().split("T")[0];

  return {
    minDate: format(min),
    maxDate: format(max),
  };
}, [payments]);

  return (
    <div className="overflow-x-auto">
      <h2 className=" mb-5 text-lg font-semibold text-gray-800">Recent Payments</h2>

      
      <div className="flex items-center mb-4">
        

        {/* Filter */}
        <div className="flex gap-5 items-center">
           <div className="flex gap-2 items-center">
          <label className="text-[15px] text-black">Select Banks</label>
          <select
            value={selectedBank}
            onChange={(e) => {
              setSelectedBank(e.target.value);
              setCurrentPage(1); // ✅ reset page
            }}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {banks.map((bank) => (
              <option key={bank} value={bank}>
                {bank}
              </option>
            ))}
          </select>
          </div>


          <label className="text-[15px] text-black">Select date</label>
          <select
            value={selectedOption}
          onChange={(e) => setSelectedOption(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Today">Today</option>
<option value="Custom">Custom</option>
          </select>


            {/* select date range -  custom (opens date picker) */}
          {selectedOption === "Custom" && (
        <div className="flex items-center gap-2">
          <label className="text-[15px] text-black mr-2">
            Select date range
          </label>

          <label htmlFor="from">From:</label>
        <input
  type="date"
  value={fromDate}
  min={minDate}
  max={maxDate}
  onChange={(e) => setFromDate(e.target.value)}
  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
/>

          <label htmlFor="to">To:</label>
        <input
  type="date"
  value={toDate}
  min={minDate}
  max={maxDate}
  onChange={(e) => setToDate(e.target.value)}
  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
/>

        <button
  onClick={() => {
    if (fromDate && toDate) {
      setAppliedRange({ from: fromDate, to: toDate });
      setCurrentPage(1); // reset pagination
    }
  }}
  className="bg-blue-500 text-white px-4 py-1.5 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  Apply
</button>
        </div>
      )}
        
       
        </div>



        
      </div>


      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-custom-200">
            <th className="p-3 text-sm font-semibold text-gray-custom-500">
              Student
            </th>
            <th className="p-3 text-sm font-semibold text-gray-custom-500">
              Amount
            </th>
            <th className="p-3 text-sm font-semibold text-gray-custom-500">
              Date
            </th>
            <th className="p-3 text-sm font-semibold text-gray-custom-500">
              Payment Type
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {paginatedPayments.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-3 text-center text-gray-500">
                No payments found
              </td>
            </tr>
          ) : (
            paginatedPayments.map((payment) => {
              const student = studentMap.get(String(payment.studentId));
              return (
                <tr key={payment.id}>
                  <td className="p-3">
                    {student ? (
                      <Link
                        to={`/students/${student.id}`}
                        className="font-medium text-gray-custom-800 hover:text-primary hover:underline"
                      >
                        {student.name}
                      </Link>
                    ) : (
                      <span className="text-gray-custom-500">Unknown</span>
                    )}
                  </td>
                  <td className="p-3 font-medium text-gray-custom-900">
                    {formatINR(payment.amount)}
                  </td>
                  <td className="p-3 text-gray-custom-600">
                    {new Date(payment.date).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-gray-custom-600">
                    {payment.payment_type || "-"}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <div className="flex justify-end items-center gap-2 mt-4">
        <span className="text-xs text-gray-500 mr-2">
          Page {currentPage} of {totalPages || 1}
        </span>

        <button
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-100 disabled:opacity-40"
        >
          Prev
        </button>

        <button
          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
          disabled={currentPage === totalPages || totalPages === 0}
          className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-100 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default RecentPayments;
