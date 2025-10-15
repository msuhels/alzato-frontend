import { apiClient, PaginatedResponse } from './apiClient';

export type PaymentListItem = {
  id: number | string;
  created_at: string;
  student_id: number | string;
  installment_date: string;
  amount: number;
  payment_recieved_in?: string;
  payment_type?: string;
  remarks?: string;
  purpose?: string;
  ak_approval?: string;
  ak_remarks?: string;
};

export type PaymentCreateBody = {
  student_id: number | string;
  installment_date: string; // YYYY-MM-DD
  amount: number;
  payment_recieved_in?: string;
  payment_type?: string;
  remarks?: string;
  purpose?: string;
  ak_approval?: string;
  ak_remarks?: string;
};

export const paymentsService = {
  async list(params: {
    limit?: number; offset?: number; sort_by?: string; sort_dir?: 'asc' | 'desc';
    student_id?: number | string; payment_type?: string; payment_recieved_in?: string;
    created_from?: string; created_to?: string; installment_from?: string; installment_to?: string;
    min_amount?: number; max_amount?: number;
  } = {}): Promise<PaginatedResponse<PaymentListItem>> {
    const { data } = await apiClient.get<PaginatedResponse<PaymentListItem>>('/payments', { params });
    return data;
  },

  async create(body: PaymentCreateBody): Promise<{ success: boolean; payment: any }> {
    const { data } = await apiClient.post<{ success: boolean; payment: any }>('/payments', body);
    return data;
  },
};


