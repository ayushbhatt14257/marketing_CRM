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
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminProductsPage from './pages/admin/AdminProductsPage';
import AdminCustomersPage from './pages/admin/AdminCustomersPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';

export default function App() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const { user, accessToken, login, setAccessToken } = useAuthStore();

  useEffect(() => {
    async function bootstrap() {
      // If localStorage already has a token (Safari/iPhone fix), verify it's still valid
      if (accessToken && user) {
        try {
          await authApi.me(); // will fail with 401 if token expired
          setBootstrapped(true);
          return;
        } catch {
          // Token expired — fall through to refresh attempt
        }
      }

      // Try cookie-based refresh (works on Chrome/Firefox, not Safari cross-origin)
      try {
        const { data } = await apiClient.post('/auth/refresh');
        setAccessToken(data.accessToken);
        const me = await authApi.me();
        login(me.data.user, data.accessToken);
      } catch {
        useAuthStore.getState().logout();
      } finally {
        setBootstrapped(true);
      }
    }
    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        Loading...
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

            <Route element={<RequireAdmin />}>
              <Route path="/admin/users" element={<AdminUsersPage />} />
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
