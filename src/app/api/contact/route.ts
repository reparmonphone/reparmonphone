import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  subject: z.string().min(2),
  message: z.string().min(5),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, subject, message } = parsed.data;

  await prisma.contactMessage.create({
    data: { name, email, subject, message },
  });

  // TODO : brancher un envoi d'e-mail réel vers contact@reparmonphone.fr (ex: Resend, Postmark)
  // une fois RESEND_API_KEY (ou équivalent) configuré dans .env.
  console.log(`Nouveau message de contact de ${name} <${email}> — ${subject}`);

  return NextResponse.json({ ok: true });
}
