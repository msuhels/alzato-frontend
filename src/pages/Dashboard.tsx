import { useEffect, useMemo, useState } from "react";
import { Users, IndianRupee } from "lucide-react";
import { formatINR } from "../lib/currency";
import StatCard from "../components/dashboard/StatCard";
import StudentsByZoneChart from "../components/dashboard/StudentsByZoneChart";
import RevenueByZonePieChart from "../components/dashboard/RevenueByZonePieChart";
import FourYearRevenueChart from "../components/dashboard/FourYearRevenueChart";
import RecentPayments from "../components/dashboard/RecentPayments";
import { paymentsService, PaymentListItem } from "../services/payments";
import { studentsService, StudentListItem } from "../services/students";
import LoadingSpinner from "../components/LoadingSpinner";

const YEARS = Array.from({ length: 2040 - 2020 + 1 }, (_, i) => 2020 + i);

const selectCls =
  "rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const DashboardPage = () => {
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
  const [students, setStudents] = useState<StudentListItem[]>([]);
   const [loading, setLoading] = useState(true);

  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  // 🔹 Load data
  useEffect(() => {
    const load = async () => {
      try {
        const [{ items: paymentsItems }, { items: studentsItems }] =
          await Promise.all([
            paymentsService.list({
              limit: 10000,
              offset: 0,
              sort_by: "installment_date",
              sort_dir: "desc",
            }),
            studentsService.list({ limit: 10000, offset: 0 }),
          ]);

        setPayments(paymentsItems);
        setStudents(studentsItems);
        console.log(studentsItems[0].intake_year);
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ✅ 1. Filter students by intake year
  const studentsThisPeriod = useMemo(() => {
    return students.filter((s) => {
      if (!s.intake_year) return false;

      // ✅ FIX: intake_year is already a number
      return Number(s.intake_year) === selectedYear;
    });
  }, [students, selectedYear]);

  // ✅ 2. Extract student IDs
  const studentIdsThisPeriod = useMemo(() => {
    return new Set(studentsThisPeriod.map((s) => String(s.id)));
  }, [studentsThisPeriod]);

  // ✅ 3. Filter payments based on those students
  const paymentsThisPeriod = useMemo(() => {
    return payments.filter((p) =>
      studentIdsThisPeriod.has(String(p.student_id)),
    );
  }, [payments, studentIdsThisPeriod]);

  // ✅ 4. Total students
  const totalStudents = useMemo(
    () => studentsThisPeriod.length,
    [studentsThisPeriod],
  );

  // ✅ 5. Revenue (based ONLY on filtered students)
  const netRevenueThisYear = useMemo(() => {
    return (
      paymentsThisPeriod.reduce((sum, p) => sum + (p.amount || 0), 0) * 1000
    );
  }, [paymentsThisPeriod]);

  // ✅ 6. Recent payments (filtered)
  const recentPayments = useMemo(
    () =>
      paymentsThisPeriod.map((p) => ({
        id: String(p.id),
        studentId: String(p.student_id),
        amount: (p.amount || 0) * 1000,
        created_at: p.created_at,
        payment_recieved_in: p.payment_recieved_in,
        date: p.installment_date,
        payment_type: p.payment_type,
      })),
    [paymentsThisPeriod],
  );

  // ✅ 7. Student map (only filtered students)
  const studentMap = useMemo(
    () => new Map(studentsThisPeriod.map((s) => [String(s.id), s])),
    [studentsThisPeriod],
  );

  // ✅ 8. Charts should also use filtered data
  const currentYear = new Date().getFullYear();

  const fiveYearRange = useMemo(() => {
    return [
      currentYear - 2,
      currentYear - 1,
      currentYear,
      currentYear + 1,
      currentYear + 2,
    ];
  }, []);

  const fiveYearRevenueData = useMemo(() => {
    // ✅ Step 1: Map studentId -> intake_year
    const studentYearMap = new Map<string, number>();

    students.forEach((s) => {
      if (s.intake_year) {
        studentYearMap.set(String(s.id), Number(s.intake_year));
      }
    });

    // ✅ Step 2: Initialize revenue map
    const revenueMap = new Map<number, number>();
    fiveYearRange.forEach((year) => revenueMap.set(year, 0));

    // ✅ Step 3: Aggregate payments by intake year
    payments.forEach((p) => {
      const studentYear = studentYearMap.get(String(p.student_id));

      if (!studentYear) return;

      if (revenueMap.has(studentYear)) {
        revenueMap.set(
          studentYear,
          revenueMap.get(studentYear)! + (p.amount || 0),
        );
      }
    });

    // ✅ Step 4: Convert to chart format
    return fiveYearRange.map((year) => ({
      date: `${year}-01-01`,
      amount: (revenueMap.get(year) || 0) * 1000,
    }));
  }, [students, payments, fiveYearRange]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <LoadingSpinner size="lg" className="mb-4" />
                    <p className="text-gray-custom-500">Loading dashboard data...</p>
                </div>
            </div>
        );
    }

return (
  <div className="space-y-8">

    {/* HEADER */}
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

      <div>
        <h1 className="text-3xl font-bold text-gray-custom-900">
          Welcome back, Admin!
        </h1>
        <p className="text-gray-custom-500 mt-1">
          Here's a snapshot of your institution's performance.
        </p>
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-200">
        
        <span className="text-xs font-semibold uppercase text-gray-custom-500">
          Year
        </span>

        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className={`${selectCls} w-24`}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <button
          onClick={() => setSelectedYear(today.getFullYear())}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-custom-500 hover:bg-gray-50 transition"
        >
          Reset
        </button>
      </div>
    </div>

    {/* ===================== TOP DASHBOARD ===================== */}
   <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

  {/* ================= LEFT: STAT CARDS ================= */}
  <div className="lg:col-span-3 flex flex-col gap-4">

    <div className="grid grid-cols-1 gap-4">

      <StatCard
        icon={IndianRupee}
        title={`Net Revenue – ${selectedYear}`}
        value={formatINR(netRevenueThisYear)}
        change=""
        changeType="increase"
        showChange={false}
      />

      <StatCard
        icon={Users}
        title="Total Students"
        value={totalStudents.toString()}
        change=""
        changeType="increase"
        showChange={false}
        size="sm"
      />

    </div>
  </div>

  {/* ================= MIDDLE: STUDENTS BY ZONE ================= */}
  <div className="lg:col-span-5">
    <div className="rounded-xl bg-white/90 backdrop-blur p-6 shadow-sm ring-1 ring-gray-200 h-full flex flex-col">

      <h2 className="text-lg font-semibold text-gray-custom-900 mb-2">
        Students by Zone
      </h2>

      <div className="flex-1">
        <StudentsByZoneChart students={studentsThisPeriod} />
      </div>

    </div>
  </div>

  {/* ================= RIGHT: REVENUE BY ZONE ================= */}
  <div className="lg:col-span-4">
    <div className="rounded-xl bg-white/90 backdrop-blur p-6 shadow-sm ring-1 ring-gray-200 h-full flex flex-col">

      <h2 className="text-lg font-semibold text-gray-custom-900 mb-1">
        Revenue by Zone
      </h2>

      <p className="text-sm text-gray-custom-500 mb-3">
        Year {selectedYear}
      </p>

      <div className="flex-1">
        <RevenueByZonePieChart
          payments={paymentsThisPeriod}
          studentMap={studentMap}
          year={selectedYear}
        />
      </div>

    </div>
  </div>

</div>

    {/* ===================== CHART SECTION ===================== */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

      <div className="lg:col-span-12 rounded-xl bg-white/90 backdrop-blur p-6 shadow-sm ring-1 ring-gray-200">
        <h2 className="text-lg font-semibold mb-4">
          5 Years Revenue (Previous 2 to Next 2)
        </h2>

        <FourYearRevenueChart
          payments={fiveYearRevenueData}
          payouts={[]}
          onYearSelect={(y) => setSelectedYear(y)}
        />
      </div>

    </div>

    {/* ===================== RECENT ===================== */}
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <RecentPayments
        payments={recentPayments}
        studentMap={studentMap}
      />
    </div>

  </div>
)};

export default DashboardPage;
