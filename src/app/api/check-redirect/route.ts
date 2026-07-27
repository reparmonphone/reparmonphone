import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path');
  if (!path) return NextResponse.json({ redirect: null });

  try {
    const redirect = await prisma.redirect.findUnique({ where: { fromPath: path } });
    if (redirect) {
      // Incrémente le compteur d'utilisation en tâche de fond (ne bloque pas la réponse)
      prisma.redirect.update({ where: { id: redirect.id }, data: { hits: { increment: 1 } } }).catch(() => {});
      return NextResponse.json({ redirect: { toPath: redirect.toPath, statusCode: redirect.statusCode } });
    }
    return NextResponse.json({ redirect: null });
  } catch {
    return NextResponse.json({ redirect: null });
  }
}
