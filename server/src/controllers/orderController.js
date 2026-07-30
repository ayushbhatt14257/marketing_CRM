const Order = require('../models/Order');
const Lead = require('../models/Lead');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { getAvailableStockFor } = require('../services/stockService');

function cleanItems(rawItems) {
  return (rawItems || [])
    .filter((i) => i.productId && Number(i.approvedQty) > 0)
    .map((i) => ({ productId: i.productId, approvedQty: Number(i.approvedQty), dispatchedQty: 0, cancelledQty: 0 }));
}

// POST /api/orders — create a draft order from a lead. Team member (lead owner) or admin.
const createOrder = asyncHandler(async (req, res) => {
  const { leadId, items, deliveryDate } = req.body;
  const lead = await Lead.findById(leadId);
  if (!lead) return res.status(404).json({ message: 'Lead not found' });
  if (String(lead.ownerId) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'You can only create orders for your own leads' });
  }

  const order = await Order.create({
    leadId,
    customerId: lead.customerId,
    createdBy: lead.ownerId,
    items: cleanItems(items),
    deliveryDate: deliveryDate || null,
    status: 'pending_approval',
  });

  res.status(201).json({ order });
});

// PATCH /api/orders/:id — edit a draft while it's still pending_approval.
const updateDraft = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.status !== 'pending_approval') {
    return res.status(400).json({ message: 'Only draft (Pending Approval) orders can be edited this way' });
  }
  if (String(order.createdBy) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const { items, deliveryDate } = req.body;
  if (items) order.items = cleanItems(items);
  if (deliveryDate !== undefined) order.deliveryDate = deliveryDate || null;
  await order.save();

  res.json({ order });
});

// PATCH /api/orders/:id/submit — finalize the draft: validates stock availability
// per item, then moves to 'approved' (this is the moment stock becomes reserved —
// reservation itself needs no write, it's just what the live aggregation now counts).
const submitOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.status !== 'pending_approval') {
    return res.status(400).json({ message: 'Order has already been submitted' });
  }
  if (String(order.createdBy) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  if (order.items.length === 0) {
    return res.status(400).json({ message: 'Add at least one item before submitting' });
  }
  if (!order.deliveryDate) {
    return res.status(400).json({ message: 'Set a delivery date before submitting' });
  }

  // Validate each item against currently-available stock (excluding this order,
  // since it isn't 'approved' yet so isn't in the reserved total).
  for (const item of order.items) {
    const product = await Product.findById(item.productId);
    if (!product) return res.status(400).json({ message: 'A product in this order no longer exists' });
    const available = await getAvailableStockFor(item.productId, product.totalStock);
    if (item.approvedQty > available) {
      return res.status(400).json({
        message: `Not enough stock for "${product.name}" — only ${available} available, ${item.approvedQty} requested`,
      });
    }
  }

  order.status = 'approved';
  await order.save();
  res.json({ order });
});

// GET /api/orders — list for the Kanban board.
// Sales reps see only their own orders; admin/stock_manager see everything.
const listOrders = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'user' ? { createdBy: req.user._id } : {};
  const orders = await Order.find(filter)
    .populate('customerId', 'name')
    .populate('createdBy', 'name')
    .populate('items.productId', 'name')
    .sort({ updatedAt: -1 })
    .lean();

  res.json({ orders });
});

// GET /api/orders/:id
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('customerId', 'name')
    .populate('createdBy', 'name')
    .populate('leadId')
    .populate('items.productId', 'name')
    .populate('dispatchHistory.dispatchedBy', 'name')
    .lean();
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (req.user.role === 'user' && String(order.createdBy._id) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not authorized' });
  }
  res.json({ order });
});

// PATCH /api/orders/:id/dispatch — Stock Manager/Admin only. Partial dispatch allowed.
const dispatchOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (!['approved', 'dispatched'].includes(order.status)) {
    return res.status(400).json({ message: 'Order is not in a dispatchable state' });
  }

  const { items } = req.body; // [{ productId, qty }]
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'items[] with quantities is required' });
  }

  const dispatchEvent = [];
  for (const { productId, qty } of items) {
    if (!qty || qty <= 0) continue;
    const line = order.items.find((i) => String(i.productId) === String(productId));
    if (!line) return res.status(400).json({ message: 'Item not found on this order' });
    const remaining = line.approvedQty - line.dispatchedQty - line.cancelledQty;
    if (qty > remaining) {
      return res.status(400).json({ message: `Cannot dispatch ${qty} — only ${remaining} pending for this item` });
    }
    line.dispatchedQty += Number(qty);
    dispatchEvent.push({ productId, qty: Number(qty) });
  }

  if (dispatchEvent.length === 0) {
    return res.status(400).json({ message: 'No valid quantities to dispatch' });
  }

  order.dispatchHistory.push({ dispatchedBy: req.user._id, items: dispatchEvent, dispatchedAt: new Date() });

  const fullyDone = order.items.every((i) => i.approvedQty - i.dispatchedQty - i.cancelledQty <= 0);
  order.status = fullyDone ? 'done' : 'dispatched';
  await order.save();

  await Notification.create({
    userId: order.createdBy,
    type: 'order_dispatched',
    refId: order._id,
    message: fullyDone
      ? 'Your order has been fully dispatched.'
      : 'Part of your order has been dispatched.',
  });

  res.json({ order });
});

// PATCH /api/orders/:id/cancel-remaining — release undispatched quantity back to stock.
// Lead owner or admin. Body: { items: [{ productId, qty }] } — qty capped at remaining.
const cancelRemaining = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (String(order.createdBy) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  if (!['approved', 'dispatched'].includes(order.status)) {
    return res.status(400).json({ message: 'Nothing to cancel on this order' });
  }

  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'items[] is required' });
  }

  for (const { productId, qty } of items) {
    const line = order.items.find((i) => String(i.productId) === String(productId));
    if (!line) continue;
    const remaining = line.approvedQty - line.dispatchedQty - line.cancelledQty;
    line.cancelledQty += Math.min(Number(qty) || 0, remaining);
  }

  const fullyResolved = order.items.every((i) => i.approvedQty - i.dispatchedQty - i.cancelledQty <= 0);
  if (fullyResolved) order.status = 'done';
  await order.save();

  res.json({ order });
});

module.exports = { createOrder, updateDraft, submitOrder, listOrders, getOrder, dispatchOrder, cancelRemaining };
