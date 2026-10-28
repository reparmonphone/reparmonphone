import { NextRequest, NextResponse } from 'next/server';
import { validatePromoCode } from '@/lib/promoCode';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getClientIp } from '@/lib/clientIp';
import { checkBanForRequest } from '@/lib/bannedClients';

export async function POST(req: NextRequest) {
  const { code, subtotal, email, items } = await req.json();
  if (await checkBanForRequest(req, { email: typeof email === 'string' ? email : null })) {
    return NextResponse.json({ error: 'Ce code promo n’est pas valable.' }, { status: 400 });
  }
  // Compte connecté (s'il y en a un) + adresse IP : servent aux codes limités à 1 usage par client.
  let userId: string | null = null;
  let userEmail: string | null = null;
  let userPhone: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    userEmail = user?.email ?? null;
    userPhone = typeof user?.user_metadata?.phone === 'string' ? user.user_metadata.phone : null;
  } catch {
    // pas de session : on continue avec l'e-mail saisi
  }
  const result = await validatePromoCode(code ?? '', Number(subtotal) || 0, {
    email: typeof email === 'string' && email.trim() ? email : userEmail,
    userId,
    accountEmail: userEmail,
    phone: userPhone,
    ip: getClientIp(req),
    items: Array.isArray(items)
      ? items.map((i: { productId?: unknown; quantity?: unknown }) => ({ productId: String(i?.productId ?? ''), quantity: Number(i?.quantity) || 0 }))
      : [],
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
