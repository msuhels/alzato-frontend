import { apiClient, PaginatedResponse } from './apiClient';

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
};

export type StudentUpdateBody = Partial<StudentCreateBody>;

export const studentsService = {
  async list(params: {
    limit?: number; offset?: number; sort_by?: string; sort_dir?: 'asc' | 'desc';
    name?: string; email?: string; phone?: string; category?: string; zone?: string; source_of_student?: string;
    intake_year_from?: string; intake_year_to?: string; created_from?: string; created_to?: string; q?: string;
  } = {}): Promise<PaginatedResponse<StudentListItem>> {
    const { data } = await apiClient.get<PaginatedResponse<StudentListItem>>('/students', { params });
    return data;
  },

  async get(id: string | number): Promise<{ success: boolean; student: any }> {
    const { data } = await apiClient.get<{ success: boolean; student: any }>(`/students/${id}`);
    return data;
  },

  async create(body: StudentCreateBody): Promise<{ success: boolean; student: any }> {
    const { data } = await apiClient.post<{ success: boolean; student: any }>('/students', body);
    return data;
  },

  async update(id: string | number, body: StudentUpdateBody): Promise<{ success: boolean; student: any }> {
    const { data } = await apiClient.put<{ success: boolean; student: any }>(`/students/${id}`, body);
    return data;
  },

  async remove(id: string | number): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.delete<{ success: boolean; message: string }>(`/students/${id}`);
    return data;
  },
};


