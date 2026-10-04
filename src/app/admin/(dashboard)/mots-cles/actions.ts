'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';

// Liste de mots-clés mise de côté depuis /admin/mots-cles (un mot-clé par ligne), pour la retrouver
// d'une session à l'autre et l'utiliser ensuite (titres, descriptions, guides, Search Console...).
const KEY = 'seo_saved_keywords';

export async function saveKeywordList(keywords: string[]) {
  await requireAdminUser();
  const clean = Array.from(new Set(keywords.map((k) => k.trim()).filter(Boolean))).slice(0, 2000);
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    update: { value: clean.join('\n') },
    create: { key: KEY, value: clean.join('\n') },
  });
  revalidatePath('/admin/mots-cles');
  return { ok: true, count: clean.length };
}
