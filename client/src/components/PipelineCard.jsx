import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, CalendarClock, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsApi } from '../api/endpoints';

const TAG_STYLES = {
  overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-700' },
  'due-today': { label: 'Due Today', cls: 'bg-amber-100 text-amber-700' },
  upcoming: { label: 'Upcoming', cls: 'bg-blue-100 text-blue-700' },
};

export default function PipelineCard({ lead, onUpdate }) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const isDue = lead.tag === 'overdue' || lead.tag === 'due-today';
  const tag = TAG_STYLES[lead.tag];

  async function markOrderReceived() {
    setSubmitting(true);
    try {
      await leadsApi.addFollowUp(lead._id, {
        status: 'order_placed',
        remark: 'Order received',
      });
      toast.success('Order received — great work! 🎉');
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      queryClient.invalidateQueries({ queryKey: ['due-today'] });
      onUpdate?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  }

  async function reschedule() {
    if (!newDate) return toast.error('Select a date');
    setSubmitting(true);
    try {
      await leadsApi.addFollowUp(lead._id, {
        status: 'follow_up_later',
        nextFollowUpDate: newDate,
        remark: 'Follow-up rescheduled',
      });
      toast.success('Follow-up rescheduled');
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['due-today'] });
      setShowReschedule(false);
      onUpdate?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reschedule');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`bg-white border rounded-xl p-4 shadow-sm space-y-3 ${isDue ? 'border-amber-200' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800">{lead.customerId?.name}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tag.cls}`}>{tag.label}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {lead.productIds?.map((p) => p.name).join(', ')}
          </p>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <Clock size={11} />
            Follow-up: {new Date(lead.nextFollowUpDate).toLocaleDateString('en-IN')}
          </p>
        </div>
        <Link
          to={`/leads/${lead._id}`}
          className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          Open
        </Link>
      </div>

      {/* Action buttons — only when due or overdue */}
      {isDue && !showReschedule && (
        <div className="flex gap-2 pt-1">
          <button
            disabled={submitting}
            onClick={markOrderReceived}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            <CheckCircle2 size={14} />
            Order Received
          </button>
          <button
            disabled={submitting}
            onClick={() => setShowReschedule(true)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border border-amber-400 text-amber-700 hover:bg-amber-50 disabled:opacity-60 transition-colors"
          >
            <CalendarClock size={14} />
            Next Follow-up Date
          </button>
        </div>
      )}

      {/* Reschedule date picker */}
      {isDue && showReschedule && (
        <div className="space-y-2 pt-1">
          <label className="block text-xs font-medium text-gray-600">Select next follow-up date</label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={reschedule}
              disabled={submitting}
              className="flex-1 py-2 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Confirm'}
            </button>
            <button
              onClick={() => setShowReschedule(false)}
              className="flex-1 py-2 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Upcoming — just shows date, no action needed yet */}
      {!isDue && (
        <p className="text-xs text-gray-400 italic">Action buttons will appear on the follow-up date.</p>
      )}
    </div>
  );
}
