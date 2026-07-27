/**
 * Seed : importe le catalogue extrait de l'export WooCommerce (data/products_final.json)
 * et initialise les zones de déplacement à supplément.
 *
 * Hiérarchie : Brand (Apple, Samsung...) -> ProductLine (iPhone, Galaxy S...) -> Model (iPhone 14...) -> Product
 *
 * Lancer avec : npm run db:seed
 */
import { PrismaClient, PieceType } from '@prisma/client';
import raw from '../data/products_final.json';
import staticPages from '../data/static_pages.json';

const prisma = new PrismaClient();

type RawProduct = {
  wp_id: string;
  title: string;
  slug: string;
  price: number;
  regular_price: number | null;
  in_stock: boolean;
  stock_qty: number | null;
  brand: string;
  line: string;
  model: string;
  piece_type: string;
  condition: string | null;
  quality: string | null;
  images: string[];
  short_description: string | null;
  description: string | null;
  tags: string[];
};

const PIECE_TYPE_MAP: Record<string, PieceType> = {
  'Écran': 'ECRAN',
  'Batterie': 'BATTERIE',
  'Nappe / Connecteur': 'NAPPE_CONNECTEUR',
  'Caméra': 'CAMERA',
  'Vitre arrière': 'VITRE_ARRIERE',
  'Châssis': 'CHASSIS',
  'Haut-parleur': 'HAUT_PARLEUR',
  'Vibreur': 'VIBREUR',
  'Bouton': 'BOUTON',
  'Outillage': 'OUTILLAGE',
  'Kit outillage': 'OUTILLAGE',
  'Accessoire': 'ACCESSOIRE',
  'Autre pièce': 'AUTRE',
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

async function main() {
  const products = raw as RawProduct[];
  console.log(`Import de ${products.length} produits...`);

  // 1. Marques uniques
  const brandNames = [...new Set(products.map((p) => p.brand))];
  const brandMap = new Map<string, string>();
  for (const name of brandNames) {
    const brand = await prisma.brand.upsert({
      where: { name },
      update: {},
      create: { name, slug: slugify(name) },
    });
    brandMap.set(name, brand.id);
  }
  console.log(`  ${brandNames.length} marques créées.`);

  // 2. Gammes uniques (par marque) — ex: Apple -> iPhone, Apple -> iPad
  const lineKey = (brand: string, line: string) => `${brand}::${line}`;
  const lineMap = new Map<string, string>();
  const seenLines = new Set<string>();
  for (const p of products) {
    const key = lineKey(p.brand, p.line);
    if (seenLines.has(key)) continue;
    seenLines.add(key);
    const brandId = brandMap.get(p.brand)!;
    const lineSlug = slugify(p.line);
    const productLine = await prisma.productLine.upsert({
      where: { brandId_slug: { brandId, slug: lineSlug } },
      update: {},
      create: { name: p.line, slug: lineSlug, brandId },
    });
    lineMap.set(key, productLine.id);
  }
  console.log(`  ${seenLines.size} gammes créées (ex: iPhone, Galaxy S, Redmi Note...).`);

  // 3. Modèles uniques (par gamme) — ex: iPhone -> iPhone 14 Pro Max
  const modelKey = (brand: string, line: string, model: string) => `${brand}::${line}::${model}`;
  const modelMap = new Map<string, string>();
  const seenModels = new Set<string>();
  for (const p of products) {
    const key = modelKey(p.brand, p.line, p.model);
    if (seenModels.has(key)) continue;
    seenModels.add(key);

    const productLineId = lineMap.get(lineKey(p.brand, p.line))!;
    const modelSlug = slugify(p.model);
    const model = await prisma.model.upsert({
      where: { productLineId_slug: { productLineId, slug: modelSlug } },
      update: {},
      create: { name: p.model, slug: modelSlug, productLineId },
    });
    modelMap.set(key, model.id);
  }
  console.log(`  ${seenModels.size} modèles créés.`);

  // 4. Produits
  let count = 0;
  for (const p of products) {
    const modelId = modelMap.get(modelKey(p.brand, p.line, p.model));
    if (!modelId) continue;

    await prisma.product.upsert({
      where: { wpId: p.wp_id },
      update: {
        images: p.images ?? [],
        shortDescription: p.short_description ?? undefined,
        description: p.description ?? undefined,
      },
      create: {
        wpId: p.wp_id,
        title: p.title,
        slug: p.slug,
        shortDescription: p.short_description ?? undefined,
        description: p.description ?? undefined,
        price: p.price,
        regularPrice: p.regular_price ?? undefined,
        pieceType: PIECE_TYPE_MAP[p.piece_type] ?? 'AUTRE',
        condition: p.condition ?? undefined,
        quality: p.quality ?? undefined,
        inStock: p.in_stock,
        stockQty: p.stock_qty ?? undefined,
        imageUrl: p.images?.[0] ?? undefined,
        images: p.images ?? [],
        modelId,
      },
    });
    count++;
    if (count % 200 === 0) console.log(`  ...${count} produits importés`);
  }
  console.log(`  ${count} produits importés au total.`);

  // 5. Zones de déplacement (issues du site actuel)
  const zones: { cityName: string; extraFee: number }[] = [
    { cityName: 'Sainte-Maxime', extraFee: 0 },
    { cityName: 'Saint-Tropez', extraFee: 30 },
    { cityName: 'Grimaud', extraFee: 30 },
    { cityName: 'Cogolin', extraFee: 30 },
    { cityName: 'La Croix-Valmer', extraFee: 30 },
    { cityName: 'Gassin', extraFee: 30 },
    { cityName: 'Plan-de-la-Tour', extraFee: 30 },
    { cityName: 'Les Issambres', extraFee: 30 },
  ];
  for (const z of zones) {
    await prisma.serviceZone.upsert({
      where: { cityName: z.cityName },
      update: { extraFee: z.extraFee },
      create: z,
    });
  }
  console.log(`  ${zones.length} zones de déplacement configurées.`);

  // 6. Avis clients de départ (modifiables ensuite dans /admin/avis)
  const reviewsCount = await prisma.review.count();
  if (reviewsCount === 0) {
    await prisma.review.createMany({
      data: [
        { source: 'GOOGLE', authorName: 'Tchi83', rating: 1, text: 'Gérant réactif et sympathique au départ, puis plus de nouvelles pendant plusieurs mois sur une pièce commandée.', order: 1 },
        { source: 'GOOGLE', authorName: 'Marie-France Mienville', rating: 5, text: "Patron très accueillant et honnête sur les prix. Sa fille avait bloqué son iPhone 11, résolu rapidement.", order: 2 },
        { source: 'GOOGLE', authorName: 'Dominique Sitbon', rating: 4, text: "Très bien, sympathique, rapide et professionnel pour un écran Huawei tombé dans une piscine.", order: 3 },
        { source: 'FACEBOOK', authorName: 'Claude Ceccaldi', rating: null, text: 'Très sympa et très compétent. 👍', order: 1 },
        { source: 'FACEBOOK', authorName: 'Philippe Huynh', rating: null, text: 'Très aimable, bon réparateur.', order: 2 },
        { source: 'FACEBOOK', authorName: 'Eveline Bigaut', rating: null, text: 'Très très bon réparateur et très aimable.', order: 3 },
      ],
    });
    console.log('  6 avis de départ créés (modifiables dans /admin/avis).');
  }

  // 7. Partenaires de départ (modifiables ensuite dans /admin/partenaires)
  const partnersCount = await prisma.partner.count();
  if (partnersCount === 0) {
    await prisma.partner.createMany({
      data: [
        { name: "Repar'Acteurs PACA", logoUrl: '/partners/repar-acteurs-paca.png', linkUrl: 'https://www.reparacteurs-paca.fr', order: 1 },
        { name: '#SainteMaxime®', logoUrl: null, linkUrl: 'https://hashtagsaintemaxime.fr', order: 2 },
      ],
    });
    console.log('  2 partenaires de départ créés (modifiables dans /admin/partenaires).');
  }

  // 8. Liens de référencement de départ
  const referralLinksCount = await prisma.referralLink.count();
  if (referralLinksCount === 0) {
    await prisma.referralLink.createMany({
      data: [
        { label: 'Gralon — Annuaire gratuit', url: 'https://www.gralon.net', order: 1 },
        { label: 'TopLien — Annuaire SEO', url: '#', order: 2 },
      ],
    });
    console.log('  2 liens de référencement de départ créés (modifiables dans /admin/partenaires).');
  }

  // 9. Pages de contenu (À propos, Mentions légales, CGV...) — éditables ensuite dans /admin/pages
  const pagesCount = await prisma.page.count();
  if (pagesCount === 0) {
    const entries = Object.entries(staticPages as Record<string, { title: string; html: string }>);
    for (const [slug, page] of entries) {
      await prisma.page.create({ data: { slug, title: page.title, contentHtml: page.html } });
    }
    console.log(`  ${entries.length} pages de contenu créées (modifiables dans /admin/pages).`);
  }

  // 10. Réglage Instagram par défaut — éditable ensuite dans /admin/partenaires
  await prisma.siteSetting.upsert({
    where: { key: 'instagram_followers' },
    update: {},
    create: { key: 'instagram_followers', value: '1,9K' },
  });

  // 11. Liens de menu header par défaut — éditables ensuite dans /admin/menu
  const menuItemsCount = await prisma.headerMenuItem.count();
  if (menuItemsCount === 0) {
    await prisma.headerMenuItem.create({ data: { label: 'Prendre RDV', href: '/rdv', order: 1 } });
    console.log('  1 lien de menu header créé (modifiable dans /admin/menu).');
  }

  // 11. Options de livraison par défaut — éditables ensuite dans /admin/livraison
  const shippingCount = await prisma.shippingOption.count();
  if (shippingCount === 0) {
    await prisma.shippingOption.createMany({
      data: [
        { label: 'Chronopost 24h', description: 'Livraison le lendemain avant 13h', price: 8.9, order: 1 },
        { label: 'Chrono Relais', description: 'Livraison en 1 jour, en point relais', price: 6.45, order: 2 },
        { label: 'Lettre Suivie - La Poste', description: 'Livraison en 2 à 5 jours', price: 4.5, order: 3 },
        {
          label: 'Réparation en Atelier ou à Domicile',
          description: 'À Sainte-Maxime, tout compris (main d\u2019œuvre incluse)',
          price: 50,
          order: 4,
        },
      ],
    });
    console.log('  4 options de livraison créées (modifiables dans /admin/livraison).');
  }

  console.log('Seed terminé ✅');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
