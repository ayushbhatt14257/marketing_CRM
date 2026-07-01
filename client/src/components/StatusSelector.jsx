import { CheckCircle2, Clock, XCircle, Lock } from 'lucide-react';

const STATUS_CONFIG = [
  { value: 'order_placed', label: 'Order Received', icon: CheckCircle2, active: 'bg-green-600 text-white border-green-600', idle: 'border-gray-300 text-gray-600 hover:border-green-400 hover:text-green-600' },
  { value: 'follow_up_later', label: 'Follow Up Later', icon: Clock, active: 'bg-amber-500 text-white border-amber-500', idle: 'border-gray-300 text-gray-600 hover:border-amber-400 hover:text-amber-600' },
  { value: 'not_now', label: 'Not Now', icon: XCircle, active: 'bg-gray-700 text-white border-gray-700', idle: 'border-gray-300 text-gray-600 hover:border-gray-500' },
];

// hideOrderPlaced: true when follow-up date hasn't arrived yet
export default function StatusSelector({ value, onChange, hideOrderPlaced = false }) {
  const visibleOptions = hideOrderPlaced
    ? STATUS_CONFIG.filter((s) => s.value !== 'order_placed')
    : STATUS_CONFIG;

  return (
    <div className="space-y-2">
      <div className={`grid gap-2 ${visibleOptions.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {visibleOptions.map(({ value: v, label, icon: Icon, active, idle }) => (
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

      {/* Locked "Order Received" notice when follow-up date hasn't arrived */}
      {hideOrderPlaced && (
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <Lock size={13} className="text-gray-400 flex-shrink-0" />
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-600">Order Received</span> will unlock on the follow-up date.
          </p>
        </div>
      )}
    </div>
  );
}
