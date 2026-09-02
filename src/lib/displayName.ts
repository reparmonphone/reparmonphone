// Affichage public des avis clients : uniquement le prénom, jamais le nom de famille (demandé par
// Krys). Les noms complets restent stockés tels quels en base (ProductReview.authorName,
// Review.authorName) et restent visibles tels quels côté admin (/admin/avis) — cette fonction ne
// change que ce qui est montré aux visiteurs du site.
export function firstNameOnly(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first || fullName;
}
