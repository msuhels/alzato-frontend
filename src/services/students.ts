import axios from 'axios';
import { API_BASE_URL, getAuthHeaders } from './config';
import type { PaginatedResponse } from './apiClient';

export type StudentListItem = {
  id: number | string;
  name: string;
  email?: string;
  phone?: string;
  category?: string;
  zone?: string;
  source_of_student?: string;
  intake_year?: string; // ISO date
  created_at?: string; // ISO timestamp
  enrollment_number?: string; // Unique enrollment number starting from 0001
  associate_wise_installments?: string;
  total_amount?: number;
  // Backend may use misspelled key 'recieved_amount'
  recieved_amount?: number;
  received_amount?: number;
  net_amount?: number;
  total_payout_amount?: number;
};

export type StudentCreateBody = {
  name: string;
  email?: string;
  phone?: string;
  intake_year?: string; // ISO date
  password?: string;
  category?: string;
  zone?: string;
  source_of_student?: string;
  associate_wise_installments?: string;
  enrollment_number?: string; // Unique enrollment number starting from 0001
  total_amount?: number;
};

export type StudentUpdateBody = Partial<StudentCreateBody>;

export const studentsService = {
  async list(params: {
    limit?: number; offset?: number; sort_by?: string; sort_dir?: 'asc' | 'desc';
    name?: string; email?: string; phone?: string; category?: string; zone?: string; source_of_student?: string;
    intake_year_from?: string; intake_year_to?: string; created_from?: string; created_to?: string; q?: string;
  } = {}): Promise<PaginatedResponse<StudentListItem>> {
    const { data } = await axios.get<PaginatedResponse<StudentListItem>>(`${API_BASE_URL}/students`, {
      params,
      headers: { ...getAuthHeaders() },
    });
    return data;
  },

  async get(id: string | number): Promise<{ success: boolean; student: any }> {
    const { data } = await axios.get<{ success: boolean; student: any }>(`${API_BASE_URL}/students/${id}`, {
      headers: { ...getAuthHeaders() },
    });
    return data;
  },

  async create(body: StudentCreateBody): Promise<{ success: boolean; student: any }> {
    const { data } = await axios.post<{ success: boolean; student: any }>(`${API_BASE_URL}/students`, body, {
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    });
    return data;
  },

  async update(id: string | number, body: StudentUpdateBody): Promise<{ success: boolean; student: any }> {
    const { data } = await axios.put<{ success: boolean; student: any }>(`${API_BASE_URL}/students/${id}`, body, {
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    });
    return data;
  },

  async remove(id: string | number): Promise<{ success: boolean; message: string }> {
    const { data } = await axios.delete<{ success: boolean; message: string }>(`${API_BASE_URL}/students/${id}`, {
      headers: { ...getAuthHeaders() },
    });
    return data;
  },

  async bulkDelete(ids: Array<string | number>): Promise<{ success: boolean; deleted: number }> {
    const { data } = await axios.post<{ success: boolean; deleted: number }>(
      `${API_BASE_URL}/students/bulk-delete`,
      { ids },
      { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } }
    );
    return data;
  },

  async getNextEnrollmentNumber(): Promise<{ success: boolean; enrollment_number: string }> {
    // Derive from latest student by enrollment_number to guarantee "next" value
    try {
      // Preferred: ask API to sort by enrollment_number desc
      const { data } = await axios.get<PaginatedResponse<StudentListItem>>(`${API_BASE_URL}/students`, {
        params: { limit: 1, offset: 0, sort_by: 'enrollment_number', sort_dir: 'desc' },
        headers: { ...getAuthHeaders() },
      });

      const latest = data?.items?.[0]?.enrollment_number;
      if (latest) {
        const parsed = parseInt(String(latest).replace(/[^0-9]/g, ''), 10);
        const nextNumeric = Number.isFinite(parsed) ? parsed + 1 : 1;
        const padded = String(nextNumeric).padStart(4, '0');
        return { success: true, enrollment_number: padded };
      }
    } catch (_) {
      // Continue to fallback below
    }

    // Fallback: fetch a page (without sort) and compute max from available items
    try {
      const { data } = await axios.get<PaginatedResponse<StudentListItem>>(`${API_BASE_URL}/students`, {
        params: { limit: 50, offset: 0 },
        headers: { ...getAuthHeaders() },
      });
      const items = data?.items || [];
      const maxExisting = items.reduce<number>((max, s) => {
        const n = parseInt(String(s.enrollment_number || '').replace(/[^0-9]/g, ''), 10);
        return Number.isFinite(n) && n > max ? n : max;
      }, 0);
      const nextNumeric = (maxExisting || 0) + 1;
      const padded = String(nextNumeric).padStart(4, '0');
      return { success: true, enrollment_number: padded };
    } catch (_) {
      // Last-resort default
      return { success: true, enrollment_number: '0001' };
    }
  },
};


