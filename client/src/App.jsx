import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { authApi } from './api/endpoints';
import apiClient from './api/client';

import AppLayout from './components/AppLayout';
import { RequireAuth, RequireAdmin } from './components/RouteGuards';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import NewLeadPage from './pages/NewLeadPage';
import LeadsListPage from './pages/LeadsListPage';
import LeadDetailPage from './pages/LeadDetailPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminProductsPage from './pages/admin/AdminProductsPage';
import AdminCustomersPage from './pages/admin/AdminCustomersPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminUserDetailPage from './pages/admin/AdminUserDetailPage';
import AdminAssignLeadPage from './pages/admin/AdminAssignLeadPage';

export default function App() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const { user, accessToken, refreshToken, login, updateTokens } = useAuthStore();

  useEffect(() => {
    async function bootstrap() {
      if (accessToken && user) {
        try {
          await authApi.me();
          setBootstrapped(true);
          return;
        } catch { /* expired, fall through */ }
      }

      try {
        const { data } = await apiClient.post('/auth/refresh');
        updateTokens(data.accessToken, data.refreshToken);
        const me = await authApi.me();
        login(me.data.user, data.accessToken, data.refreshToken);
        setBootstrapped(true);
        return;
      } catch { /* cookie failed */ }

      if (refreshToken) {
        try {
          const { data } = await apiClient.post('/auth/refresh', { refreshToken });
          updateTokens(data.accessToken, data.refreshToken);
          const me = await authApi.me();
          login(me.data.user, data.accessToken, data.refreshToken);
          setBootstrapped(true);
          return;
        } catch { /* refresh token expired */ }
      }

      useAuthStore.getState().logout();
      setBootstrapped(true);
    }
    bootstrap();
  }, []); // eslint-disable-line

  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/leads/new" element={<NewLeadPage />} />
            <Route path="/leads" element={<LeadsListPage />} />
            <Route path="/leads/:id" element={<LeadDetailPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route element={<RequireAdmin />}>
              <Route path="/admin/assign" element={<AdminAssignLeadPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
              <Route path="/admin/products" element={<AdminProductsPage />} />
              <Route path="/admin/customers" element={<AdminCustomersPage />} />
              <Route path="/admin/reports" element={<AdminReportsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
