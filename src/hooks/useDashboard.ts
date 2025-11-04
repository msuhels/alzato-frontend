import { useMutation, useQuery } from "@tanstack/react-query";
import {
	dashboardApi,
	DashboardOverviewParams,
	MonthlySeriesParams,
	MonthlySeriesResponse,
	NetRevenueCommonParams,
	NetRevenuePeriodResponse,
	NetRevenueTotalResponse,
	RevenueMonthlyBody,
	RevenueMonthlyResponse,
} from "../api/dashboard";

const STALE_TIME_MS = 60_000;

// Stable key builders
const qk = {
	dashboardOverview: (params?: DashboardOverviewParams) => ["dashboard", "overview", params ?? {}] as const,
	netRevenueTotal: (params?: NetRevenueCommonParams) => ["dashboard", "net-revenue", "total", params ?? {}] as const,
	netRevenueYearCurrent: (params?: { zone?: string; category?: string }) => ["dashboard", "net-revenue", "year", "current", params ?? {}] as const,
	netRevenueMonthCurrent: (params?: { zone?: string; category?: string }) => ["dashboard", "net-revenue", "month", "current", params ?? {}] as const,
	monthlySeries: (params?: MonthlySeriesParams) => ["dashboard", "revenue", "monthly-series", params ?? {}] as const,
};

// Queries
export function useDashboardOverview(params?: DashboardOverviewParams) {
	return useQuery({
		queryKey: qk.dashboardOverview(params),
		queryFn: () => dashboardApi.getDashboardOverview(params),
		staleTime: STALE_TIME_MS,
	});
}

export function useNetRevenueTotal(params?: NetRevenueCommonParams) {
	return useQuery<NetRevenueTotalResponse>({
		queryKey: qk.netRevenueTotal(params),
		queryFn: () => dashboardApi.getNetRevenueTotal(params),
		staleTime: STALE_TIME_MS,
	});
}

export function useNetRevenueYearCurrent(params?: { zone?: string; category?: string }) {
	return useQuery<NetRevenuePeriodResponse>({
		queryKey: qk.netRevenueYearCurrent(params),
		queryFn: () => dashboardApi.getNetRevenueYearCurrent(params),
		staleTime: STALE_TIME_MS,
	});
}

export function useNetRevenueMonthCurrent(params?: { zone?: string; category?: string }) {
	return useQuery<NetRevenuePeriodResponse>({
		queryKey: qk.netRevenueMonthCurrent(params),
		queryFn: () => dashboardApi.getNetRevenueMonthCurrent(params),
		staleTime: STALE_TIME_MS,
	});
}

export function useMonthlySeries(params?: MonthlySeriesParams) {
	return useQuery<MonthlySeriesResponse>({
		queryKey: qk.monthlySeries(params),
		queryFn: () => dashboardApi.getMonthlySeries(params),
		staleTime: STALE_TIME_MS,
	});
}

// Mutations
export function useRevenueMonthly() {
	return useMutation<RevenueMonthlyResponse, Error, RevenueMonthlyBody>({
		mutationFn: (body: RevenueMonthlyBody) => dashboardApi.postRevenueMonthly(body),
	});
}

/*
Quick usage examples (in components/containers):

// Net Revenue card (Total)
const { data: total } = useNetRevenueTotal({ from, to, zone, category });
const netRevenue = total?.netRevenue ?? 0;
const subtitle = `${total?.totalRevenue ?? 0} • ${total?.totalStudents ?? 0} students`;

// Yearly Net Revenue card
const { data: year } = useNetRevenueYearCurrent({ zone, category });
const yearly = year?.netRevenue ?? 0;
const yearlyDelta = (year?.netRevenue ?? 0) - (year?.lastPeriod.netRevenue ?? 0);

// This Month Net Revenue card
const { data: month } = useNetRevenueMonthCurrent({ zone, category });
const monthNet = month?.netRevenue ?? 0;
const monthDelta = (month?.netRevenue ?? 0) - (month?.lastPeriod.netRevenue ?? 0);

// New Students This Month card
const newStudents = month?.totalStudents ?? 0;
const newStudentsDelta = (month?.totalStudents ?? 0) - (month?.lastPeriod.totalStudents ?? 0);

// Monthly Revenue chart (last 6 months)
const { data: series } = useMonthlySeries({ months: 6, zone, category });
const monthlyChart = (series?.items ?? []).map(i => ({ label: i.month, value: i.totalRevenue }));

// Revenue by Zone donut (from month current)
const donut = Object.entries(month?.zoneWise ?? {}).map(([zoneKey, z]) => ({ label: zoneKey, value: z.netRevenue }));

// Dashboard Overview
const { data: overview } = useDashboardOverview({ from, to, zone, category, recent_payments_limit: 10 });
const totals = overview?.totals;
const recentPayments = overview?.tables.recentPayments ?? [];
*/


