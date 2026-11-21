'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import {
  GROUPS,
  GROUP_COLORS,
  GROUP_ICONS,
  GROUP_LABELS,
  PERIODS,
  PRECISION_LABELS,
  emptyCell,
  type GeoAgg,
  type GeoPoint,
  type PeriodKey,
  type StatusGroup,
} from '@/lib/orderGeo';
import { geocodeNextBatch, retryFailedGeocoding } from './actions';

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });

const STATUS_ONE: Record<StatusGroup, string> = { valid: 'commande valide', refunded: 'commande remboursée', cancelled: 'commande annulée' };

type Props = { aggs: Record<PeriodKey, GeoAgg>; points: GeoPoint[]; todo: number; failed: number };

export default function OrdersGeoMap({ aggs, points: initialPoints, todo: initialTodo, failed: initialFailed }: Props) {
  const [points, setPoints] = useState<GeoPoint[]>(initialPoints);
  const [todo, setTodo] = useState(initialTodo);
  const [failed, setFailed] = useState(initialFailed);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState('');
  const [on, setOn] = useState<Record<StatusGroup, boolean>>({ valid: true, refunded: true, cancelled: true });
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [ready, setReady] = useState(false);

  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ L: typeof import('leaflet'); map: LeafletMap; layer: LayerGroup } | null>(null);
  const fitted = useRef(false);
  const runFlag = useRef(false);
  const initialTotal = useRef(initialTodo);

  // ---- Localisation des adresses par petits paquets (barre de progression) ----
  const run = useCallback(async () => {
    if (runFlag.current) return;
    runFlag.current = true;
    setRunning(true);
    setErr('');
    try {
      while (runFlag.current) {
        const r = await geocodeNextBatch();
        if (!r.ok) {
          setErr(r.error);
          break;
        }
        if (r.points.length) setPoints((prev) => [...prev, ...r.points]);
        setTodo(r.remaining);
        setFailed(r.failed);
        if (r.remaining === 0 || r.processed === 0) break;
      }
    } catch {
      setErr('Connexion interrompue. Clique sur « Reprendre » pour continuer.');
    } finally {
      runFlag.current = false;
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    if (initialTodo > 0) void run();
    return () => {
      runFlag.current = false; // on arrête la boucle si on quitte l'onglet ou la page
    };
  }, [initialTodo, run]);

  // ---- Carte OpenStreetMap (Leaflet) ----
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapDiv.current) return;
      map = L.map(mapDiv.current, { scrollWheelZoom: true }).setView([46.6, 2.4], 5);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      }).addTo(map);
      const layer = L.layerGroup().addTo(map);
      mapRef.current = { L, map, layer };
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current = null;
      map?.remove();
    };
  }, []);

  const periodDays = PERIODS.find((p) => p.key === period)?.days ?? null;
  const visible = useMemo(() => {
    const now = Date.now();
    return points.filter((p) => on[p.g] && (periodDays === null || (now - new Date(p.d).getTime()) / 86_400_000 <= periodDays));
  }, [points, on, periodDays]);

  const fit = useCallback(() => {
    const m = mapRef.current;
    if (!m || visible.length === 0) return;
    m.map.fitBounds(m.L.latLngBounds(visible.map((p) => [p.lat, p.lon] as [number, number])), { padding: [30, 30], maxZoom: 12 });
  }, [visible]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    const { L, layer } = m;
    layer.clearLayers();
    for (const p of visible) {
      const color = GROUP_COLORS[p.g];
      const approx = p.p === 'ville';
      L.circleMarker([p.lat, p.lon], {
        radius: 7,
        color: approx ? color : '#ffffff',
        weight: approx ? 2 : 1.5,
        dashArray: approx ? '3' : undefined,
        fillColor: color,
        fillOpacity: approx ? 0.3 : 0.9,
      })
        .bindPopup(
          `<div style="font:13px/1.4 system-ui,sans-serif">` +
            `<strong>${GROUP_ICONS[p.g]} Commande n° ${p.n}</strong><br>` +
            `${esc(p.c)} · ${dateFr(p.d)}<br>${eur(p.t)} · ${STATUS_ONE[p.g]}<br>` +
            `<span style="color:#6b7280">${esc(PRECISION_LABELS[p.p])}</span><br>` +
            `<a href="/admin/commandes/${encodeURIComponent(p.id)}" style="color:#0E7FDB;font-weight:600">Ouvrir la commande →</a></div>`,
        )
        .addTo(layer);
    }
    if (!fitted.current && visible.length > 0) {
      fitted.current = true;
      fit();
    }
  }, [ready, visible, fit]);

  // ---- Boutons de filtre ----
  const totals = useMemo(() => {
    const t = emptyCell();
    const a = aggs[period];
    for (const c of [...Object.values(a.countries), a.unknown]) {
      for (const g of GROUPS) {
        t[g].n += c[g].n;
        t[g].sum += c[g].sum;
      }
    }
    return t;
  }, [aggs, period]);
  const allOn = GROUPS.every((g) => on[g]);
  const toggle = (g: StatusGroup) => setOn((s) => ({ ...s, [g]: !s[g] }));
  const done = Math.max(0, initialTotal.current - todo);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-stretch">
          <button
            type="button"
            onClick={() => setOn({ valid: true, refunded: true, cancelled: true })}
            className={`px-3 py-2 rounded-lg border text-sm font-semibold ${allOn ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            Tout afficher
          </button>
          {GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggle(g)}
              aria-pressed={on[g]}
              className={`px-3 py-2 rounded-lg border text-sm text-left transition ${on[g] ? 'text-gray-900 shadow-sm' : 'bg-white text-gray-400 border-gray-200'}`}
              style={on[g] ? { borderColor: GROUP_COLORS[g], background: `${GROUP_COLORS[g]}14` } : undefined}
            >
              <span className="font-semibold">
                {on[g] ? GROUP_ICONS[g] : '▫️'} {GROUP_LABELS[g]}
              </span>
              <span className="block text-xs">
                {totals[g].n} commande{totals[g].n > 1 ? 's' : ''} · {eur(totals[g].sum)}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-sm">
          <span className="text-gray-500 mr-1">Période :</span>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`px-2.5 py-1 rounded-md border ${period === p.key ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              style={period === p.key ? { background: '#0E7FDB', borderColor: '#0E7FDB' } : undefined}
            >
              {p.label}
            </button>
          ))}
          <button type="button" onClick={fit} className="ml-auto px-2.5 py-1 rounded-md border border-gray-300 hover:bg-gray-50">
            🎯 Recentrer la carte
          </button>
        </div>

        {todo > 0 && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                📡 Localisation des adresses : <strong>{done}</strong> sur <strong>{initialTotal.current}</strong>
                {running ? ' en cours…' : ' en pause.'} Les points apparaissent au fur et à mesure.
              </span>
              {running ? (
                <button type="button" onClick={() => (runFlag.current = false)} className="px-2.5 py-1 rounded-md border border-blue-300 bg-white">
                  Mettre en pause
                </button>
              ) : (
                <button type="button" onClick={() => void run()} className="px-2.5 py-1 rounded-md border border-blue-300 bg-white font-semibold">
                  Reprendre
                </button>
              )}
            </div>
            <div className="h-1.5 mt-2 rounded bg-blue-100 overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${initialTotal.current ? Math.min(100, (done / initialTotal.current) * 100) : 0}%` }} />
            </div>
          </div>
        )}
        {err && <p className="text-sm text-red-600">{err}</p>}
        {!GROUPS.some((g) => on[g]) && <p className="text-sm text-amber-700">Aucune catégorie sélectionnée : clique sur « Tout afficher » ou sur l’une des catégories.</p>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-2">
        <div ref={mapDiv} className="relative z-0 w-full rounded-lg" style={{ height: 600 }} />
      </div>

      <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1">
        <p>
          <strong>{visible.length}</strong> commande{visible.length > 1 ? "s" : ""} affichée{visible.length > 1 ? "s" : ""} sur la carte.
          {failed > 0 && (
            <>
              {' '}
              {failed > 1 ? (
                <>
                  <strong>{failed}</strong> adresses n’ont pas pu être localisées
                </>
              ) : (
                <>
                  <strong>1</strong> adresse n’a pas pu être localisée
                </>
              )}{' '}
              (adresse incomplète ou inconnue).{' '}
              <button
                type="button"
                className="underline text-blue-700"
                onClick={async () => {
                  await retryFailedGeocoding();
                  window.location.reload();
                }}
              >
                Réessayer
              </button>
            </>
          )}
        </p>
        <p className="text-xs text-gray-500">
          Pastille pleine = position à l’adresse ou dans la rue. Pastille pointillée et pâle = adresse introuvable, on montre le centre de la ville.
          « Valides » = commandes payées (payées, en préparation, expédiées, livrées) ; les paniers non payés et les renvois gratuits ne sont pas comptés.
          Les adresses sont localisées par le service de géocodage de l’État (IGN) pour la France et par OpenStreetMap (Nominatim) pour l’étranger ; seule l’adresse est envoyée, jamais le nom ni les
          coordonnées du client. Fond de carte © contributeurs OpenStreetMap.
        </p>
      </div>
    </div>
  );
}
