import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { reportsApi } from '../../api/endpoints';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AdminAnalyticsPage() {
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => reportsApi.analytics().then((r) => r.data),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const { trend, funnel, productPerformance, comparison } = analyticsData || {};

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp size={24} className="text-brand-600" />
        <h2 className="text-xl font-semibold text-gray-800">Deep Analysis Dashboard</h2>
      </div>

      {/* Funnel Overview */}
      {funnel && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Total Leads</p>
            <p className="text-2xl font-bold text-gray-800">{funnel.totalLeads}</p>
          </div>
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Orders Placed</p>
            <p className="text-2xl font-bold text-green-600">{funnel.ordersPlaced}</p>
          </div>
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Conversion Rate</p>
            <p className="text-2xl font-bold text-blue-600">{funnel.conversionRate}%</p>
          </div>
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Not Converted</p>
            <p className="text-2xl font-bold text-amber-600">{funnel.totalLeads - funnel.ordersPlaced}</p>
          </div>
        </div>
      )}

      {/* Trend Chart */}
      {trend && trend.length > 0 && (
        <div className="bg-white border rounded-lg p-4 mb-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Leads & Orders Trend (30 days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <Tooltip contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px' }} />
              <Legend />
              <Line type="monotone" dataKey="leadsCount" stroke="#3b82f6" name="Leads Entered" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="ordersCount" stroke="#10b981" name="Orders Placed" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Product Performance */}
      {productPerformance && productPerformance.length > 0 && (
        <div className="bg-white border rounded-lg p-4 mb-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Product-wise Sales</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={productPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="productName" stroke="#9ca3af" style={{ fontSize: '12px' }} angle={-45} textAnchor="end" height={100} />
              <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
              <Tooltip contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px' }} />
              <Legend />
              <Bar dataKey="approvedQty" fill="#3b82f6" name="Approved" />
              <Bar dataKey="dispatchedQty" fill="#10b981" name="Dispatched" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Week/Month Comparison */}
      {comparison && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">This Week vs Last Week</h3>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={[
                { name: 'This Week', value: comparison.thisWeek },
                { name: 'Last Week', value: comparison.lastWeek },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '11px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '11px' }} />
                <Tooltip contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px' }} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">This Month vs Last Month</h3>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={[
                { name: 'This Month', value: comparison.thisMonth },
                { name: 'Last Month', value: comparison.lastMonth },
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '11px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '11px' }} />
                <Tooltip contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px' }} />
                <Bar dataKey="value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
