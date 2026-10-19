// Suivi de la demande d'avis d'une commande (affiché dans la liste et sur la fiche commande).
// Composant d'affichage uniquement (aucun état) : utilisable côté serveur.

type Props = {
  status: string;
  noReviewRequest: boolean;
  reviewReminderSentAt: Date | string | null;
  reviewAutoSentAt: Date | string | null;
  reviewRelanceCount: number;
  deliveredAt: Date | string | null;
  createdAt: Date | string;
};

const DAY = 24 * 60 * 60 * 1000;

function fmt(d: Date | string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function ReviewStatusBadge(o: Props) {
  const lines: { text: string; cls: string }[] = [];

  if (o.noReviewRequest) {
    lines.push({ text: '🚫 Pas de demande d’avis', cls: 'text-red-600' });
  }

  if (o.reviewAutoSentAt) {
    lines.push({ text: `🤖 Auto envoyée le ${fmt(o.reviewAutoSentAt)}`, cls: 'text-green-700' });
  }

  if (o.reviewRelanceCount > 0 && o.reviewReminderSentAt) {
    lines.push({
      text: `🔁 Relance manuelle ×${o.reviewRelanceCount} (dernière le ${fmt(o.reviewReminderSentAt)})`,
      cls: 'text-indigo-700',
    });
  }

  // Commandes relancées avant la mise en place de ce suivi : on sait qu'un e-mail est parti, pas par quel biais.
  if (o.reviewReminderSentAt && !o.reviewAutoSentAt && o.reviewRelanceCount === 0) {
    lines.push({ text: `✉️ Envoyée le ${fmt(o.reviewReminderSentAt)} (ancien envoi)`, cls: 'text-gray-600' });
  }

  if (lines.length === 0 && !o.noReviewRequest) {
    if (o.status === 'DELIVERED') {
      const base = new Date(o.deliveredAt ?? o.createdAt).getTime() + (o.deliveredAt ? 10 : 14) * DAY;
      const due = base <= Date.now();
      lines.push({
        text: due ? '⏳ À envoyer (automatique au prochain passage)' : `⏳ Envoi auto prévu vers le ${fmt(new Date(base))}`,
        cls: 'text-amber-600',
      });
    } else {
      lines.push({ text: '—', cls: 'text-gray-300' });
    }
  }

  return (
    <div className="space-y-0.5">
      {lines.map((l, i) => (
        <div key={i} className={`text-[11px] leading-tight ${l.cls}`}>
          {l.text}
        </div>
      ))}
    </div>
  );
}
