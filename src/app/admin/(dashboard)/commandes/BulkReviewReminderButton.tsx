'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendReviewReminderBatch } from './actions';

// Bouton "Relancer les avis" de la liste des commandes : envoie la demande d'avis (produits + Trustpilot)
// à tous les clients dont la commande est livrée depuis plus de 10 jours et n'a pas encore été relancée.
export default function BulkReviewReminderButton({ eligibleCount }: { eligibleCount: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    if (eligibleCount === 0 || running) return;
    const ok = window.confirm(
      `Envoyer la demande d'avis (produits + Trustpilot) à ${eligibleCount} client(s) dont la commande est livrée depuis plus de 10 jours ?\n\nChaque client ne la reçoit qu'une seule fois.`
    );
    if (!ok) return;

    setRunning(true);
    setMessage(null);
    let totalSent = 0;
    const skipIds: string[] = [];
    let remaining = eligibleCount;
    let lastError: string | undefined;

    try {
      while (remaining > 0) {
        const res = await sendReviewReminderBatch(skipIds);
        totalSent += res.sent;
        skipIds.push(...res.failedIds);
        remaining = res.remaining;
        lastError = res.lastError ?? lastError;
        setMessage(`Envoi en cours… ${totalSent} envoyé(s), ${remaining} restant(s)`);
        // Lot vide : plus rien à traiter, on s'arrête (évite toute boucle infinie)
        if (res.sent === 0 && res.failedIds.length === 0) break;
      }
      setMessage(
        skipIds.length > 0
          ? `⚠️ ${totalSent} envoyé(s), ${skipIds.length} en échec (${lastError ?? 'erreur inconnue'}).`
          : `✅ ${totalSent} demande(s) d'avis envoyée(s).`
      );
    } catch {
      setMessage(`⚠️ Interrompu après ${totalSent} envoi(s). Tu peux recliquer pour reprendre là où ça s'est arrêté.`);
    }

    setRunning(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {message && <span className="text-xs text-gray-500">{message}</span>}
      <button
        type="button"
        onClick={handleClick}
        disabled={running || eligibleCount === 0}
        title={
          eligibleCount === 0
            ? 'Aucune commande livrée depuis plus de 10 jours à relancer'
            : "Demande d'avis aux clients livrés depuis plus de 10 jours"
        }
        className="text-sm bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {running ? 'Envoi…' : `✉️ Relancer les avis (${eligibleCount})`}
      </button>
    </div>
  );
}
