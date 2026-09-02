import { withDeliveryMention } from './seoText';

// Génère une meta description SEO cohérente pour une fiche produit, à partir de ses infos de base.
// Utilisé à deux endroits : le bouton "✨ Générer automatiquement" de /admin/produits/[id]
// (ProductEditForm, appelé côté navigateur — donc uniquement du code pur ici, pas de Prisma/serveur),
// et scripts/backfill-meta-descriptions.js pour remplir en une fois tous les produits qui n'en ont
// pas encore. `pieceLabel` (ex: "écran", voir PIECE_TYPE_LABELS dans seoText.ts) est optionnel :
// l'admin ne le passe pas (il n'a pas cette info sous la main dans le formulaire) et utilise alors
// simplement le titre du produit ; le script de backfill, lui, le fournit pour un résultat plus net.
export function generateMetaDescription({
  title,
  brandName,
  modelName,
  condition,
  quality,
  price,
  pieceLabel,
}: {
  title: string;
  brandName: string;
  modelName: string;
  condition?: string | null;
  quality?: string | null;
  price?: number | null;
  pieceLabel?: string | null;
}): string {
  const qualifiers = [quality, condition].filter((v): v is string => !!v && v.trim() !== '');
  const qualifierText = qualifiers.length ? ` (${qualifiers.join(', ')})` : '';

  const subject = pieceLabel
    ? `${pieceLabel.charAt(0).toUpperCase()}${pieceLabel.slice(1)}${qualifierText}`
    : `${title}${qualifierText}`;

  const target = [brandName, modelName].filter((v) => v && v.trim() !== '').join(' ');
  const forText = target ? ` pour ${target}` : '';

  const priceText =
    typeof price === 'number' && price > 0 ? ` À partir de ${price.toFixed(2).replace('.', ',')} €.` : '';

  const base = `${subject}${forText}.${priceText}`.replace(/\s+/g, ' ').trim();
  return withDeliveryMention(base);
}
