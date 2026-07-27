import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getResendClient } from '@/lib/resend';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  requestType: z.string().optional(),
  subject: z.string().min(2),
  message: z.string().min(5),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, requestType, subject, message } = parsed.data;

  await prisma.contactMessage.create({
    data: { name, email, requestType, subject, message },
  });

  // Notifie l'admin par email si Resend est configuré (sinon, le message reste consultable dans /admin/messages)
  const resend = getResendClient();
  if (resend) {
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'ReparMonPhone <contact@reparmonphone.fr>',
        to: 'contact@reparmonphone.fr',
        replyTo: email,
        subject: `[${requestType ?? 'Contact'}] ${subject}`,
        html: `
          <p><strong>${name}</strong> (${email})</p>
          ${requestType ? `<p>Type : ${requestType}</p>` : ''}
          <p style="white-space: pre-line;">${message}</p>
        `,
      });
    } catch (e) {
      console.error("Erreur lors de l'envoi de la notification email au contact", e);
    }
  }

  return NextResponse.json({ ok: true });
}
