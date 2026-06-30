import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { productsApi } from '../../api/endpoints';

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => productsApi.list(true).then((r) => r.data.products),
  });

  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await productsApi.create(name.trim());
      toast.success('Product added');
      setName('');
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
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
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update product');
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-5">Products</h2>

      <form onSubmit={handleAdd} className="flex gap-3 mb-5">
        <input
          placeholder="New product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm flex-1 max-w-sm"
        />
        <button type="submit" disabled={submitting} className="bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-brand-700 disabled:opacity-60">
          Add
        </button>
      </form>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto max-w-xl">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={3} className="text-center py-6 text-gray-400">Loading...</td></tr>
            )}
            {data?.map((p) => (
              <tr key={p._id} className="border-b border-gray-100">
                <td className="px-4 py-2.5 font-medium text-gray-800">{p.name}</td>
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
