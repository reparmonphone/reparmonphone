/**
 * Importe des avis produits en masse depuis un fichier CSV.
 *
 * Usage : npm run import-reviews -- chemin/vers/avis.csv
 *
 * Colonnes attendues (l'ordre n'importe pas, les noms sont détectés automatiquement parmi ces variantes) :
 *   - identifiant produit : "product_id" / "sku" / "wpid" / "wp_id" / "reference"  (le plus fiable : l'ancien ID WooCommerce)
 *       OU "product_slug" / "slug"
 *       OU "product_title" / "title" / "produit"  (correspondance par titre exact — moins fiable, en dernier recours)
 *   - note : "rating" / "note" / "stars" / "etoiles"  (nombre 1 à 5)
 *   - auteur : "author" / "auteur" / "name" / "nom"
 *   - texte : "text" / "comment" / "commentaire" / "avis" / "review"
 *   - date (facultatif) : "date" / "created_at"
 *
 * Le script :
 *   1. Essaie de faire correspondre chaque ligne à un produit existant (par wpId, puis slug, puis titre exact)
 *   2. Insère les avis trouvés (ignore et compte les lignes sans correspondance, sans planter l'import)
 *   3. Recalcule avgRating/reviewCount pour tous les produits concernés à la fin
 *
 * ⚠️ Adapte la fonction `findColumn` ci-dessous si ton fichier utilise des noms de colonnes différents.
 */
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function findColumn(row: Record<string, string>, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const match = keys.find((k) => k.toLowerCase().trim() === candidate);
    if (match) return row[match];
  }
  return undefined;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage : npm run import-reviews -- chemin/vers/avis.csv');
    process.exit(1);
  }

  const content = readFileSync(filePath, 'utf-8');
  const rows: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`${rows.length} ligne(s) trouvée(s) dans le CSV.`);

  let imported = 0;
  let notFound = 0;
  let skippedInvalid = 0;
  let skippedReplies = 0;
  const touchedProductIds = new Set<string>();

  for (const row of rows) {
    const wpId = findColumn(row, ['product_id', 'sku', 'wpid', 'wp_id', 'reference']);
    const slug = findColumn(row, ['product_slug', 'slug']);
    const title = findColumn(row, ['product_title', 'title', 'produit']);
    const ratingRaw = findColumn(row, ['rating', 'note', 'stars', 'etoiles', 'review_score']);
    const author = findColumn(row, ['author', 'auteur', 'name', 'nom', 'display_name']) || 'Client ReparMonPhone';
    const text = findColumn(row, ['text', 'comment', 'commentaire', 'avis', 'review', 'review_content']) || '';
    const dateRaw = findColumn(row, ['date', 'created_at']);
    const parent = findColumn(row, ['parent']);

    // Les lignes avec un "parent" renseigné sont des réponses de la boutique à un avis (pas un avis client) — on les ignore.
    if (parent && parent.trim()) {
      skippedReplies++;
      continue;
    }

    const rating = ratingRaw ? Math.round(parseFloat(ratingRaw.replace(',', '.'))) : NaN;
    if (!rating || rating < 1 || rating > 5) {
      skippedInvalid++;
      continue;
    }

    let product = null;
    if (wpId) product = await prisma.product.findUnique({ where: { wpId } });
    if (!product && slug) product = await prisma.product.findUnique({ where: { slug } });
    if (!product && title) product = await prisma.product.findFirst({ where: { title } });

    if (!product) {
      notFound++;
      continue;
    }

    await prisma.productReview.create({
      data: {
        productId: product.id,
        authorName: author,
        rating,
        text: text || null,
        verified: false, // avis importés en masse : pas de vérification d'achat individuelle possible
        createdAt: dateRaw ? new Date(dateRaw) : new Date(),
      },
    });
    touchedProductIds.add(product.id);
    imported++;

    if (imported % 500 === 0) console.log(`  ...${imported} avis importés`);
  }

  console.log(`\nRecalcul de la note moyenne pour ${touchedProductIds.size} produit(s)...`);
  for (const productId of touchedProductIds) {
    const agg = await prisma.productReview.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await prisma.product.update({
      where: { id: productId },
      data: { avgRating: agg._avg.rating, reviewCount: agg._count.rating },
    });
  }

  console.log(`\n✅ Import terminé : ${imported} avis importés, ${notFound} produit(s) introuvable(s), ${skippedReplies} réponse(s) boutique ignorée(s), ${skippedInvalid} ligne(s) avec note invalide ignorée(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
