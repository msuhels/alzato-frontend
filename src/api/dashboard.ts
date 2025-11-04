// Dashboard API client

const BASE_URL = "/api";

export type DashboardOverviewParams = {
	from?: string;
	to?: string;
	zone?: string;
	category?: string;
	recent_payments_limit?: number;
};

export type NetRevenueCommonParams = {
	from?: string;
	to?: string;
	zone?: string;
	category?: string;
};

export type NetRevenueScopedParams = {
	zone?: string;
	category?: string;
};

export type RevenueByZoneItem = {
	totalRevenue: number;
	totalPayout: number;
	netRevenue: number;
	students: number;
};

export type DashboardOverviewResponse = {
	totals: {
		totalRevenue: number;
		totalStudents: number;
		revenueThisMonth: number;
		newStudentsThisMonth: number;
	};
	charts: {
		monthlyRevenue: { month: string; amount: number }[];
		studentsByZone: Record<string, number>;
		revenueByZone?: Record<string, RevenueByZoneItem>;
	};
	tables: {
		recentPayments: {
			id: number;
			student_id: number;
			amount: number;
			date: string;
			payment_type: string | null;
		}[];
	};
};

export type NetRevenueTotalResponse = {
	totalRevenue: number;
	totalPayout: number;
	netRevenue: number;
	totalStudents: number;
	zoneWise: Record<string, RevenueByZoneItem>;
};

export type PeriodRange = { from: string; to: string };

export type NetRevenuePeriodResponse = {
	period: PeriodRange;
	totalRevenue: number;
	totalPayout: number;
	netRevenue: number;
	totalStudents: number;
	zoneWise: Record<string, RevenueByZoneItem>;
	lastPeriod: {
		totalRevenue: number;
		totalPayout: number;
		netRevenue: number;
		totalStudents: number;
		zoneWise: Record<string, RevenueByZoneItem>;
	};
};

export type RevenueMonthlyBody = {
	month: string;
	zone?: string;
	category?: string;
};

export type RevenueMonthlyResponse = {
	period: { month: string; from: string; to: string };
	totalRevenue: number;
	totalPayout: number;
	netRevenue: number;
	totalStudents: number;
	zoneWise: Record<string, RevenueByZoneItem>;
};

export type MonthlySeriesParams = {
	months?: number;
	zone?: string;
	category?: string;
};

export type MonthlySeriesResponse = {
	months: number;
	items: {
		month: string;
		totalRevenue: number;
		totalPayout: number;
		netRevenue: number;
		totalStudents: number;
	}[];
};

export type ApiErrorShape = { error: string; code?: string | number };

export function toQuery(params?: Record<string, unknown>): string {
	if (!params) return "";
	const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
	if (entries.length === 0) return "";
	const usp = new URLSearchParams();
	for (const [key, value] of entries) {
		usp.append(key, String(value));
	}
	return `?${usp.toString()}`;
}

type ApiRequestInit = Omit<RequestInit, "headers" | "body"> & {
	method?: string;
	body?: unknown;
};

async function apiRequest<TResponse>(path: string, init?: ApiRequestInit): Promise<TResponse> {
	const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
	const headers: HeadersInit = {
		"Content-Type": "application/json",
		Accept: "application/json",
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	};

	const requestInit: RequestInit = {
		method: init?.method ?? (init?.body ? "POST" : "GET"),
		headers,
		body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
	};

	const response = await fetch(`${BASE_URL}${path}`, requestInit);
	const contentType = response.headers.get("content-type") || "";
	const isJson = contentType.includes("application/json");
	const json = isJson ? await response.json() : undefined;

	if (!response.ok) {
		const err: ApiErrorShape = json && typeof json === "object" && "error" in json ? json : { error: response.statusText, code: response.status };
		throw new Error(err.error || "Request failed");
	}

	// All endpoints return { success: true, ... }
	if (json && typeof json === "object" && "success" in json) {
		const { success, ...rest } = json as { success: boolean } & Record<string, unknown>;
		return rest as TResponse;
	}

	return (json as TResponse) ?? ({} as TResponse);
}

// 1) GET /api/dashboard
export async function getDashboardOverview(params?: DashboardOverviewParams): Promise<DashboardOverviewResponse> {
	const qs = toQuery(params);
	return apiRequest<DashboardOverviewResponse>(`/dashboard${qs}`);
}

// 2) GET /api/dashboard/net-revenue/total
export async function getNetRevenueTotal(params?: NetRevenueCommonParams): Promise<NetRevenueTotalResponse> {
	const qs = toQuery(params);
	return apiRequest<NetRevenueTotalResponse>(`/dashboard/net-revenue/total${qs}`);
}

// 3) GET /api/dashboard/net-revenue/year/current
export async function getNetRevenueYearCurrent(params?: NetRevenueScopedParams): Promise<NetRevenuePeriodResponse> {
	const qs = toQuery(params);
	return apiRequest<NetRevenuePeriodResponse>(`/dashboard/net-revenue/year/current${qs}`);
}

// 4) GET /api/dashboard/net-revenue/month/current
export async function getNetRevenueMonthCurrent(params?: NetRevenueScopedParams): Promise<NetRevenuePeriodResponse> {
	const qs = toQuery(params);
	return apiRequest<NetRevenuePeriodResponse>(`/dashboard/net-revenue/month/current${qs}`);
}

// 5) POST /api/dashboard/revenue/monthly
export async function postRevenueMonthly(body: RevenueMonthlyBody): Promise<RevenueMonthlyResponse> {
	return apiRequest<RevenueMonthlyResponse>(`/dashboard/revenue/monthly`, { method: "POST", body });
}

// 6) GET /api/dashboard/revenue/monthly-series
export async function getMonthlySeries(params?: MonthlySeriesParams): Promise<MonthlySeriesResponse> {
	const qs = toQuery(params);
	return apiRequest<MonthlySeriesResponse>(`/dashboard/revenue/monthly-series${qs}`);
}

export const dashboardApi = {
	getDashboardOverview,
	getNetRevenueTotal,
	getNetRevenueYearCurrent,
	getNetRevenueMonthCurrent,
	postRevenueMonthly,
	getMonthlySeries,
	toQuery,
	apiRequest,
};


