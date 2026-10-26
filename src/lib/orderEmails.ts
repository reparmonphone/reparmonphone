import { prisma } from '@/lib/prisma';
import { getResendClient } from '@/lib/resend';
import { formatPrice } from '@/lib/format';

const FROM = process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>';
const ADMIN_EMAIL = 'contact@reparmonphone.fr';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

const CARRIER_LABELS: Record<string, string> = {
  CHRONOPOST: 'Chronopost',
  COLISSIMO: 'Colissimo',
  MONDIAL_RELAY: 'Mondial Relay',
  RELAIS_COLIS: 'Relais Colis',
  AUTRE: 'Autre transporteur',
  UPS: 'UPS',
  DHL: 'DHL',
};

// Génère automatiquement le lien de suivi public du transporteur à partir du numéro de suivi,
// si aucune URL personnalisée (trackingUrlOverride) n'a été saisie manuellement dans l'admin.
function getTrackingUrl(carrier: string | null, trackingNumber: string | null, override: string | null) {
  if (override) return override;
  if (!trackingNumber || !carrier) return null;

  const encoded = encodeURIComponent(trackingNumber);
  switch (carrier) {
    case 'CHRONOPOST':
      return `https://www.chronopost.fr/tracking-no-cms/suivi-colis?listeNumerosLT=${encoded}`;
    case 'COLISSIMO':
      return `https://www.laposte.fr/outils/suivre-vos-envois?code=${encoded}`;
    case 'MONDIAL_RELAY':
      return `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${encoded}`;
    case 'UPS':
      return `https://www.ups.com/track?loc=fr_FR&tracknum=${encoded}`;
    case 'DHL':
      return `https://www.dhl.com/fr-fr/home/tracking/tracking-express.html?submit=1&tracking-id=${encoded}`;
    default:
      return null;
  }
}

// Échappe le HTML avant d'insérer un texte saisi par l'admin (ex: une note de commande) dans un
// email — sans ça, un caractère comme "<" ou "&" tapé dans le formulaire casserait la mise en page
// de l'email, voire injecterait du HTML non désiré.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Offre de fidélité : -5 % sur la 2ème commande ----------
// Bloc affiché dans l'e-mail de confirmation de commande et dans les e-mails d'expédition / de suivi.
// Masqué si le client a déjà utilisé le code (sur cette commande ou une précédente).
export const FIDELITY_CODE = 'REPARMONPHONEFIDELITY';
export const FIDELITY_PERCENT = 5;

export async function fidelityBlockHtml(
  order: { customerEmail: string; promoCode: string | null },
  tone: 'vous' | 'tu' = 'vous'
): Promise<string> {
  try {
    if (order.promoCode === FIDELITY_CODE) return '';
    const used = await prisma.order.count({
      where: {
        promoCode: FIDELITY_CODE,
        status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'REFUNDED'] },
        customerEmail: { equals: order.customerEmail, mode: 'insensitive' },
      },
    });
    if (used > 0) return '';
  } catch {
    // en cas d'erreur de lecture, on affiche quand même l'offre
  }
  const you = tone === 'vous';
  return `
    <div style="background:#fffbeb; border:1px dashed #f59e0b; border-radius:8px; padding:16px; margin:20px 0; text-align:center;">
      <p style="margin:0 0 6px; font-size:15px; font-weight:700; color:#92400e;">🎁 ${FIDELITY_PERCENT} % de remise sur ${you ? 'votre' : 'ta'} 2ème commande</p>
      <p style="margin:0 0 10px; font-size:13px; color:#78350f; line-height:1.5;">
        ${you ? 'Pour vous remercier de votre confiance, vous bénéficiez' : 'Pour te remercier de ta confiance, tu bénéficies'} de ${FIDELITY_PERCENT} % de remise sur <strong>tout ${you ? 'votre' : 'ton'} panier</strong> lors de ${you ? 'votre' : 'ta'} prochaine commande.
      </p>
      <p style="margin:0 0 10px;"><span style="display:inline-block; background:#ffffff; border:2px solid #f59e0b; border-radius:6px; padding:8px 16px; font-size:16px; font-weight:800; letter-spacing:0.06em; color:#111827;">${FIDELITY_CODE}</span></p>
      <p style="margin:0; font-size:12px; color:#92400e;">À saisir ${you ? 'vous-même' : 'toi-même'} dans le champ « Code promo » du panier. Valable une seule fois par client.</p>
    </div>`;
}

