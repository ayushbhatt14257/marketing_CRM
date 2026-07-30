import { useEffect, useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { authApi } from './api/endpoints';
import apiClient from './api/client';

import AppLayout from './components/AppLayout';
import { RequireAuth, RequireAdmin, RequireStockOrAdmin } from './components/RouteGuards';

// Lazy-loaded: each page becomes its own JS chunk, fetched only when actually
// visited. Regular sales-rep users (the majority of daily traffic) never touch
// the admin pages, so this keeps their initial load to just what they need
// instead of shipping the whole admin section (users, reports, book-match, etc.)
// on every page load.
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const NewLeadPage = lazy(() => import('./pages/NewLeadPage'));
const LeadsListPage = lazy(() => import('./pages/LeadsListPage'));
const LeadDetailPage = lazy(() => import('./pages/LeadDetailPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage'));
const AdminCustomersPage = lazy(() => import('./pages/admin/AdminCustomersPage'));
const AdminBookMatchPage = lazy(() => import('./pages/admin/AdminBookMatchPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'));
const AdminUserDetailPage = lazy(() => import('./pages/admin/AdminUserDetailPage'));
const AdminAssignLeadPage = lazy(() => import('./pages/admin/AdminAssignLeadPage'));
const OrdersKanbanPage = lazy(() => import('./pages/OrdersKanbanPage'));
const AdminStockPage = lazy(() => import('./pages/admin/AdminStockPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage'));

function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/leads/new" element={<NewLeadPage />} />
              <Route path="/leads" element={<LeadsListPage />} />
              <Route path="/leads/:id" element={<LeadDetailPage />} />
              <Route path="/orders" element={<OrdersKanbanPage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
              <Route element={<RequireStockOrAdmin />}>
                <Route path="/stock" element={<AdminStockPage />} />
              </Route>
              <Route element={<RequireAdmin />}>
                <Route path="/admin/assign" element={<AdminAssignLeadPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
                <Route path="/admin/products" element={<AdminProductsPage />} />
                <Route path="/admin/customers" element={<AdminCustomersPage />} />
                <Route path="/admin/book-match" element={<AdminBookMatchPage />} />
                <Route path="/admin/reports" element={<AdminReportsPage />} />
                <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
