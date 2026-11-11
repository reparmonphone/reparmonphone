import { NextResponse } from 'next/server';
import { getFinderModels } from '@/lib/partFinder';

// Modèles d'une gamme (avec les pièces en stock) pour le trouveur de pièce de l'accueil.
// Mis en cache par le CDN 1 h : la liste ne change qu'avec le catalogue.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brand = (searchParams.get('brand') ?? '').slice(0, 80);
  const line = (searchParams.get('line') ?? '').slice(0, 80);
  if (!brand || !line) return NextResponse.json({ models: [] }, { status: 400 });
  try {
    const models = await getFinderModels(brand, line);
    return NextResponse.json(
      { models },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  } catch {
    return NextResponse.json({ models: [] }, { status: 500 });
  }
}
