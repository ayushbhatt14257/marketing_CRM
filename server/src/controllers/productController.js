const Product = require('../models/Product');
const StockLedger = require('../models/StockLedger');
const asyncHandler = require('../utils/asyncHandler');
const { withAvailableStock } = require('../services/stockService');

const listProducts = asyncHandler(async (req, res) => {
  const filter = req.query.includeInactive === 'true' ? {} : { isActive: true };
  const products = await Product.find(filter).sort({ category: 1, name: 1 }).lean();

  // Live stock numbers are only computed when asked for (?withStock=true) — most
  // callers (e.g. the simple product picker on the lead form) don't need them and
  // there's no reason to pay for the reservation aggregation on every call.
  if (req.query.withStock === 'true') {
    const withStock = await withAvailableStock(products);
    return res.json({ products: withStock });
  }

  res.json({ products });
});

const createProduct = asyncHandler(async (req, res) => {
  const { name, category } = req.body;
  if (!name) return res.status(400).json({ message: 'Product name is required' });
  if (!category || !['fonfox', 'supreme'].includes(category)) {
    return res.status(400).json({ message: 'Category must be fonfox or supreme' });
  }
  const product = await Product.create({ name: name.trim(), category });
  res.status(201).json({ product });
});

const updateProduct = asyncHandler(async (req, res) => {
  const { name, isActive, category } = req.body;
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  if (name) product.name = name.trim();
  if (category && ['fonfox', 'supreme'].includes(category)) product.category = category;
  if (typeof isActive === 'boolean') product.isActive = isActive;
  await product.save();
  res.json({ product });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  product.isActive = false;
  await product.save();
  res.json({ message: 'Product deactivated' });
});

// POST /api/products/:id/stock-in — Stock Manager/Admin only.
const stockIn = asyncHandler(async (req, res) => {
  const { quantity, note } = req.body;
  const qty = Number(quantity);
  if (!qty || qty <= 0) return res.status(400).json({ message: 'quantity must be a positive number' });

  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  product.totalStock += qty;
  await product.save();

  await StockLedger.create({
    productId: product._id,
    quantity: qty,
    addedBy: req.user._id,
    note: note || '',
  });

  res.json({ product, message: `Added ${qty} to ${product.name}` });
});

module.exports = { listProducts, createProduct, updateProduct, deleteProduct, stockIn };
