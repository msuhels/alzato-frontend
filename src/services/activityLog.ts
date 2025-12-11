import axios from 'axios';
import { API_BASE_URL, getAuthHeaders } from './config';
import type { PaginatedResponse } from './apiClient';

export type ActivityLogItem = {
  id: number;
  activity_type: 'student_added' | 'payment_received' | 'student_updated' | 'payment_updated' | 'ak_approval_updated';
  student_id?: number;
  payment_id?: number;
  title?: string;
  description?: string;
  is_read?: boolean;
  created_at: string;
};

export const activityLogService = {
  async list(params: { limit?: number; offset?: number; is_read?: boolean } = {}): Promise<PaginatedResponse<ActivityLogItem>> {
    const { data } = await axios.get<PaginatedResponse<ActivityLogItem>>(`${API_BASE_URL}/activity-log`, {
      params,
      headers: { ...getAuthHeaders() },
    });
    return data;
  },

  async markRead(id: number | string): Promise<{ success: boolean; activity: ActivityLogItem }> {
    const { data } = await axios.patch<{ success: boolean; activity: ActivityLogItem }>(
      `${API_BASE_URL}/activity-log/${encodeURIComponent(String(id))}/read`,
      {},
      { headers: { ...getAuthHeaders() } }
    );
    return data;
  },

  async getUnreadCount(): Promise<{ success: boolean; total: number }> {
    const { data } = await axios.get<{ success: boolean; total: number }>(
      `${API_BASE_URL}/activity-log/unread-count`,
      { headers: { ...getAuthHeaders() } }
    );
    return data;
  },

  async updateAkFields(activityId: number | string, payload: { ak_approval?: string; ak_remarks?: string }) {
    const { data } = await axios.patch<{ success: boolean; payment: any }>(
      `${API_BASE_URL}/activity-log/${encodeURIComponent(String(activityId))}/ak-fields`,
      payload,
      { headers: { ...getAuthHeaders() } }
    );
    return data;
  },
};

