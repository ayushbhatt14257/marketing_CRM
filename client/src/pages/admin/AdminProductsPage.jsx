import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { productsApi } from '../../api/endpoints';

const CATEGORY_LABELS = { fonfox: 'FonFox', supreme: 'Supreme' };
const CATEGORY_COLORS = {
  fonfox: 'bg-brand-100 text-brand-700',
  supreme: 'bg-purple-100 text-purple-700',
};

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => productsApi.list(true).then((r) => r.data.products),
  });

  const [name, setName] = useState('');
  const [category, setCategory] = useState('fonfox');
  const [submitting, setSubmitting] = useState(false);
  const [filterCat, setFilterCat] = useState('all');

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await productsApi.create(name.trim(), category);
      toast.success(`Product added to ${CATEGORY_LABELS[category]}`);
      setName('');
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add product');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(product) {
    try {
      await productsApi.update(product._id, { isActive: !product.isActive });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update product');
    }
  }

  const filtered = filterCat === 'all' ? data : data?.filter((p) => p.category === filterCat);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-5">Products</h2>

      {/* Add product form */}
      <form onSubmit={handleAdd} className="flex flex-wrap gap-3 mb-5 items-center">
        <input
          placeholder="New product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm flex-1 min-w-[180px] max-w-sm"
        />
        {/* Category toggle */}
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setCategory('fonfox')}
            className={`px-4 py-2 text-xs font-semibold transition-colors ${
              category === 'fonfox' ? 'bg-brand-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            FonFox
          </button>
          <button
            type="button"
            onClick={() => setCategory('supreme')}
            className={`px-4 py-2 text-xs font-semibold transition-colors ${
              category === 'supreme' ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Supreme
          </button>
        </div>
        <button type="submit" disabled={submitting}
          className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
          Add
        </button>
      </form>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {['all', 'fonfox', 'supreme'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filterCat === cat ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600'
            }`}
          >
            {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Category</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={4} className="text-center py-6 text-gray-400">Loading...</td></tr>
            )}
            {filtered?.map((p) => (
              <tr key={p._id} className="border-b border-gray-100">
                <td className="px-4 py-2.5 font-medium text-gray-800">{p.name}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${CATEGORY_COLORS[p.category]}`}>
                    {CATEGORY_LABELS[p.category]}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => toggleActive(p)} className="text-brand-600 text-xs font-medium hover:underline">
                    {p.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
