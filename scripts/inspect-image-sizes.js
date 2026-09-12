// Diagnostic en lecture seule : pour comprendre le "LCP à 7,1s" et les "3,3 Mo d'économie possible sur
// les images" remontés par PageSpeed Insights, ce script va chercher le poids réel (en Ko) d'un
// échantillon de photos produits directement sur leur URL d'hébergement (Supabase Storage / ancien
// WordPress), sans rien télécharger ni modifier.
//
// Contexte trouvé dans next.config.mjs : l'optimisation d'image automatique de Next.js/Vercel est
// désactivée (`images.unoptimized: true`), pour éviter de dépasser le quota de 5000 transformations/mois
// du plan Hobby. Résultat : chaque photo est servie TELLE QUELLE, à sa taille et son format d'origine,
// même quand elle s'affiche dans une vignette de 220px sur la boutique. Ce script vérifie si c'est bien
// la cause du problème en mesurant le poids réel des fichiers.
//
// Usage :
//   node scripts/inspect-image-sizes.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SAMPLE_SIZE = 25;

async function headInfo(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const len = res.headers.get('content-length');
    const type = res.headers.get('content-type');
    return { ok: res.ok, status: res.status, bytes: len ? parseInt(len, 10) : null, type };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function main() {
  // Échantillon large et varié : on prend des produits ECRAN (les plus consultés) en priorité, avec un
  // peu de tout le reste pour comparer.
  const ecranSample = await prisma.product.findMany({
    where: { pieceType: 'ECRAN', imageUrl: { not: null } },
    select: { title: true, slug: true, imageUrl: true },
    take: SAMPLE_SIZE,
    orderBy: { updatedAt: 'desc' },
  });
  const otherSample = await prisma.product.findMany({
    where: { pieceType: { not: 'ECRAN' }, imageUrl: { not: null } },
    select: { title: true, slug: true, imageUrl: true },
    take: 10,
    orderBy: { updatedAt: 'desc' },
  });

  console.log(`Vérification du poids réel de ${ecranSample.length} images ECRAN + ${otherSample.length} autres...\n`);

  const results = [];
  for (const p of [...ecranSample, ...otherSample]) {
    const info = await headInfo(p.imageUrl);
    results.push({ p, info });
    const sizeStr = info.bytes ? `${(info.bytes / 1024).toFixed(0)} Ko` : '(taille inconnue)';
    console.log(`${info.ok ? '✓' : '✗'} ${sizeStr.padStart(10)}  [${info.type || '?'}]  ${p.title.slice(0, 60)}`);
  }

  const withSize = results.filter((r) => r.info.bytes);
  if (withSize.length > 0) {
    const totalKo = withSize.reduce((s, r) => s + r.info.bytes, 0) / 1024;
    const avgKo = totalKo / withSize.length;
    const over500Ko = withSize.filter((r) => r.info.bytes > 500 * 1024).length;
    const formats = new Map();
    for (const r of withSize) formats.set(r.info.type, (formats.get(r.info.type) || 0) + 1);

    console.log(`\n========== Résumé (${withSize.length} images mesurées) ==========`);
    console.log(`Poids moyen par image : ${avgKo.toFixed(0)} Ko`);
    console.log(`Images de plus de 500 Ko : ${over500Ko} / ${withSize.length}`);
    console.log(`Formats rencontrés : ${[...formats.entries()].map(([t, c]) => `${t} (${c})`).join(', ')}`);
    console.log(`\nPour référence : une vignette de 220px de large n'a normalement besoin que de 15 à 40 Ko`);
    console.log(`environ en JPEG/WebP bien compressé. Un écran principal de fiche produit (~600px) : 40 à 100 Ko.`);
  }

  const failed = results.filter((r) => !r.info.ok);
  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} image(s) n'ont pas pu être vérifiées (URL inaccessible ou erreur réseau) :`);
    for (const r of failed.slice(0, 5)) console.log(`  ${r.p.title} : ${r.p.imageUrl} (${r.info.error || r.info.status})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
