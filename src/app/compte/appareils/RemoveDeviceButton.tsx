'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { removeDevice } from './actions';

export default function RemoveDeviceButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await removeDevice(id);
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      aria-label={`Retirer ${name}`}
      className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
    >
      Retirer
    </button>
  );
}
