import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().min(6),
  addressLine1: z.string().min(3),
  addressCity: z.string().min(1),
  addressZip: z.string().min(4),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Champs invalides ou manquants.' }, { status: 400 });
  }
  const data = parsed.data;

  // IP du client au moment de l'inscription (utile pour l'admin : détection fraude/doublons)
  const signupIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'inconnue';

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true, // pas de double-opt-in email pour l'instant — simplifie le premier lancement
    user_metadata: {
      first_name: data.firstName,
      last_name: data.lastName,
      full_name: `${data.firstName} ${data.lastName}`.trim(),
      phone: data.phone,
      address_line1: data.addressLine1,
      address_city: data.addressCity,
      address_zip: data.addressZip,
      signup_ip: signupIp,
    },
  });

  if (error) {
    const message = error.message.includes('already been registered')
      ? 'Un compte existe déjà avec cet email.'
      : "Erreur lors de la création du compte.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, userId: created.user?.id });
}
