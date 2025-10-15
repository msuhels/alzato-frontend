import { apiClient } from './apiClient';

export type BasicUser = { id: string; email: string; role: 'user' | 'moderator' | 'admin'; firstName?: string; lastName?: string };

export type UserStats = { totalUsers: number; byRole: { admin: number; moderator: number; user: number } };

export const usersService = {
  async listAll(): Promise<BasicUser[]> {
    const { data } = await apiClient.get<BasicUser[]>('/user/all');
    return data;
  },

  async stats(): Promise<UserStats> {
    const { data } = await apiClient.get<UserStats>('/user/stats');
    return data;
  },

  async getById(userId: string): Promise<BasicUser> {
    const { data } = await apiClient.get<BasicUser>(`/user/${userId}`);
    return data;
  },

  async updateRole(userId: string, role: 'user' | 'moderator' | 'admin'): Promise<BasicUser> {
    const { data } = await apiClient.put<BasicUser>(`/user/${userId}/role`, { role });
    return data;
  },

  async remove(userId: string): Promise<{ success: boolean }> {
    const { data } = await apiClient.delete<{ success: boolean }>(`/user/${userId}`);
    return data;
  },

  async createAdmin(payload: { email: string; password: string; role: 'user' | 'moderator' | 'admin'; firstName?: string; lastName?: string }): Promise<BasicUser> {
    const { data } = await apiClient.post<BasicUser>('/user/admin/create', payload);
    return data;
  },
};


