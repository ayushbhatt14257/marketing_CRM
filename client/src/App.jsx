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
  const login = useAuthStore((s) => s.login);

  // On app load, try to silently refresh the session using the httpOnly cookie,
  // so a page refresh doesn't force a re-login.
  useEffect(() => {
    async function bootstrap() {
      try {
        const { data } = await apiClient.post('/auth/refresh');
        useAuthStore.getState().setAccessToken(data.accessToken);
        const me = await authApi.me();
        login(me.data.user, data.accessToken);
      } catch {
        // not logged in — fine, user will see the login page
      } finally {
        setBootstrapped(true);
      }
    }
    bootstrap();
  }, [login]);

  if (!bootstrapped) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading...</div>;
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
