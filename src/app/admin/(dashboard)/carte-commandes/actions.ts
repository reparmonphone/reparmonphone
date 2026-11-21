'use server';

import { prisma } from '@/lib/prisma';
import { requireAdminUser } from '@/lib/supabase-server';
import { locateOrder, type GeoPoint } from '@/lib/orderGeo';
import { geocodeFrance, geocodeForeign, type GeoResult } from '@/lib/geocode';
import { GEO_PREFIX, foreignInfo, loadGeoCache, loadGeoOrders, plainCity, toPoint, type GeoOrderRow } from '@/lib/orderGeoServer';

// Localise un petit paquet de commandes pas encore placées sur la carte. Le navigateur rappelle cette fonction en
// boucle (avec une barre de progression) jusqu'à ce qu'il n'en reste plus : chaque appel reste court.

const FR_BATCH = 12;
const FR_CONCURRENCY = 4;
const FOREIGN_BATCH = 2;

export type GeoBatchResult =
  | { ok: true; points: GeoPoint[]; remaining: number; failed: number; processed: number }
  | { ok: false; error: string };

async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

export async function geocodeNextBatch(): Promise<GeoBatchResult> {
  await requireAdminUser();
  try {
    const [orders, cache] = await Promise.all([loadGeoOrders(), loadGeoCache()]);
    const todo = orders.filter((o) => !cache.has(o.id));
    if (todo.length === 0) return { ok: true, points: [], remaining: 0, failed: countFailed(cache), processed: 0 };

    // Adresses inutilisables (code postal absent ou inconnu) : on les marque tout de suite comme « non localisables ».
    const unusable = todo.filter((o) => locateOrder(o.zip, o.city).kind === 'unknown');
    const frTodo = todo.filter((o) => locateOrder(o.zip, o.city).kind === 'fr').slice(0, FR_BATCH);
    const foreignTodo = frTodo.length === 0 ? todo.filter((o) => locateOrder(o.zip, o.city).kind === 'country').slice(0, FOREIGN_BATCH) : [];

    const results = new Map<string, GeoResult | null>();
    for (const o of unusable) results.set(o.id, null);
    await pool(frTodo, FR_CONCURRENCY, async (o: GeoOrderRow) => {
      results.set(o.id, await geocodeFrance(o.line1, o.zip, plainCity(o.city)).catch(() => null));
    });
    for (const o of foreignTodo) {
      const info = foreignInfo(o);
      results.set(o.id, info ? await geocodeForeign(o.line1, o.zip, plainCity(o.city), info.name, info.code).catch(() => null) : null);
      await new Promise((r) => setTimeout(r, 1100)); // Nominatim : 1 requête par seconde
    }

    const today = new Date().toISOString().slice(0, 10);
    const data = [...results].map(([id, r]) => ({
      key: `${GEO_PREFIX}${id}`,
      value: JSON.stringify(r ? { ...r, at: today } : { fail: true, at: today }),
    }));
    if (data.length) await prisma.siteSetting.createMany({ data, skipDuplicates: true });

    const byId = new Map(orders.map((o) => [o.id, o]));
    const points: GeoPoint[] = [];
    let newFail = 0;
    for (const [id, r] of results) {
      const o = byId.get(id);
      if (!r) newFail++;
      else if (o) {
        const p = toPoint(o, r);
        if (p) points.push(p);
      }
    }
    return {
      ok: true,
      points,
      remaining: todo.length - results.size,
      failed: countFailed(cache) + newFail,
      processed: results.size,
    };
  } catch (e) {
    console.error('geocodeNextBatch', e);
    return { ok: false, error: 'La localisation a rencontré un problème. Réessaie dans un instant.' };
  }
}

const countFailed = (cache: Map<string, { fail?: true }>) => [...cache.values()].filter((v) => v.fail).length;

// Efface les échecs mémorisés pour retenter leur localisation (par exemple après avoir corrigé une adresse).
export async function retryFailedGeocoding(): Promise<{ ok: true; cleared: number }> {
  await requireAdminUser();
  const res = await prisma.siteSetting.deleteMany({ where: { key: { startsWith: GEO_PREFIX }, value: { contains: '"fail"' } } });
  return { ok: true, cleared: res.count };
}
