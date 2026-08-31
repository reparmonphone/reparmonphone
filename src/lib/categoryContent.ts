import categoryContentRaw from '../../data/category_content.json';

export type CategoryCard = {
  name: string;
  // string | null : le contenu scrappé d'origine fournit toujours une image, mais une carte
  // générée dynamiquement depuis la base (voir src/app/marque/[...slug]/page.tsx) peut n'avoir
  // encore aucune photo (gamme/modèle tout juste créé depuis /admin/gammes, sans image ajoutée).
  imageUrl: string | null;
  href: string;
  count: number | null;
  // Compteur précis calculé par identifiant réel (voir scripts/consolidate-huawei-categories.js,
  // ou directement depuis la base dans src/app/marque/[...slug]/page.tsx), à préférer à la
  // recherche floue par texte quand il est présent.
  liveCount?: number;
  // Ordre d'affichage manuel (Model.sortOrder) sur une page de gamme — réglable depuis
  // /admin/gammes avec les flèches ▲▼. Absent pour les cartes "gamme" (page racine d'une marque),
  // qui gardent leur ordre d'origine.
  sortOrder?: number;
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

// Direction inverse de LINE_CONTENT_KEY : retrouve notre slug de gamme interne (Prisma) à partir
// de la clé de contenu scrappé (ex: brandSlug="apple", theirKey="iphones" -> "iphone"). Nécessaire
// car pour certaines gammes (iPhone/iPad notamment) la clé scrappée diffère de notre slug (pluriel,
// convention différente...) : une correspondance texte naïve (slug ou nom normalisé) échouerait.
export function getOurSlugForContentKey(brandSlug: string, theirKey: string): string | null {
  for (const [combo, key] of Object.entries(LINE_CONTENT_KEY)) {
    if (key !== theirKey) continue;
    const [b, ourSlug] = combo.split('/');
    if (b === brandSlug) return ourSlug;
  }
  return null;
}

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
