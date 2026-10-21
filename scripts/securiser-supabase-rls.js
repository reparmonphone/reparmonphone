// Corrige l'alerte Supabase « rls_disabled_in_public » : active la sécurité au niveau des lignes (RLS)
// sur toutes les tables du schéma « public », sans créer de règle d'accès.
//   - Le site n'est pas affecté : il lit la base via Prisma (rôle « postgres », qui contourne la RLS).
//   - Mais l'API publique de Supabase (clé « anon », visible dans le navigateur) ne peut plus rien lire,
//     modifier ni supprimer dans ces tables.
//
//   node scripts/securiser-supabase-rls.js           -> diagnostic seul (rien n'est modifié)
//   node scripts/securiser-supabase-rls.js --apply   -> active la RLS puis revérifie
//
// Le test d'exposition n'affiche jamais de données : uniquement « lisible » ou « protégée ».
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.migration') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); // complète (ne remplace rien)
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

async function tables() {
  return prisma.$queryRawUnsafe(
    `SELECT c.relname AS name, c.relrowsecurity AS rls
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname`
  );
}

// Interroge l'API publique comme le ferait n'importe quel visiteur muni de l'adresse du projet.
async function exposition(name) {
  if (!SUPABASE_URL || !ANON_KEY) return 'inconnu';
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(name)}?select=*&limit=1`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (!res.ok) return 'protégée';
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? 'LISIBLE PAR TOUS' : 'protégée (ou vide)';
  } catch {
    return 'inconnu';
  }
}

async function rapport(titre) {
  const list = await tables();
  console.log(`\n${titre}`);
  let sansRls = 0;
  let lisibles = 0;
  for (const t of list) {
    const expo = await exposition(t.name);
    if (!t.rls) sansRls++;
    if (expo === 'LISIBLE PAR TOUS') lisibles++;
    console.log(`${t.rls ? '✅' : '❌'} ${t.name.padEnd(34)} RLS ${t.rls ? 'active  ' : 'INACTIVE'}  |  API publique : ${expo}`);
  }
  console.log(`\n${list.length} tables — ${sansRls} sans RLS — ${lisibles} lisibles publiquement.`);
  if (!SUPABASE_URL || !ANON_KEY) console.log('(Test de l\'API publique ignoré : NEXT_PUBLIC_SUPABASE_URL / clé anon introuvables dans .env)');
  return { list, sansRls };
}

async function main() {
  const { list, sansRls } = await rapport(APPLY ? '--- AVANT ---' : '--- DIAGNOSTIC (rien n\'est modifié) ---');
  if (!APPLY) {
    if (sansRls > 0) console.log('\n👉 Pour corriger : node scripts/securiser-supabase-rls.js --apply');
    return;
  }
  let ok = 0;
  for (const t of list.filter((x) => !x.rls)) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "public"."${t.name.replace(/"/g, '""')}" ENABLE ROW LEVEL SECURITY`);
      ok++;
    } catch (e) {
      console.log(`⚠️  ${t.name} : ${e.message.split('\n')[0]}`);
    }
  }
  console.log(`\n🔒 RLS activée sur ${ok} table(s).`);
  await rapport('--- APRÈS ---');
}

main()
  .catch((e) => { console.error('❌ Erreur :', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
