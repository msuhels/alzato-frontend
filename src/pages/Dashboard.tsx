import { useEffect, useMemo, useState } from 'react';
import { Users, CreditCard, UserPlus } from 'lucide-react';
import { IndianRupee } from 'lucide-react';
import { formatINR } from '../lib/currency';
import StatCard from '../components/dashboard/StatCard';
// import RevenueChart from '../components/dashboard/RevenueChart';
// import StudentsByZoneChart from '../components/dashboard/StudentsByZoneChart';
import RevenueByZonePieChart from '../components/dashboard/RevenueByZonePieChart';
import YearlyRevenueChart from '../components/dashboard/YearlyRevenueChart';
import FourYearRevenueChart from '../components/dashboard/FourYearRevenueChart';
import RecentPayments from '../components/dashboard/RecentPayments';
import { paymentsService, PaymentListItem } from '../services/payments';
import { studentsService, StudentListItem } from '../services/students';
import LoadingSpinner from '../components/LoadingSpinner';

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
    const totalReceived = useMemo(() => {
        return students.reduce((sum, s) => sum + (s.recieved_amount ?? s.received_amount ?? 0), 0);
    }, [students]);
    const totalPayout = useMemo(() => {
        return students.reduce((sum, s) => sum + (s.total_payout_amount ?? 0), 0);
    }, [students]);
    const totalNetRevenue = useMemo(() => {
        const explicitNet = students.reduce((sum, s) => sum + (s.net_amount ?? 0), 0);
        // If net_amount exists on rows, prefer that; otherwise fall back to received - payout
        return explicitNet > 0 ? explicitNet : (totalReceived - totalPayout);
    }, [students, totalReceived, totalPayout]);

    const totalStudents = useMemo(() => students.length, [students]);

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const [selectedMonthStart, setSelectedMonthStart] = useState<Date>(startOfMonth);
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const nextMonthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth() + 1, 1), [today]);
    const selectedMonthLabel = useMemo(
        () => selectedMonthStart.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
        [selectedMonthStart]
    );

    // Year-to-date (YTD) net revenue from students using intake_year == current year
    const currentYear = today.getFullYear();
    const studentsThisYear = useMemo(
        () => students.filter(s => {
            const yr = s.intake_year ? parseInt(String(s.intake_year), 10) : undefined;
            return Number.isFinite(yr) && (yr as number) === currentYear;
        }),
        [students, currentYear]
    );
    const receivedAmountThisYear = useMemo(() => studentsThisYear.reduce((sum, s) => sum + (s.recieved_amount ?? s.received_amount ?? 0), 0), [studentsThisYear]);
    const payoutAmountThisYear = useMemo(() => studentsThisYear.reduce((sum, s) => sum + (s.total_payout_amount ?? 0), 0), [studentsThisYear]);
    const netRevenueThisYear = useMemo(() => {
        const explicitNet = studentsThisYear.reduce((sum, s) => sum + (s.net_amount ?? 0), 0);
        return explicitNet > 0 ? explicitNet : (receivedAmountThisYear - payoutAmountThisYear);
    }, [studentsThisYear, receivedAmountThisYear, payoutAmountThisYear]);

    const paymentsThisMonthAll = useMemo(
        () => payments.filter(p => {
            const d = new Date(p.installment_date);
            return d >= startOfMonth && d < nextMonthStart;
        }),
        [payments, startOfMonth, nextMonthStart]
    );
    const receivedThisMonth = useMemo(
        () => paymentsThisMonthAll.filter(p => (p.payment_type || '').toLowerCase() !== 'payout'),
        [paymentsThisMonthAll]
    );
    const payoutThisMonth = useMemo(
        () => paymentsThisMonthAll.filter(p => (p.payment_type || '').toLowerCase() === 'payout'),
        [paymentsThisMonthAll]
    );
    const receivedAmountThisMonth = useMemo(() => receivedThisMonth.reduce((sum, p) => sum + (p.amount || 0), 0), [receivedThisMonth]);
    const payoutAmountThisMonth = useMemo(() => payoutThisMonth.reduce((sum, p) => sum + (p.amount || 0), 0), [payoutThisMonth]);
    const netRevenueThisMonth = useMemo(() => receivedAmountThisMonth - payoutAmountThisMonth, [receivedAmountThisMonth, payoutAmountThisMonth]);

    // Previous month period
    const prevMonthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth() - 1, 1), [today]);
    const prevMonthPayments = useMemo(
        () => payments.filter(p => {
            const d = new Date(p.installment_date);
            return d >= prevMonthStart && d < startOfMonth;
        }),
        [payments, prevMonthStart, startOfMonth]
    );
    const prevReceived = useMemo(
        () => prevMonthPayments.filter(p => (p.payment_type || '').toLowerCase() !== 'payout'),
        [prevMonthPayments]
    );
    const prevPayout = useMemo(
        () => prevMonthPayments.filter(p => (p.payment_type || '').toLowerCase() === 'payout'),
        [prevMonthPayments]
    );
    const prevReceivedAmount = useMemo(() => prevReceived.reduce((s, p) => s + (p.amount || 0), 0), [prevReceived]);
    const prevPayoutAmount = useMemo(() => prevPayout.reduce((s, p) => s + (p.amount || 0), 0), [prevPayout]);
    const prevNetRevenue = useMemo(() => prevReceivedAmount - prevPayoutAmount, [prevReceivedAmount, prevPayoutAmount]);

    // Net revenue this month vs last month percent
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

    // New students this month and last month
    const studentsPrevMonth = useMemo(
        () => students.filter(s => s.created_at && new Date(s.created_at) >= prevMonthStart && new Date(s.created_at) < startOfMonth),
        [students, prevMonthStart, startOfMonth]
    );
    const studentsThisMonth = useMemo(
        () => students.filter(s => s.created_at && new Date(s.created_at) >= startOfMonth),
        [students, startOfMonth]
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
    // Note: handled below with newStudentsCountThisMonth/newStudentsMoM

    const recentPayments = useMemo(() => payments.slice(0, 5).map(p => ({
        id: String(p.id),
        studentId: String(p.student_id),
        amount: p.amount,
        date: p.installment_date,
        payment_type: p.payment_type,
    })), [payments]);
    // Normalize keys to string to align with recentPayments.studentId (string)
    const studentMap = useMemo(() => new Map<string, StudentListItem>(students.map(s => [String(s.id), s])), [students]);

    // For charts: use received side of payments (non-payout)
    const receivedPaymentsForChart = useMemo(
        () => payments.filter(p => (p.payment_type || '').toLowerCase() !== 'payout'),
        [payments]
    );
    const payoutPaymentsForChart = useMemo(
        () => payments.filter(p => (p.payment_type || '').toLowerCase() === 'payout'),
        [payments]
    );

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
            <div>
                <h1 className="text-3xl font-bold text-gray-custom-900">Welcome back, Admin!</h1>
                <p className="text-gray-custom-500 mt-1">Here's a snapshot of your institution's performance.</p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 gap-6 sm:[grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
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
                    icon={IndianRupee}
                    title="Yearly Net Revenue"
                    value={formatINR(netRevenueThisYear)}
                    change=""
                    changeType="increase"
                    showChange={false}
                />
                <StatCard 
                    icon={CreditCard}
                    title="Net Revenue This Month"
                    value={formatINR(netRevenueThisMonth)}
                    subText={`Total: ${formatINR(receivedAmountThisMonth)}`}
                    change={netRevenueMoM.text}
                    changeType={netRevenueMoM.type}
                />
                <StatCard 
                    icon={UserPlus}
                    title="New Students This Month"
                    value={newStudentsCountThisMonth.toString()}
                    change={newStudentsMoM.text}
                    changeType={newStudentsMoM.type}
                    size="sm"
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

            {/* Charts */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Row 1: This Year Monthly Revenue + Monthly Pie */}
                <div className="md:col-span-1 lg:col-span-2 rounded-xl bg-white/90 backdrop-blur p-6 shadow-sm ring-1 ring-gray-200">
                    <h2 className="text-lg font-semibold text-gray-custom-900 mb-4">This Year Monthly Revenue</h2>
                    <YearlyRevenueChart 
                        payments={receivedPaymentsForChart.map(p => ({ date: p.installment_date, amount: p.amount }))}
                        payouts={payoutPaymentsForChart.map(p => ({ date: p.installment_date, amount: p.amount }))}
                        onMonthSelect={(m) => setSelectedMonthStart(m)}
                    />
                </div>
                <div className="md:col-span-1 lg:col-span-1 rounded-xl bg-white/90 backdrop-blur p-6 shadow-sm ring-1 ring-gray-200">
                    <h2 className="text-lg font-semibold text-gray-custom-900 mb-1">Revenue by Zone</h2>
                    <p className="text-sm text-gray-custom-500 mb-3">{selectedMonthLabel}</p>
                    <RevenueByZonePieChart payments={payments} studentMap={studentMap} monthStart={selectedMonthStart} />
                </div>

                {/* Row 2: Last 4 Years Revenue + Yearly Pie */}
                <div className="md:col-span-1 lg:col-span-2 rounded-xl bg-white/90 backdrop-blur p-6 shadow-sm ring-1 ring-gray-200">
                    <h2 className="text-lg font-semibold text-gray-custom-900 mb-4">Last 4 Years Revenue</h2>
                    <FourYearRevenueChart 
                        payments={receivedPaymentsForChart.map(p => ({ date: p.installment_date, amount: p.amount }))}
                        payouts={payoutPaymentsForChart.map(p => ({ date: p.installment_date, amount: p.amount }))}
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
                 <h2 className="text-lg font-semibold text-gray-custom-900 mb-4">Recent Payments</h2>
                 <RecentPayments payments={recentPayments} studentMap={studentMap} />
            </div>
        </div>
    );
};

export default DashboardPage;
