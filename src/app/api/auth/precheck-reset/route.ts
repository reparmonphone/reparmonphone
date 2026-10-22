import { NextRequest, NextResponse } from 'next/server';
import { checkBanForRequest } from '@/lib/bannedClients';

// Appelé par la page « mot de passe oublié » AVANT que Supabase n'envoie son e-mail : pour un client banni
// on n'envoie rien (la page affiche quand même le même message neutre, il ne se doute de rien).
export async function POST(req: NextRequest) {
  let email = '';
  try {
    const body = await req.json();
    email = typeof body?.email === 'string' ? body.email : '';
  } catch {
    // corps illisible : on laisse passer
  }
  const banned = await checkBanForRequest(req, { email });
  return NextResponse.json({ skip: !!banned });
}
