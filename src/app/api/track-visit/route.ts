import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json();
    await prisma.pageView.create({ data: { path: typeof path === 'string' ? path.slice(0, 300) : '/' } });
  } catch {
    // Ne bloque jamais la navigation du visiteur pour un souci de tracking
  }
  return NextResponse.json({ ok: true });
}
