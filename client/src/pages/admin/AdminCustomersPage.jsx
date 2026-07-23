import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Check, X, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { customersApi } from '../../api/endpoints';

export default function AdminCustomersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: () => customersApi.listAll().then((r) => r.data.customers),
  });

  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [userFilter, setUserFilter] = useState('all');

  // Per-user counts, for the summary row and the filter dropdown.
  const userSummary = useMemo(() => {
    if (!data) return [];
    const counts = new Map(); // userId -> { name, count }
    for (const c of data) {
      const key = c.addedById || 'unknown';
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { id: key, name: c.addedByName, count: 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data) return data;
    if (userFilter === 'all') return data;
    return data.filter((c) => (c.addedById || 'unknown') === userFilter);
  }, [data, userFilter]);

  function startEdit(customer) {
    setEditingId(customer._id);
    setEditValue(customer.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue('');
  }

  async function saveEdit(id) {
    if (!editValue.trim()) return;
    setSaving(true);
    try {
      await customersApi.rename(id, editValue.trim());
      toast.success('Customer renamed');
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      cancelEdit();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to rename customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Customers</h2>
      <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-5">
        <Info size={13} />
        Customers are created automatically the first time someone logs a lead for them — matched by name, so
        typing the same name again reuses the existing customer instead of creating a duplicate. If you spot a
        typo variant (e.g. "Rohit Sharma" vs "Rohit Shrama"), rename one to merge it visually — existing leads
        stay linked to their original record either way.
      </p>

      {/* Per-user summary */}
      {!isLoading && userSummary.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Customers by User</h3>
            {userFilter !== 'all' && (
              <button
                onClick={() => setUserFilter('all')}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {userSummary.map((u) => (
              <button
                key={u.id}
                onClick={() => setUserFilter(userFilter === u.id ? 'all' : u.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  userFilter === u.id
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-brand-300'
                }`}
              >
                {u.name} · {u.count}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Added By</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Leads</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">First Seen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="text-center py-6 text-gray-400">Loading...</td></tr>
            )}
            {!isLoading && filteredData?.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6 text-gray-400">No customers yet — they'll appear here once leads are logged.</td></tr>
            )}
            {filteredData?.map((c) => (
              <tr key={c._id} className="border-b border-gray-100">
                <td className="px-4 py-2.5 font-medium text-gray-800">
                  {editingId === c._id ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit(c._id)}
                      className="px-2 py-1 border border-brand-300 rounded text-sm w-full max-w-xs"
                    />
                  ) : (
                    c.name
                  )}
                </td>
                <td className="px-4 py-2.5 text-gray-600">{c.addedByName}</td>
                <td className="px-4 py-2.5 text-gray-600">{c.leadCount}</td>
                <td className="px-4 py-2.5 text-gray-600">{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                <td className="px-4 py-2.5 text-right">
                  {editingId === c._id ? (
                    <span className="inline-flex gap-2">
                      <button onClick={() => saveEdit(c._id)} disabled={saving} className="text-green-600 hover:text-green-700">
                        <Check size={16} />
                      </button>
                      <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
                        <X size={16} />
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => startEdit(c)} className="text-brand-600 text-xs font-medium hover:underline inline-flex items-center gap-1">
                      <Pencil size={12} />
                      Rename
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
