'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createProductReview } from '@/app/produit/[slug]/reviewActions';

export default function ProductReviewForm({
  productId,
  compact = false,
}: {
  productId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createProductReview(productId, { rating, text });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return <p className="text-green-600 text-sm">✅ Merci pour ton avis !</p>;
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? '' : 'bg-gray-50 border border-gray-100 rounded-xl p-5'}>
      {!compact && <h3 className="font-semibold text-sm mb-3">Laisser un avis sur ce produit</h3>}
      <div className="flex items-center gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`leading-none ${compact ? 'text-lg' : 'text-2xl'} ${n <= rating ? 'text-amber-400' : 'text-gray-200'}`}
            aria-label={`${n} étoile(s)`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={compact ? 2 : 3}
        placeholder="Ton avis (facultatif)"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"
      />
      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className={`bg-brand text-white rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60 ${
          compact ? 'px-3 py-1.5 text-xs' : 'px-5 py-2 text-sm'
        }`}
      >
        {pending ? 'Envoi...' : 'Publier mon avis'}
      </button>
    </form>
  );
}
