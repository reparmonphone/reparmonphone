// Vérifie ce qui est réellement enregistré en base pour les pages légales (rien n'est modifié).
// Lancer :  node scripts/check-pages-legales.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.migration') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CONTROLES = [
  { slug: 'cgv', label: "CGV — paragraphe « Retards d'acheminement »", texte: "Retards d'acheminement" },
  { slug: 'cgv', label: 'CGV — offre de fidélité (article 3 ter)', texte: 'REPARMONPHONEFIDELITY' },
  { slug: 'confidentialite', label: 'Confidentialité — adresse IP / offre de fidélité', texte: "Offre de fidélité" },
  { slug: 'livraison-retours', label: 'Livraison & Retours — retards d\'acheminement', texte: "retard d'acheminement signalé" },
];

async function main() {
  for (const c of CONTROLES) {
    const page = await prisma.page.findUnique({ where: { slug: c.slug } });
    if (!page) { console.log(`⚠️  ${c.label} : page "${c.slug}" introuvable en base`); continue; }
    const ok = page.contentHtml.includes(c.texte);
    console.log(`${ok ? '✅' : '❌'} ${c.label} (${page.contentHtml.length} caractères)`);
  }
}

main()
  .catch((e) => { console.error('❌ Erreur :', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
