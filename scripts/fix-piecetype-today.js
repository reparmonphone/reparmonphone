/**
 * Reclasse le type de pièce (pieceType) des produits créés aujourd'hui qui sont restés en "AUTRE"
 * alors que leur titre indique clairement un écran, une nappe, une batterie, une caméra, etc.
 * (cas typique : les 10 produits de l'échantillon importés avec l'ancien script, qui mettait tout en AUTRE).
 *
 * Même logique de détection que scripts/import-supplier-absents.js. Ne touche QUE les produits
 * "AUTRE" créés depuis la date donnée, et seulement si une règle claire s'applique.
 * Les tiroirs SIM, câbles, etc. n'ont pas de type dédié : ils restent en "AUTRE".
 *
 * Usage :
 *   node scripts/fix-piecetype-today.js                      (aperçu, rien n'est écrit)
 *   node scripts/fix-piecetype-today.js --apply              (applique)
 *   node scripts/fix-piecetype-today.js --since 2026-10-04   (autre date de départ)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.migration') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const argv = process.argv;
const APPLY = argv.includes('--apply');
const sinceArg = argv.includes('--since') ? argv[argv.indexOf('--since') + 1] : null;
const since = sinceArg ? new Date(`${sinceArg}T00:00:00`) : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

function guessPieceType(titre) {
  const t = titre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/(nappe (de )?test|testeur|rebillage|reprogrammation|station|soudure|fer a souder|tournevis|\bpince\b|ventouse|outillage|\boutil\b)/.test(t)) return 'OUTILLAGE';
  if (/\b(vitre arriere|cache batterie|coque arriere)\b/.test(t)) return 'VITRE_ARRIERE';
  if (/(protection|verre\s*tremp|\bfilm\b|housse|\bcoque|adhesif|stylet)/.test(t)) return 'ACCESSOIRE';
  if (/\b(ecran|afficheur|lcd)\b/.test(t)) return 'ECRAN';
  if (/\bbatterie\b/.test(t)) return 'BATTERIE';
  if (/\bcamera\b/.test(t)) return 'CAMERA';
  if (/\b(nappe|connecteur)\b/.test(t)) return 'NAPPE_CONNECTEUR';
  if (/\bchassis\b/.test(t)) return 'CHASSIS';
  if (/\b(haut parleur|haut-parleur|parleur|ecouteur)\b/.test(t)) return 'HAUT_PARLEUR';
  if (/\bvibreur\b/.test(t)) return 'VIBREUR';
  if (/\bbouton\b/.test(t)) return 'BOUTON';
  return 'AUTRE';
}

async function main() {
  console.log(APPLY ? 'MODE RÉEL — la base va être modifiée.\n' : 'MODE APERÇU — rien ne sera écrit.\n');
  const rows = await prisma.product.findMany({
    where: { pieceType: 'AUTRE', createdAt: { gte: since } },
    select: { id: true, title: true },
  });
  console.log(`${rows.length} produit(s) en "AUTRE" créés depuis le ${since.toLocaleDateString('fr-FR')}.`);

  const toFix = [];
  const stay = [];
  for (const r of rows) {
    const g = guessPieceType(r.title);
    if (g === 'AUTRE') stay.push(r); else toFix.push({ ...r, to: g });
  }

  const byType = new Map();
  toFix.forEach((r) => byType.set(r.to, (byType.get(r.to) || 0) + 1));
  console.log(`\n${toFix.length} seraient reclassés :`);
  [...byType.entries()].forEach(([k, v]) => console.log(`   ${String(v).padStart(4)} -> ${k}`));
  toFix.slice(0, 15).forEach((r) => console.log(`      ${r.to.padEnd(18)} ${r.title.slice(0, 70)}`));

  console.log(`\n${stay.length} resteraient en "AUTRE" (tiroirs SIM, câbles… sans type dédié). Aperçu par mot-clé :`);
  const kw = new Map();
  stay.forEach((r) => {
    const k = r.title.split(/[\s/]+/).slice(0, 2).join(' ').toLowerCase();
    kw.set(k, (kw.get(k) || 0) + 1);
  });
  [...kw.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log(`   ${String(v).padStart(4)}  ${k}`));

  if (!APPLY) {
    console.log('\nAperçu uniquement — relance avec --apply pour appliquer.');
    return;
  }
  for (const r of toFix) await prisma.product.update({ where: { id: r.id }, data: { pieceType: r.to } });
  console.log(`\n✅ ${toFix.length} produit(s) reclassé(s).`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
