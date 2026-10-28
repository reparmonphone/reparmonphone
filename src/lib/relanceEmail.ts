// Contenu de l'e-mail « Votre compte vous attend » — fonction pure (pas d'accès base), réutilisée pour
// l'aperçu admin, l'envoi de test et l'envoi réel. HTML « e-mail » : tableaux + styles en ligne pour
// un rendu fiable dans Gmail, Outlook, Apple Mail.

export type RelancePromo = {
  code: string;
  label: string; // ex. « -10 % » ou « -5 € »
  conditions: string[]; // ex. ["Valable une seule fois par client", "Dès 30 € d'achat"]
};

const BRAND = '#0E7FDB';
const BRAND_DARK = '#0A5FA8';

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPlainRelanceEmail(opts: {
  firstName?: string | null;
  siteUrl: string;
  promo: RelancePromo | null;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const { siteUrl, promo, unsubscribeUrl } = opts;
  const name = (opts.firstName ?? '').trim();
  const hello = name ? `Bonjour ${esc(name)},` : 'Bonjour,';
  const shop = `${siteUrl}/boutique`;
  const rdv = `${siteUrl}/rdv`;

  const subject = promo
    ? `Votre compte ReparMonPhone vous attend : ${promo.label} sur votre première commande`
    : 'Votre compte ReparMonPhone est prêt : pièces détachées et réparation à Sainte-Maxime';
  const preheader = promo
    ? `Utilisez le code ${promo.code} sur votre première commande de pièces détachées.`
    : 'Pièces détachées pour smartphones et tablettes, livrées en 24h partout en France.';

  const promoBlock = promo
    ? `
        <tr><td style="padding:8px 32px 8px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:2px dashed #f59e0b;border-radius:10px;">
            <tr><td align="center" style="padding:22px 20px;">
              <p style="margin:0 0 4px 0;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#92400e;font-weight:700;">Offre de bienvenue</p>
              <p style="margin:0 0 12px 0;font-size:26px;line-height:1.2;color:#111827;font-weight:800;">${esc(promo.label)} sur votre première commande</p>
              <p style="margin:0 0 12px 0;"><span style="display:inline-block;background:#ffffff;border:2px solid #f59e0b;border-radius:8px;padding:10px 22px;font-size:20px;font-weight:800;letter-spacing:.08em;color:#111827;font-family:Consolas,Menlo,monospace;">${esc(promo.code)}</span></p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#78350f;">À saisir dans le champ « Code promo » de votre panier.${
                promo.conditions.length ? '<br>' + promo.conditions.map(esc).join(' · ') : ''
              }</p>
            </td></tr>
          </table>
        </td></tr>`
    : '';

  const benefit = (icon: string, title: string, text: string) => `
            <tr>
              <td width="44" valign="top" style="padding:10px 0;font-size:26px;line-height:1;">${icon}</td>
              <td valign="top" style="padding:10px 0;">
                <p style="margin:0 0 2px 0;font-size:15px;font-weight:700;color:#111827;">${title}</p>
                <p style="margin:0;font-size:14px;line-height:1.5;color:#4b5563;">${text}</p>
              </td>
            </tr>`;

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f3f4f6;font-size:1px;line-height:1px;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">

    <tr><td align="center" style="background:${BRAND};padding:26px 24px;">
      <p style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:.01em;">ReparMonPhone</p>
      <p style="margin:6px 0 0 0;font-size:13px;color:rgba(255,255,255,.88);">Pièces détachées &amp; réparation · Sainte-Maxime</p>
    </td></tr>

    <tr><td style="padding:30px 32px 6px 32px;">
      <p style="margin:0 0 12px 0;font-size:16px;color:#111827;">${hello}</p>
      <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.25;color:#111827;">Votre compte est prêt, il ne manque que votre première pièce</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#374151;">
        Vous avez créé un compte sur ReparMonPhone, mais vous n'avez pas encore passé commande. Écran fissuré, batterie fatiguée, connecteur de charge qui lâche : retrouvez les pièces détachées pour smartphones et tablettes, ou confiez-nous la réparation.
      </p>
    </td></tr>

    ${promoBlock}

    <tr><td align="center" style="padding:20px 32px 6px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td align="center" style="background:${BRAND};border-radius:8px;">
          <a href="${shop}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Voir les pièces détachées</a>
        </td>
      </tr></table>
    </td></tr>

    <tr><td style="padding:22px 32px 4px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;">
        <tr><td colspan="2" style="padding-top:18px;"><p style="margin:0;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${BRAND_DARK};font-weight:700;">Pourquoi ReparMonPhone</p></td></tr>
        ${benefit('📦', 'Livraison rapide', 'Expédition Chronopost 24h en France métropolitaine.')}
        ${benefit('📱', 'Toutes les grandes marques', 'Apple, Samsung, Huawei, Xiaomi et d’autres sur demande.')}
        ${benefit('🔧', 'Un atelier près de chez vous', 'Réparation en atelier à Sainte-Maxime, ou à domicile selon votre secteur.')}
        ${benefit('🔒', 'Paiement sécurisé', 'Carte bancaire ou PayPal, avec suivi de votre commande dans votre compte.')}
      </table>
    </td></tr>

    <tr><td style="padding:14px 32px 30px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7ff;border-radius:10px;">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:#111827;">Vous préférez qu'on s'en occupe ?</p>
          <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;color:#4b5563;">Prenez rendez-vous pour une réparation : diagnostic et conseils par un technicien.</p>
          <a href="${rdv}" style="font-size:14px;font-weight:700;color:${BRAND};text-decoration:underline;">Prendre rendez-vous →</a>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;">
      <p style="margin:0 0 8px 0;font-size:12px;line-height:1.6;color:#6b7280;">
        ReparMonPhone — Les Saquèdes, 83120 Sainte-Maxime — <a href="tel:+33783497262" style="color:#6b7280;">07 83 49 72 62</a><br>
        <a href="${siteUrl}" style="color:#6b7280;">reparmonphone.fr</a>
      </p>
      <p style="margin:0;font-size:11px;line-height:1.6;color:#9ca3af;">
        Vous recevez cet e-mail parce que vous avez un compte sur reparmonphone.fr et que vous avez accepté de recevoir nos offres.
        <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Se désinscrire</a> en un clic.
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    hello.replace(/&amp;/g, '&'),
    '',
    'Votre compte ReparMonPhone est prêt, il ne manque que votre première pièce.',
    promo ? `Offre de bienvenue : ${promo.label} avec le code ${promo.code}${promo.conditions.length ? ' (' + promo.conditions.join(', ') + ')' : ''}.` : '',
    `Pièces détachées : ${shop}`,
    `Réparation sur rendez-vous : ${rdv}`,
    '',
    `Se désinscrire : ${unsubscribeUrl}`,
  ]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n');

  return { subject, html, text };
}

