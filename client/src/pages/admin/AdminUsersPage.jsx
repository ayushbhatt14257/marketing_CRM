import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '../../api/endpoints';

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => usersApi.list().then((r) => r.data.users),
  });

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [submitting, setSubmitting] = useState(false);
  const [adjustingId, setAdjustingId] = useState(null);
  const [adjustDelta, setAdjustDelta] = useState('');

  const duplicateWarning = useMemo(() => {
    if (!data) return null;
    const normalizedName = name.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail && data.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      return 'A user with this email already exists.';
    }
    if (normalizedName && data.some((u) => u.name.trim().toLowerCase() === normalizedName)) {
      return `A user named "${name.trim()}" already exists.`;
    }
    return null;
  }, [data, name, email]);

  async function handleCreate(e) {
    e.preventDefault();
    if (duplicateWarning) { toast.error(duplicateWarning); return; }
    setSubmitting(true);
    try {
      await usersApi.create({ name: name.trim(), email: email.trim(), password, role });
      toast.success('User created');
      setName(''); setEmail(''); setPassword(''); setRole('user'); setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false); }
  }

  async function toggleActive(user) {
    try {
      await usersApi.setActive(user._id, !user.isActive);
      toast.success(user.isActive ? 'User deactivated' : 'User activated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
  }

  async function resetPassword(user) {
    try {
      const { data } = await usersApi.resetPassword(user._id);
      toast.success(`Temp password for ${user.name}: ${data.tempPassword}`, { duration: 8000 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    }
  }

  async function handleAdjustPoints(userId, delta) {
    if (!delta || isNaN(Number(delta))) { toast.error('Enter a valid number'); return; }
    try {
      const { data } = await usersApi.adjustPoints(userId, Number(delta));
      toast.success(`Points updated! New total: ${data.totalPoints}`);
      setAdjustingId(null);
      setAdjustDelta('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to adjust points');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-800">Users</h2>
        <button onClick={() => setShowForm((s) => !s)}
          className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-brand-700">
          {showForm ? 'Cancel' : '+ New User'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-lg p-5 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input placeholder="Name" required value={name} onChange={(e) => setName(e.target.value)}
              className={`px-3 py-2 border rounded-md text-sm ${duplicateWarning ? 'border-red-300' : 'border-gray-300'}`} />
            <input placeholder="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className={`px-3 py-2 border rounded-md text-sm ${duplicateWarning ? 'border-red-300' : 'border-gray-300'}`} />
            <input placeholder="Temporary password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm" />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-md text-sm">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {duplicateWarning && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 mt-3">
              <AlertTriangle size={13} />{duplicateWarning}
            </p>
          )}
          <button type="submit" disabled={submitting || !!duplicateWarning}
            className="w-full mt-4 bg-brand-600 text-white py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create User'}
          </button>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Points</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="text-center py-6 text-gray-400">Loading...</td></tr>}
            {!isLoading && data?.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-gray-400">No users yet.</td></tr>}
            {data?.map((u) => (
              <>
                <tr key={u._id} className="border-b border-gray-100">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{u.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{u.email}</td>
                  <td className="px-4 py-2.5 text-gray-600 capitalize">{u.role}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-brand-700">{u.totalPoints || 0}</span>
                      <span className="text-gray-400 text-xs">pts</span>
                      <button onClick={() => setAdjustingId(adjustingId === u._id ? null : u._id)}
                        className="text-xs text-gray-500 hover:text-brand-600 underline ml-1">
                        adjust
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-3">
                    <button onClick={() => resetPassword(u)} className="text-brand-600 text-xs font-medium hover:underline">Reset Pwd</button>
                    <button onClick={() => toggleActive(u)} className="text-xs font-medium hover:underline text-gray-600">
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
                {adjustingId === u._id && (
                  <tr key={`${u._id}-adjust`} className="bg-brand-50 border-b border-brand-100">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-semibold text-gray-700">Adjust points for {u.name}:</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setAdjustDelta(String(Number(adjustDelta || 0) - 2))}
                            className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200">
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            value={adjustDelta}
                            onChange={(e) => setAdjustDelta(e.target.value)}
                            placeholder="e.g. +2 or -4"
                            className="w-24 px-2 py-1 border border-gray-300 rounded-md text-sm text-center"
                          />
                          <button onClick={() => setAdjustDelta(String(Number(adjustDelta || 0) + 2))}
                            className="w-7 h-7 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200">
                            <Plus size={14} />
                          </button>
                        </div>
                        <button onClick={() => handleAdjustPoints(u._id, adjustDelta)}
                          className="px-3 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-md hover:bg-brand-700">
                          Apply
                        </button>
                        <button onClick={() => { setAdjustingId(null); setAdjustDelta(''); }}
                          className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-semibold rounded-md hover:bg-gray-50">
                          Cancel
                        </button>
                        <span className="text-xs text-gray-400">Current: {u.totalPoints || 0} pts</span>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
