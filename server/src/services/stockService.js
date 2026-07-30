const Order = require('../models/Order');

// Reserved quantity per product = sum, across every order that has actually been
// submitted (status 'approved' or 'dispatched' — NOT 'pending_approval' drafts,
// NOT 'done'), of (approvedQty - dispatchedQty - cancelledQty) for that product.
// This is intentionally recalculated from Order documents on every call rather
// than stored on Product — see the comment on Product.totalStock for why.
async function getReservedMap(productIds = null) {
  const pipeline = [
    { $match: { status: { $in: ['approved', 'dispatched'] } } },
    { $unwind: '$items' },
  ];
  if (productIds) {
    pipeline.push({ $match: { 'items.productId': { $in: productIds } } });
  }
  pipeline.push({
    $group: {
      _id: '$items.productId',
      reserved: {
        $sum: {
          $subtract: ['$items.approvedQty', { $add: ['$items.dispatchedQty', '$items.cancelledQty'] }],
        },
      },
    },
  });

  const rows = await Order.aggregate(pipeline);
  const map = {};
  rows.forEach((r) => { map[String(r._id)] = r.reserved; });
  return map;
}

// Attaches reservedStock + availableStock to a list of plain product objects
// (each must have _id and totalStock).
async function withAvailableStock(products) {
  const ids = products.map((p) => p._id);
  const reservedMap = await getReservedMap(ids);
  return products.map((p) => {
    const reserved = reservedMap[String(p._id)] || 0;
    return {
      ...p,
      reservedStock: reserved,
      availableStock: Math.max(0, (p.totalStock || 0) - reserved),
    };
  });
}

async function getAvailableStockFor(productId, totalStock) {
  const reservedMap = await getReservedMap([productId]);
  const reserved = reservedMap[String(productId)] || 0;
  return Math.max(0, (totalStock || 0) - reserved);
}

module.exports = { getReservedMap, withAvailableStock, getAvailableStockFor };
