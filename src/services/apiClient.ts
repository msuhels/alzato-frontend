import axios from 'axios';

// Use relative '/api' in dev to leverage Vite proxy and avoid CORS.
// Prefer env override when provided for staging/prod.
const BASE_URL = (import.meta as any)?.env?.VITE_BACKEND_URL || '/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth-token');
  const url = config.url || '';
  const isSignin = url.includes('/auth/signin');
  if (token && !isSignin) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// Optional: handle 401 to route to login without clearing token immediately
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      // Keep token for now; app can decide to redirect
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export type PaginatedResponse<T> = {
  success?: boolean;
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type ApiError = { error: string; code?: string; details?: any[] };


