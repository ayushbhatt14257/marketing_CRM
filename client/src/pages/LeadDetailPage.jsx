import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsApi } from '../api/endpoints';
import StatusSelector from '../components/StatusSelector';

const STATUS_META = {
  order_placed: { label: 'Order Received', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  follow_up_later: { label: 'Follow Up Later', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  not_now: { label: 'Not Now', icon: XCircle, color: 'text-gray-600 bg-gray-100' },
};

export default function LeadDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.get(id).then((r) => r.data),
  });

  const [status, setStatus] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) return <p className="text-gray-400">Loading...</p>;
  if (!data) return <p className="text-gray-400">Lead not found.</p>;

  const { lead, history } = data;
  const isClosed = lead.currentStatus === 'not_now';
  const CurrentIcon = STATUS_META[lead.currentStatus].icon;

  // "Order Received" only unlocks on/after the follow-up date for follow_up_later leads.
  // Example: follow-up set for 3rd July — user can't mark order before that date.
  const followUpDatePassed =
    lead.currentStatus === 'follow_up_later' && lead.nextFollowUpDate
      ? new Date(lead.nextFollowUpDate) <= new Date()
      : true;
  const hideOrderPlaced = !followUpDatePassed;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!status) return toast.error('Select an outcome');
    if (status === 'follow_up_later' && !nextFollowUpDate) return toast.error('Next follow-up date required');

    setSubmitting(true);
    try {
      await leadsApi.addFollowUp(id, { status, nextFollowUpDate: nextFollowUpDate || undefined, remark });
      toast.success(status === 'order_placed' ? 'Order received — great work! 🎉' : 'Follow-up logged');
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['due-today'] });
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      setStatus('');
      setRemark('');
      setNextFollowUpDate('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Lead info card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{lead.customerId?.name}</h2>
            <p className="text-sm text-gray-500">{lead.productIds?.map((p) => p.name).join(', ')}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${STATUS_META[lead.currentStatus].color}`}>
            <CurrentIcon size={14} />
            {STATUS_META[lead.currentStatus].label}
          </span>
        </div>
        {lead.nextFollowUpDate && (
          <p className="text-sm text-gray-500 mt-2">
            Next follow-up: {new Date(lead.nextFollowUpDate).toLocaleDateString('en-IN')}
            {hideOrderPlaced && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                Not due yet
              </span>
            )}
          </p>
        )}
      </div>

      {/* Follow-up form */}
      {!isClosed && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700">Add a follow-up</h3>

          {/* Pass hideOrderPlaced — "Order Received" hidden until follow-up date arrives */}
          <StatusSelector value={status} onChange={setStatus} hideOrderPlaced={hideOrderPlaced} />

          {status === 'follow_up_later' && (
            <input
              type="date"
              value={nextFollowUpDate}
              onChange={(e) => setNextFollowUpDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          )}
          <textarea
            placeholder="Feedback / remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <button
            type="submit"
            disabled={submitting}
            className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-5 py-2 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Save follow-up'}
          </button>
        </form>
      )}

      {isClosed && (
        <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-4">
          This lead is closed (Not Now) and cannot be reopened.
        </p>
      )}

      {/* History */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">History</h3>
        <div className="space-y-3">
          {history?.map((h) => {
            const meta = STATUS_META[h.statusAtEntry];
            const Icon = meta.icon;
            return (
              <div key={h._id} className="flex gap-3 border-b border-gray-100 pb-3 last:border-0">
                <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${meta.color}`}>
                  <Icon size={14} />
                </span>
                <div>
                  <p className="text-xs text-gray-400">{new Date(h.createdAt).toLocaleString('en-IN')}</p>
                  <p className="text-sm text-gray-700 font-medium">{meta.label}</p>
                  {h.remark && <p className="text-sm text-gray-500 mt-0.5">{h.remark}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
