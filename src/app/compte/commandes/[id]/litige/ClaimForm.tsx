'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitClaim } from './actions';

export default function ClaimForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let photoUrl = '';
    if (file) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload-claim-photo', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Échec de l'envoi de la photo.");
          setUploading(false);
          return;
        }
        photoUrl = data.url;
      } catch {
        setError("Échec de l'envoi de la photo. Réessaie ou continue sans photo.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    startTransition(async () => {
      const result = await submitClaim(orderId, description, photoUrl);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="text-center py-10">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold mb-2">Réclamation envoyée</h2>
        <p className="text-gray-600 mb-4">
          Nous avons bien reçu votre signalement, nous revenons vers vous rapidement.
        </p>
        <button onClick={() => router.push('/compte/commandes')} className="text-brand hover:underline text-sm">
          ← Retour à mes commandes
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-xl border border-gray-100">
      <div>
        <label className="block text-sm font-medium mb-1">Décrivez le problème</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={5}
          placeholder="Ex : l'écran reçu est fissuré à la livraison, l'emballage était intact..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Une photo du produit reçu (fortement recommandé)
        </label>
        <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm" />
        {preview && (
          <img src={preview} alt="Aperçu" className="mt-3 max-h-48 rounded-lg border border-gray-200" />
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={isPending || uploading}
        className="w-full bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60"
      >
        {uploading ? 'Envoi de la photo...' : isPending ? 'Envoi...' : 'Envoyer ma réclamation'}
      </button>
    </form>
  );
}
