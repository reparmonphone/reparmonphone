// Liste les réglages enregistrés dans la table site_settings SANS afficher leurs valeurs, pour repérer
// un éventuel secret (clé d'API, jeton, mot de passe) qui aurait été lisible avant la correction RLS.
//   node scripts/verifier-site-settings.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.migration') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const NOMS_SUSPECTS = /(secret|token|password|passwd|pwd|api[_-]?key|apikey|private|credential|auth|webhook|bearer|license|licence|smtp|dsn)/i;
const VALEURS_SUSPECTES = [
  [/^sk_(live|test)_/i, 'ressemble à une clé secrète Stripe'],
  [/^rk_(live|test)_/i, 'ressemble à une clé restreinte Stripe'],
  [/^whsec_/i, 'ressemble à un secret de webhook Stripe'],
  [/^re_[A-Za-z0-9_]{16,}/, 'ressemble à une clé API Resend'],
  [/^sumup_|^sup_sk_/i, 'ressemble à une clé SumUp'],
  [/^eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\./, 'ressemble à un jeton JWT'],
  [/^-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'ressemble à une clé privée'],
  [/^[A-Za-z0-9+/=_-]{32,}$/, 'longue chaîne sans espace (peut être une clé ou un jeton)'],
];

async function main() {
  const rows = await prisma.siteSetting.findMany({ orderBy: { key: 'asc' } });
  console.log(`\n${rows.length} réglage(s) dans site_settings (les valeurs ne sont pas affichées)\n`);
  let suspects = 0;
  for (const r of rows) {
    const raisons = [];
    if (NOMS_SUSPECTS.test(r.key)) raisons.push('le nom évoque un secret');
    for (const [re, msg] of VALEURS_SUSPECTES) {
      if (re.test(String(r.value).trim())) { raisons.push(msg); break; }
    }
    if (raisons.length) suspects++;
    console.log(`${raisons.length ? '⚠️ ' : '   '} ${r.key.padEnd(42)} ${String(r.value.length).padStart(5)} car.${raisons.length ? '  → ' + raisons.join(' ; ') : ''}`);
  }
  console.log(
    suspects === 0
      ? '\n✅ Aucun réglage ne ressemble à un secret.'
      : `\n⚠️  ${suspects} réglage(s) à vérifier : s'ils contiennent un vrai secret, changez-le chez le fournisseur concerné.`
  );
}

main()
  .catch((e) => { console.error('❌ Erreur :', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
