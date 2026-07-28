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

function orderItemsTableHtml(items: { quantity: number; unitPrice: unknown; product: { title: string } }[]) {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px 0; color:#374151; font-size: 14px;">${item.product.title}</td>
          <td style="padding: 8px 0; color:#6b7280; font-size: 14px; text-align: center;">×${item.quantity}</td>
          <td style="padding: 8px 0; color:#111827; font-size: 14px; text-align: right; font-weight: 600;">${formatPrice(Number(item.unitPrice) * item.quantity)}</td>
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

// ---------- 2. Commande expédiée ----------
// À appeler depuis updateOrderStatus quand le nouveau statut est SHIPPED.
export async function sendOrderShippedEmail(orderId: string) {
  const resend = getResendClient();
  if (!resend) return;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  const orderRef = order.invoiceNumber || order.id.slice(-8).toUpperCase();
  const trackingUrl = getTrackingUrl(order.carrier, order.trackingNumber, order.trackingUrlOverride);

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

  const orderRef = order.invoiceNumber || order.id.slice(-8).toUpperCase();
  const trackingUrl = getTrackingUrl(order.carrier, order.trackingNumber, order.trackingUrlOverride);

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
        `
      ),
    });
  } catch (e) {
    console.error('Erreur envoi email numéro de suivi', e);
  }
}