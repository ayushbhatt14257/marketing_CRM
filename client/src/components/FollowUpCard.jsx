import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsApi } from '../api/endpoints';

export default function FollowUpCard({ lead }) {
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const followUpDate = new Date(lead.nextFollowUpDate);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const isOverdue = followUpDate < todayStart;
  // "Order Received" button only shows on or after the follow-up date (not before it)
  const isFollowUpDue = followUpDate <= new Date();

  async function quickComplete(status) {
    setSubmitting(true);
    try {
      await leadsApi.addFollowUp(lead._id, {
        status,
        remark: status === 'order_placed' ? 'Order received' : 'Follow-up completed',
      });
      toast.success(status === 'order_placed' ? 'Order received — great work! 🎉' : 'Follow-up updated');
      queryClient.invalidateQueries({ queryKey: ['due-today'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white border border-amber-200 rounded-lg px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800">
            {lead.customerId?.name}
            {isOverdue && <span className="text-xs text-red-600 font-semibold ml-1.5">OVERDUE</span>}
          </p>
          <p className="text-xs text-gray-500">
            {lead.productIds?.map((p) => p.name).join(', ')} ·{' '}
            <span className="text-amber-700">Due: {new Date(lead.nextFollowUpDate).toLocaleDateString('en-IN')}</span>
          </p>
        </div>
        <Link to={`/leads/${lead._id}`}
          className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">
          Open
        </Link>
      </div>

      {/* Action buttons — only show Order Received when it's actually due/overdue */}
      {isFollowUpDue && (
        <div className="flex gap-2 pt-1">
          <button
            disabled={submitting}
            onClick={() => quickComplete('order_placed')}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
          >
            <CheckCircle2 size={13} />
            Order Received
          </button>
          <button
            disabled={submitting}
            onClick={() => quickComplete('follow_up_later')}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-md border border-amber-400 text-amber-700 hover:bg-amber-50 disabled:opacity-60"
          >
            <Clock size={13} />
            Reschedule
          </button>
        </div>
      )}
    </div>
  );
}
