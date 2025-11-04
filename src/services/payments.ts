import axios from 'axios';
import { API_BASE_URL, getAuthHeaders } from './config';
import type { PaginatedResponse } from './apiClient';

export type PaymentListItem = {
  id: number | string;
  created_at: string;
  student_id: number | string;
  installment_date: string;
  installment_number?: number;
  amount: number;
  payment_recieved_in?: string;
  payment_send_from?: string;
  payment_type?: string;
  remarks?: string;
  purpose?: string;
  ak_approval?: string;
  ak_remarks?: string;
  accounting_remarks?: string;
  installment_remarks?: string;
  net_amount?: number; // Optional backend-calculated field
};

export type PaymentCreateBody = {
  student_id: number | string;
  installment_date: string; // YYYY-MM-DD
  installment_number?: number;
  amount: number;
  payment_recieved_in?: string;
  payment_send_from?: string;
  payment_type?: string;
  remarks?: string;
  purpose?: string;
  ak_approval?: string;
  ak_remarks?: string;
  accounting_remarks?: string;
  installment_remarks?: string;
  net_amount?: number; // Optional backend-calculated field
};

export type PaymentUpdateBody = Partial<PaymentCreateBody>;

export const paymentsService = {
  async get(id: string | number): Promise<any> {
    const { data } = await axios.get<any>(`${API_BASE_URL}/payments/${encodeURIComponent(String(id))}`, {
      headers: { ...getAuthHeaders() },
    });
    return data;
  },
  async list(params: {
    limit?: number; offset?: number; sort_by?: string; sort_dir?: 'asc' | 'desc';
    student_id?: number | string; payment_type?: string; payment_recieved_in?: string;
    created_from?: string; created_to?: string; installment_from?: string; installment_to?: string;
    min_amount?: number; max_amount?: number;
  } = {}): Promise<PaginatedResponse<PaymentListItem>> {
    const { data } = await axios.get<PaginatedResponse<PaymentListItem>>(`${API_BASE_URL}/payments`, {
      params,
      headers: { ...getAuthHeaders() },
    });
    return data;
  },

  async create(body: PaymentCreateBody): Promise<{ success: boolean; payment: any }> {
    const { data } = await axios.post<{ success: boolean; payment: any }>(`${API_BASE_URL}/payments`, body, {
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    });
    return data;
  },

  async update(id: string | number, body: PaymentUpdateBody): Promise<{ success: boolean; payment: any }> {
    const { data } = await axios.put<{ success: boolean; payment: any }>(`${API_BASE_URL}/payments/${id}`, body, {
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    });
    return data;
  },
  async remove(id: string | number): Promise<{ success: boolean }> {
    const { data } = await axios.delete<{ success: boolean }>(`${API_BASE_URL}/payments/${encodeURIComponent(String(id))}`, {
      headers: { ...getAuthHeaders() },
    });
    return data;
  },

  async adjustHrdPayout(studentId: string | number, hrdAmount: number): Promise<{ success: boolean; message: string }> {
    const { data } = await axios.post<{ success: boolean; message: string }>(`${API_BASE_URL}/payments/adjust-hrd-payout`, {
      student_id: studentId,
      hrd_amount: hrdAmount,
    }, {
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    });
    return data;
  },

  // CSV Import/Export (admin)
  async importCsv(csv: string): Promise<{ inserted: number; failed: number; errors?: Array<{ rowNumber: number; message: string }> }> {
    const { data } = await axios.post(
      `${API_BASE_URL}/payments/import-csv`,
      { csv },
      { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } }
    );
    return data;
  },

  async exportCsv(params: { student_id?: number | string; created_from?: string; created_to?: string } = {}): Promise<Blob> {
    const response = await axios.get(`${API_BASE_URL}/payments/export-csv`, {
      params,
      headers: { ...getAuthHeaders() },
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  async downloadSampleCsv(): Promise<{ blob: Blob; filename?: string }> {
    const response = await axios.get(`${API_BASE_URL}/payments/sample-csv`, {
      headers: { ...getAuthHeaders() },
      responseType: 'blob',
    });
    // Try to parse filename from Content-Disposition
    const disposition = (response.headers as any)['content-disposition'] as string | undefined;
    let filename: string | undefined;
    if (disposition) {
      const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
      filename = decodeURIComponent((match?.[1] || match?.[2] || '').trim());
    }
    return { blob: response.data as Blob, filename };
  },
};


