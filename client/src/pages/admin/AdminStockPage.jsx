import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Layers, Plus } from 'lucide-react';
import { stockApi } from '../../api/endpoints';

export default function StockManagementPage() {
  const queryClient = useQueryClient();
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { data: productsData } = useQuery({
    queryKey: ['products-with-stock'],
    queryFn: () => stockApi.list(true).then((r) => r.data),
  });

  const products = productsData?.products || [];

  const handleAddStock = async () => {
    if (!selectedProduct || !quantity) {
      toast.error('Select product and enter quantity');
      return;
    }
    if (Number(quantity) <= 0) {
      toast.error('Quantity must be positive');
      return;
    }

    setIsLoading(true);
    try {
      await stockApi.stockIn(selectedProduct._id, Number(quantity), note);
      toast.success(`Added ${quantity} units to stock`);
      queryClient.invalidateQueries({ queryKey: ['products-with-stock'] });
      setSelectedProduct(null);
      setQuantity('');
      setNote('');
      setShowAddStockModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Stock-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Layers size={24} className="text-brand-600" />
          <h2 className="text-xl font-semibold text-gray-800">Stock Management</h2>
        </div>
        <button
          onClick={() => setShowAddStockModal(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-md hover:bg-brand-700 text-sm font-medium"
        >
          <Plus size={16} /> Add Stock
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div key={product._id} className="bg-white border rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-3">{product.name}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Stock:</span>
                <span className="font-medium text-gray-800">{product.totalStock || 0} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Reserved:</span>
                <span className="font-medium text-amber-600">{product.reservedStock || 0} units</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-gray-700 font-medium">Available:</span>
                <span className="text-lg font-bold text-green-600">{product.availableStock || 0} units</span>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedProduct(product);
                setShowAddStockModal(true);
              }}
              className="w-full mt-4 bg-blue-50 text-blue-600 py-2 rounded-md hover:bg-blue-100 text-sm font-medium transition"
            >
              Add Stock
            </button>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No products found</p>
        </div>
      )}

      {showAddStockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Stock</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Product</label>
                <select
                  value={selectedProduct?._id || ''}
                  onChange={(e) => {
                    const prod = products.find((p) => p._id === e.target.value);
                    setSelectedProduct(prod);
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select a product</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                  <p className="text-gray-700"><span className="text-gray-500">Current available:</span> <span className="font-medium">{selectedProduct.availableStock} units</span></p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Enter quantity"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Note (optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="e.g., 'Fresh stock from supplier'"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowAddStockModal(false);
                    setSelectedProduct(null);
                    setQuantity('');
                    setNote('');
                  }}
                  className="flex-1 border border-gray-300 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddStock}
                  disabled={isLoading || !selectedProduct || !quantity}
                  className="flex-1 bg-brand-600 text-white py-2 rounded-md hover:bg-brand-700 text-sm font-medium disabled:opacity-50"
                >
                  {isLoading ? 'Adding...' : 'Add Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
