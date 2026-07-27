'use client';

import { useState, useTransition } from 'react';
import { updateReview, deleteReview } from './actions';
import type { ReviewSource } from '@prisma/client';

type Review = {
  id: string;
  source: ReviewSource;
  authorName: string;
  authorPhotoUrl: string | null;
  rating: number | null;
  text: string;
  reviewDate: string | null; // yyyy-mm-dd
  verified: boolean;
};

export default function ReviewRow({ review }: { review: Review }) {
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState(review.source);
  const [authorName, setAuthorName] = useState(review.authorName);
  const [authorPhotoUrl, setAuthorPhotoUrl] = useState(review.authorPhotoUrl ?? '');
  const [rating, setRating] = useState(review.rating ?? 5);
  const [hasRating, setHasRating] = useState(review.rating !== null);
  const [text, setText] = useState(review.text);
  const [reviewDate, setReviewDate] = useState(review.reviewDate ?? '');
  const [verified, setVerified] = useState(review.verified);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateReview(review.id, {
        source,
        authorName,
        authorPhotoUrl,
        rating: hasRating ? rating : null,
        text,
        reviewDate,
        verified,
      });
      setEditing(false);
    });
  }

  function remove() {
    if (confirm(`Supprimer l'avis de "${review.authorName}" ?`)) {
      startTransition(() => deleteReview(review.id));
    }
  }

  if (!editing) {
    return (
      <div className="p-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 uppercase">
            {review.source === 'GOOGLE' ? 'Google' : 'Facebook'}{review.verified ? ' · vérifié ✔️' : ''}
          </p>
          <p className="font-medium text-sm">{review.authorName} {review.rating ? `— ${review.rating}★` : ''}</p>
          {review.reviewDate && <p className="text-xs text-gray-400">{review.reviewDate}</p>}
          <p className="text-sm text-gray-600 mt-1">{review.text}</p>
        </div>
        <div className="flex gap-3 shrink-0 text-sm">
          <button onClick={() => setEditing(true)} className="text-brand hover:underline">Modifier</button>
          <button onClick={remove} disabled={pending} className="text-red-500 hover:underline disabled:opacity-50">Supprimer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 bg-gray-50">
      <div className="grid grid-cols-2 gap-3">
        <select value={source} onChange={(e) => setSource(e.target.value as ReviewSource)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="GOOGLE">Google</option>
          <option value="FACEBOOK">Facebook</option>
        </select>
        <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Nom de l'auteur" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input value={authorPhotoUrl} onChange={(e) => setAuthorPhotoUrl(e.target.value)} placeholder="Photo (URL, facultatif)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasRating} onChange={(e) => setHasRating(e.target.checked)} />
          Note chiffrée (désactive pour "recommande" façon Facebook)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          Vérifié ✔️
        </label>
      </div>
      {hasRating && (
        <select value={rating} onChange={(e) => setRating(parseInt(e.target.value, 10))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ★</option>)}
        </select>
      )}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      <div className="flex gap-3">
        <button onClick={save} disabled={pending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60">
          Enregistrer
        </button>
        <button onClick={() => setEditing(false)} className="text-gray-500 text-sm">Annuler</button>
      </div>
    </div>
  );
}