function emailWrapper(headerColor: string, headerTitle: string, headerSubtitle: string, bodyHtml: string) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background:${headerColor}; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color:#ffffff; font-size: 20px; margin: 0;">${headerTitle}</h1>
        <p style="color:rgba(255,255,255,0.85); font-size: 13px; margin: 6px 0 0;">${headerSubtitle}</p>
      </div>
      <div style="background:#ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
        ${bodyHtml}
      </div>
      <p style="color:#9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
        ReparMonPhone — Les Saquèdes, 83120 Sainte-Maxime — <a href="tel:+33783497262" style="color:#9ca3af;">07 83 49 72 62</a>
      </p>
    </div>
  `;
}

function orderItemsTableHtml(
  items: { quantity: number; unitPrice: unknown; product: { title: string } }[],
  opts?: { free?: boolean } // true = renvoi gratuit : on affiche « Offert » au lieu du prix
) {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px 0; color:#374151; font-size: 14px;">${item.product.title}</td>
          <td style="padding: 8px 0; color:#6b7280; font-size: 14px; text-align: center;">×${item.quantity}</td>
          <td style="padding: 8px 0; color:#111827; font-size: 14px; text-align: right; font-weight: 600;">${opts?.free ? 'Offert' : formatPrice(Number(item.unitPrice) * item.quantity)}</td>
        </tr>`
    )
    .join('');
  return `<table style="width:100%; border-collapse: collapse;">${rows}</table>`;
}

// ---------- 1a. Email client "commande confirmée" (générique, sans facture PDF) ----------
// À utiliser pour les moyens de paiement qui n'envoient pas déjà une confirmation avec facture
// PDF ailleurs (ex: SumUp). Pour Stripe, ne PAS utiliser cette fonction — le webhook Stripe envoie
// déjà un email de confirmation avec la facture PDF jointe ; utiliser seulement
// sendNewOrderAdminNotification dans ce cas, pour éviter d'envoyer deux emails de confirmation au client.
export async function sendOrderConfirmedCustomerEmail(orderId: string) {
  const resend = getResendClient();
  if (!resend) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: { select: { title: true } } } } },
  });
  if (!order) return;

  const itemsHtml = orderItemsTableHtml(order.items);
  const orderRef = order.invoiceNumber || order.id.slice(-8).toUpperCase();
  const fidelityHtml = await fidelityBlockHtml(order);

  try {
    await resend.emails.send({
      from: FROM,
      to: order.customerEmail,
      subject: `Votre commande #${orderRef} est confirmée — ReparMonPhone`,
      html: emailWrapper(
        '#16a34a',
        'Commande confirmée ✅',
        `Merci pour votre commande, ${order.customerName} !`,
        `
          <p style="color:#374151; font-size: 14px; line-height: 1.6;">
            Nous avons bien reçu votre paiement. Votre commande <strong>#${orderRef}</strong> est en cours de préparation.
          </p>
          <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 16px 0; margin: 20px 0;">
            ${itemsHtml}
          </div>
          <table style="width:100%; border-collapse: collapse;">
            <tr><td style="padding:4px 0; color:#6b7280; font-size:14px;">Sous-total</td><td style="padding:4px 0; text-align:right; font-size:14px;">${formatPrice(Number(order.subtotal))}</td></tr>
            ${Number(order.discountAmount) > 0 ? `<tr><td style="padding:4px 0; color:#16a34a; font-size:14px;">Remise${order.promoCode ? ` (${order.promoCode})` : ''}</td><td style="padding:4px 0; text-align:right; font-size:14px; color:#16a34a;">-${formatPrice(Number(order.discountAmount))}</td></tr>` : ''}
            <tr><td style="padding:4px 0; color:#6b7280; font-size:14px;">Livraison</td><td style="padding:4px 0; text-align:right; font-size:14px;">${formatPrice(Number(order.shippingCost))}</td></tr>
            <tr><td style="padding:8px 0 0; color:#111827; font-size:16px; font-weight:700; border-top:1px solid #e5e7eb;">Total</td><td style="padding:8px 0 0; text-align:right; font-size:16px; font-weight:700; border-top:1px solid #e5e7eb;">${formatPrice(Number(order.total))}</td></tr>
          </table>
          ${fidelityHtml}
          <p style="color:#6b7280; font-size: 13px; margin-top: 20px;">
            Vous recevrez un nouvel email dès que votre colis sera expédié.<br />
            Livraison à : ${order.shippingLine1}, ${order.shippingZip} ${order.shippingCity}
          </p>
          <div style="text-align:center; margin-top: 20px;">
            <a href="${SITE_URL}/compte/commandes" style="display:inline-block; background:#16a34a; color:#fff; text-decoration:none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Suivre ma commande</a>
          </div>
        `
      ),
    });
  } catch (e) {
    console.error('Erreur envoi email confirmation commande (client)', e);
  }
}

