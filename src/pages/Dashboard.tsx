import { useEffect, useMemo, useState } from 'react';
import { Users, CreditCard, UserPlus } from 'lucide-react';
import { IndianRupee } from 'lucide-react';
import { formatINR } from '../lib/currency';
import StatCard from '../components/dashboard/StatCard';
import RevenueChart from '../components/dashboard/RevenueChart';
import StudentsByZoneChart from '../components/dashboard/StudentsByZoneChart';
import RecentPayments from '../components/dashboard/RecentPayments';
import { paymentsService, PaymentListItem } from '../services/payments';
import { studentsService, StudentListItem } from '../services/students';

const DashboardPage = () => {
    const [payments, setPayments] = useState<PaymentListItem[]>([]);
    const [students, setStudents] = useState<StudentListItem[]>([]);

    useEffect(() => {
        const load = async () => {
            const [{ items: paymentsItems }, { items: studentsItems }] = await Promise.all([
                paymentsService.list({ limit: 100, offset: 0 }),
                studentsService.list({ limit: 100, offset: 0 }),
            ]);
            setPayments(paymentsItems);
            setStudents(studentsItems);
        };
        load();
    }, []);

    const totalRevenue = useMemo(() => payments.reduce((sum, p) => sum + (p.amount || 0), 0), [payments]);
    const totalStudents = useMemo(() => students.length, [students]);

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const paymentsThisMonth = useMemo(() => payments.filter(p => new Date(p.installment_date) >= startOfMonth), [payments]);
    const revenueThisMonth = useMemo(() => paymentsThisMonth.reduce((sum, p) => sum + (p.amount || 0), 0), [paymentsThisMonth]);
    const newStudentsThisMonth = useMemo(() => students.filter(s => s.created_at && new Date(s.created_at) >= startOfMonth).length, [students]);

    const recentPayments = useMemo(() => payments.slice(0, 5).map(p => ({
        id: String(p.id),
        studentId: String(p.student_id),
        amount: p.amount,
        date: p.installment_date,
        payment_type: p.payment_type,
    })), [payments]);
    const studentMap = useMemo(() => new Map<string | number, StudentListItem>(students.map(s => [s.id, s])), [students]);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-custom-900">Welcome back, Admin!</h1>
                <p className="text-gray-custom-500 mt-1">Here's a snapshot of your institution's performance.</p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard 
                    icon={IndianRupee}
                    title="Total Revenue"
                    value={formatINR(totalRevenue)}
                    change="+12.5%"
                    changeType="increase"
                />
                <StatCard 
                    icon={Users}
                    title="Total Students"
                    value={totalStudents.toString()}
                    change="+2.1%"
                    changeType="increase"
                />
                <StatCard 
                    icon={CreditCard}
                    title="Revenue This Month"
                    value={formatINR(revenueThisMonth)}
                    change="-3.2%"
                    changeType="decrease"
                />
                <StatCard 
                    icon={UserPlus}
                    title="New Students This Month"
                    value={newStudentsThisMonth.toString()}
                    change="+5"
                    changeType="increase"
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-lg bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-custom-900 mb-4">Monthly Revenue</h2>
                    <RevenueChart payments={payments.map(p => ({ date: p.installment_date, amount: p.amount }))} />
                </div>
                <div className="rounded-lg bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-custom-900 mb-4">Students by Zone</h2>
                    <StudentsByZoneChart students={students} />
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
