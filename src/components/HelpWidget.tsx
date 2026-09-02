'use client';

import { useState } from 'react';

const REQUEST_TYPES = ['Aide', 'Bug', 'Erreur', 'Demande directe'];

export default function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [requestType, setRequestType] = useState('Aide');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, requestType, subject, message }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError('Erreur lors de l\u2019envoi. Réessaie ou contacte-nous directement par téléphone.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-50">
      {open && (
        <div className="mb-3 w-[320px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="bg-brand text-white px-5 py-4 flex items-center justify-between">
            <div>
              <p className="font-bold">ReparMonPhone</p>
              <p className="text-xs text-white/80">Aide, bug, erreur ou demande directe</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer" className="text-white/80 hover:text-white text-xl leading-none">
              ×
            </button>
          </div>

          {sent ? (
            <div className="p-5 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm text-gray-700 font-medium">Message envoyé, merci !</p>
              <p className="text-xs text-gray-400 mt-1">On te répond au plus vite.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nom</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                  <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@email.fr" className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Type de demande</label>
                <select value={requestType} onChange={(e) => setRequestType(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm">
                  {REQUEST_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Sujet</label>
                <input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex : problème de commande" className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Message</label>
                <textarea required value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Décrivez votre demande, bug ou erreur..." className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm" />
              </div>

              {error && <p className="text-red-600 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-brand text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {sending ? 'Envoi...' : <>➤ Envoyer</>}
              </button>
            </form>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Besoin d'aide ? Nous contacter"
        // Sur mobile : juste la bulle (icône ronde), sans le texte, pour ne pas saturer le bas de
        // l'écran à côté du badge "Achats Vérifiés" (voir VerifiedReviewsFloatingBadge, positionné à
        // gauche) — le texte complet ne revient qu'à partir de la largeur "sm" (tablette/desktop).
        className="flex items-center gap-3 bg-brand hover:bg-brand-dark transition text-white rounded-full p-2 sm:pl-2 sm:pr-5 shadow-lg"
      >
        <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-lg shrink-0">💬</span>
        <span className="hidden sm:inline text-left leading-tight">
          <span className="block font-bold text-sm">Besoin d&apos;aide ?</span>
          <span className="block text-xs text-white/80">Nous contacter</span>
        </span>
      </button>
    </div>
  );
}
