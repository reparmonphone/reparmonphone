import { NextRequest, NextResponse } from 'next/server';
import { markOpened, verifyUnsubToken } from '@/lib/marketing';

export const dynamic = 'force-dynamic';

// GIF transparent 1×1
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// Pixel de suivi : l'e-mail le charge à l'ouverture (si le client mail affiche les images).
// Lien signé : impossible de « marquer » l'adresse de quelqu'un d'autre.
export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get('e') ?? '').trim();
  const token = req.nextUrl.searchParams.get('t') ?? '';
  if (email && verifyUnsubToken(email, token, 'open')) {
    try {
      await markOpened(email);
    } catch {
      // le suivi ne doit jamais empêcher l'affichage de l'e-mail
    }
  }
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    },
  });
}
