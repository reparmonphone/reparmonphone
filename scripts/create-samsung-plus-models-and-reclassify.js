// Crée les fiches Modèle manquantes pour les variantes "+" de Galaxy S (S8+, S9+, S10+, S20+,
// S22+, S23+, S25+, S26+, S6 Edge+) — confirmées absentes du catalogue par le diagnostic du
// 31/08/2026 — avec leur photo (déjà présente sur le disque), puis déplace vers ces nouvelles
// fiches les produits actuellement mal rangés sous le modèle de base dont le titre désigne
// CLAIREMENT la variante Plus (contient son code référence, ex: S916B pour S23+) SANS mentionner
// le code du modèle de base. Les produits compatibles avec les DEUX modèles (le titre contient
// les deux codes, ex: "S22 (S901B) / S22+ (S906B)") restent où ils sont pour ne rien casser.
//
// ATTENTION : contrairement au script d'import de photos, celui-ci ÉCRIT dans le catalogue
// (création de modèles + déplacement de produits). Lance TOUJOURS --dry-run d'abord.
//
// Usage :
//   node scripts/create-samsung-plus-models-and-reclassify.js --dry-run
//   node scripts/create-samsung-plus-models-and-reclassify.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const IMAGES_DIR = 'C:\\Users\\Pc-Krys\\Pictures\\00 ReparMonPhone\\Samsung\\GALAXY S\\images';
const BUCKET = process.env.SUPABASE_BUCKET || 'products';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function normalize(raw) {
  return raw
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\+/g, '+')
    .toUpperCase();
}

function stripGeneration(s) {
  return s.replace(/\b(4G|5G)\b/gi, '').replace(/\s+/g, ' ').trim();
}

function baseNamesMatch(a, b) {
  return a === b || (stripGeneration(a) === stripGeneration(b) && stripGeneration(a).length > 0);
}

function guessContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
  return map[ext] || 'application/octet-stream';
}

// Codes référence confirmés par le diagnostic du 31/08/2026 (présents dans les vrais titres
// produits de ce catalogue) pour chaque variante Plus, + le nom du dossier photo local.
const VARIANTS = [
  { label: 'S8+', base: 'S8', codes: ['G955F'], dossier: 'S8+' },
  { label: 'S9+', base: 'S9', codes: ['G965F'], dossier: 'S9+' },
  { label: 'S10+', base: 'S10', codes: ['G975F'], dossier: 'S10 +' },
  { label: 'S20+', base: 'S20', codes: ['G985F', 'G986B', 'G986F', 'G986U', 'G986N'], dossier: 'S20+' },
  { label: 'S22+', base: 'S22', codes: ['S906B', 'S906U'], dossier: 'S22+' },
  { label: 'S23+', base: 'S23', codes: ['S916B', 'S916U'], dossier: 'S23+' },
  { label: 'S25+', base: 'S25', codes: ['S936B', 'S936U'], dossier: 'S25+' },
  { label: 'S26+', base: 'S26', codes: ['S947B'], dossier: 'S26+' },
  { label: 'S6 Edge+', base: 'S6 Edge', codes: ['G928F'], dossier: 'S6 Edge +' },
];

