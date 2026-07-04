import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UserCheck, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsApi, customersApi, productsApi, usersApi } from '../../api/endpoints';
import StatusSelector from '../../components/StatusSelector';

export default function AdminAssignLeadPage() {
  const navigate = useNavigate();
  const [assignTo, setAssignTo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [productTab, setProductTab] = useState('fonfox');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [status, setStatus] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef(null);

  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => usersApi.list().then((r) => r.data.users.filter((u) => u.isActive && u.role === 'user')),
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.list().then((r) => r.data.products),
  });

  const fonfoxProducts = products?.filter((p) => p.category === 'fonfox') || [];
  const supremeProducts = products?.filter((p) => p.category === 'supreme') || [];
  const activeTabProducts = productTab === 'fonfox' ? fonfoxProducts : supremeProducts;
  const fonfoxSelected = selectedProductIds.filter((id) => fonfoxProducts.some((p) => p._id === id)).length;
  const supremeSelected = selectedProductIds.filter((id) => supremeProducts.some((p) => p._id === id)).length;

  useEffect(() => {
    if (customerName.trim().length < 2) { setSuggestions([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { data } = await customersApi.search(customerName);
      setSuggestions(data.customers);
      setShowSuggestions(true);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [customerName]);

  function selectCustomer(c) { setCustomerName(c.name); setSelectedCustomerId(c._id); setShowSuggestions(false); }
  function toggleProduct(id) {
    setSelectedProductIds((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!assignTo) { toast.error('Select a user to assign this lead to'); return; }
    if (!customerName.trim()) { toast.error('Customer name is required'); return; }
    if (!selectedProductIds.length) { toast.error('Select at least one product'); return; }
    if (!status) { toast.error('Select what happened'); return; }
    if (status === 'follow_up_later' && !nextFollowUpDate) { toast.error('Next follow-up date is required'); return; }
    if (!remark.trim()) { toast.error('Remark is required'); return; }

    setSubmitting(true);
    try {
      await leadsApi.create({
        customerName: selectedCustomerId ? undefined : customerName.trim(),
        customerId: selectedCustomerId || undefined,
        productIds: selectedProductIds,
        status,
        nextFollowUpDate: (status === 'follow_up_later' || status === 'payment_talk') ? nextFollowUpDate : undefined,
        remark,
        isNewCustomer: !selectedCustomerId,
        assignTo,
      });
      toast.success('Lead assigned successfully! User has been notified.');
      navigate('/admin/reports');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign lead');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2 mb-1">
        <UserCheck size={20} className="text-brand-600" />
        <h2 className="text-xl font-semibold text-gray-800">Assign Lead to User</h2>
      </div>
      <p className="text-sm text-gray-500 mb-5">Create a lead from an inbound customer and assign it to a marketing team member.</p>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-5 shadow-sm">

        {/* Assign to user — first and most prominent */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Assign to <span className="text-red-500">*</span>
          </label>
          <select
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select team member...</option>
            {users?.map((u) => (
              <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
            ))}
          </select>
          {assignTo && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <UserCheck size={12} />
              Lead will be assigned + notification sent to {users?.find((u) => u._id === assignTo)?.name}
            </p>
          )}
        </div>

        {/* Customer */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer name <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => { setCustomerName(e.target.value); setSelectedCustomerId(null); }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Type to search existing or enter new name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-md mt-1 shadow-sm max-h-48 overflow-y-auto">
              {suggestions.map((c) => (
                <li key={c._id} onClick={() => selectCustomer(c)} className="px-3 py-2 text-sm hover:bg-brand-50 cursor-pointer">{c.name}</li>
              ))}
            </ul>
          )}
          {selectedCustomerId && <p className="text-xs text-green-600 mt-1">✓ Existing customer selected</p>}
        </div>

        {/* Product tabs */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Product(s) discussed <span className="text-red-500">*</span>
          </label>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-3">
            {['fonfox', 'supreme'].map((cat) => (
              <button key={cat} type="button" onClick={() => setProductTab(cat)}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                  productTab === cat
                    ? cat === 'fonfox' ? 'bg-brand-600 text-white' : 'bg-purple-600 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}>
                {cat === 'fonfox' ? 'FonFox' : 'Supreme'} Products
                {(cat === 'fonfox' ? fonfoxSelected : supremeSelected) > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-white text-gray-700">
                    {cat === 'fonfox' ? fonfoxSelected : supremeSelected}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {activeTabProducts.map((p) => (
              <button key={p._id} type="button" onClick={() => toggleProduct(p._id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selectedProductIds.includes(p._id)
                    ? productTab === 'fonfox' ? 'bg-brand-600 border-brand-600 text-white' : 'bg-purple-600 border-purple-600 text-white'
                    : 'border-gray-300 text-gray-600 hover:border-brand-400'
                }`}>
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
          <label className="block text-sm font-medium text-gray-700 mb-2">What happened? <span className="text-red-500">*</span></label>
          <StatusSelector value={status} onChange={setStatus} />
        </div>

        {(status === 'follow_up_later' || status === 'payment_talk') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Next follow-up date</label>
            <input type="date" value={nextFollowUpDate} onChange={(e) => setNextFollowUpDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
        )}

        {/* Remark — mandatory */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Remark / notes <span className="text-red-500">*</span>
          </label>
          <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3}
            placeholder="What did the customer enquire about? Any specific requirements?"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
        </div>

        <button type="submit" disabled={submitting}
          className="w-full bg-gradient-to-r from-brand-600 to-brand-700 text-white py-2.5 rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-60">
          {submitting ? 'Assigning...' : 'Assign Lead & Notify User'}
        </button>
      </form>
    </div>
  );
}
