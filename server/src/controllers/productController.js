const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');

const listProducts = asyncHandler(async (req, res) => {
  // Users only need active products in dropdowns; admin product-management screen can request all
  const filter = req.query.includeInactive === 'true' ? {} : { isActive: true };
  const products = await Product.find(filter).sort({ name: 1 });
  res.json({ products });
});

const createProduct = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Product name is required' });

  const product = await Product.create({ name: name.trim() });
  res.status(201).json({ product });
});

const updateProduct = asyncHandler(async (req, res) => {
  const { name, isActive } = req.body;
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  if (name) product.name = name.trim();
  if (typeof isActive === 'boolean') product.isActive = isActive;
  await product.save();

  res.json({ product });
});

const deleteProduct = asyncHandler(async (req, res) => {
  // Soft delete only — hard deletes would break historical reports referencing this product
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  product.isActive = false;
  await product.save();
  res.json({ message: 'Product deactivated' });
});

module.exports = { listProducts, createProduct, updateProduct, deleteProduct };
