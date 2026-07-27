export function generateMetaDescription(p: {
  title: string;
  brandName: string;
  modelName: string;
  quality?: string | null;
  condition?: string | null;
  price: number;
}) {
  const qualityPart = p.quality ? ` (${p.quality})` : '';
  const conditionPart = p.condition ? `, ${p.condition.toLowerCase()}` : '';
  let text = `${p.title}${qualityPart}${conditionPart} pour ${p.brandName} ${p.modelName}. Livraison 24h Chronopost. À partir de ${p.price.toFixed(2)}€ — ReparMonPhone, Sainte-Maxime.`;

  if (text.length > 160) {
    text = `${text.slice(0, 157)}...`;
  }
  return text;
}