// ─────────────────────────────────────────────────────────────────────────────
// E-mail « TICKET À GRATTER » : un ticket doré dans l'e-mail, un bouton qui mène à la page /ticket où le
// client gratte VRAIMENT (au doigt ou à la souris) pour révéler son code. Tous les tickets sont gagnants
// (même offre pour tous, aucun achat nécessaire pour gratter) : ce n'est donc pas une loterie.
// ─────────────────────────────────────────────────────────────────────────────

export const SUBJECT_VARIANTS = [
  { label: '🎟️ Prénom, ton ticket à gratter t’attend ! 🎁', build: (n: string) => `🎟️ ${n ? n + ', ton' : 'Ton'} ticket à gratter t’attend ! 🎁` },
  { label: '🔥 Ton ticket est GAGNANT… à toi de le gratter !', build: (n: string) => `🔥 ${n ? n + ', ton' : 'Ton'} ticket est GAGNANT… à toi de le gratter ! 🪙` },
  { label: '📱 Une surprise se cache sous ce ticket ✨', build: (n: string) => `📱 ${n ? n + ', une' : 'Une'} surprise se cache sous ce ticket à gratter ✨🎁` },
] as const;

export function buildTicketRelanceEmail(opts: {
  firstName?: string | null;
  siteUrl: string;
  promo: RelancePromo | null;
  unsubscribeUrl: string;
  ticketUrl: string;
  ticketNumber: string;
  subjectVariant?: number;
}): { subject: string; html: string; text: string } {
  const { siteUrl, promo, unsubscribeUrl, ticketUrl, ticketNumber } = opts;
  // Sans code promo, pas de ticket : on retombe sur l'e-mail simple
  if (!promo) return buildPlainRelanceEmail({ firstName: opts.firstName, siteUrl, promo, unsubscribeUrl });

  const name = (opts.firstName ?? '').trim();
  const variant = SUBJECT_VARIANTS[Math.min(Math.max(opts.subjectVariant ?? 0, 0), SUBJECT_VARIANTS.length - 1)];
  const subject = variant.build(name);
  const preheader = '🎁 Chaque ticket est gagnant : gratte-le pour découvrir ton cadeau de bienvenue ReparMonPhone.';
  const hello = name ? `Salut ${esc(name)} 👋` : 'Salut 👋';
  const shop = `${siteUrl}/boutique`;
  const rdv = `${siteUrl}/rdv`;
  const GOLD = '#f5c542';
  const NAVY = '#0b1b33';

  const step = (n: string, t: string, d: string) => `
        <td width="33%" valign="top" align="center" style="padding:0 6px;">
          <p style="margin:0 0 6px 0;font-size:22px;line-height:1;">${n}</p>
          <p style="margin:0 0 2px 0;font-size:14px;font-weight:700;color:#ffffff;">${t}</p>
          <p style="margin:0;font-size:12px;line-height:1.4;color:#9db4d6;">${d}</p>
        </td>`;
  const perk = (icon: string, t: string) => `
        <td width="33%" valign="top" align="center" style="padding:6px;">
          <p style="margin:0 0 4px 0;font-size:24px;line-height:1;">${icon}</p>
          <p style="margin:0;font-size:12px;line-height:1.4;color:#374151;font-weight:600;">${t}</p>
        </td>`;

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${NAVY};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${NAVY};font-size:1px;line-height:1px;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${NAVY}" style="background:${NAVY};">
<tr><td align="center" style="padding:20px 10px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;font-family:Arial,Helvetica,sans-serif;">

    <tr><td align="center" style="padding:6px 16px 18px 16px;">
      <p style="margin:0;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#7fb5ff;font-weight:700;">ReparMonPhone</p>
      <p style="margin:4px 0 0 0;font-size:12px;color:#6f86a8;">Pièces détachées &amp; réparation · Sainte-Maxime</p>
    </td></tr>

    <tr><td align="center" style="padding:6px 20px 4px 20px;">
      <p style="margin:0 0 8px 0;font-size:16px;color:#c9d8ef;">${hello}</p>
      <h1 style="margin:0 0 10px 0;font-size:32px;line-height:1.15;color:#ffffff;font-weight:800;">Un ticket à gratter<br>t’attend <span style="color:${GOLD};">🎟️</span></h1>
      <p style="margin:0 0 18px 0;font-size:16px;line-height:1.55;color:#c9d8ef;">
        Tu as créé ton compte, on t’a gardé un petit cadeau.<br>
        <strong style="color:#ffffff;">Chaque ticket est gagnant</strong> : à toi de découvrir ce qu’il cache&nbsp;!
      </p>
    </td></tr>

    <!-- LE TICKET -->
    <tr><td align="center" style="padding:6px 10px 6px 10px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${GOLD}" style="background:${GOLD};background-image:linear-gradient(135deg,#ffe08a 0%,#f5c542 45%,#e0a91f 100%);border-radius:18px;border:3px solid #fff3c4;">
        <tr><td style="padding:14px 18px 6px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:12px;font-weight:800;letter-spacing:.14em;color:#6b4a00;text-transform:uppercase;">🎟️ Ticket à gratter</td>
            <td align="right" style="font-size:12px;font-weight:700;color:#6b4a00;">N° ${esc(ticketNumber)}</td>
          </tr></table>
        </td></tr>
        <tr><td align="center" style="padding:6px 18px;">
          <a href="${ticketUrl}" style="text-decoration:none;display:block;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#c9ced6" style="background:#c9ced6;background-image:linear-gradient(135deg,#eceef2 0%,#aab1bd 40%,#e4e7ec 60%,#98a0ad 100%);border-radius:12px;border:2px dashed #7b8494;">
              <tr><td align="center" style="padding:26px 10px 24px 10px;">
                <p style="margin:0 0 6px 0;font-size:34px;line-height:1;">🪙 ✨ 🪙</p>
                <p style="margin:0;font-size:24px;line-height:1.1;font-weight:900;letter-spacing:.12em;color:#4a5160;text-transform:uppercase;">Gratte ici</p>
                <p style="margin:6px 0 0 0;font-size:13px;color:#5d6575;">100&nbsp;% gagnant · cadeau de bienvenue</p>
              </td></tr>
            </table>
          </a>
        </td></tr>
        <tr><td align="center" style="padding:6px 18px 14px 18px;">
          <p style="margin:0;font-size:12px;color:#6b4a00;font-weight:600;">Sur ta 1<sup>re</sup> commande · pièces détachées pour smartphones &amp; tablettes</p>
        </td></tr>
      </table>
    </td></tr>

    <tr><td align="center" style="padding:20px 20px 6px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td align="center" bgcolor="#ffd54a" style="background:#ffd54a;border-radius:999px;">
          <a href="${ticketUrl}" style="display:inline-block;padding:16px 38px;font-size:18px;font-weight:800;color:#3a2a00;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">🪙 Gratter mon ticket</a>
        </td>
      </tr></table>
      <p style="margin:12px 0 0 0;font-size:13px;color:#8fa6c8;">⏱️ 5 secondes chrono · c’est offert, sans engagement</p>
    </td></tr>

    <tr><td style="padding:22px 14px 8px 14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#12284a" style="background:#12284a;border-radius:14px;">
        <tr><td style="padding:18px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            ${step('🪙', 'Tu grattes', 'Au doigt ou à la souris')}
            ${step('🎁', 'Tu découvres', 'Ton code cadeau s’affiche')}
            ${step('📦', 'Tu commandes', 'Livré en 24h partout en France')}
          </tr></table>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:10px 14px 4px 14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#ffffff;border-radius:14px;">
        <tr><td style="padding:16px 10px 8px 10px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            ${perk('📦', 'Expédition Chronopost 24h')}
            ${perk('🔧', 'Atelier à Sainte-Maxime')}
            ${perk('🔒', 'Paiement 100&nbsp;% sécurisé')}
          </tr></table>
        </td></tr>
        <tr><td align="center" style="padding:6px 16px 18px 16px;">
          <p style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:#4b5563;">Écran, batterie, connecteur de charge… Apple, Samsung, Huawei, Xiaomi et d’autres sur demande.</p>
          <a href="${shop}" style="font-size:14px;font-weight:700;color:#0E7FDB;text-decoration:underline;">Voir les pièces détachées →</a>
          <span style="color:#9ca3af;"> &nbsp;·&nbsp; </span>
          <a href="${rdv}" style="font-size:14px;font-weight:700;color:#0E7FDB;text-decoration:underline;">Prendre rendez-vous →</a>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:18px 20px 8px 20px;">
      <p style="margin:0 0 8px 0;font-size:11px;line-height:1.6;color:#6f86a8;text-align:center;">
        Offre réservée aux titulaires d’un compte, valable une seule fois par client sur une 1<sup>re</sup> commande. Tous les tickets sont gagnants, aucun achat n’est nécessaire pour gratter.
      </p>
      <p style="margin:0 0 8px 0;font-size:11px;line-height:1.6;color:#6f86a8;text-align:center;">
        ReparMonPhone — Les Saquèdes, 83120 Sainte-Maxime — <a href="tel:+33783497262" style="color:#8fa6c8;">07 83 49 72 62</a> — <a href="${siteUrl}" style="color:#8fa6c8;">reparmonphone.fr</a>
      </p>
      <p style="margin:0;font-size:11px;line-height:1.6;color:#6f86a8;text-align:center;">
        Tu reçois cet e-mail parce que tu as un compte sur reparmonphone.fr et que tu as accepté de recevoir nos offres.
        <a href="${unsubscribeUrl}" style="color:#8fa6c8;text-decoration:underline;">Se désinscrire</a> en un clic.
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    name ? `Salut ${name},` : 'Salut,',
    '',
    '🎟️ Un ticket à gratter t’attend : chaque ticket est gagnant !',
    `Gratte-le ici : ${ticketUrl}`,
    '',
    `Pièces détachées : ${shop}`,
    `Réparation sur rendez-vous : ${rdv}`,
    '',
    'Offre réservée aux titulaires d’un compte, valable une seule fois par client sur une 1re commande.',
    `Se désinscrire : ${unsubscribeUrl}`,
  ].join('\n');

  return { subject, html, text };
}

// Point d'entrée unique : ticket à gratter si un code promo est choisi, e-mail simple sinon
export function buildRelanceEmail(opts: Parameters<typeof buildTicketRelanceEmail>[0]) {
  return buildTicketRelanceEmail(opts);
}
