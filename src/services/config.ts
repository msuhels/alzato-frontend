// Centralized API configuration. Use this in all services.

export const API_BASE_URL: string = (() => {
  const env: any = (import.meta as any).env || {};
  const configured = env.VITE_BACKEND_URL?.trim();
  console.log('configured', configured);
  return configured;
})();

export const getAuthHeaders = () => {
  const token = localStorage.getItem('auth-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};


