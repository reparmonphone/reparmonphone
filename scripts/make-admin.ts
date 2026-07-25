/**
 * Attribue le rôle admin à un compte déjà existant (créé via /compte/inscription
 * ou via Supabase Dashboard → Authentication → Users → Add user).
 *
 * Usage : npm run make-admin -- ton-email@exemple.fr
 *
 * Nécessite SUPABASE_SERVICE_ROLE_KEY dans .env (jamais exposée au navigateur,
 * c'est pour ça que ce script tourne en local et pas depuis le site).
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const email = process.argv[2];

if (!email) {
  console.error('Usage : npm run make-admin -- ton-email@exemple.fr');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // On liste les utilisateurs et on cherche l'email correspondant
  // (l'API admin ne permet pas de chercher directement par email sur toutes les versions).
  let user;
  let page = 1;
  while (!user) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user || data.users.length < 200) break;
    page++;
  }

  if (!user) {
    console.error(`Aucun compte trouvé pour ${email}. Crée d'abord le compte via /compte/inscription.`);
    process.exit(1);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, role: 'admin' },
  });

  if (updateError) throw updateError;

  console.log(`✅ ${email} est maintenant administrateur. Connecte-toi sur /admin/login.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
