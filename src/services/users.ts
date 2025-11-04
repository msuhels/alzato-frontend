import axios from 'axios';
import { API_BASE_URL, getAuthHeaders } from './config';

export type BasicUser = { id: string; email: string; role: 'user' | 'moderator' | 'admin'; firstName?: string; lastName?: string };

export type UserStats = { totalUsers: number; byRole: { admin: number; moderator: number; user: number } };

export const usersService = {
  async listAll(): Promise<BasicUser[]> {
    const { data } = await axios.get<BasicUser[]>(`${API_BASE_URL}/user/all`, {
      headers: { ...getAuthHeaders() },
    });
    return data;
  },

  async stats(): Promise<UserStats> {
    const { data } = await axios.get<UserStats>(`${API_BASE_URL}/user/stats`, {
      headers: { ...getAuthHeaders() },
    });
    return data;
  },

  async getById(userId: string): Promise<BasicUser> {
    const { data } = await axios.get<BasicUser>(`${API_BASE_URL}/user/${userId}`, {
      headers: { ...getAuthHeaders() },
    });
    return data;
  },

  async updateRole(userId: string, role: 'user' | 'moderator' | 'admin'): Promise<BasicUser> {
    const { data } = await axios.put<BasicUser>(`${API_BASE_URL}/user/${userId}/role`, { role }, {
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    });
    return data;
  },

  async remove(userId: string): Promise<{ success: boolean }> {
    const { data } = await axios.delete<{ success: boolean }>(`${API_BASE_URL}/user/${userId}`, {
      headers: { ...getAuthHeaders() },
    });
    return data;
  },

  async createAdmin(payload: { email: string; password: string; role: 'user' | 'moderator' | 'admin'; firstName?: string; lastName?: string }): Promise<BasicUser> {
    const { data } = await axios.post<BasicUser>(`${API_BASE_URL}/user/admin/create`, payload, {
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    });
    return data;
  },
};


