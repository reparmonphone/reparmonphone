'use client';

import { useState } from 'react';

export default function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // l'utilisateur a annulé le partage — rien à faire
      }
      return;
    }
    // Repli desktop / navigateurs sans API Web Share : copie le lien
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // rien
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
      aria-label="Partager ce produit"
    >
      {copied ? (
        <>✅ Lien copié</>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
            <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
          </svg>
          Partager
        </>
      )}
    </button>
  );
}