function extractCodes(modelName) {
  const m = modelName.match(/\(([^)]+)\)\s*$/);
  if (!m) return [];
  return m[1].split('/').map((s) => s.trim().toUpperCase()).filter(Boolean);
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env.migration');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const brand = await prisma.brand.findFirst({ where: { slug: 'samsung' } });
  if (!brand) throw new Error('Marque "samsung" introuvable.');
  const line = await prisma.productLine.findFirst({ where: { brandId: brand.id, slug: 'galaxy-s' } });
  if (!line) throw new Error('Gamme "galaxy-s" introuvable.');

  const models = await prisma.model.findMany({ where: { productLineId: line.id }, include: { products: true } });

  console.log(DRY_RUN ? '--- MODE DRY-RUN (aucune écriture) ---\n' : '--- EXÉCUTION RÉELLE ---\n');

  let modelsCreated = 0;
  let productsMoved = 0;

  for (const variant of VARIANTS) {
    console.log(`\n=== ${variant.label} ===`);

    const baseModel = models.find((m) => baseNamesMatch(normalize(m.name), normalize(variant.base)));
    if (!baseModel) {
      console.log(`  Modèle de base "${variant.base}" introuvable — variante ignorée.`);
      continue;
    }
    const baseCodes = extractCodes(baseModel.name);

    // Produits du modèle de base dont le titre mentionne un code de la variante Plus
    // SANS mentionner un code du modèle de base (= pièce spécifique à la variante Plus).
    const toMove = baseModel.products.filter((p) => {
      const t = p.title.toUpperCase();
      const mentionsPlusCode = variant.codes.some((c) => t.includes(c));
      const mentionsBaseCode = baseCodes.some((c) => t.includes(c));
      return mentionsPlusCode && !mentionsBaseCode;
    });

    console.log(`  Base "${baseModel.name}" : ${toMove.length} produit(s) spécifique(s) à déplacer (sur ${baseModel.products.length} au total).`);
    if (toMove.length === 0) {
      console.log(`  Rien à déplacer — pas de fiche créée pour éviter une catégorie vide.`);
      continue;
    }

    // Codes réellement rencontrés dans les produits à déplacer -> nom du nouveau modèle
    const foundCodes = new Set();
    toMove.forEach((p) => {
      const t = p.title.toUpperCase();
      variant.codes.forEach((c) => { if (t.includes(c)) foundCodes.add(c); });
    });
    const modelName = `${variant.label} (${[...foundCodes].join(' / ')})`;
    const modelSlug = `${slugify(variant.base)}-plus`;

    console.log(`  -> Nouvelle fiche : "${modelName}" (slug: ${modelSlug})`);
    toMove.forEach((p) => console.log(`       - ${p.title}`));

    if (DRY_RUN) continue;

    // Évite un conflit si une fiche avec ce slug existe déjà (relance du script)
    let newModel = await prisma.model.findUnique({ where: { productLineId_slug: { productLineId: line.id, slug: modelSlug } } });

    if (!newModel) {
      let imageUrl = null;
      const imagePath = path.join(IMAGES_DIR, variant.dossier, `${variant.dossier}.jpg`);
      if (fs.existsSync(imagePath)) {
        const buffer = fs.readFileSync(imagePath);
        const ext = path.extname(imagePath).slice(1) || 'jpg';
        const storagePath = `categories/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
          contentType: guessContentType(imagePath),
          upsert: false,
        });
        if (uploadError) {
          console.log(`  [ERREUR UPLOAD PHOTO] ${uploadError.message}`);
        } else {
          const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
          imageUrl = data.publicUrl;
        }
      } else {
        console.log(`  [PHOTO INTROUVABLE] ${imagePath}`);
      }

      newModel = await prisma.model.create({
        data: { name: modelName, slug: modelSlug, productLineId: line.id, imageUrl },
      });
      modelsCreated++;
      console.log(`  ✅ Fiche créée (id ${newModel.id})`);
    } else {
      console.log(`  Fiche déjà existante (id ${newModel.id}) — réutilisée.`);
    }

    for (const p of toMove) {
      await prisma.product.update({ where: { id: p.id }, data: { modelId: newModel.id } });
      productsMoved++;
    }
    console.log(`  ✅ ${toMove.length} produit(s) déplacé(s).`);
  }

  console.log('\n--- RÉSUMÉ ---');
  if (DRY_RUN) {
    console.log('Relance sans --dry-run pour créer les fiches et déplacer réellement les produits listés ci-dessus.');
  } else {
    console.log(`Fiches modèle créées : ${modelsCreated}`);
    console.log(`Produits déplacés : ${productsMoved}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
