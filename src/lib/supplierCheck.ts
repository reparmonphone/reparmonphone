// Version "web" de scripts/weekly-fournisseur-check.js : même logique de comparaison/correction,
// appelée depuis le bouton "Lancer la vérification" de /admin/fournisseur (voir actions.ts) au lieu
// d'une commande PowerShell. Le script scripts/weekly-fournisseur-check.js reste disponible tel
// quel pour un usage en ligne de commande — les deux chemins écrivent dans les mêmes tables
// (SupplierCheckRun / SupplierCheckItem / Product.supplierSku), donc peu importe lequel est utilisé
// une semaine donnée, l'historique reste cohérent sur /admin/fournisseur.
import { parse } from 'csv-parse/sync';
import { prisma } from '@/lib/prisma';
import { buildSupplierIndex, findBestMatch, SupplierRow } from '@/lib/matchSupplier';

export type SupplierCheckSummary = {
  totalRows: number;
  comparedCount: number;
  notFoundInCsv: number;
  unchangedCount: number;
  newlyMatched: number;
  priceHausse: number;
  priceBaisse: number;
  retourStock: number;
  ruptureStock: number;
  runId: string;
};

// Décode le fichier en UTF-8, et retombe sur latin1 si le résultat contient des caractères de
// remplacement (même logique que readFileSmartEncoding() dans les scripts CLI — l'export
// fournisseur n'est pas toujours en UTF-8 propre selon comment il a été sauvegardé).
function decodeSmart(buffer: Buffer): string {
  const asUtf8 = buffer.toString('utf-8');
  if (asUtf8.includes('�')) return buffer.toString('latin1');
  return asUtf8;
}

function isInStock(disponibilite: string): boolean {
  return /en stock/i.test((disponibilite || '').trim());
}

export async function runSupplierComparison(fileBuffer: Buffer, sourceFileName: string): Promise<SupplierCheckSummary> {
  const content = decodeSmart(fileBuffer);
  const rawRows: Record<string, string>[] = parse(content, {
    delimiter: ';',
    quote: '"',
    columns: true,
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: false,
  });

  const supplierRows: SupplierRow[] = rawRows
    .map((row) => ({
      nom: (row['Nom'] || '').trim(),
      sku: (row['Reference_SKU'] || '').trim(),
      prix: Number((row['Prix_TTC'] || '0').toString().replace(',', '.')) || 0,
      disponibilite: (row['Disponibilite'] || '').trim(),
    }))
    .filter((r) => r.nom && r.sku);

  if (supplierRows.length === 0) {
    throw new Error(
      "Aucune ligne exploitable dans ce CSV — vérifie qu'il contient bien les colonnes \"Nom\", \"Reference_SKU\", \"Prix_TTC\" et \"Disponibilite\" (avec ces noms exacts)."
    );
  }

  const bySku = new Map<string, SupplierRow>();
  for (const r of supplierRows) {
    if (!bySku.has(r.sku)) bySku.set(r.sku, r);
  }

  const withSku = await prisma.product.findMany({
    where: { supplierSku: { not: null } },
    select: { id: true, title: true, price: true, inStock: true, supplierSku: true, supplierPrice: true },
  });

  const withoutSku = await prisma.product.findMany({
    where: { supplierSku: null },
    select: { id: true, title: true, price: true, inStock: true },
  });

  const index = buildSupplierIndex(supplierRows);
  let newlyMatched = 0;
  const freshMatches: { id: string; title: string; price: unknown; inStock: boolean; supplierSku: string; supplierPrice: null }[] = [];
  for (const p of withoutSku) {
    const match = findBestMatch(p.title, index);
    if (match) {
      freshMatches.push({ id: p.id, title: p.title, price: p.price, inStock: p.inStock, supplierSku: match.row.sku, supplierPrice: null });
      newlyMatched++;
    }
  }

  const allTracked = [...withSku, ...freshMatches];

  type Item = {
    productId: string;
    type: 'PRIX_HAUSSE' | 'PRIX_BAISSE' | 'RETOUR_STOCK' | 'RUPTURE_STOCK';
    oldPrice?: number;
    newPrice?: number;
    oldSupplierPrice?: number;
    newSupplierPrice?: number;
    oldStock?: boolean;
    newStock?: boolean;
    applied: boolean;
    reviewed: boolean;
  };
  const items: Item[] = [];
  const productUpdates: { id: string; data: Record<string, unknown> }[] = [];
  let comparedCount = 0;
  let unchangedCount = 0;
  let notFoundInCsv = 0;

  for (const p of allTracked) {
    const supplierRow = p.supplierSku ? bySku.get(p.supplierSku) : undefined;
    if (!supplierRow) {
      notFoundInCsv++;
      continue;
    }
    comparedCount++;

    const newSupplierPrice = supplierRow.prix;
    const oldSupplierPrice = p.supplierPrice != null ? Number(p.supplierPrice) : null;
    const newStock = isInStock(supplierRow.disponibilite);
    const oldStock = p.inStock;

    const data: Record<string, unknown> = {
      supplierSku: p.supplierSku,
      supplierPrice: newSupplierPrice,
      supplierPriceCheckedAt: new Date(),
    };
    let changed = false;

    if (newStock !== oldStock) {
      data.inStock = newStock;
      changed = true;
      items.push({ productId: p.id, type: newStock ? 'RETOUR_STOCK' : 'RUPTURE_STOCK', oldStock, newStock, applied: true, reviewed: true });
    }

    if (oldSupplierPrice != null) {
      const delta = Math.round((newSupplierPrice - oldSupplierPrice) * 100) / 100;
      if (Math.abs(delta) >= 0.01) {
        const currentPublicPrice = Number(p.price);
        if (delta > 0) {
          const newPublicPrice = Math.round((currentPublicPrice + delta) * 100) / 100;
          data.price = newPublicPrice;
          changed = true;
          items.push({
            productId: p.id, type: 'PRIX_HAUSSE',
            oldPrice: currentPublicPrice, newPrice: newPublicPrice,
            oldSupplierPrice, newSupplierPrice, applied: true, reviewed: true,
          });
        } else {
          items.push({
            productId: p.id, type: 'PRIX_BAISSE',
            oldPrice: currentPublicPrice, newPrice: currentPublicPrice,
            oldSupplierPrice, newSupplierPrice, applied: false, reviewed: false,
          });
        }
      }
    }

    if (!changed) unchangedCount++;
    productUpdates.push({ id: p.id, data });
  }

  for (const u of productUpdates) {
    await prisma.product.update({ where: { id: u.id }, data: u.data });
  }

  const run = await prisma.supplierCheckRun.create({
    data: { sourceFile: sourceFileName, totalCompared: comparedCount, newlyMatched },
  });

  if (items.length > 0) {
    await prisma.supplierCheckItem.createMany({ data: items.map((i) => ({ ...i, runId: run.id })) });
  }

  return {
    totalRows: rawRows.length,
    comparedCount,
    notFoundInCsv,
    unchangedCount,
    newlyMatched,
    priceHausse: items.filter((i) => i.type === 'PRIX_HAUSSE').length,
    priceBaisse: items.filter((i) => i.type === 'PRIX_BAISSE').length,
    retourStock: items.filter((i) => i.type === 'RETOUR_STOCK').length,
    ruptureStock: items.filter((i) => i.type === 'RUPTURE_STOCK').length,
    runId: run.id,
  };
}
