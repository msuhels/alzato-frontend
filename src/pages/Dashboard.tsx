import { useEffect, useMemo, useState } from 'react';
import { Users, CreditCard, UserPlus } from 'lucide-react';
import { IndianRupee } from 'lucide-react';
import { formatINR } from '../lib/currency';
import StatCard from '../components/dashboard/StatCard';
// import RevenueChart from '../components/dashboard/RevenueChart';
import StudentsByZoneChart from '../components/dashboard/StudentsByZoneChart';
import RevenueByZonePieChart from '../components/dashboard/RevenueByZonePieChart';
import YearlyRevenueChart from '../components/dashboard/YearlyRevenueChart';
import FourYearRevenueChart from '../components/dashboard/FourYearRevenueChart';
import RecentPayments from '../components/dashboard/RecentPayments';
import { paymentsService, PaymentListItem } from '../services/payments';
import { studentsService, StudentListItem } from '../services/students';
import LoadingSpinner from '../components/LoadingSpinner';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const YEARS = Array.from({ length: 2040 - 2020 + 1 }, (_, i) => 2020 + i); // 2020 → 2040

const selectCls = 'rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

const DashboardPage = () => {
    const [payments, setPayments] = useState<PaymentListItem[]>([]);
    const [students, setStudents] = useState<StudentListItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [{ items: paymentsItems }, { items: studentsItems }] = await Promise.all([
                    paymentsService.list({ limit: 10000, offset: 0, sort_by: 'installment_date', sort_dir: 'desc' }),
                    studentsService.list({ limit: 100, offset: 0 }),
                ]);
                setPayments(paymentsItems);
                setStudents(studentsItems);
            } catch (error) {
                console.error('Failed to load dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Aggregate revenue from students table
    // Note: Amounts are stored in thousands, so multiply by 1000 for display
    const totalReceived = useMemo(() => {
        return students.reduce((sum, s) => sum + (s.recieved_amount ?? s.received_amount ?? 0), 0) * 1000;
    }, [students]);
    const totalNetRevenue = useMemo(() => {
        // Use received_amount (total revenue received) instead of net_amount (remaining to be paid)
        return totalReceived;
    }, [totalReceived]);

    const totalStudents = useMemo(() => students.length, [students]);

    const today = new Date();
    // selectedMonth: null = All Months, 0–11 = specific month
    const [selectedMonth, setSelectedMonth] = useState<number | null>(today.getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

    // Derived period boundaries based on selectedMonth + selectedYear
    const periodStart = useMemo(() =>
        selectedMonth === null
            ? new Date(selectedYear, 0, 1)           // Jan 1 of year
            : new Date(selectedYear, selectedMonth, 1),
        [selectedMonth, selectedYear]
    );
    const periodEnd = useMemo(() =>
        selectedMonth === null
            ? new Date(selectedYear + 1, 0, 1)       // Jan 1 of next year
            : new Date(selectedYear, selectedMonth + 1, 1),
        [selectedMonth, selectedYear]
    );
    // Previous period for comparison (prev month or prev year)
    const prevPeriodStart = useMemo(() =>
        selectedMonth === null
            ? new Date(selectedYear - 1, 0, 1)
            : new Date(selectedYear, selectedMonth - 1, 1),
        [selectedMonth, selectedYear]
    );
    const prevPeriodEnd = useMemo(() => periodStart, [periodStart]);

    // Label shown in card titles
    const periodLabel = useMemo(() =>
        selectedMonth === null
            ? String(selectedYear)
            : `${MONTHS[selectedMonth]} ${selectedYear}`,
        [selectedMonth, selectedYear]
    );
    // Keep selectedMonthStart as a derived Date for chart compatibility
    const selectedMonthStart = useMemo(() => periodStart, [periodStart]);
    const selectedMonthLabel = useMemo(() => periodLabel, [periodLabel]);

    // Yearly revenue filtered by selectedYear
    const netRevenueThisYear = useMemo(
        () => payments
            .filter(p => p.installment_date && new Date(p.installment_date).getFullYear() === selectedYear)
            .reduce((sum, p) => sum + (p.amount || 0), 0) * 1000,
        [payments, selectedYear]
    );

    // Period payments (month or full year depending on selectedMonth)
    const paymentsThisMonthAll = useMemo(
        () => payments.filter(p => {
            const d = new Date(p.installment_date);
            return d >= periodStart && d < periodEnd;
        }),
        [payments, periodStart, periodEnd]
    );
    const receivedAmountThisMonth = useMemo(() => paymentsThisMonthAll.reduce((sum, p) => sum + (p.amount || 0), 0) * 1000, [paymentsThisMonthAll]);
    const netRevenueThisMonth = useMemo(() => receivedAmountThisMonth, [receivedAmountThisMonth]);

    // Previous period payments for comparison
    const prevMonthPayments = useMemo(
        () => payments.filter(p => {
            const d = new Date(p.installment_date);
            return d >= prevPeriodStart && d < prevPeriodEnd;
        }),
        [payments, prevPeriodStart, prevPeriodEnd]
    );
    const prevNetRevenue = useMemo(() => prevMonthPayments.reduce((s, p) => s + (p.amount || 0), 0) * 1000, [prevMonthPayments]);

    // Revenue % change vs previous period
    const netRevenueMoM = useMemo(() => {
        if (prevNetRevenue === 0) {
            if (netRevenueThisMonth === 0) return { text: '0%', type: 'increase' as const };
            return { text: '+100%', type: 'increase' as const };
        }
        const delta = ((netRevenueThisMonth - prevNetRevenue) / prevNetRevenue) * 100;
        const type = delta >= 0 ? 'increase' : 'decrease';
        const text = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
        return { text, type } as const;
    }, [netRevenueThisMonth, prevNetRevenue]);

    // New students in selected period
    const studentsThisMonth = useMemo(
        () => students.filter(s => s.created_at && new Date(s.created_at) >= periodStart && new Date(s.created_at) < periodEnd),
        [students, periodStart, periodEnd]
    );
    const studentsPrevMonth = useMemo(
        () => students.filter(s => s.created_at && new Date(s.created_at) >= prevPeriodStart && new Date(s.created_at) < prevPeriodEnd),
        [students, prevPeriodStart, prevPeriodEnd]
    );
    const newStudentsCountThisMonth = useMemo(() => studentsThisMonth.length, [studentsThisMonth]);
    const newStudentsCountPrevMonth = useMemo(() => studentsPrevMonth.length, [studentsPrevMonth]);
    const newStudentsMoM = useMemo(() => {
        if (newStudentsCountPrevMonth === 0) {
            if (newStudentsCountThisMonth === 0) return { text: '0%', type: 'increase' as const };
            return { text: '+100%', type: 'increase' as const };
        }
        const delta = ((newStudentsCountThisMonth - newStudentsCountPrevMonth) / newStudentsCountPrevMonth) * 100;
        const type = delta >= 0 ? 'increase' : 'decrease';
        const text = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
        return { text, type } as const;
    }, [newStudentsCountThisMonth, newStudentsCountPrevMonth]);

    // Students in selected period for zone chart
    const studentsThisPeriod = useMemo(
        () => students.filter(s => s.created_at && new Date(s.created_at) >= periodStart && new Date(s.created_at) < periodEnd),
        [students, periodStart, periodEnd]
    );

    const recentPayments = useMemo(() => payments.map(p => ({
        id: String(p.id),
        studentId: String(p.student_id),
        amount: (p.amount || 0) * 1000, // Convert from thousands to actual amount
        created_at: p.created_at,
        payment_recieved_in: p.payment_recieved_in,
        date: p.installment_date,
        payment_type: p.payment_type,
    })), [payments]);
    // Normalize keys to string to align with recentPayments.studentId (string)
    const studentMap = useMemo(() => new Map<string, StudentListItem>(students.map(s => [String(s.id), s])), [students]);

    // For charts: use all payments
    const receivedPaymentsForChart = useMemo(() => payments, [payments]);

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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-custom-900">Welcome back, Admin!</h1>
                    <p className="text-gray-custom-500 mt-1">Here's a snapshot of your institution's performance.</p>
                </div>
                {/* ── Filters (right side) ── */}
                <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-200 self-start">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-custom-500">Month</span>
                        <select
                            value={selectedMonth === null ? 'all' : selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value === 'all' ? null : Number(e.target.value))}
                            className={selectCls}
                        >
                            <option value="all">All Months</option>
                            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                    </div>
                    <div className="h-4 w-px bg-gray-200" />
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-custom-500">Year</span>
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(Number(e.target.value))}
                            className={`${selectCls} w-24`}
                        >
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <button
                        onClick={() => {
                            setSelectedMonth(today.getMonth());
                            setSelectedYear(today.getFullYear());
                        }}
                        className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-custom-500 hover:bg-gray-custom-50 transition-colors"
                    >
                        Reset
                    </button>
                </div>
            </div>

            {/* Stat Cards + Students by Zone */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatCard 
                            icon={IndianRupee}
                            title="Total Net Revenue"
                            value={formatINR(totalNetRevenue)}
                            subText={`Total: ${formatINR(totalReceived)} • Students: ${totalStudents}`}
                            change=""
                            changeType="increase"
                            showChange={false}
                        />
                        <StatCard
                            icon={CreditCard}
                            title={`Revenue – ${selectedMonthLabel}`}
                            value={formatINR(netRevenueThisMonth)}
                            subText={`vs prev month: ${formatINR(prevNetRevenue)}`}
                            change={netRevenueMoM.text}
                            changeType={netRevenueMoM.type}
                        />
                        <StatCard
                            icon={UserPlus}
                            title={`New Students – ${selectedMonthLabel}`}
                            value={newStudentsCountThisMonth.toString()}
                            change={newStudentsMoM.text}
                            changeType={newStudentsMoM.type}
                            size="sm"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="rounded-xl bg-white/90 backdrop-blur p-6 shadow-sm ring-1 ring-gray-200 h-full flex flex-col">
                    <h2 className="text-lg font-semibold text-gray-custom-900 mb-1">Students by Zone</h2>
                    <p className="text-sm text-gray-custom-500 mb-3">{selectedMonthLabel}</p>
                    <div className="flex-1">
                        <StudentsByZoneChart students={studentsThisPeriod} />
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Row 1: This Year Monthly Revenue + Monthly Pie */}
                <div className="md:col-span-1 lg:col-span-2 rounded-xl bg-white/90 backdrop-blur p-6 shadow-sm ring-1 ring-gray-200">
                    <h2 className="text-lg font-semibold text-gray-custom-900 mb-4">This Year Monthly Revenue</h2>
                    <YearlyRevenueChart 
                        payments={receivedPaymentsForChart.map(p => ({ date: p.installment_date, amount: (p.amount || 0) * 1000 }))}
                        payouts={[]}
                        onMonthSelect={(m) => { setSelectedMonth(m.getMonth()); setSelectedYear(m.getFullYear()); }}
                    />
                </div>
                <div className="md:col-span-1 lg:col-span-1 rounded-xl bg-white/90 backdrop-blur p-6 shadow-sm ring-1 ring-gray-200">
                    <h2 className="text-lg font-semibold text-gray-custom-900 mb-1">Revenue by Zone</h2>
                    <p className="text-sm text-gray-custom-500 mb-3">{selectedMonthLabel}</p>
                    <RevenueByZonePieChart payments={payments} studentMap={studentMap} monthStart={selectedMonthStart} />
                </div>

                {/* Row 2: 5 Years Revenue (Previous 2 to Next 2) + Yearly Pie */}
                <div className="md:col-span-1 lg:col-span-2 rounded-xl bg-white/90 backdrop-blur p-6 shadow-sm ring-1 ring-gray-200">
                    <h2 className="text-lg font-semibold text-gray-custom-900 mb-4">5 Years Revenue (Previous 2 to Next 2)</h2>
                    <FourYearRevenueChart 
                        payments={receivedPaymentsForChart.map(p => ({ date: p.installment_date, amount: (p.amount || 0) * 1000 }))}
                        payouts={[]}
                        onYearSelect={(y) => setSelectedYear(y)}
                    />
                </div>
                <div className="md:col-span-1 lg:col-span-1 rounded-xl bg-white/90 backdrop-blur p-6 shadow-sm ring-1 ring-gray-200">
                    <h2 className="text-lg font-semibold text-gray-custom-900 mb-1">Revenue by Zone</h2>
                    <p className="text-sm text-gray-custom-500 mb-3">Year {selectedYear}</p>
                    <RevenueByZonePieChart payments={payments} studentMap={studentMap} year={selectedYear} />
                </div>
            </div>


            {/* Recent Payments */}
            <div className="rounded-lg bg-white p-6 shadow-sm">
                
                 <RecentPayments payments={recentPayments} studentMap={studentMap} />
            </div>
        </div>
    );
};

export default DashboardPage;
