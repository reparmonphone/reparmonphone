'use client';

import { useState, useTransition } from 'react';
import { addOrderNote, deleteOrderNote } from './noteActions';

type Note = { id: string; message: string; createdAt: string };

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));
}

export default function OrderNotesPanel({ orderId, initialNotes }: { orderId: string; initialNotes: Note[] }) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);
    startTransition(async () => {
      const r = await addOrderNote(orderId, message);
      if ('error' in r) {
        setError(r.error);
      } else {
        setNotes((prev) => [r.note, ...prev]);
        setMessage('');
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      }
    });
  }

  function handleDelete(noteId: string) {
    if (!confirm("Supprimer cette note ? Si un email a déjà été envoyé au client, il ne peut pas être rappelé.")) return;
    startTransition(async () => {
      const r = await deleteOrderNote(noteId);
      if (!('error' in r)) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="space-y-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="ex : Votre commande ne pourra pas partir aujourd'hui en raison d'un problème de ramassage Chronopost indépendant de notre volonté. Elle sera expédiée dès que possible."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y"
          maxLength={2000}
        />
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || !message.trim()}
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
          >
            {pending ? 'Envoi...' : '📧 Ajouter et envoyer au client'}
          </button>
          {sent && <span className="text-green-600 text-xs">✅ Note ajoutée et email envoyé</span>}
        </div>
        <p className="text-xs text-gray-400">
          Cette note sera envoyée par email au client immédiatement, et restera visible dans le détail de sa commande.
        </p>
      </form>

      {notes.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-gray-100">
          {notes.map((note) => (
            <div key={note.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-gray-700 whitespace-pre-line flex-1">{note.message}</p>
                <button
                  onClick={() => handleDelete(note.id)}
                  disabled={pending}
                  className="text-red-500 text-xs hover:underline disabled:opacity-50 shrink-0"
                >
                  Supprimer
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">{formatDate(note.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
