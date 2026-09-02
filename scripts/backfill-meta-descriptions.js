// Génère automatiquement la "meta description" SEO (celle qui apparaît sous le lien dans Google) de
// tous les produits qui n'en ont pas encore — typiquement les produits ajoutés récemment. Utilise
// exactement la même logique que le bouton "✨ Générer automatiquement" de la fiche produit dans
// /admin/produits/[id] (voir src/lib/seoDescription.ts) : script en JS pur (Node ne sait pas
// importer directement un fichier .ts), donc dupliqué ici — si tu changes un jour le texte généré
// dans seoDescription.ts, pense à refaire le même changement ici.
//
// Sont considérés "à générer" : metaDescription vide/null, OU contenant encore le texte provisoire
// laissé par un import fournisseur ("texte source fournisseur, a reformuler").
//
// Usage :
//   node scripts/backfill-meta-descriptions.js            (aperçu, aucune écriture)
//   node scripts/backfill-meta-descriptions.js --apply     (applique réellement les changements)

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

const PIECE_TYPE_LABELS = {
  ECRAN: 'écran',
  BATTERIE: 'batterie',
  NAPPE_CONNECTEUR: 'nappe / connecteur de charge',
  CAMERA: 'caméra',
  VITRE_ARRIERE: 'vitre arrière',
  CHASSIS: 'châssis',
  HAUT_PARLEUR: 'haut-parleur',
  VIBREUR: 'vibreur',
  BOUTON: 'bouton',
  OUTILLAGE: 'outil de réparation',
  ACCESSOIRE: 'accessoire',
  AUTRE: 'pièce détachée',
};

const DELIVERY_LINE = 'Livraison Chronopost 24h en France métropolitaine';

function mentionsDelivery(text) {
  return /livraison|chronopost|24\s*h\b|24h/i.test(text);
}

function withDeliveryMention(text, maxLength = 160) {
  const trimmed = text.trim();
  const withDelivery = mentionsDelivery(trimmed) ? trimmed : `${trimmed} ${DELIVERY_LINE}.`;
  if (withDelivery.length <= maxLength) return withDelivery;
  const budget = maxLength - DELIVERY_LINE.length - 2;
  const shortened = trimmed.length > budget ? `${trimmed.slice(0, Math.max(0, budget - 1)).trim()}…` : trimmed;
  return mentionsDelivery(shortened) ? shortened : `${shortened} ${DELIVERY_LINE}.`;
}

function generateMetaDescription({ title, brandName, modelName, condition, quality, price, pieceLabel }) {
  const qualifiers = [quality, condition].filter((v) => !!v && v.trim() !== '');
  const qualifierText = qualifiers.length ? ` (${qualifiers.join(', ')})` : '';

  const subject = pieceLabel
    ? `${pieceLabel.charAt(0).toUpperCase()}${pieceLabel.slice(1)}${qualifierText}`
    : `${title}${qualifierText}`;

  const target = [brandName, modelName].filter((v) => v && v.trim() !== '').join(' ');
  const forText = target ? ` pour ${target}` : '';

  const priceText = typeof price === 'number' && price > 0 ? ` À partir de ${price.toFixed(2).replace('.', ',')} €.` : '';

  const base = `${subject}${forText}.${priceText}`.replace(/\s+/g, ' ').trim();
  return withDeliveryMention(base);
}

async function main() {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { metaDescription: null },
        { metaDescription: '' },
        { metaDescription: { contains: 'texte source fournisseur' } },
      ],
    },
    select: {
      id: true,
      title: true,
      price: true,
      condition: true,
      quality: true,
      pieceType: true,
      model: { select: { name: true, productLine: { select: { brand: { select: { name: true } } } } } },
    },
  });

  console.log(`${products.length} produit(s) sans meta description (ou avec un texte provisoire à remplacer).\n`);

  let done = 0;
  for (const p of products) {
    const metaDescription = generateMetaDescription({
      title: p.title,
      brandName: p.model.productLine.brand.name,
      modelName: p.model.name,
      condition: p.condition,
      quality: p.quality,
      price: Number(p.price),
      pieceLabel: PIECE_TYPE_LABELS[p.pieceType] ?? null,
    });

    if (done < 10) {
      console.log(`"${p.title}"`);
      console.log(`  → ${metaDescription}\n`);
    }

    if (APPLY) {
      await prisma.product.update({ where: { id: p.id }, data: { metaDescription } });
    }
    done += 1;
  }

  if (products.length > 10) console.log(`… et ${products.length - 10} autre(s).\n`);

  if (!APPLY) {
    console.log('Aperçu uniquement — relance avec --apply pour enregistrer ces meta descriptions.');
  } else {
    console.log(`✅ ${done} meta description(s) générée(s) et enregistrée(s).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
