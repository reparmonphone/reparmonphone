// Diagnostic en lecture seule (aucune écriture) : Krys veut que /marque/outils n'affiche plus que 2
// grandes catégories ("Accessoires" et "Reprogrammation"), le reste (Colle, Désoxydation, Kit Outils,
// Machine, Ouverture, Pince, Programmation, Redressement, Soudure, Testeur, Tournevis) devenant des
// sous-catégories rangées dans l'une des deux — comme le fait déjà le menu déroulant "Outils" en haut
// du site (qui liste les MODÈLES de la gamme "Accessoires" et de la gamme "Reprogrammation", voir
// src/components/Header.tsx). Avant de coder cette réorganisation (même principe que le hub iPad, voir
// scripts/split-ipad-lines.js), ce script liste tout ce qui existe réellement en base sous la marque
// "Outils", pour être sûr des slugs exacts et ne rien deviner.
//
// Usage :
//   node scripts/diagnose-outils-lines.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const brand = await prisma.brand.findFirst({
    where: { OR: [{ slug: 'outils' }, { name: { startsWith: 'Autre', mode: 'insensitive' } }] },
  });
  if (!brand) {
    console.error('❌ Marque "Outils" introuvable (ni slug "outils", ni nom commençant par "Autre").');
    process.exit(1);
  }
  console.log(`Marque trouvée : "${brand.name}" (slug: "${brand.slug}", id: ${brand.id})\n`);

  const lines = await prisma.productLine.findMany({
    where: { brandId: brand.id },
    orderBy: { sortOrder: 'asc' },
    include: {
      models: {
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { products: true } } },
      },
    },
  });

  console.log(`${lines.length} gamme(s) sous "${brand.name}" :\n`);
  for (const l of lines) {
    const totalProducts = l.models.reduce((s, m) => s + m._count.products, 0);
    console.log(`sortOrder ${l.sortOrder} — "${l.name}" (slug: "${l.slug}", id: ${l.id}) — ${l.models.length} modèle(s), ${totalProducts} produit(s) au total`);
    for (const m of l.models) {
      console.log(`    · modèle "${m.name}" (slug: "${m.slug}") — ${m._count.products} produit(s)`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
