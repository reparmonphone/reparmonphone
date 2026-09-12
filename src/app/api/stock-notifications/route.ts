import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const schema = z.object({ productId: z.string().min(1), email: z.string().email() });

// Inscription publique (pas d'auth requise) à l'alerte "produit de nouveau en stock", depuis la
// fiche produit (voir StockNotifyForm.tsx). L'email de retour en stock est envoyé depuis
// src/lib/stockNotifications.ts, déclenché quand l'admin repasse le produit en stock.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: 'Produit introuvable.' }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await prisma.stockNotification.upsert({
    where: { productId_email: { productId: parsed.data.productId, email: parsed.data.email } },
    // Si le client s'était déjà inscrit et avait déjà été notifié une fois (produit revenu en stock
    // puis re-rupture), on relance une inscription active en réinitialisant notifiedAt.
    update: { userId: user?.id ?? undefined, notifiedAt: null },
    create: { productId: parsed.data.productId, email: parsed.data.email, userId: user?.id },
  });

  return NextResponse.json({ ok: true });
}
