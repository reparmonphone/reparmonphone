import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: 'maintenance_mode' } });
    return NextResponse.json({ enabled: setting?.value === 'true' });
  } catch {
    // En cas de souci (base non initialisée...), on ne bloque jamais le site par erreur.
    return NextResponse.json({ enabled: false });
  }
}
