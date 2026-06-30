import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsApi, customersApi, productsApi } from '../api/endpoints';
import StatusSelector from '../components/StatusSelector';

export default function NewLeadPage() {
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [productId, setProductId] = useState('');
  const [status, setStatus] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [remark, setRemark] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef(null);

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.list().then((r) => r.data.products),
  });

  useEffect(() => {
    if (selectedCustomerId) return;
    if (customerName.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { data } = await customersApi.search(customerName);
      setSuggestions(data.customers);
      setShowSuggestions(true);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [customerName, selectedCustomerId]);

  function selectCustomer(customer) {
    setCustomerName(customer.name);
    setSelectedCustomerId(customer._id);
    setShowSuggestions(false);
  }

  function handleNameChange(value) {
    setCustomerName(value);
    setSelectedCustomerId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!customerName.trim() || !productId || !status) {
      toast.error('Please fill in customer, product, and status');
      return;
    }
    if (status === 'follow_up_later' && !nextFollowUpDate) {
      toast.error('Next follow-up date is required for Follow Up Later');
      return;
    }

    setSubmitting(true);
    try {
      await leadsApi.create({
        customerName: selectedCustomerId ? undefined : customerName.trim(),
        customerId: selectedCustomerId || undefined,
        productId,
        status,
        nextFollowUpDate: status === 'follow_up_later' ? nextFollowUpDate : undefined,
        remark,
        lostReason: status === 'not_now' ? lostReason : undefined,
      });
      toast.success('+2 points! Logged for today 🎯', { icon: '🔥' });
      navigate('/leads');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save lead');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={20} className="text-brand-600" />
        <h2 className="text-xl font-semibold text-gray-800">Today's Work</h2>
      </div>
      <p className="text-sm text-gray-500 mb-5">Log a customer touchpoint — takes 10 seconds, earns you points.</p>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm">
        {/* Customer Name with autocomplete */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => handleNameChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Customer name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-md mt-1 shadow-sm max-h-48 overflow-y-auto">
              {suggestions.map((c) => (
                <li
                  key={c._id}
                  onClick={() => selectCustomer(c)}
                  className="px-3 py-2 text-sm hover:bg-brand-50 cursor-pointer"
                >
                  {c.name}
                </li>
              ))}
            </ul>
          )}
          {selectedCustomerId && <p className="text-xs text-green-600 mt-1">Existing customer selected</p>}
        </div>

        {/* Product */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product discussed</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select product...</option>
            {products?.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status — button row, not a dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">What happened?</label>
          <StatusSelector value={status} onChange={setStatus} />
        </div>

        {/* Conditional: Next follow-up date */}
        {status === 'follow_up_later' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Next follow-up date</label>
            <input
              type="date"
              value={nextFollowUpDate}
              onChange={(e) => setNextFollowUpDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        )}

        {/* Conditional: Lost reason */}
        {status === 'not_now' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="e.g. price, competitor, no budget"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-amber-600 mt-1">This is final — the lead can't be reopened later.</p>
          </div>
        )}

        {/* Feedback / Remark — replaces the old separate Remark + Today's Report fields */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Feedback / remark</label>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            placeholder="e.g. wants bulk rate, asked for new designs"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gradient-to-r from-brand-600 to-brand-700 text-white py-2.5 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {submitting ? 'Saving...' : 'Add to today\'s report'}
        </button>
        <p className="text-xs text-center text-gray-400">Pick an outcome, then add. Takes ~10 seconds.</p>
      </form>
    </div>
  );
}
