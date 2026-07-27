import categoryContentRaw from '../../data/category_content.json';

export type CategoryCard = {
  name: string;
  imageUrl: string;
  href: string;
  count: number | null;
};

export type CategoryContent = {
  title: string;
  cards: CategoryCard[];
  description: string | null;
};

const categoryContent = categoryContentRaw as Record<string, CategoryContent>;

// Mappe le slug de marque interne (Prisma) vers la clé du contenu scrappé,
// quand ils diffèrent (ex: notre "xiaomi" correspond à leur "xiaomi-2").
const BRAND_CONTENT_KEY: Record<string, string> = {
  apple: 'apple',
  samsung: 'samsung',
  xiaomi: 'xiaomi-2',
  huawei: 'huawei',
  // La marque "Outils" (issue de la catégorie "Autre"/"Autres" à la migration) peut avoir gardé
  // son slug d'origine même après renommage de son nom affiché — on couvre toutes les variantes.
  autre: 'outils',
  autres: 'outils',
  outils: 'outils',
};

// Mappe brandSlug/ourLineSlug -> clé de contenu scrappé, pour les liens directs
// depuis le mega-menu / Catégories en Vedette (qui utilisent nos propres slugs de gamme).
export const LINE_CONTENT_KEY: Record<string, string> = {
  'apple/iphone': 'iphones',
  'apple/ipad': 'ipads',
  'apple/airpods': 'airpods',
  'apple/apple-watch': 'watch',
  'samsung/galaxy-a': 'galaxy-a',
  'samsung/galaxy-j': 'galaxy-j',
  'samsung/galaxy-m': 'galaxy-m',
  'samsung/galaxy-note': 'galaxy-note',
  'samsung/galaxy-s': 'galaxy-s',
  'samsung/galaxy-z': 'galaxy-z',
  'huawei/mate': 'gamme-mate',
  'huawei/serie-p': 'gamme-p',
  'xiaomi/redmi': 'serie-redmi-2',
  'xiaomi/mi': 'serie-mi',
  'xiaomi/poco': 'serie-poco-2',
  'xiaomi/redmi-note': 'serie-redmi-note',
};

export function getBrandContent(brandSlug: string): CategoryContent | null {
  const key = BRAND_CONTENT_KEY[brandSlug];
  return key ? categoryContent[key] ?? null : null;
}

export function getContentByKey(key: string): CategoryContent | null {
  return categoryContent[key] ?? null;
}

// Extrait le dernier segment de chemin d'une URL WordPress, ex:
// "https://www.reparmonphone.fr/product-category/pieces-detachees/samsung/galaxy-a/a3/" -> "a3"
export function lastPathSegment(url: string): string {
  const clean = url.replace(/\/$/, '');
  const parts = clean.split('/');
  return parts[parts.length - 1] || '';
}

// Une carte est une "branche" (sous-catégorie à explorer) si son segment correspond
// à une entrée connue de notre contenu ET qu'elle n'a pas de compteur produit.
export function isBranchCard(card: CategoryCard): boolean {
  const segment = lastPathSegment(card.href);
  return card.count === null && !!categoryContent[segment];
}