// ---------- 1b. Notification admin "nouvelle commande" ----------
// À appeler pour TOUS les moyens de paiement dès qu'une commande passe en statut PAID
// (y compris Stripe, en plus de son email de confirmation avec facture déjà existant).
export async function sendNewOrderAdminNotification(orderId: string) {
  const resend = getResendClient();
  if (!resend) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: { select: { title: true } } } } },
  });
  if (!order) return;

  const itemsHtml = orderItemsTableHtml(order.items);
  const orderRef = order.invoiceNumber || order.id.slice(-8).toUpperCase();

  try {
    await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `🛒 Nouvelle commande #${orderRef} — ${formatPrice(Number(order.total))}`,
      html: emailWrapper(
        '#1e3a8a',
        'Nouvelle commande reçue',
        `#${orderRef} — ${formatPrice(Number(order.total))}`,
        `
          <table style="width:100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr><td style="padding:4px 0; color:#6b7280; font-size:13px; width:120px;">Client</td><td style="padding:4px 0; color:#111827; font-size:14px; font-weight:600;">${order.customerName}</td></tr>
            <tr><td style="padding:4px 0; color:#6b7280; font-size:13px;">Email</td><td style="padding:4px 0; color:#111827; font-size:14px;"><a href="mailto:${order.customerEmail}" style="color:#1e3a8a;">${order.customerEmail}</a></td></tr>
            ${order.customerPhone ? `<tr><td style="padding:4px 0; color:#6b7280; font-size:13px;">Téléphone</td><td style="padding:4px 0; color:#111827; font-size:14px;">${order.customerPhone}</td></tr>` : ''}
            <tr><td style="padding:4px 0; color:#6b7280; font-size:13px;">Paiement</td><td style="padding:4px 0; color:#111827; font-size:14px;">${order.paymentProvider}</td></tr>
            <tr><td style="padding:4px 0; color:#6b7280; font-size:13px;">Livraison</td><td style="padding:4px 0; color:#111827; font-size:14px;">${order.shippingLine1}, ${order.shippingZip} ${order.shippingCity}</td></tr>
          </table>
          <div style="border-top: 1px solid #e5e7eb; padding-top: 12px;">
            ${itemsHtml}
          </div>
          <div style="text-align:center; margin-top: 20px;">
            <a href="${SITE_URL}/admin/commandes" style="display:inline-block; background:#1e3a8a; color:#fff; text-decoration:none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Voir dans l'admin</a>
          </div>
        `
      ),
    });
  } catch (e) {
    console.error('Erreur envoi email notification commande (admin)', e);
  }
}

