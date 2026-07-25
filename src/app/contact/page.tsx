'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          subject: form.get('subject'),
          message: form.get('message'),
        }),
      });
      if (res.ok) {
        setSent(true);
        e.currentTarget.reset();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-10">
      <div>
        <h1 className="text-2xl font-bold mb-4">Laissez-nous un message</h1>
        <p className="text-gray-600 mb-6">
          Vous pouvez nous contacter pour nous faire part d&apos;une demande précise, n&apos;hésitez pas à
          indiquer toutes les informations pertinentes afin que nous puissions répondre à votre demande
          dans les meilleurs délais. Au plaisir de vous lire.
          <br />
          L&apos;équipe <strong>Repar Mon Phone</strong>
        </p>

        <div className="space-y-2 text-sm text-gray-700 bg-white border border-gray-100 rounded-xl p-5">
          <p><strong>Adresse :</strong> Repar Mon Phone, Les Saquèdes, 83120 Sainte-Maxime, France</p>
          <p><strong>Téléphone :</strong> <a href="tel:+33783497262" className="text-brand">07 83 49 72 62</a></p>
          <p><strong>Email :</strong> <a href="mailto:contact@reparmonphone.fr" className="text-brand">contact@reparmonphone.fr</a></p>
          <p className="pt-2 text-gray-500">Support 7j/7 — HotLine : 07 83 49 72 62</p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">Formulaire de contact</h2>

        {sent ? (
          <p className="text-green-700 bg-green-50 rounded-lg p-4">
            Merci, votre message a bien été envoyé. On vous répond au plus vite !
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-100 rounded-xl p-5">
            <input name="name" required placeholder="Votre nom" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
            <input name="email" required type="email" placeholder="Votre email" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
            <input name="subject" required placeholder="Sujet" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
            <textarea name="message" required rows={5} placeholder="Votre message" className="w-full border border-gray-200 rounded-lg px-3 py-2" />
            {error && <p className="text-red-600 text-sm">Une erreur est survenue, merci de réessayer.</p>}
            <button type="submit" disabled={loading} className="w-full bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60">
              {loading ? 'Envoi...' : 'Envoyer le message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
