import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useCountUp } from '../hooks/useCountUp';

export default function StatCard({ label, value, loading, accent, urgent, icon: Icon, index = 0 }) {
  const cardRef = useRef(null);
  const countRef = useCountUp(loading ? null : value ?? 0);

  useEffect(() => {
    if (!cardRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.5, delay: index * 0.06, ease: 'power2.out' }
      );
    });
    return () => ctx.revert();
  }, [index]);

  const base = urgent
    ? 'bg-gradient-to-br from-red-50 to-red-100/50 border-red-200'
    : accent
    ? 'bg-gradient-to-br from-brand-50 to-brand-100/50 border-brand-200'
    : 'bg-white border-gray-200';
  const valueColor = urgent ? 'text-red-600' : accent ? 'text-brand-700' : 'text-gray-800';
  const iconBg = urgent ? 'bg-red-100 text-red-500' : accent ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400';

  return (
    <div
      ref={cardRef}
      className={`rounded-2xl border p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${base}`}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {Icon && (
          <span className={`w-7 h-7 rounded-full flex items-center justify-center ${iconBg}`}>
            <Icon size={14} />
          </span>
        )}
      </div>
      <p className={`text-3xl font-extrabold tracking-tight ${valueColor}`}>
        {loading ? '—' : <span ref={countRef}>0</span>}
      </p>
    </div>
  );
}
