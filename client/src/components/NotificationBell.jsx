import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, UserCheck } from 'lucide-react';
import apiClient from '../api/client';

async function fetchNotifications() {
  const { data } = await apiClient.get('/notifications');
  return data;
}

async function markAllRead() {
  await apiClient.put('/notifications/read-all');
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30000, // check every 30 seconds
  });

  const unread = data?.unreadCount || 0;
  const notifications = data?.notifications || [];

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleOpen() {
    setOpen((v) => !v);
    if (!open && unread > 0) {
      await markAllRead();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} className="text-white" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Notifications</p>
            {notifications.length > 0 && (
              <button onClick={async () => { await markAllRead(); queryClient.invalidateQueries({ queryKey: ['notifications'] }); }}
                className="text-xs text-brand-600 hover:underline flex items-center gap-1">
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No notifications yet</p>
            )}
            {notifications.map((n) => (
              <div key={n._id}
                className={`px-4 py-3 border-b border-gray-50 ${!n.isRead ? 'bg-brand-50' : ''}`}>
                <div className="flex gap-2.5">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center">
                    <UserCheck size={14} className="text-brand-600" />
                  </span>
                  <div>
                    <p className="text-xs text-gray-700">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(n.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  {!n.isRead && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-brand-500 mt-1" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
