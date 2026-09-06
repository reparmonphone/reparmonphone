/**
 * Reclasse les produits de la gamme "Accessoires > Protection Écran" par FAMILLE D'APPAREIL
 * (iPhone, Samsung, Xiaomi, Huawei/Honor, iPad, Apple Watch, etc.) au lieu du découpage actuel
 * en seulement 2 modèles ("Films" et "Verre Trempé"), où "Verre Trempé" à lui seul contient 376
 * produits mélangés (iPhone, Samsung, Sony, Nokia, HTC...) sans aucun moyen de filtrer par appareil.
 *
 * Pourquoi par FAMILLE et non par modèle précis (ex: "iPhone 15 Pro Max") : beaucoup de titres
 * fournisseur couvrent plusieurs modèles à la fois (ex: "iPhone 13 / 13 Pro / 14 / 16e / 17e"), or
 * un produit ne peut avoir qu'un seul modèle rattaché sur le site. Choisir arbitrairement un seul
 * modèle parmi ceux cités ferait qu'un client cherchant "iPhone 17e" pourrait rater ce produit. La
 * famille (ex: "iPhone") reste, elle, toujours 100% exacte quel que soit le nombre de modèles cités.
 *
 * Méthode : chaque produit est classé par mot-clé trouvé dans son titre (voir FAMILY_RULES
 * ci-dessous, testées dans l'ordre, la première qui correspond gagne). Une famille trouvée dans
 * moins de MIN_FAMILY_COUNT produits est repliée dans "Autres marques" (même logique que pour la
 * création des gammes Accessoires — évite des entrées de menu avec 1 ou 2 produits seulement).
 * Les quelques articles qui ne sont pas des protections d'écran à proprement parler mais qui
 * traînaient dans cette catégorie fournisseur (spatule de pose, tapis silicone, outil Mijing...)
 * atterrissent aussi dans "Autres marques" faute de marque de téléphone détectée dans leur titre.
 *
 * Idempotent : peut être relancé sans risque (un produit déjà classé sera juste réaffecté au même
 * modèle). Les anciens modèles "Films" et "Verre Trempé" sont supprimés à la fin s'ils sont vides.
 *
 * MODE APERÇU (par défaut, aucune écriture) :
 *   node scripts/reclassify-protection-ecran-by-family.js
 *
 * MODE RÉEL :
 *   node scripts/reclassify-protection-ecran-by-family.js --apply
 */

const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const MIN_FAMILY_COUNT = 3;

// Testées dans l'ordre : la première expression régulière qui correspond dans le titre gagne.
const FAMILY_RULES = [
  [/iphone/i, 'iPhone'],
  [/ipad/i, 'iPad'],
  [/apple watch/i, 'Apple Watch'],
  [/samsung|galaxy/i, 'Samsung'],
  [/xiaomi|redmi|poco|\bmi \d|\bmi a\d/i, 'Xiaomi'],
  [/huawei|honor/i, 'Huawei / Honor'],
  [/google pixel|\bpixel \d/i, 'Google Pixel'],
  [/sony|xperia/i, 'Sony'],
  [/microsoft|surface/i, 'Microsoft Surface'],
  [/asus|zenfone/i, 'Asus'],
  [/nokia/i, 'Nokia'],
  [/htc/i, 'HTC'],
  [/wiko/i, 'Wiko'],
  [/alcatel/i, 'Alcatel'],
  [/\blg\b/i, 'LG'],
  [/blackberry/i, 'BlackBerry'],
  [/motorola|\bmoto /i, 'Motorola'],
  [/oneplus/i, 'OnePlus'],
  [/realme/i, 'RealMe'],
];

function classifyFamily(title) {
  for (const [re, name] of FAMILY_RULES) {
    if (re.test(title)) return name;
  }
  return 'Autres marques';
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

async function main() {
  console.log(APPLY ? 'MODE REEL - la base va etre modifiee.\n' : 'MODE APERCU - aucune ecriture ne sera faite.\n');

  const brand = await prisma.brand.findFirst({ where: { name: 'Accessoires' } });
  if (!brand) {
    console.error('Marque "Accessoires" introuvable — lance d\'abord create-accessoires-categories.js et import-accessoires-products.js.');
    process.exit(1);
  }

  const line = await prisma.productLine.findFirst({ where: { brandId: brand.id, slug: 'protection-ecran' } });
  if (!line) {
    console.error('Gamme "Protection Écran" introuvable sous "Accessoires".');
    process.exit(1);
  }

  const oldModels = await prisma.model.findMany({ where: { productLineId: line.id } });
  const oldModelIds = oldModels.map((m) => m.id);
  const products = await prisma.product.findMany({ where: { modelId: { in: oldModelIds } } });

  console.log(
    `${products.length} produit(s) trouvé(s) dans "Protection Écran" (actuellement répartis sur ${oldModels.length} modèle(s) : ${oldModels
      .map((m) => `"${m.name}"`)
      .join(', ')}).\n`
  );

  const familyMap = new Map(); // nom famille -> { count, productIds: [] }
  for (const p of products) {
    const fam = classifyFamily(p.title);
    if (!familyMap.has(fam)) familyMap.set(fam, { count: 0, productIds: [] });
    const entry = familyMap.get(fam);
    entry.count++;
    entry.productIds.push(p.id);
  }

  // Repli des familles trop petites dans "Autres marques"
  if (!familyMap.has('Autres marques')) familyMap.set('Autres marques', { count: 0, productIds: [] });
  const autresEntry = familyMap.get('Autres marques');
  for (const [fam, entry] of [...familyMap.entries()]) {
    if (fam === 'Autres marques' || entry.count >= MIN_FAMILY_COUNT) continue;
    autresEntry.count += entry.count;
    autresEntry.productIds.push(...entry.productIds);
    familyMap.delete(fam);
  }

  const sortedFamilies = [...familyMap.entries()].sort((a, b) => b[1].count - a[1].count);

  console.log('--- Aperçu du reclassement ---\n');
  for (const [fam, entry] of sortedFamilies) {
    console.log(`"${fam}" : ${entry.count} produit(s)`);
  }

  if (!APPLY) {
    console.log('\nAperçu uniquement — relance avec --apply pour appliquer réellement ce reclassement.');
    await prisma.$disconnect();
    return;
  }

  console.log('');
  let sortOrder = 0;
  for (const [fam, entry] of sortedFamilies) {
    const famSlug = slugify(fam);
    let model = await prisma.model.findFirst({ where: { productLineId: line.id, slug: famSlug } });
    if (!model) {
      model = await prisma.model.create({ data: { name: fam, slug: famSlug, productLineId: line.id, sortOrder } });
      console.log(`✅ Modèle créé : "${fam}"`);
    } else {
      console.log(`ℹ️  Modèle "${fam}" déjà existant — réutilisé.`);
    }
    sortOrder++;
    await prisma.product.updateMany({ where: { id: { in: entry.productIds } }, data: { modelId: model.id } });
    console.log(`   → ${entry.productIds.length} produit(s) réaffecté(s) à "${fam}".`);
  }

  console.log('');
  for (const old of oldModels) {
    const remaining = await prisma.product.count({ where: { modelId: old.id } });
    if (remaining === 0) {
      await prisma.model.delete({ where: { id: old.id } });
      console.log(`🗑️  Ancien modèle "${old.name}" supprimé (vide).`);
    } else {
      console.log(`⚠️  Ancien modèle "${old.name}" conservé (encore ${remaining} produit(s) dedans — cas inattendu, à vérifier).`);
    }
  }

  console.log('\nTerminé.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
