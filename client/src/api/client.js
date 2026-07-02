import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let queue = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try cookie first, fall back to localStorage refresh token (Safari/iPhone)
        const storedRefreshToken = useAuthStore.getState().refreshToken;
        const { data } = await apiClient.post('/auth/refresh',
          storedRefreshToken ? { refreshToken: storedRefreshToken } : {}
        );
        useAuthStore.getState().updateTokens(data.accessToken, data.refreshToken);
        queue.forEach((p) => p.resolve());
        queue = [];
        return apiClient(originalRequest);
      } catch {
        queue.forEach((p) => p.reject());
        queue = [];
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
