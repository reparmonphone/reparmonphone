'use client';

import { useState, useTransition } from 'react';
import { setPaymentMethodEnabled } from './actions';

export default function PaymentMethodToggle({
  provider,
  label,
  description,
  enabled,
}: {
  provider: 'stripe' | 'sumup' | 'paypal';
  label: string;
  description: string;
  enabled: boolean;
}) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !isEnabled;
    startTransition(async () => {
      await setPaymentMethodEnabled(provider, next);
      setIsEnabled(next);
    });
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 flex items-center justify-between">
      <div>
        <p className="font-semibold text-gray-800">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        onClick={toggle}
        disabled={pending}
        className={`relative w-12 h-7 rounded-full transition disabled:opacity-60 ${isEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition ${isEnabled ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}
