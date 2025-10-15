import { apiClient } from './apiClient';

export type LoginBody = { email: string; password: string };
export type RegisterBody = { email: string; password: string; firstName: string; lastName: string };

export type LoginResponse = {
  success: boolean;
  message: string;
  token: string;
  user: { id: string; email: string; role: 'user' | 'moderator' | 'admin' };
};

export type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  bio: string;
  avatar: string;
  role: 'user' | 'moderator' | 'admin';
};

export const authService = {
  async login(body: LoginBody): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/auth/signin', body);
    return data;
  },

  async register(body: RegisterBody): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/auth/register', body);
    return data;
  },

  async logout(): Promise<{ success: boolean }> {
    const { data } = await apiClient.post<{ success: boolean }>('/auth/signout');
    return data;
  },

  async getProfile(): Promise<UserProfile> {
    const { data } = await apiClient.get<UserProfile>('/user/profile');
    return data;
  },

  async updateProfile(update: Partial<Omit<UserProfile, 'id' | 'email' | 'role'>>): Promise<UserProfile> {
    const { data } = await apiClient.put<UserProfile>('/user/profile', update);
    return data;
  },
};


