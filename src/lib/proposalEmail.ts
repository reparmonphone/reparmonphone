import { SITE_URL, itemsTotal, laborTotal, proposalTotal, proposalUrl, type Proposal } from '@/lib/proposalShared';

// E-mail « Votre proposition » — fonction pure (pas d'accès base). HTML e-mail : tableaux + styles en ligne.

const BRAND = '#0E7FDB';
const BRAND_DARK = '#0B5FA5';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
const dateFr = (ymd: string) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : '');

export function buildProposalEmail(p: Proposal): { subject: string; html: string; text: string } {
  const url = proposalUrl(p.token);
  const total = proposalTotal(p);
  const hello = p.customerName ? `Bonjour ${esc(p.customerName)},` : 'Bonjour,';
  const subject = `Votre proposition ReparMonPhone : ${eur(total)}`;
  const preheader = `Le détail de votre proposition, valable jusqu'au ${dateFr(p.validUntil)}.`;
  const hasLabor = p.labor.length > 0;
  const hasItems = p.items.length > 0;

  const row = (label: string, qty: string, amount: string, bold = false) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eef0f3;font-size:14px;color:#111827;${bold ? 'font-weight:700;' : ''}">${label}</td>
      <td style="padding:8px 8px;border-bottom:1px solid #eef0f3;font-size:13px;color:#6b7280;text-align:center;white-space:nowrap;">${qty}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eef0f3;font-size:14px;color:#111827;text-align:right;white-space:nowrap;${bold ? 'font-weight:700;' : ''}">${amount}</td>
    </tr>`;

  const itemRows = p.items
    .map((i) => row(esc(i.title), `× ${i.quantity}`, eur(i.price * i.quantity)))
    .join('');
  const laborRows = p.labor.map((l) => row(esc(l.label), '', eur(l.price))).join('');
  const msg = p.message
    ? `<tr><td style="padding:0 32px 16px 32px;"><div style="background:#f3f8fd;border-left:4px solid ${BRAND};padding:12px 14px;border-radius:6px;font-size:14px;line-height:1.6;color:#1f2937;">${esc(p.message).replace(/\n/g, '<br>')}</div></td></tr>`
    : '';

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr><td align="center" style="background:#091a32;padding:20px 32px 16px 32px;">
    <a href="${SITE_URL}" style="text-decoration:none;">
      <img src="${SITE_URL}/email/logo-anim.gif" width="150" alt="ReparMonPhone · Pièces détachées &amp; accessoires" style="display:block;margin:0 auto;width:150px;max-width:100%;height:auto;border:0;border-radius:14px;font-size:20px;font-weight:800;color:#7fb5ff;text-align:center;">
    </a>
  </td></tr>
  <tr><td style="background:${BRAND};padding:18px 32px;color:#ffffff;text-align:center;">
    <div style="font-size:22px;font-weight:700;">Votre proposition</div>
  </td></tr>
  <tr><td style="padding:24px 32px 8px 32px;font-size:14px;line-height:1.6;color:#374151;">
    ${hello}<br>Voici la proposition que nous vous avons préparée. Elle est valable jusqu'au <strong>${dateFr(p.validUntil)}</strong>.
  </td></tr>
  ${msg}
  <tr><td style="padding:8px 32px 0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${hasItems ? `<tr><td colspan="3" style="padding:8px 0 4px 0;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;">Pièces</td></tr>${itemRows}` : ''}
      ${hasLabor ? `<tr><td colspan="3" style="padding:14px 0 4px 0;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;">Main d'œuvre</td></tr>${laborRows}` : ''}
      <tr>
        <td style="padding:14px 0 0 0;font-size:16px;font-weight:700;color:#111827;">Total TTC</td>
        <td></td>
        <td style="padding:14px 0 0 0;font-size:18px;font-weight:700;color:${BRAND_DARK};text-align:right;white-space:nowrap;">${eur(total)}</td>
      </tr>
      ${hasItems && hasLabor ? `<tr><td colspan="3" style="padding-top:4px;font-size:12px;color:#6b7280;">dont pièces ${eur(itemsTotal(p.items))} et main d'œuvre ${eur(laborTotal(p.labor))}</td></tr>` : ''}
    </table>
  </td></tr>
  <tr><td align="center" style="padding:24px 32px 8px 32px;">
    <a href="${url}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Voir ma proposition${hasItems ? ' et commander' : ''}</a>
  </td></tr>
  <tr><td style="padding:12px 32px 24px 32px;font-size:12px;line-height:1.6;color:#6b7280;">
    ${hasItems ? 'Les frais de port sont calculés dans le panier. ' : ''}${hasLabor ? 'La main d\'œuvre se règle lors de la réparation. ' : ''}Les prix sont indiqués TTC. Une question ? Répondez simplement à ce message.
  </td></tr>
  <tr><td style="background:#f9fafb;padding:16px 32px;font-size:12px;color:#6b7280;text-align:center;">
    ReparMonPhone · Sainte-Maxime (Golfe de Saint-Tropez)<br>reparmonphone.fr
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  const lines = [
    p.customerName ? `Bonjour ${p.customerName},` : 'Bonjour,',
    '',
    `Voici la proposition que nous vous avons préparée, valable jusqu'au ${dateFr(p.validUntil)}.`,
    '',
    ...(p.message ? [p.message, ''] : []),
    ...p.items.map((i) => `- ${i.title} × ${i.quantity} : ${eur(i.price * i.quantity)}`),
    ...p.labor.map((l) => `- Main d'œuvre, ${l.label} : ${eur(l.price)}`),
    '',
    `Total TTC : ${eur(total)}`,
    '',
    `Voir la proposition${hasItems ? ' et commander' : ''} : ${url}`,
    '',
    'ReparMonPhone · reparmonphone.fr',
  ];
  return { subject, html, text: lines.join('\n') };
}
