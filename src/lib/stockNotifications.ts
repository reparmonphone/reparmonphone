import { prisma } from '@/lib/prisma';
import { getResendClient } from '@/lib/resend';

const FROM = process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

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

// À appeler juste après avoir repassé un produit "en stock" (que ce soit depuis le bouton rapide de
// la liste admin ou depuis la fiche complète) — voir les deux appels dans
// src/app/admin/(dashboard)/produits/actions.ts. Envoie un email à chaque client inscrit sur
// "Alerte Stock" pour ce produit et pas encore notifié, puis marque son inscription comme traitée
// (un seul email par inscription, jamais deux, même si le stock oscille ensuite).
export async function notifyBackInStock(productId: string) {
  const resend = getResendClient();
  if (!resend) return;

  const [product, notifications] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: { title: true, slug: true, imageUrl: true },
    }),
    prisma.stockNotification.findMany({ where: { productId, notifiedAt: null } }),
  ]);
  if (!product || notifications.length === 0) return;

  const link = `${SITE_URL}/produit/${product.slug}`;

  for (const n of notifications) {
    try {
      await resend.emails.send({
        from: FROM,
        to: n.email,
        subject: `🔔 ${product.title} est de nouveau disponible !`,
        html: emailWrapper(
          '#16a34a',
          'De retour en stock ! 🎉',
          product.title,
          `
            <p style="color:#374151; font-size: 14px; line-height: 1.6;">
              Bonne nouvelle : le produit que vous attendiez vient de redevenir disponible sur ReparMonPhone.
            </p>
            ${
              product.imageUrl
                ? `<div style="text-align:center; margin: 16px 0;"><img src="${product.imageUrl}" alt="" style="max-width:160px; max-height:160px;" /></div>`
                : ''
            }
            <div style="text-align:center; margin-top: 12px;">
              <a href="${link}" style="display:inline-block; background:#16a34a; color:#fff; text-decoration:none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Voir le produit</a>
            </div>
          `
        ),
      });
    } catch (e) {
      console.error(`Erreur envoi email retour en stock (${n.email})`, e);
    }
  }

  await prisma.stockNotification.updateMany({
    where: { id: { in: notifications.map((n) => n.id) } },
    data: { notifiedAt: new Date() },
  });
}