// ---------- 1c. Confirmation complète (client + admin) ----------
// Pratique pour les moyens de paiement qui n'ont pas déjà leur propre email de confirmation
// avec facture (ex: SumUp). Envoie les deux emails ci-dessus en une fois.
export async function sendOrderConfirmedEmails(orderId: string) {
  await sendOrderConfirmedCustomerEmail(orderId);
  await sendNewOrderAdminNotification(orderId);
}

// ---------- Renvoi (nouvelle expédition gratuite d'une commande déjà close) ----------
// Trois moments, un seul gabarit :
//  - announced : le renvoi vient d'être créé (en préparation) — « un nouvel envoi arrive »
//  - shipped   : le renvoi passe en « Expédiée » (en livraison)
//  - tracking  : un numéro de suivi vient d'être ajouté / modifié
// Pas d'offre de fidélité ici (ce n'est pas un achat) et les articles sont marqués « Offert ».
export type ReplacementEmailStage = 'announced' | 'shipped' | 'tracking';

export async function sendReplacementEmail(orderId: string, stage: ReplacementEmailStage) {
  const resend = getResendClient();
  if (!resend) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { select: { title: true } } } },
      replacementOf: { select: { id: true } },
    },
  });
  if (!order) return;
  if (stage === 'tracking' && !order.trackingNumber) return;

  const ref = order.id.slice(-8);
  const origRef = (order.replacementOf?.id ?? order.id).slice(-8);
  const name = escapeHtml(order.customerName);
  const trackingUrl = getTrackingUrl(order.carrier, order.trackingNumber, order.trackingUrlOverride);
  const carrierLabel = order.carrier ? CARRIER_LABELS[order.carrier] ?? order.carrier : null;
  const itemsHtml = orderItemsTableHtml(order.items, { free: true });
  const orderUrl = `${SITE_URL}/compte/commandes/${order.id}`;

  const trackingBlock = order.trackingNumber
    ? `
      <div style="background:#eff6ff; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
        <p style="color:#6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">Numéro de suivi${carrierLabel ? ` — ${carrierLabel}` : ''}</p>
        <p style="color:#111827; font-size: 18px; font-weight: 700; margin: 0; letter-spacing: 0.03em;">${escapeHtml(order.trackingNumber)}</p>
      </div>`
    : '';
  const button = (href: string, label: string) =>
    `<div style="text-align:center; margin-top: 16px;"><a href="${href}" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">${label}</a></div>`;
  const itemsBlock = `
    <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 12px 0; margin: 16px 0;">
      ${itemsHtml}
    </div>`;
  const freeNote = `<p style="color:#374151; font-size: 14px; line-height: 1.6;">Cet envoi est <strong>entièrement offert</strong> : aucun paiement ni frais de port ne vous sont demandés.</p>`;

  let subject: string;
  let title: string;
  let subtitle: string;
  let body: string;

  if (stage === 'announced') {
    subject = `ReparMonPhone.fr - Un nouvel envoi est en préparation pour votre commande #${origRef}`;
    title = 'Un nouvel envoi est en préparation 🔁';
    subtitle = `Renvoi de votre commande #${origRef}`;
    body = `
      <p style="color:#374151; font-size: 14px; line-height: 1.6;">
        Bonjour ${name}, nous préparons un <strong>nouvel envoi</strong> pour votre commande <strong>#${origRef}</strong>. Une nouvelle livraison devrait donc très prochainement vous parvenir.
      </p>
      ${itemsBlock}
      ${freeNote}
      ${
        order.trackingNumber
          ? `<p style="color:#374151; font-size: 14px; line-height: 1.6;">Voici déjà le suivi de ce colis${carrierLabel ? ` (${carrierLabel})` : ''} :</p>${trackingBlock}${trackingUrl ? button(trackingUrl, 'Suivre mon colis') : ''}`
          : `<p style="color:#374151; font-size: 14px; line-height: 1.6;">Vous recevrez un e-mail avec le numéro de suivi dès que le colis sera expédié.</p>${button(orderUrl, 'Voir mon nouvel envoi')}`
      }
      <p style="color:#9ca3af; font-size: 12px; margin-top: 16px;">À réception, vous pourrez donner votre avis depuis votre compte, comme pour une commande classique.</p>`;
  } else if (stage === 'shipped') {
    subject = `ReparMonPhone.fr - Votre nouveau colis (commande #${origRef}) a été expédié 📦`;
    title = 'Votre nouveau colis est en route 📦';
    subtitle = `Renvoi de votre commande #${origRef}`;
    body = `
      <p style="color:#374151; font-size: 14px; line-height: 1.6;">
        Bonjour ${name}, le nouvel envoi lié à votre commande <strong>#${origRef}</strong> vient d'être expédié${carrierLabel ? ` via <strong>${carrierLabel}</strong>` : ''}.
      </p>
      ${itemsBlock}
      ${freeNote}
      ${trackingBlock}
      ${trackingUrl ? button(trackingUrl, 'Suivre mon colis') : button(orderUrl, 'Voir mon nouvel envoi')}
      <p style="color:#9ca3af; font-size: 12px; margin-top: 16px;">À réception, vous pourrez donner votre avis depuis votre compte, comme pour une commande classique.</p>`;
  } else {
    subject = `ReparMonPhone.fr - Suivi de votre nouvel envoi (commande #${origRef})`;
    title = 'Suivi de votre nouvel envoi 🔍';
    subtitle = `Renvoi de votre commande #${origRef}`;
    body = `
      <p style="color:#374151; font-size: 14px; line-height: 1.6;">
        Bonjour ${name}, le numéro de suivi de votre nouveau colis${carrierLabel ? ` (${carrierLabel})` : ''} est maintenant disponible.
      </p>
      ${trackingBlock}
      ${trackingUrl ? button(trackingUrl, 'Suivre mon colis') : button(orderUrl, 'Voir mon nouvel envoi')}`;
  }

  try {
    await resend.emails.send({
      from: FROM,
      to: order.customerEmail,
      subject,
      html: emailWrapper('#2563eb', title, subtitle, body),
    });
  } catch (e) {
    console.error(`Erreur envoi email renvoi (${stage}) #${ref}`, e);
  }
}

