import { useState, useEffect } from 'react';
import { KeyRound, X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SEEN_KEY = 'crm_seen_change_password_popup';

export default function NewFeaturePopup() {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Show only once — after user dismisses it, never show again
    const alreadySeen = localStorage.getItem(SEEN_KEY);
    if (!alreadySeen) {
      // Small delay so dashboard loads first, then popup appears
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(SEEN_KEY, 'true');
    setVisible(false);
  }

  function goToChangePassword() {
    dismiss();
    navigate('/change-password');
  }

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
        onClick={dismiss}
      >
        {/* Modal */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative animate-in"
          style={{ animation: 'popIn 0.25s ease-out' }}
        >
          {/* Close button */}
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
          >
            <X size={18} />
          </button>

          {/* Icon */}
          <div className="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center mb-4">
            <KeyRound size={28} className="text-brand-600" />
          </div>

          {/* Content */}
          <div className="mb-5">
            <span className="text-xs font-semibold text-brand-600 uppercase tracking-wide bg-brand-50 px-2 py-0.5 rounded-full">
              New Feature
            </span>
            <h2 className="text-lg font-bold text-gray-800 mt-2">
              Change your password anytime
            </h2>
            <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
              You can now set your own password directly from the app — no need to ask admin for a reset.
              Find it in the sidebar under <span className="font-medium text-gray-700">Change Password</span>.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={goToChangePassword}
              className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Change Password
              <ArrowRight size={15} />
            </button>
            <button
              onClick={dismiss}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </>
  );
}
