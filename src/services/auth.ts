import axios from 'axios';
import { API_BASE_URL, getAuthHeaders } from './config';

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
  // Map API responses (which may be snake_case and wrapped) into our camelCase UserProfile
  _normalizeUserProfile(data: any): UserProfile {
    const raw = (data?.profile ?? data?.user ?? data) || {};
    return {
      id: raw.id,
      email: raw.email,
      firstName: raw.firstName ?? raw.first_name ?? '',
      lastName: raw.lastName ?? raw.last_name ?? '',
      phone: raw.phone ?? '',
      bio: raw.bio ?? '',
      avatar: raw.avatar ?? '',
      role: raw.role,
    } as UserProfile;
  },
  async login(body: LoginBody): Promise<LoginResponse> {
    const { data } = await axios.post<LoginResponse>(`${API_BASE_URL}/auth/signin`, body, {
      headers: { 'Content-Type': 'application/json' },
    });
    return data;
  },

  async register(body: RegisterBody): Promise<LoginResponse> {
    const { data } = await axios.post<LoginResponse>(`${API_BASE_URL}/auth/register`, body, {
      headers: { 'Content-Type': 'application/json' },
    });
    return data;
  },

  async logout(): Promise<{ success: boolean }> {
    const { data } = await axios.post<{ success: boolean }>(`${API_BASE_URL}/auth/signout`, undefined, {
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    });
    return data;
  },

  async getProfile(): Promise<UserProfile> {
    const { data } = await axios.get(`${API_BASE_URL}/user/profile`, {
      headers: { ...getAuthHeaders() },
    });
    return authService._normalizeUserProfile(data);
  },

  async updateProfile(update: Partial<Omit<UserProfile, 'id' | 'email' | 'role'>>): Promise<UserProfile> {
    const { data } = await axios.put(`${API_BASE_URL}/user/profile`, update, {
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    });
    return authService._normalizeUserProfile(data);
  },
};


