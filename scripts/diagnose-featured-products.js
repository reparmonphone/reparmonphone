// Diagnostic en lecture seule (aucune écriture) : Krys a fait remonter un retour d'audit disant que
// le bloc "TOP Produits" / "Vedette" de la home est un tirage aléatoire dans tout le catalogue —
// remontant parfois des pièces à 0,36€ pour iPhone 5/5C/5S — plutôt qu'une vraie sélection de
// produits qui "font 2026" (écrans iPhone 13/14/15, batteries récentes, Galaxy A/S récents,
// connecteurs de charge). Avant de coder cette sélection "vedette" dans TopProduitsSection.tsx, ce
// script vérifie combien de produits en stock existent réellement pour chaque règle envisagée — pour
// ne pas se retrouver avec un bloc vide si un nom de modèle ne correspond pas exactement en base.
//
// Usage :
//   node scripts/diagnose-featured-products.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_WHERE = { inStock: true, showInBoutique: true, price: { gt: 0 } };

const RULES = [
  { label: 'Écran iPhone 15', modelContains: 'iPhone 15', pieceType: 'ECRAN' },
  { label: 'Batterie iPhone 14 Pro', modelContains: 'iPhone 14 Pro', pieceType: 'BATTERIE' },
  { label: 'Écran iPhone 13', modelContains: 'iPhone 13', pieceType: 'ECRAN' },
  { label: 'Écran iPhone 14', modelContains: 'iPhone 14', pieceType: 'ECRAN' },
  { label: 'Batterie iPhone 11', modelContains: 'iPhone 11', pieceType: 'BATTERIE' },
  { label: 'Batterie iPhone 12', modelContains: 'iPhone 12', pieceType: 'BATTERIE' },
  { label: 'Batterie iPhone 13', modelContains: 'iPhone 13', pieceType: 'BATTERIE' },
  { label: 'Galaxy A15', modelContains: 'A15', pieceType: null },
  { label: 'Galaxy A16', modelContains: 'A16', pieceType: null },
  { label: 'Galaxy A25', modelContains: 'A25', pieceType: null },
  { label: 'Galaxy A26', modelContains: 'A26', pieceType: null },
  { label: 'Galaxy A35', modelContains: 'A35', pieceType: null },
  { label: 'Galaxy A55', modelContains: 'A55', pieceType: null },
  { label: 'Galaxy S22', modelContains: 'S22', pieceType: null },
  { label: 'Galaxy S23', modelContains: 'S23', pieceType: null },
  { label: 'Galaxy S24', modelContains: 'S24', pieceType: null },
  { label: 'Connecteurs de charge (tous modèles)', modelContains: null, pieceType: 'NAPPE_CONNECTEUR' },
];

async function main() {
  console.log('Comptage des produits en stock correspondant à chaque règle envisagée :\n');
  for (const rule of RULES) {
    const where = { ...BASE_WHERE };
    if (rule.modelContains) where.model = { name: { contains: rule.modelContains, mode: 'insensitive' } };
    if (rule.pieceType) where.pieceType = rule.pieceType;
    const count = await prisma.product.count({ where });
    console.log(`${count.toString().padStart(4)} produit(s) — ${rule.label}`);
  }

  console.log('\nQuelques exemples de noms de modèles en base contenant "iPhone 1" ou "Galaxy A"/"Galaxy S" (pour vérifier la convention de nommage exacte) :');
  const sampleModels = await prisma.model.findMany({
    where: { OR: [{ name: { contains: 'iPhone 1', mode: 'insensitive' } }, { name: { contains: 'Galaxy A', mode: 'insensitive' } }, { name: { contains: 'Galaxy S', mode: 'insensitive' } }] },
    select: { name: true },
    distinct: ['name'],
    take: 40,
  });
  for (const m of sampleModels) console.log(`  · ${m.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