// ---------- 2. Commande expédiée ----------
// À appeler depuis updateOrderStatus quand le nouveau statut est SHIPPED.
export async function sendOrderShippedEmail(orderId: string) {
  const resend = getResendClient();
  if (!resend) return;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;
  // Renvoi (nouvelle expédition gratuite) : e-mail dédié « nouveau colis en route »
  if (order.replacementOfId) return sendReplacementEmail(orderId, 'shipped');

  const orderRef = order.invoiceNumber || order.id.slice(-8).toUpperCase();
  const trackingUrl = getTrackingUrl(order.carrier, order.trackingNumber, order.trackingUrlOverride);
  const fidelityHtml = await fidelityBlockHtml(order);

  try {
    await resend.emails.send({
      from: FROM,
      to: order.customerEmail,
      subject: `ReparMonPhone.fr - Votre commande #${orderRef} a été expédiée 📦`,
      html: emailWrapper(
        '#2563eb',
        'Commande expédiée 📦',
        `Votre colis est en route, ${order.customerName} !`,
        `
          <p style="color:#374151; font-size: 14px; line-height: 1.6;">
            Bonne nouvelle : votre commande <strong>#${orderRef}</strong> vient d'être expédiée${order.carrier ? ` via <strong>${CARRIER_LABELS[order.carrier] ?? order.carrier}</strong>` : ''}.
          </p>
          ${
            order.trackingNumber
              ? `
          <div style="background:#eff6ff; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
            <p style="color:#6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">Numéro de suivi</p>
            <p style="color:#111827; font-size: 18px; font-weight: 700; margin: 0; letter-spacing: 0.03em;">${order.trackingNumber}</p>
          </div>`
              : ''
          }
          ${
            trackingUrl
              ? `<div style="text-align:center; margin-top: 16px;"><a href="${trackingUrl}" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Suivre mon colis</a></div>`
              : `<div style="text-align:center; margin-top: 16px;"><a href="${SITE_URL}/compte/commandes" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Voir ma commande</a></div>`
          }
          ${fidelityHtml}
        `
      ),
    });
  } catch (e) {
    console.error('Erreur envoi email commande expédiée', e);
  }
}

