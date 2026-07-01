import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, UserPlus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsApi, customersApi, productsApi } from '../api/endpoints';
import StatusSelector from '../components/StatusSelector';

export default function NewLeadPage() {
  const navigate = useNavigate();

  // Step 1: new or existing customer — shown first before anything else
  const [customerType, setCustomerType] = useState(null); // 'new' | 'existing'

  const [customerName, setCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
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
    if (selectedCustomerId || customerType !== 'existing') return;
    if (customerName.trim().length < 2) { setSuggestions([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { data } = await customersApi.search(customerName);
      setSuggestions(data.customers);
      setShowSuggestions(true);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [customerName, selectedCustomerId, customerType]);

  function selectCustomer(customer) {
    setCustomerName(customer.name);
    setSelectedCustomerId(customer._id);
    setShowSuggestions(false);
  }

  function toggleProduct(id) {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!customerType) { toast.error('Please select New or Existing customer first'); return; }
    if (!customerName.trim()) { toast.error('Customer name is required'); return; }
    if (customerType === 'existing' && !selectedCustomerId) { toast.error('Please select an existing customer from the dropdown'); return; }
    if (!selectedProductIds.length) { toast.error('Select at least one product'); return; }
    if (!status) { toast.error('Select what happened'); return; }
    if (status === 'follow_up_later' && !nextFollowUpDate) { toast.error('Next follow-up date is required'); return; }

    setSubmitting(true);
    try {
      await leadsApi.create({
        customerName: selectedCustomerId ? undefined : customerName.trim(),
        customerId: selectedCustomerId || undefined,
        productIds: selectedProductIds,
        status,
        nextFollowUpDate: status === 'follow_up_later' ? nextFollowUpDate : undefined,
        remark,
        lostReason: status === 'not_now' ? lostReason : undefined,
        isNewCustomer: customerType === 'new',
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

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-5 shadow-sm">

        {/* STEP 1: New or Existing customer — always first */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Customer type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { setCustomerType('new'); setSelectedCustomerId(null); setCustomerName(''); }}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                customerType === 'new'
                  ? 'bg-green-600 border-green-600 text-white'
                  : 'border-gray-300 text-gray-600 hover:border-green-400 hover:text-green-600'
              }`}
            >
              <UserPlus size={20} />
              New Customer
            </button>
            <button
              type="button"
              onClick={() => { setCustomerType('existing'); setSelectedCustomerId(null); setCustomerName(''); }}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                customerType === 'existing'
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'border-gray-300 text-gray-600 hover:border-brand-400 hover:text-brand-600'
              }`}
            >
              <Users size={20} />
              Existing Customer
            </button>
          </div>
        </div>

        {/* STEP 2: Customer name — shown only after type is selected */}
        {customerType && (
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {customerType === 'new' ? 'Customer name' : 'Search existing customer'}
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => { setCustomerName(e.target.value); setSelectedCustomerId(null); }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder={customerType === 'new' ? 'Enter new customer name' : 'Type to search...'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {customerType === 'existing' && showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-md mt-1 shadow-sm max-h-48 overflow-y-auto">
                {suggestions.map((c) => (
                  <li key={c._id} onClick={() => selectCustomer(c)} className="px-3 py-2 text-sm hover:bg-brand-50 cursor-pointer">
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
            {customerType === 'existing' && selectedCustomerId && (
              <p className="text-xs text-green-600 mt-1">✓ Existing customer selected</p>
            )}
            {customerType === 'existing' && customerName.length > 1 && !selectedCustomerId && suggestions.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No existing customer found — check spelling or choose "New Customer"</p>
            )}
          </div>
        )}

        {/* Rest of form — shown only after customer type is selected */}
        {customerType && (
          <>
            {/* Multi-select products */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product(s) discussed
                <span className="text-xs text-gray-400 ml-1">(select one or more)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {products?.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => toggleProduct(p._id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      selectedProductIds.includes(p._id)
                        ? 'bg-brand-600 border-brand-600 text-white'
                        : 'border-gray-300 text-gray-600 hover:border-brand-400'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              {selectedProductIds.length > 0 && (
                <p className="text-xs text-green-600 mt-1">{selectedProductIds.length} product(s) selected</p>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">What happened?</label>
              <StatusSelector value={status} onChange={setStatus} />
            </div>

            {status === 'follow_up_later' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next follow-up date</label>
                <input
                  type="date"
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            )}

            {status === 'not_now' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  placeholder="e.g. price, competitor, no budget"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <p className="text-xs text-amber-600 mt-1">This is final — lead can't be reopened.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Feedback / remark</label>
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={3}
                placeholder="e.g. wants bulk rate, asked for new designs"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-brand-600 to-brand-700 text-white py-2.5 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? 'Saving...' : "Add to today's report"}
            </button>
            <p className="text-xs text-center text-gray-400">Pick an outcome, then add. Takes ~10 seconds.</p>
          </>
        )}
      </form>
    </div>
  );
}
