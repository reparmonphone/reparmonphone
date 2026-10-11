'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendReviewReminderBatch } from './actions';

// Boutons de relance "laisse un avis" (produits + Trustpilot) de la liste des commandes.
//  - "Relancer les avis (N)" : commandes livrées depuis plus de 10 jours, jamais relancées.
//  - "Tous les livrés (M)"   : toutes les commandes au statut "Livrée", même déjà relancées.
// Les commandes remboursées, expédiées, annulées ou en attente ne sont jamais concernées.
export default function BulkReviewReminderButton({
  eligibleCount,
  allDeliveredCount,
}: {
  eligibleCount: number;
  allDeliveredCount: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(mode: 'new' | 'all') {
    const count = mode === 'all' ? allDeliveredCount : eligibleCount;
    if (count === 0 || running) return;

    const ok = window.confirm(
      mode === 'all'
        ? `Envoyer la demande d'avis (produits + Trustpilot) à TOUS les clients dont la commande est « Livrée » (${count} commande(s)) ?\n\nAttention : ceux qui ont déjà reçu une relance la recevront une 2e fois. Un client qui a plusieurs commandes ne reçoit qu'un seul e-mail.`
        : `Envoyer la demande d'avis (produits + Trustpilot) à ${count} client(s) dont la commande est livrée depuis plus de 10 jours ?\n\nChaque client ne la reçoit qu'une seule fois.`
    );
    if (!ok) return;

    setRunning(true);
    setMessage(null);
    const startedAtIso = new Date().toISOString();
    let totalSent = 0;
    let totalDuplicates = 0;
    const skipIds: string[] = [];
    let remaining = count;
    let lastError: string | undefined;

    try {
      while (remaining > 0) {
        const res = await sendReviewReminderBatch(mode, startedAtIso, skipIds);
        totalSent += res.sent;
        totalDuplicates += res.duplicates;
        skipIds.push(...res.failedIds);
        remaining = res.remaining;
        lastError = res.lastError ?? lastError;
        setMessage(`Envoi en cours… ${totalSent} envoyé(s), ${remaining} restant(s)`);
        // Lot vide : plus rien à traiter, on s'arrête (évite toute boucle infinie)
        if (res.sent === 0 && res.duplicates === 0 && res.failedIds.length === 0) break;
      }
      const dupText = totalDuplicates > 0 ? ` (${totalDuplicates} doublon(s) évité(s))` : '';
      setMessage(
        skipIds.length > 0
          ? `⚠️ ${totalSent} envoyé(s)${dupText}, ${skipIds.length} en échec (${lastError ?? 'erreur inconnue'}).`
          : `✅ ${totalSent} demande(s) d'avis envoyée(s)${dupText}.`
      );
    } catch {
      setMessage(`⚠️ Interrompu après ${totalSent} envoi(s). Tu peux recliquer pour reprendre là où ça s'est arrêté.`);
    }

    setRunning(false);
    router.refresh();
  }

  const btn = 'text-sm text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="flex items-center gap-2">
      {message && <span className="text-xs text-gray-500">{message}</span>}
      <button
        type="button"
        onClick={() => run('new')}
        disabled={running || eligibleCount === 0}
        title={
          eligibleCount === 0
            ? 'Aucune commande livrée depuis plus de 10 jours à relancer'
            : "Demande d'avis aux clients livrés depuis plus de 10 jours (jamais relancés)"
        }
        className={`${btn} bg-amber-500 hover:bg-amber-600`}
      >
        {running ? 'Envoi…' : `✉️ Relancer les avis (${eligibleCount})`}
      </button>
      <button
        type="button"
        onClick={() => run('all')}
        disabled={running || allDeliveredCount === 0}
        title="Demande d'avis à tous les clients au statut « Livrée », même déjà relancés"
        className={`${btn} bg-gray-700 hover:bg-gray-800`}
      >
        Tous les livrés ({allDeliveredCount})
      </button>
    </div>
  );
}