// ---------- 3. Numéro de suivi renseigné/mis à jour ----------
// À appeler depuis updateOrderTracking, uniquement quand un numéro de suivi non vide
// vient d'être ajouté ou modifié (voir logique de comparaison dans actions.ts).
export async function sendTrackingNumberEmail(orderId: string) {
  const resend = getResendClient();
  if (!resend) return;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.trackingNumber) return;
  // Renvoi : e-mail de suivi dédié (sans offre de fidélité)
  if (order.replacementOfId) return sendReplacementEmail(orderId, 'tracking');

  const orderRef = order.invoiceNumber || order.id.slice(-8).toUpperCase();
  const trackingUrl = getTrackingUrl(order.carrier, order.trackingNumber, order.trackingUrlOverride);
  const fidelityHtml = await fidelityBlockHtml(order);

  try {
    await resend.emails.send({
      from: FROM,
      to: order.customerEmail,
      subject: `ReparMonPhone.fr - Numéro de suivi disponible pour votre commande #${orderRef}`,
      html: emailWrapper(
        '#2563eb',
        'Numéro de suivi disponible 🔍',
        `Commande #${orderRef}`,
        `
          <p style="color:#374151; font-size: 14px; line-height: 1.6;">
            Bonjour ${order.customerName}, le numéro de suivi de votre colis${order.carrier ? ` (${CARRIER_LABELS[order.carrier] ?? order.carrier})` : ''} est maintenant disponible.
          </p>
          <div style="background:#eff6ff; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
            <p style="color:#6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">Numéro de suivi</p>
            <p style="color:#111827; font-size: 18px; font-weight: 700; margin: 0; letter-spacing: 0.03em;">${order.trackingNumber}</p>
          </div>
          ${
            trackingUrl
              ? `<div style="text-align:center; margin-top: 16px;"><a href="${trackingUrl}" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Suivre mon colis</a></div>`
              : ''
          }
          ${fidelityHtml}
        `
      ),
    });
  } catch (e) {
    console.error('Erreur envoi email numéro de suivi', e);
  }
}

