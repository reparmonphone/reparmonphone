import { NextRequest, NextResponse } from 'next/server';
import { validatePromoCode } from '@/lib/promoCode';

export async function POST(req: NextRequest) {
  const { code, subtotal } = await req.json();
  const result = await validatePromoCode(code ?? '', Number(subtotal) || 0);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
