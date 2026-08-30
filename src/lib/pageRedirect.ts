import { notFound, permanentRedirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

// Utilisé par les pages catalogue dont les URLs sont volontairement exclues de la vérification
// automatique des redirections dans le middleware (voir KNOWN_PREFIXES dans src/middleware.ts, qui
// saute exprès /produit et /marque pour ne pas interroger la base à chaque page vue normale — ce
// sont les URLs les plus visitées du site). Sans ce filet de sécurité, une ancienne URL de produit ou
// de gamme renommée/réorganisée (ex: fusion de modèles en double, gamme fantôme supprimée) renvoyait
// un 404 sec au lieu du vrai 301, même après avoir ajouté la redirection depuis /admin/seo.
//
// Ne coûte une requête base supplémentaire QUE dans le cas (rare) où la page demandée n'existe déjà
// plus — aucun impact sur les pages qui existent normalement.
export async function redirectOrNotFound(pathname: string): Promise<never> {
  const hit = await prisma.redirect.findUnique({ where: { fromPath: pathname } });
  if (hit) {
    await prisma.redirect.update({ where: { id: hit.id }, data: { hits: { increment: 1 } } });
    permanentRedirect(hit.toPath);
  }
  notFound();
}