// ---------- 4. Livraison partielle : numéro de suivi d'un envoi (colis) ----------
// À appeler depuis shipmentActions.ts quand un numéro de suivi non vide vient d'être ajouté/modifié
// sur un Shipment donné (commande expédiée en plusieurs colis). Liste uniquement les articles
// inclus dans CET envoi, pas la commande entière.
export async function sendShipmentTrackingEmail(shipmentId: string) {
  const resend = getResendClient();
  if (!resend) return;

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      order: true,
      items: { include: { orderItem: { include: { product: { select: { title: true } } } } } },
    },
  });
  if (!shipment || !shipment.trackingNumber) return;

  const { order } = shipment;
  const orderRef = order.invoiceNumber || order.id.slice(-8).toUpperCase();
  const trackingUrl = getTrackingUrl(shipment.carrier, shipment.trackingNumber, shipment.trackingUrlOverride);
  const fidelityHtml = await fidelityBlockHtml(order);
  const itemsHtml = orderItemsTableHtml(
    shipment.items.map((si) => ({ quantity: si.quantity, unitPrice: si.orderItem.unitPrice, product: si.orderItem.product }))
  );

  try {
    await resend.emails.send({
      from: FROM,
      to: order.customerEmail,
      subject: `ReparMonPhone.fr - Un de vos colis est en route pour la commande #${orderRef}`,
      html: emailWrapper(
        '#2563eb',
        'Un colis de votre commande est en route 📦',
        `Commande #${orderRef} — livraison partielle`,
        `
          <p style="color:#374151; font-size: 14px; line-height: 1.6;">
            Bonjour ${order.customerName}, votre commande <strong>#${orderRef}</strong> est expédiée en plusieurs colis.
            Voici le suivi du colis contenant les articles ci-dessous${shipment.carrier ? ` (${CARRIER_LABELS[shipment.carrier] ?? shipment.carrier})` : ''} :
          </p>
          <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 16px 0; margin: 16px 0;">
            ${itemsHtml}
          </div>
          <div style="background:#eff6ff; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
            <p style="color:#6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">Numéro de suivi</p>
            <p style="color:#111827; font-size: 18px; font-weight: 700; margin: 0; letter-spacing: 0.03em;">${shipment.trackingNumber}</p>
          </div>
          ${
            trackingUrl
              ? `<div style="text-align:center; margin-top: 16px;"><a href="${trackingUrl}" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Suivre ce colis</a></div>`
              : ''
          }
          ${fidelityHtml}
          <p style="color:#9ca3af; font-size: 12px; margin-top: 16px;">
            Le reste de votre commande vous sera expédié séparément dès que possible ; vous recevrez un email dédié pour chaque colis.
          </p>
        `
      ),
    });
  } catch (e) {
    console.error('Erreur envoi email suivi envoi partiel', e);
  }
}

// ---------- 5. Note ajoutée sur une commande (info libre pour le client) ----------
// À appeler depuis noteActions.ts à chaque nouvelle OrderNote créée par l'admin — typiquement pour
// prévenir d'un imprévu (retard transporteur, rupture surprise, etc.) : le texte est libre, saisi
// par Krys dans l'admin, donc toujours échappé avant d'être inséré dans le HTML de l'email. Les
// retours à la ligne du formulaire sont convertis en <br> pour rester lisibles.
export async function sendOrderNoteEmail(orderId: string, message: string) {
  const resend = getResendClient();
  if (!resend) return;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  const orderRef = order.invoiceNumber || order.id.slice(-8).toUpperCase();
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

  try {
    await resend.emails.send({
      from: FROM,
      to: order.customerEmail,
      subject: `ReparMonPhone.fr - Information concernant votre commande #${orderRef}`,
      html: emailWrapper(
        '#f59e0b',
        'Information sur votre commande ℹ️',
        `Commande #${orderRef}`,
        `
          <p style="color:#374151; font-size: 14px; line-height: 1.6;">
            Bonjour ${order.customerName},
          </p>
          <div style="background:#fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="color:#374151; font-size: 14px; line-height: 1.6; margin: 0;">${safeMessage}</p>
          </div>
          <p style="color:#6b7280; font-size: 13px; margin-top: 16px;">
            Cette information est aussi visible à tout moment dans le détail de votre commande sur votre compte.
            Pour toute question, n'hésitez pas à nous contacter.
          </p>
          <div style="text-align:center; margin-top: 20px;">
            <a href="${SITE_URL}/compte/commandes/${order.id}" style="display:inline-block; background:#f59e0b; color:#fff; text-decoration:none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Voir ma commande</a>
          </div>
        `
      ),
    });
  } catch (e) {
    console.error('Erreur envoi email note de commande', e);
  }
}