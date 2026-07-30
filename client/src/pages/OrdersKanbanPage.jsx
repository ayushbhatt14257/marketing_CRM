import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShoppingCart, Plus } from 'lucide-react';
import { ordersApi, productsApi } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';

const statusConfig = {
  pending_approval: { label: 'Pending Approval', color: 'bg-gray-100', borderColor: 'border-gray-300' },
  approved: { label: 'Approved', color: 'bg-blue-50', borderColor: 'border-blue-300' },
  dispatched: { label: 'Dispatched', color: 'bg-amber-50', borderColor: 'border-amber-300' },
  done: { label: 'Completed', color: 'bg-green-50', borderColor: 'border-green-300' },
};

export default function OrdersKanbanPage() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchQtys, setDispatchQtys] = useState({});
  const [showCreateOrder, setShowCreateOrder] = useState(!!location.state?.leadId);
  const [orderItems, setOrderItems] = useState([]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [creatingOrder, setCreatingOrder] = useState(false);

  // Pre-fill with lead info if coming from LeadDetailPage
  const leadInfo = location.state || {};

  const { data: ordersData, refetch } = useQuery({
    queryKey: ['orders-list'],
    queryFn: () => ordersApi.list().then((r) => r.data),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-for-orders'],
    queryFn: () => productsApi.list().then((r) => r.data),
    enabled: showCreateOrder,
  });

  const handleCreateOrder = async () => {
    if (!leadInfo.leadId || orderItems.length === 0 || !deliveryDate) {
      toast.error('Fill all fields and add items');
      return;
    }

    setCreatingOrder(true);
    try {
      const payload = {
        leadId: leadInfo.leadId,
        items: orderItems,
        deliveryDate,
      };
      await ordersApi.create(payload);
      toast.success('Order created and submitted!');
      setShowCreateOrder(false);
      setOrderItems([]);
      setDeliveryDate('');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Order creation failed');
    } finally {
      setCreatingOrder(false);
    }
  };

  const addItem = () => {
    setOrderItems([...orderItems, { productId: '', approvedQty: 0 }]);
  };

  const removeItem = (idx) => {
    setOrderItems(orderItems.filter((_, i) => i !== idx));
  };

  const updateItem = (idx, field, value) => {
    const updated = [...orderItems];
    updated[idx][field] = value;
    setOrderItems(updated);
  };

  const orders = ordersData?.orders || [];
  const byStatus = {
    pending_approval: orders.filter((o) => o.status === 'pending_approval'),
    approved: orders.filter((o) => o.status === 'approved'),
    dispatched: orders.filter((o) => o.status === 'dispatched'),
    done: orders.filter((o) => o.status === 'done'),
  };

  const handleDispatch = async () => {
    if (!selectedOrder) return;
    const items = Object.entries(dispatchQtys)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([productId, qty]) => ({ productId, qty: Number(qty) }));

    if (items.length === 0) {
      toast.error('Enter quantities to dispatch');
      return;
    }

    try {
      await ordersApi.dispatch(selectedOrder._id, items);
      toast.success('Order dispatched');
      setSelectedOrder(null);
      setShowDispatchModal(false);
      setDispatchQtys({});
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Dispatch failed');
    }
  };

  const OrderCard = ({ order }) => (
    <div
      onClick={() => setSelectedOrder(order)}
      className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md cursor-pointer transition"
    >
      <p className="font-medium text-sm text-gray-800">{order.customerId?.name}</p>
      <p className="text-xs text-gray-500 mt-1">By: {order.createdBy?.name}</p>
      <div className="mt-2 space-y-1">
        {order.items?.slice(0, 2).map((item, i) => (
          <div key={i} className="text-xs text-gray-600">
            {item.productId?.name}: {item.approvedQty} units
          </div>
        ))}
        {order.items?.length > 2 && <p className="text-xs text-gray-400">+{order.items.length - 2} more</p>}
      </div>
    </div>
  );

  const Column = ({ status, title, orders: colOrders }) => (
    <div className="flex-1 min-w-[300px]">
      <div className={`${statusConfig[status].color} border ${statusConfig[status].borderColor} rounded-lg p-4`}>
        <h3 className="font-semibold text-gray-800 mb-3">{title}</h3>
        <div className="space-y-2">
          {colOrders.map((order) => (
            <OrderCard key={order._id} order={order} />
          ))}
          {colOrders.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No orders</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <ShoppingCart size={24} className="text-brand-600" />
        <h2 className="text-xl font-semibold text-gray-800">Order Management</h2>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          <Column status="pending_approval" title="Pending Approval" orders={byStatus.pending_approval} />
          <Column status="approved" title="Approved" orders={byStatus.approved} />
          <Column status="dispatched" title="Dispatched" orders={byStatus.dispatched} />
          <Column status="done" title="Completed" orders={byStatus.done} />
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-800">{selectedOrder.customerId?.name}</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="space-y-3 mb-4 text-sm">
              <p><span className="text-gray-500">By:</span> {selectedOrder.createdBy?.name}</p>
              <p><span className="text-gray-500">Delivery:</span> {new Date(selectedOrder.deliveryDate).toLocaleDateString()}</p>
              <p><span className="text-gray-500">Status:</span> <span className="font-medium">{statusConfig[selectedOrder.status].label}</span></p>
            </div>

            <div className="border-t pt-4 mb-4">
              <h4 className="font-medium text-gray-700 mb-3">Items</h4>
              <div className="space-y-2">
                {selectedOrder.items?.map((item, i) => {
                  const remaining = item.approvedQty - item.dispatchedQty - item.cancelledQty;
                  return (
                    <div key={i} className="text-sm border rounded p-2 bg-gray-50">
                      <p className="font-medium">{item.productId?.name}</p>
                      <p className="text-xs text-gray-600">
                        Approved: {item.approvedQty} | Dispatched: {item.dispatchedQty} | Pending: {remaining}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {['admin', 'stock_manager'].includes(user?.role) && ['approved', 'dispatched'].includes(selectedOrder.status) && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowDispatchModal(true)}
                  className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 text-sm font-medium"
                >
                  Dispatch Order
                </button>
              </div>
            )}

            {showDispatchModal && (
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium text-gray-700 mb-2 text-sm">Dispatch Quantities</h4>
                {selectedOrder.items?.map((item) => {
                  const remaining = item.approvedQty - item.dispatchedQty - item.cancelledQty;
                  return (
                    <div key={item.productId} className="mb-2">
                      <label className="text-xs text-gray-600">{item.productId?.name} (max {remaining})</label>
                      <input
                        type="number"
                        min="0"
                        max={remaining}
                        value={dispatchQtys[item.productId] || ''}
                        onChange={(e) => setDispatchQtys((p) => ({ ...p, [item.productId]: e.target.value }))}
                        className="w-full border rounded px-2 py-1 text-sm mt-1"
                        placeholder="0"
                      />
                    </div>
                  );
                })}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setShowDispatchModal(false)}
                    className="flex-1 border py-2 rounded-md text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDispatch}
                    className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 text-sm font-medium"
                  >
                    Confirm Dispatch
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreateOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Create Order</h3>
            
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Customer</label>
                <p className="text-sm font-medium text-gray-800">{leadInfo.customerName}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Delivery Date</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-gray-700">Items</label>
                  <button
                    onClick={addItem}
                    className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {orderItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 text-sm">
                      <select
                        value={item.productId}
                        onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                        className="flex-1 border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="">Product</option>
                        {productsData?.products?.map((p) => (
                          <option key={p._id} value={p._id}>{p.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={item.approvedQty}
                        onChange={(e) => updateItem(idx, 'approvedQty', Number(e.target.value))}
                        className="w-16 border border-gray-300 rounded px-2 py-1"
                        placeholder="Qty"
                      />
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-red-600 hover:text-red-700 font-medium"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t pt-4">
              <button
                onClick={() => {
                  setShowCreateOrder(false);
                  setOrderItems([]);
                  setDeliveryDate('');
                }}
                className="flex-1 border py-2 rounded-md text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={creatingOrder || orderItems.length === 0 || !deliveryDate}
                className="flex-1 bg-brand-600 text-white py-2 rounded-md hover:bg-brand-700 text-sm font-medium disabled:opacity-50"
              >
                {creatingOrder ? 'Creating...' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
