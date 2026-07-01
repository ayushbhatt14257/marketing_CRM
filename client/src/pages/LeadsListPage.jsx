import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { leadsApi } from '../api/endpoints';

const STATUS_LABELS = {
  order_placed: 'Order Placed',
  follow_up_later: 'Follow Up Later',
  payment_talk: 'Payment Talk',
  not_now: 'Not Now',
};

const STATUS_COLORS = {
  order_placed: 'bg-green-100 text-green-700',
  follow_up_later: 'bg-amber-100 text-amber-700',
  payment_talk: 'bg-purple-100 text-purple-700',
  not_now: 'bg-gray-100 text-gray-600',
};

export default function LeadsListPage() {
  const [range, setRange] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', range, status, search, page],
    queryFn: () =>
      leadsApi.list({ range: range || undefined, status: status || undefined, search: search || undefined, page })
        .then((r) => r.data),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-800">My Leads</h2>
        <Link to="/leads/new" className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-700">
          + Today's Work
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search customer..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        />
        <select value={range} onChange={(e) => { setRange(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
          <option value="">All time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Customer</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Products</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Follow-up</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Last Remark</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-6 text-gray-400">Loading...</td></tr>
            )}
            {!isLoading && data?.leads.length === 0 && (
              <tr><td colSpan={7} className="text-center py-6 text-gray-400">No leads found.</td></tr>
            )}
            {data?.leads.map((lead) => (
              <tr key={lead._id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-800">{lead.customerId?.name}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${lead.isNewCustomer ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {lead.isNewCustomer ? 'New' : 'Existing'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-600 text-xs">
                  {lead.productIds?.map((p) => p.name).join(', ') || '—'}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[lead.currentStatus]}`}>
                    {STATUS_LABELS[lead.currentStatus]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-600 text-xs">
                  {lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toLocaleDateString('en-IN') : '—'}
                </td>
                <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[160px] truncate">
                  {lead.lastRemark || '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link to={`/leads/${lead._id}`} className="text-brand-600 text-xs font-medium hover:underline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data?.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 text-sm rounded-md ${p === page ? 'bg-brand-600 text-white' : 'bg-white border border-gray-300 text-gray-600'}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
