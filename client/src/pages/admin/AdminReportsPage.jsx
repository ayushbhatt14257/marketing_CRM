import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi, reportsApi } from '../../api/endpoints';
import StatCard from '../../components/StatCard';

export default function AdminReportsPage() {
  const { data: adminStats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => dashboardApi.adminStats().then((r) => r.data),
  });

  const { data: performance, isLoading: perfLoading } = useQuery({
    queryKey: ['user-performance'],
    queryFn: () => dashboardApi.userPerformance().then((r) => r.data.users),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Reports & Analytics</h2>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={adminStats?.totalUsers} loading={statsLoading} />
        <StatCard label="Active Users" value={adminStats?.activeUsers} loading={statsLoading} />
        <StatCard label="Total Leads" value={adminStats?.totalLeads} loading={statsLoading} />
        <StatCard label="Due Today" value={adminStats?.dueToday} loading={statsLoading} />
        <StatCard label="Orders Placed" value={adminStats?.ordersPlaced} loading={statsLoading} />
        <StatCard label="Pending Follow-ups" value={adminStats?.pendingFollowUps} loading={statsLoading} />
        <StatCard label="Closed Follow-ups" value={adminStats?.closedFollowUps} loading={statsLoading} />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Export Lead Activity Report</h3>
          <div className="flex gap-2">
            {['excel', 'csv', 'pdf'].map((type) => (
              <a
                key={type}
                href={reportsApi.exportUrl(type)}
                className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 uppercase"
              >
                {type}
              </a>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">User Performance</h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Total Leads</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Orders Placed</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Due Follow-ups</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Points (All-time)</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Points (Month)</th>
              </tr>
            </thead>
            <tbody>
              {perfLoading && (
                <tr><td colSpan={6} className="text-center py-6 text-gray-400">Loading...</td></tr>
              )}
              {performance?.map((u) => (
                <tr key={u.userId} className="border-b border-gray-100">
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    <Link
                      to={`/admin/users/${u.userId}`}
                      className="text-brand-600 hover:underline"
                    >
                      {u.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{u.totalLeads}</td>
                  <td className="px-4 py-2.5 text-gray-600">{u.ordersPlaced}</td>
                  <td className="px-4 py-2.5 text-gray-600">{u.dueFollowUps}</td>
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
