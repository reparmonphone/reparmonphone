import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const schema = z.object({
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(6),
  deviceBrand: z.string().min(1),
  deviceModel: z.string().min(1),
  issueDescription: z.string().min(5),
  type: z.enum(['ATELIER', 'DOMICILE']),
  city: z.string().min(2),
  preferredDate: z.string(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  let extraFee = 0;
  if (data.type === 'DOMICILE') {
    const zone = await prisma.serviceZone.findUnique({ where: { cityName: data.city } });
    extraFee = zone ? Number(zone.extraFee) : 0;
  }

  // Si le client est connecté, on rattache le RDV à son compte (sinon RDV "invité")
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const appointment = await prisma.appointment.create({
    data: {
      ...data,
      preferredDate: new Date(data.preferredDate),
      extraFee,
      userId: user?.id,
    },
  });

  return NextResponse.json({ appointment });
}
