'use client';

import { useState } from 'react';
import PhotoUploader from '@/components/PhotoUploader';

export default function RepairByMailForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      customerName: form.get('customerName'),
      customerEmail: form.get('customerEmail'),
      customerPhone: form.get('customerPhone'),
      deviceBrand: form.get('deviceBrand'),
      deviceModel: form.get('deviceModel'),
      issueDescription: form.get('issueDescription'),
      clientPhotos: photos,
    };
    try {
      const res = await fetch('/api/reparation-a-distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError("Impossible d'envoyer votre demande pour le moment. Réessayez ou appelez-nous directement.");
      }
    } catch {
      setError("Impossible d'envoyer votre demande pour le moment. Réessayez ou appelez-nous directement.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold mb-2">Demande bien reçue !</h2>
        <p className="text-gray-600 max-w-md mx-auto">
          On revient vers vous rapidement par email avec une estimation. Aucun paiement n'est demandé
          avant d'avoir reçu et diagnostiqué votre appareil.
        </p>
        <div className="mt-5 mx-auto max-w-md bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
          <p className="text-amber-800 text-sm font-semibold mb-1">⚠️ N'envoyez pas encore votre appareil</p>
          <p className="text-amber-700 text-sm">
            L'adresse d'envoi ne vous est communiquée qu'une fois votre demande validée, directement par
            email après échange avec nous. Merci d'attendre cette confirmation avant tout envoi, afin
            d'éviter un envoi à une mauvaise adresse.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-xl border border-gray-100">
      <div className="grid grid-cols-2 gap-4">
        <input name="customerName" required placeholder="Nom complet" className="border border-gray-200 rounded-lg px-3 py-2" />
        <input name="customerPhone" required placeholder="Téléphone" className="border border-gray-200 rounded-lg px-3 py-2" />
      </div>
      <input name="customerEmail" required type="email" placeholder="E-mail" className="w-full border border-gray-200 rounded-lg px-3 py-2" />

      <div className="grid grid-cols-2 gap-4">
        <input name="deviceBrand" required placeholder="Marque (ex: Apple)" className="border border-gray-200 rounded-lg px-3 py-2" />
        <input name="deviceModel" required placeholder="Modèle (ex: iPhone 14)" className="border border-gray-200 rounded-lg px-3 py-2" />
      </div>

      <textarea
        name="issueDescription"
        required
        placeholder="Décrivez la panne (écran cassé, batterie qui ne tient plus, ne s'allume plus...)"
        rows={4}
        className="w-full border border-gray-200 rounded-lg px-3 py-2"
      />

      <PhotoUploader
        value={photos}
        onChange={setPhotos}
        uploadUrl="/api/reparation-a-distance/upload-photo"
        label="Photos de l'état de l'appareil (facultatif, recommandé pour un écran fissuré par exemple)"
      />

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60"
      >
        {loading ? 'Envoi...' : 'Recevoir mon estimation gratuite'}
      </button>
      <p className="text-xs text-gray-400 text-center">
        Réponse sous 24h ouvrées. Vous ne payez rien tant que votre appareil n'a pas été reçu et diagnostiqué.
        N'envoyez rien avant d'avoir reçu notre adresse d'envoi confirmée par email.
      </p>
    </form>
  );
}
