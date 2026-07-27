'use client';

import { useState, useTransition } from 'react';
import { updateSocialFollowersCount } from './actions';

export default function SocialFollowersCountForm({
  platform,
  label,
  initialValue,
}: {
  platform: 'facebook' | 'instagram';
  label: string;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await updateSocialFollowersCount(platform, value);
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
        });
      }}
      className="flex items-center gap-3"
    >
      <label className="text-sm font-medium w-40 shrink-0">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ex: 1900"
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-32"
      />
      <button type="submit" disabled={pending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        {pending ? '...' : 'Enregistrer'}
      </button>
      {saved && <span className="text-green-600 text-sm">✅</span>}
    </form>
  );
}
