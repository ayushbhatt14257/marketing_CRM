import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, User, TrendingUp, CheckCircle2, Clock,
  CreditCard, XCircle, UserPlus, Users, Star
} from 'lucide-react';
import { dashboardApi } from '../../api/endpoints';

const STATUS_META = {
  order_placed:    { label: 'Order Placed',    color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  follow_up_later: { label: 'Follow Up Later', color: 'bg-amber-100 text-amber-700',   icon: Clock },
  payment_talk:    { label: 'Payment Talk',    color: 'bg-purple-100 text-purple-700', icon: CreditCard },
  not_now:         { label: 'Not Now',         color: 'bg-gray-100 text-gray-600',     icon: XCircle },
};

function StatBox({ label, value, sub, color = 'text-gray-800' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`text-2xl font-extrabold mt-1 ${color}`}>{value ?? 0}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('leads');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['user-detail', id],
    queryFn: () => dashboardApi.userDetail(id).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-400">User not found.</p>;

  const { user, stats, leads, recentActivity } = data;

  const filteredLeads = statusFilter
    ? leads.filter((l) => l.currentStatus === statusFilter)
    : leads;

  return (
    <div className="max-w-5xl space-y-6">
      {/* Back */}
      <Link to="/admin/reports" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600">
        <ArrowLeft size={16} /> Back to Reports
      </Link>

      {/* User header */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-extrabold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-extrabold">{user.name}</h2>
            <p className="text-brand-100 text-sm">{user.email}</p>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 capitalize">{user.role}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${user.isActive ? 'bg-green-400/30' : 'bg-red-400/30'}`}>
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div className="ml-auto text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <Star size={16} className="text-amber-300" />
              <span className="text-2xl font-extrabold">{stats.allTimePoints}</span>
            </div>
            <p className="text-xs text-brand-100">All-time points</p>
            <p className="text-xs text-brand-100 mt-0.5">{stats.monthlyPoints} pts this month</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Total Leads" value={stats.totalLeads} />
        <StatBox label="Orders Placed" value={stats.ordersPlaced}
          sub={`${stats.conversionRate}% conversion`} color="text-green-700" />
        <StatBox label="Pending Follow-ups" value={stats.followUpsPending} color="text-amber-700" />
        <StatBox label="Unique Customers" value={stats.uniqueCustomers} />
        <StatBox label="New Customers" value={stats.newCustomers} sub="First-time contacts" />
        <StatBox label="Closed Follow-ups" value={stats.followUpsClosed} color="text-green-600" />
        <StatBox label="Talked Today" value={stats.todayTalked} />
        <StatBox label="Points This Month" value={stats.monthlyPoints} color="text-brand-700" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { key: 'leads', label: `All Leads (${leads.length})` },
          { key: 'activity', label: `Recent Activity (${recentActivity.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Leads tab */}
      {activeTab === 'leads' && (
        <div>
          {/* Status filter pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            {['', 'order_placed', 'follow_up_later', 'payment_talk', 'not_now'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  statusFilter === s
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'border-gray-300 text-gray-600 hover:border-gray-400'
                }`}
              >
                {s === '' ? `All (${leads.length})` : STATUS_META[s]?.label}
              </button>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Customer</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Products</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Follow-up</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Last Remark</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Added</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">No leads found.</td></tr>
                )}
                {filteredLeads.map((lead) => {
                  const meta = STATUS_META[lead.currentStatus];
                  const Icon = meta?.icon;
                  return (
                    <tr key={lead._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{lead.customerId?.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          lead.isNewCustomer ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {lead.isNewCustomer ? <UserPlus size={11} /> : <Users size={11} />}
                          {lead.isNewCustomer ? 'New' : 'Existing'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px]">
                        {lead.productIds?.map((p) => p.name).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {meta && (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
                            <Icon size={11} />
                            {meta.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {lead.nextFollowUpDate
                          ? new Date(lead.nextFollowUpDate).toLocaleDateString('en-IN')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px] truncate">
                        {lead.lastLog?.remark || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(lead.createdAt).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity tab */}
      {activeTab === 'activity' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="space-y-3">
            {recentActivity.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No activity yet.</p>
            )}
            {recentActivity.map((log) => {
              const meta = STATUS_META[log.statusAtEntry];
              const Icon = meta?.icon || CheckCircle2;
              return (
                <div key={log._id} className="flex gap-3 border-b border-gray-100 pb-3 last:border-0">
                  <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${meta?.color || 'bg-gray-100 text-gray-600'}`}>
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800">
                        {log.leadId?.customerId?.name || 'Unknown customer'}
                      </p>
                      <p className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{meta?.label}</p>
                    {log.remark && (
                      <p className="text-xs text-gray-400 mt-0.5 italic">"{log.remark}"</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
