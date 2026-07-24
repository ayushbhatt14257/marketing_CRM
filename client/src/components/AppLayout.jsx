import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, List, PlusCircle, Users, Package,
  Contact, FileBarChart, LogOut, Menu, X,
  UserCheck, KeyRound
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authApi, dashboardApi } from '../api/endpoints';
import PointsBadge from './PointsBadge';
import NotificationBell from './NotificationBell';

const userLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/leads/new', label: "Today's Work", icon: PlusCircle },
  { to: '/leads', label: 'My Leads', icon: List },
  { to: '/change-password', label: 'Change Password', icon: KeyRound },
];

const mobileTabLinks = [
  { to: '/dashboard', label: 'My Day', icon: LayoutDashboard },
  { to: '/leads/new', label: 'New Entry', icon: PlusCircle },
  { to: '/leads', label: 'Leads', icon: List },
];

const adminLinks = [
  { to: '/admin/assign', label: 'Assign Lead', icon: UserCheck },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/customers', label: 'Customers', icon: Contact },
  { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
];

export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['user-stats'],
    queryFn: () => dashboardApi.userStats().then((r) => r.data),
    enabled: user?.role !== 'admin',
  });

  // Claim daily points as soon as ANY authenticated page loads — not just the Dashboard.
  // Lives here (in the layout every page renders inside) rather than in DashboardPage,
  // so someone who lands straight on "Today's Work" or "My Leads" still gets credited.
  // Fires once the session is *confirmed* valid (user-stats succeeded) rather than a
  // blind timer, since that's what caused the "only works after a refresh" bug before.
  useEffect(() => {
    if (user?.role === 'admin' || !stats) return;
    let cancelled = false;

    const claim = (attempt = 1) => {
      const currentUser = useAuthStore.getState().user;
      const uid = currentUser?.id || currentUser?._id;
      if (!uid || cancelled) return;
      dashboardApi.claimDailyPoints()
        .then(({ data }) => {
          if (cancelled) return;
          if (data.awarded) {
            toast.success(`+${data.points} points! Keep it up 🔥`, { duration: 3000, icon: '⭐' });
            queryClient.invalidateQueries({ queryKey: ['user-stats'] });
          }
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('claim-daily-points failed:', err?.message || err);
          if (attempt < 3) {
            setTimeout(() => claim(attempt + 1), 2000 * attempt);
          }
        });
    };

    claim();

    const onVisible = () => {
      if (document.visibilityState === 'visible') claim();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [stats, user?.role, queryClient]); // eslint-disable-line

  const links = user?.role === 'admin' ? [...userLinks, ...adminLinks] : userLinks;

  async function handleLogout() {
    try { await authApi.logout(); } finally {
      logout();
      navigate('/login');
    }
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-gradient-to-r from-brand-600 to-brand-700 sticky top-0 z-30">
        <div>
          <h1 className="text-base font-bold text-white">Marketing CRM</h1>
          <p className="text-xs text-brand-100">{user?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role !== 'admin' && <PointsBadge points={stats?.currentPoints ?? 0} size="sm" />}
          <NotificationBell />
          <button onClick={() => setMobileMenuOpen((v) => !v)} className="text-white p-1.5 rounded-md hover:bg-white/10">
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile slide-down menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 sticky top-[60px] z-30">
          <nav className="px-3 py-2">
            {(user?.role === 'admin' ? adminLinks : [{ to: '/change-password', label: 'Change Password', icon: KeyRound }]).map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600'}`
                }>
                <Icon size={17} />{label}
              </NavLink>
            ))}
            <button onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium text-gray-600">
              <LogOut size={17} />Log out
            </button>
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-gray-200 flex-col">
        <div className="px-5 py-5 border-b border-gray-100 bg-gradient-to-br from-brand-600 to-brand-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Marketing CRM</h1>
              <p className="text-xs text-brand-100 mt-0.5">{user?.name}</p>
            </div>
            <NotificationBell />
          </div>
        </div>

        {user?.role !== 'admin' && (
          <div className="px-4 py-3 border-b border-gray-100">
            <PointsBadge points={stats?.currentPoints ?? 0} />
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }>
              <Icon size={17} />{label}
            </NavLink>
          ))}
        </nav>

        <button onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 m-3 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100">
          <LogOut size={17} />Log out
        </button>
      </aside>

      <main className="flex-1 p-4 md:p-6 overflow-y-auto bg-gray-50 pb-20 md:pb-6">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-30">
        {mobileTabLinks.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname === to ||
            (to === '/leads' && location.pathname.startsWith('/leads/') && location.pathname !== '/leads/new');
          return (
            <NavLink key={to} to={to}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium ${
                isActive ? 'text-brand-600' : 'text-gray-400'
              }`}>
              <Icon size={20} />{label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
