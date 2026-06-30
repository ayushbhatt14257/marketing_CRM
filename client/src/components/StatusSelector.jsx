import { CheckCircle2, Clock, XCircle } from 'lucide-react';

const STATUS_CONFIG = [
  { value: 'order_placed', label: 'Order Placed', icon: CheckCircle2, active: 'bg-green-600 text-white border-green-600', idle: 'border-gray-300 text-gray-600 hover:border-green-400 hover:text-green-600' },
  { value: 'follow_up_later', label: 'Follow Up Later', icon: Clock, active: 'bg-amber-500 text-white border-amber-500', idle: 'border-gray-300 text-gray-600 hover:border-amber-400 hover:text-amber-600' },
  { value: 'not_now', label: 'Not Now', icon: XCircle, active: 'bg-gray-700 text-white border-gray-700', idle: 'border-gray-300 text-gray-600 hover:border-gray-500' },
];

export default function StatusSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {STATUS_CONFIG.map(({ value: v, label, icon: Icon, active, idle }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border-2 text-xs font-semibold transition-all ${
            value === v ? active : `bg-white ${idle}`
          }`}
        >
          <Icon size={20} />
          {label}
        </button>
      ))}
    </div>
  );
}
