'use client';

import { useState, useTransition } from 'react';
import { createReview } from './actions';
import type { ReviewSource } from '@prisma/client';

export default function NewReviewForm() {
  const [source, setSource] = useState<ReviewSource>('GOOGLE');
  const [authorName, setAuthorName] = useState('');
  const [authorPhotoUrl, setAuthorPhotoUrl] = useState('');
  const [hasRating, setHasRating] = useState(true);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [verified, setVerified] = useState(true);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || !text.trim()) return;
    startTransition(async () => {
      await createReview({
        source,
        authorName: authorName.trim(),
        authorPhotoUrl: authorPhotoUrl.trim(),
        rating: hasRating ? rating : null,
        text: text.trim(),
        reviewDate,
        verified,
      });
      setAuthorName('');
      setAuthorPhotoUrl('');
      setText('');
      setReviewDate('');
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <select value={source} onChange={(e) => setSource(e.target.value as ReviewSource)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="GOOGLE">Google</option>
          <option value="FACEBOOK">Facebook</option>
        </select>
        <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Nom de l'auteur" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input value={authorPhotoUrl} onChange={(e) => setAuthorPhotoUrl(e.target.value)} placeholder="Photo (URL, facultatif — sinon initiales)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasRating} onChange={(e) => setHasRating(e.target.checked)} />
          Note chiffrée
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          Badge "vérifié" ✔️
        </label>
      </div>
      {hasRating && (
        <select value={rating} onChange={(e) => setRating(parseInt(e.target.value, 10))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ★</option>)}
        </select>
      )}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Texte de l'avis" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      <button type="submit" disabled={pending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        {pending ? 'Ajout...' : 'Ajouter l\u2019avis'}
      </button>
    </form>
  );
}
