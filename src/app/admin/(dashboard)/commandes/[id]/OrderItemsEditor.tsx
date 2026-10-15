'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeOrderItem } from './itemActions';

type Item = { id: string; title: string; quantity: number; unitPrice: number };

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

function defaultMessage(title: string, amount: number) {
  return (
    `Bonjour,\n\nl'article « ${title} » de votre commande n'est malheureusement pas disponible. ` +
    `Nous l'avons retiré de votre commande et nous vous remboursons ${eur(amount)} sur votre moyen de paiement ` +
    `(le délai d'affichage dépend de votre banque ou de PayPal).\n\n` +
    `Le reste de votre commande est préparé normalement. Nous vous prions de nous excuser pour ce désagrément.\n\n` +
    `L'équipe ReparMonPhone`
  );
}

export default function OrderItemsEditor({
  orderId,
  items,
  canEdit,
}: {
  orderId: string;
  items: Item[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open(item: Item) {
    setOpenId(item.id);
    setQty(item.quantity);
    setNotify(true);
    setMessage(defaultMessage(item.title, item.unitPrice * item.quantity));
    setError(null);
    setResult(null);
  }

  function changeQty(item: Item, q: number) {
    setQty(q);
    setMessage(defaultMessage(item.title, item.unitPrice * q));
  }

  function confirm(item: Item) {
    setError(null);
    startTransition(async () => {
      const r = await removeOrderItem(orderId, item.id, qty, notify ? message : '');
      if ('error' in r) {
        setError(r.error);
        return;
      }
      setOpenId(null);
      const parts = [`✅ Article retiré. Nouveau total : ${eur(r.newTotal)}.`, `💸 À rembourser au client : ${eur(r.refundAmount)} (à faire dans PayPal / SumUp / Stripe).`];
      if (r.hasPromo) parts.push('⚠️ La commande utilise un code promo : la réduction n’a pas été recalculée, vérifie le montant.');
      if (r.noteSent) parts.push('📧 Le client a été prévenu par email.');
      if (r.noteError) parts.push(`⚠️ Article retiré, mais le client n'a pas été prévenu : ${r.noteError}`);
      setResult(parts.join('\n'));
      router.refresh();
    });
  }

  const lastLine = items.length <= 1;

  return (
    <div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id}>
            <div className="flex justify-between items-start gap-3 text-sm">
              <span className="flex-1">
                {item.quantity} × {item.title}
              </span>
              <span className="font-medium whitespace-nowrap">{eur(item.unitPrice * item.quantity)}</span>
              {canEdit && !lastLine && openId !== item.id && (
                <button
                  type="button"
                  onClick={() => open(item)}
                  disabled={pending}
                  className="text-red-500 text-xs hover:underline shrink-0 disabled:opacity-50"
                >
                  Retirer
                </button>
              )}
            </div>

            {openId === item.id && (
              <div className="mt-2 mb-3 border border-red-200 bg-red-50 rounded-lg p-3 space-y-3">
                <p className="text-sm font-semibold text-red-700">Retirer cet article de la commande</p>

                {item.quantity > 1 && (
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    Quantité à retirer :
                    <select
                      value={qty}
                      onChange={(e) => changeQty(item, Number(e.target.value))}
                      className="border border-gray-200 rounded px-2 py-1 bg-white"
                    >
                      {Array.from({ length: item.quantity }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} sur {item.quantity}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <p className="text-sm text-gray-700">
                  Montant concerné : <strong>{eur(item.unitPrice * qty)}</strong>. Le total de la commande sera recalculé. Le
                  remboursement n&apos;est pas automatique : tu le fais toi-même chez le prestataire de paiement.
                </p>

                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-1" />
                  <span>Prévenir le client par email (ajoute aussi une note visible dans sa commande)</span>
                </label>

                {notify && (
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={7}
                    maxLength={2000}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white resize-y"
                  />
                )}

                {error && <p className="text-red-600 text-xs">{error}</p>}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => confirm(item)}
                    disabled={pending || (notify && !message.trim())}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-60"
                  >
                    {pending ? 'En cours...' : 'Confirmer le retrait'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenId(null)}
                    disabled={pending}
                    className="text-sm text-gray-500 hover:underline"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {canEdit && lastLine && (
        <p className="text-xs text-gray-400 mt-3">
          Dernier article de la commande : pour tout annuler, passe la commande au statut « Annulée » et rembourse le client.
        </p>
      )}

      {result && (
        <p className="mt-3 text-sm whitespace-pre-line bg-green-50 border border-green-200 text-green-800 rounded-lg p-3">
          {result}
        </p>
      )}
    </div>
  );
}
