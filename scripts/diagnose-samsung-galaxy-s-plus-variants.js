// Diagnostic (LECTURE SEULE — aucune écriture) : pour les variantes "+" de la gamme Galaxy S
// qui n'ont AUCUNE fiche Model en base (S8+, S9+, S10+, S20+, S22+, S23+, S25+, S26+, S6 Edge+,
// et S24 tout court), on vérifie si des produits (écrans, batteries...) censés être pour ces
// variantes existent déjà mais ont été rangés par erreur sous le modèle de base
// (ex: des pièces "S22+" mélangées dans le modèle "S22").
//
// Deux méthodes de recherche, combinées :
//   1. Le titre du produit contient "+" ou "Plus" à proximité du nom du modèle de base.
//   2. Le titre du produit contient le code référence connu de la variante Plus (ex: S906B
//      pour S22+, G975F pour S10+ — codes retrouvés dans mapping.csv). Ce code est différent
//      de celui du modèle de base, donc un match ici est un signal fort de mauvais classement.
//
// Usage : node scripts/diagnose-samsung-galaxy-s-plus-variants.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// dossier_local du mapping -> { baseModelName, plusCode }
// baseModelName = nom (normalisé, sans code) du modèle de base sous lequel des pièces
// mal classées seraient probablement rangées aujourd'hui.
const VARIANTS = [
  { plus: 'S26+', base: 'S26', code: null },
  { plus: 'S25+', base: 'S25', code: null },
  { plus: 'S24', base: null, code: null }, // pas une variante "+", juste absente elle-même
  { plus: 'S23+', base: 'S23', code: 'S916B' },
  { plus: 'S22+', base: 'S22', code: 'S906B' },
  { plus: 'S20+', base: 'S20', code: 'G986' },
  { plus: 'S10+', base: 'S10', code: 'G975F' },
  { plus: 'S9+', base: 'S9', code: 'G965F' },
  { plus: 'S8+', base: 'S8', code: 'G955' },
  { plus: 'S6 Edge+', base: 'S6 Edge', code: 'G928' },
];

function normalize(raw) {
  return raw
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\+/g, '+')
    .toUpperCase();
}

async function main() {
  const brand = await prisma.brand.findFirst({ where: { slug: 'samsung' } });
  if (!brand) throw new Error('Marque "samsung" introuvable.');
  const line = await prisma.productLine.findFirst({ where: { brandId: brand.id, slug: 'galaxy-s' } });
  if (!line) throw new Error('Gamme "galaxy-s" introuvable.');

  const models = await prisma.model.findMany({ where: { productLineId: line.id }, include: { products: true } });

  console.log(`--- DIAGNOSTIC (lecture seule, rien n'est modifié) ---\n`);

  for (const variant of VARIANTS) {
    console.log(`\n=== ${variant.plus} ===`);

    if (!variant.base) {
      console.log(`  Pas de modèle de base à vérifier pour "${variant.plus}" (c'est le modèle lui-même qui manque).`);
      continue;
    }

    const baseModel = models.find((m) => normalize(m.name) === normalize(variant.base));
    if (!baseModel) {
      console.log(`  Modèle de base "${variant.base}" introuvable dans Galaxy S — rien à vérifier.`);
      continue;
    }

    console.log(`  Modèle de base "${baseModel.name}" : ${baseModel.products.length} produit(s) au total.`);

    const suspects = baseModel.products.filter((p) => {
      const t = p.title.toUpperCase();
      const mentionsPlus = /\+|PLUS\b/.test(t) && t.includes(normalize(variant.base).replace('+', ''));
      const mentionsCode = variant.code && t.includes(variant.code);
      return mentionsPlus || mentionsCode;
    });

    if (suspects.length === 0) {
      console.log(`  Aucun produit suspect trouvé — probablement aucune pièce "${variant.plus}" au catalogue pour l'instant.`);
    } else {
      console.log(`  ⚠️  ${suspects.length} produit(s) SOUS "${baseModel.name}" qui pourrai(en)t en fait être pour "${variant.plus}" :`);
      suspects.forEach((p) => console.log(`      - [${p.id}] ${p.title}`));
    }
  }

  console.log(`\n--- FIN DU DIAGNOSTIC ---`);
  console.log(`Aucune donnée n'a été modifiée. Envoie-moi ce résultat pour qu'on décide de la suite.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
