import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi, reportsApi } from '../../api/endpoints';
import StatCard from '../../components/StatCard';

const DAY_COLORS = {
  true: 'bg-green-500',
  false: 'bg-gray-200',
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getCurrentISTMonth() {
  const d = new Date(Date.now() + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Converts a 'YYYY-MM' month string into IST month-start/month-end ISO bounds.
function monthRangeIST(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const from = new Date(`${monthStr}-01T00:00:00+05:30`);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  const to = new Date(new Date(`${nextMonth}-01T00:00:00+05:30`).getTime() - 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function AdminReportsPage() {
  const { data: adminStats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => dashboardApi.adminStats().then((r) => r.data),
  });

  // null = "All Time" (no filter). Defaults to the current IST month.
  const [perfMonth, setPerfMonth] = useState(getCurrentISTMonth());
  const perfRange = perfMonth ? monthRangeIST(perfMonth) : null;

  const { data: performance, isLoading: perfLoading } = useQuery({
    queryKey: ['user-performance', perfMonth],
    queryFn: () => dashboardApi.userPerformance(perfRange || undefined).then((r) => r.data.users),
  });

  const { data: attendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ['weekly-attendance'],
    queryFn: () => dashboardApi.weeklyAttendance().then((r) => r.data),
  });

  const { data: byDay, isLoading: byDayLoading } = useQuery({
    queryKey: ['leads-by-day-admin'],
    queryFn: () => reportsApi.leadsByDay().then((r) => r.data.days),
  });

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-gray-800">Reports & Analytics</h2>

      {/* Stats grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={adminStats?.totalUsers} loading={statsLoading} />
        <StatCard label="Active Users" value={adminStats?.activeUsers} loading={statsLoading} />
        <StatCard label="Total Leads" value={adminStats?.totalLeads} loading={statsLoading} />
        <StatCard label="Due Today" value={adminStats?.dueToday} loading={statsLoading} />
        <StatCard label="Orders Placed" value={adminStats?.ordersPlaced} loading={statsLoading} />
        <StatCard label="Pending Follow-ups" value={adminStats?.pendingFollowUps} loading={statsLoading} />
        <StatCard label="Closed Follow-ups" value={adminStats?.closedFollowUps} loading={statsLoading} />
      </section>

      {/* Weekly Attendance */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Weekly Login Attendance</h3>
            <p className="text-xs text-gray-500 mt-0.5">Last 7 days — green = logged in / visited, gray = absent</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-[140px]">User</th>
                {attendanceLoading
                  ? Array(7).fill(null).map((_, i) => (
                      <th key={i} className="px-3 py-3 text-center font-medium text-gray-400 min-w-[80px]">—</th>
                    ))
                  : attendance?.days.map((d) => (
                      <th key={d.dateKey} className="px-3 py-3 text-center min-w-[80px]">
                        <p className="font-semibold text-gray-700 text-xs">{d.dayName.slice(0, 3)}</p>
                        <p className="text-gray-400 text-xs font-normal">{d.label.split(',')[0]}</p>
                      </th>
                    ))}
                <th className="px-4 py-3 text-center font-medium text-gray-600">Active Days</th>
              </tr>
            </thead>
            <tbody>
              {attendanceLoading && (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">Loading attendance...</td></tr>
              )}
              {!attendanceLoading && attendance?.users.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">No users found.</td></tr>
              )}
              {attendance?.users.map((u) => (
                <tr key={u.userId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/admin/users/${u.userId}`} className="font-medium text-brand-600 hover:underline text-sm">
                      {u.name}
                    </Link>
                    <p className="text-xs text-gray-400">{u.email}</p>
                    {!u.isActive && (
                      <span className="text-xs text-gray-400 italic">Inactive</span>
                    )}
                  </td>
                  {u.presence.map((present, idx) => (
                    <td key={idx} className="px-3 py-3 text-center">
                      <div className="flex justify-center">
                        {present ? (
                          <span className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">✓</span>
                        ) : (
                          <span className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300 text-xs">–</span>
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-bold ${
                      u.activeDays >= 5 ? 'text-green-600' :
                      u.activeDays >= 3 ? 'text-amber-600' : 'text-red-500'
                    }`}>
                      {u.activeDays}/7
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Leads by Day */}
      <section>
        <div className="mb-3">
          <h3 className="text-base font-semibold text-gray-800">Leads by Day</h3>
          <p className="text-xs text-gray-500 mt-0.5">All leads across all users, grouped by the date they were entered (IST).</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Leads Entered</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Orders Placed</th>
              </tr>
            </thead>
            <tbody>
              {byDayLoading && (
                <tr><td colSpan={3} className="text-center py-6 text-gray-400">Loading...</td></tr>
              )}
              {!byDayLoading && byDay?.length === 0 && (
                <tr><td colSpan={3} className="text-center py-6 text-gray-400">No leads yet.</td></tr>
              )}
              {byDay?.map((d) => (
                <tr key={d.date} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    {new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{d.count}</td>
                  <td className="px-4 py-2.5 text-gray-600">{d.ordersPlaced}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Export */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Export Lead Activity Report</h3>
          <div className="flex gap-2">
            {['excel', 'csv', 'pdf'].map((type) => (
              <a key={type} href={reportsApi.exportUrl(type)}
                className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 uppercase">
                {type}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* User Performance Table */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-gray-700">User Performance</h3>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={perfMonth || ''}
              onChange={(e) => setPerfMonth(e.target.value || getCurrentISTMonth())}
              className="text-xs border border-gray-300 rounded-md px-2 py-1.5 text-gray-700"
            />
            {perfMonth !== null && (
              <button
                onClick={() => setPerfMonth(null)}
                className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Remove filter (All Time)
              </button>
            )}
            {perfMonth === null && (
              <button
                onClick={() => setPerfMonth(getCurrentISTMonth())}
                className="text-xs font-medium px-3 py-1.5 rounded-md border border-brand-300 text-brand-600 hover:bg-brand-50"
              >
                Back to this month
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          {perfMonth
            ? `Showing data for ${new Date(`${perfMonth}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}. Leads, orders, and "Days <7 Leads" reset each month — points columns are always all-time / this-month regardless of this filter.`
            : 'Showing all-time data — no month filter applied.'}
        </p>
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Total Leads</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Orders Placed</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Due Follow-ups</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600" title="Days this user worked but entered fewer than 7 leads">Days &lt;7 Leads</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Points (All-time)</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Points (Month)</th>
              </tr>
            </thead>
            <tbody>
              {perfLoading && (
                <tr><td colSpan={7} className="text-center py-6 text-gray-400">Loading...</td></tr>
              )}
              {performance?.map((u) => (
                <tr key={u.userId} className="border-b border-gray-100">
                  <td className="px-4 py-2.5 font-medium">
                    <Link to={`/admin/users/${u.userId}`} className="text-brand-600 hover:underline">
                      {u.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{u.totalLeads}</td>
                  <td className="px-4 py-2.5 text-gray-600">{u.ordersPlaced}</td>
                  <td className="px-4 py-2.5 text-gray-600">{u.dueFollowUps}</td>
                  <td className={`px-4 py-2.5 font-medium ${u.lowLeadDays > 0 ? 'text-amber-600' : 'text-gray-600'}`}>{u.lowLeadDays}</td>
                  <td className="px-4 py-2.5 text-gray-600">{u.allTimePoints}</td>
                  <td className="px-4 py-2.5 text-gray-600">{u.monthlyPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
