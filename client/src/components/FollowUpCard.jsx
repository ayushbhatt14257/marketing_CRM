import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsApi } from '../api/endpoints';

export default function FollowUpCard({ lead }) {
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const isOverdue = new Date(lead.nextFollowUpDate) < new Date(new Date().setHours(0, 0, 0, 0));

  async function quickComplete(status) {
    setSubmitting(true);
    try {
      await leadsApi.addFollowUp(lead._id, {
        status,
        remark: status === 'order_placed' ? 'Order placed' : 'Marked as Not Now',
      });
      toast.success(status === 'order_placed' ? 'Order placed — nice work! 🎉' : 'Follow-up updated');
      queryClient.invalidateQueries({ queryKey: ['due-today'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-between bg-white border border-amber-200 rounded-lg px-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-gray-800">
          {lead.customerId?.name}{' '}
          {isOverdue && <span className="text-xs text-red-600 font-semibold ml-1">OVERDUE</span>}
        </p>
        <p className="text-xs text-gray-500">{lead.productId?.name}</p>
      </div>
      <div className="flex gap-2">
        <Link
          to={`/leads/${lead._id}`}
          className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Open
        </Link>
        <button
          disabled={submitting}
          onClick={() => quickComplete('order_placed')}
          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
        >
          <CheckCircle2 size={13} />
          Order Placed
        </button>
      </div>
    </div>
  );
}
