'use client';

import { useMemo, useState } from 'react';
import {
  GROUPS,
  GROUP_COLORS,
  GROUP_ICONS,
  GROUP_LABELS,
  OUTRE_MER_ZONES,
  PERIODS,
  emptyCell,
  type Cell,
  type GeoAgg,
  type PeriodKey,
  type StatusGroup,
} from '@/lib/orderGeo';
import { WORLD_COUNTRIES, WORLD_EUROPE_VIEWBOX, WORLD_POINTS, WORLD_VIEWBOX } from '@/lib/mapGeoWorld';
import { FRANCE_DEPARTEMENTS, FRANCE_VIEWBOX } from '@/lib/mapGeoFrance';

// Fonds de carte : pays © Natural Earth (domaine public, paquet world-atlas) ; départements © @svg-maps/france.departments
// (licence CC BY 4.0). Rien n'est chargé depuis un service externe.

const BRAND = '#0E7FDB';
const NONE = '#e5e7eb';

type Metric = 'count' | 'amount';
type Active = { type: 'country' | 'fr'; code: string } | null;

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

let regionNames: Intl.DisplayNames | null = null;
function countryLabel(code: string): string {
  try {
    regionNames ??= new Intl.DisplayNames(['fr'], { type: 'region' });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

const DEPT_NAMES: Record<string, string> = Object.fromEntries(FRANCE_DEPARTEMENTS.map(([id, name]) => [id, name]));
for (const z of OUTRE_MER_ZONES) DEPT_NAMES[z.code] = z.name;
const PARIS_ZONES = [
  { code: '75', name: 'Paris' },
  { code: '92', name: 'Hauts-de-Seine' },
  { code: '93', name: 'Seine-Saint-Denis' },
  { code: '94', name: 'Val-de-Marne' },
];
const zoneLabel = (a: NonNullable<Active>) => (a.type === 'country' ? countryLabel(a.code) : `${a.code} – ${DEPT_NAMES[a.code] ?? a.code}`);

export default function OrdersMap({ aggs }: { aggs: Record<PeriodKey, GeoAgg> }) {
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [on, setOn] = useState<Record<StatusGroup, boolean>>({ valid: true, refunded: true, cancelled: true });
  const [metric, setMetric] = useState<Metric>('count');
  const [europe, setEurope] = useState(false);
  const [active, setActive] = useState<Active>(null);

  const agg = aggs[period];
  const picked = GROUPS.filter((g) => on[g]);
  const allOn = picked.length === GROUPS.length;
  // Une seule catégorie choisie : la carte prend sa couleur (vert / orange / rouge). Plusieurs : bleu de la marque.
  const color = picked.length === 1 ? GROUP_COLORS[picked[0]] : BRAND;

  const val = (c: Cell | undefined): number => {
    if (!c) return 0;
    let t = 0;
    for (const g of picked) t += metric === 'count' ? c[g].n : c[g].sum;
    return t;
  };
  const fmt = (v: number) => (metric === 'count' ? `${v}` : eur(v));
  const fmtCell = (c: Cell | undefined) => fmt(val(c));

  // Totaux par catégorie (toujours visibles sur les boutons, quel que soit le filtre)
  const totals = useMemo(() => {
    const t = emptyCell();
    for (const c of [...Object.values(agg.countries), agg.unknown]) {
      for (const g of GROUPS) {
        t[g].n += c[g].n;
        t[g].sum += c[g].sum;
      }
    }
    return t;
  }, [agg]);

  const maxCountry = Math.max(0, ...Object.values(agg.countries).map(val));
  const maxFrance = Math.max(0, ...Object.values(agg.france).map(val));
  // Échelle logarithmique : une zone avec 1 commande reste visible à côté de la France avec des centaines.
  const opacity = (v: number, max: number) => (v <= 0 || max <= 0 ? 1 : 0.3 + 0.7 * (Math.log(1 + v) / Math.log(1 + max)));

  const toggle = (g: StatusGroup) => setOn((s) => ({ ...s, [g]: !s[g] }));
  const showAll = () => setOn({ valid: true, refunded: true, cancelled: true });

  const activeCell: Cell | undefined = active ? (active.type === 'country' ? agg.countries[active.code] : agg.france[active.code]) : undefined;

  const rankedCountries = Object.entries(agg.countries)
    .map(([code, c]) => ({ key: code, label: countryLabel(code), v: val(c) }))
    .filter((r) => r.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, 8);
  const rankedDepts = Object.entries(agg.france)
    .map(([code, c]) => ({ key: code, label: `${code} – ${DEPT_NAMES[code] ?? code}`, v: val(c) }))
    .filter((r) => r.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, 10);
  const unknownVal = val(agg.unknown);
  const grandTotal = picked.reduce((t, g) => t + (metric === 'count' ? totals[g].n : totals[g].sum), 0);

  const pathStyle = (v: number, max: number, isActive: boolean) => ({
    fill: v > 0 ? color : NONE,
    fillOpacity: opacity(v, max),
    stroke: isActive ? '#0B5FA5' : '#ffffff',
    strokeWidth: isActive ? 1.6 : 0.5,
  });

  const zoneTiles = (title: string, zones: { code: string; name: string }[]) => (
    <div>
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-2">
        {zones.map((z) => {
          const v = val(agg.france[z.code]);
          const isActive = active?.type === 'fr' && active.code === z.code;
          return (
            <button
              key={z.code}
              type="button"
              onMouseEnter={() => setActive({ type: 'fr', code: z.code })}
              onClick={() => setActive({ type: 'fr', code: z.code })}
              className={`rounded-lg border p-2 text-left text-xs ${isActive ? 'border-blue-700 ring-1 ring-blue-700' : 'border-gray-200'}`}
              style={{ background: v > 0 ? `${color}${Math.round(opacity(v, Math.max(maxFrance, v)) * 130 + 40).toString(16).padStart(2, '0')}` : '#f3f4f6' }}
            >
              <span className="block text-gray-600">{z.code} – {z.name}</span>
              <span className="block text-base font-bold text-gray-900">{fmt(v)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Filtres */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-stretch">
          <button
            type="button"
            onClick={showAll}
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

        <div className="flex flex-wrap gap-x-6 gap-y-2 items-center text-sm">
          <div className="flex items-center gap-1">
            <span className="text-gray-500 mr-1">Période :</span>
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={`px-2.5 py-1 rounded-md border ${period === p.key ? 'bg-brand text-white border-brand' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                style={period === p.key ? { background: BRAND, borderColor: BRAND } : undefined}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 mr-1">Afficher :</span>
            {([['count', 'Nombre de commandes'], ['amount', 'Montant TTC']] as [Metric, string][]).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMetric(k)}
                className={`px-2.5 py-1 rounded-md border ${metric === k ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                style={metric === k ? { background: BRAND, borderColor: BRAND } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {picked.length === 0 && <p className="text-sm text-amber-700">Aucune catégorie sélectionnée : clique sur « Tout afficher » ou sur l’une des catégories.</p>}
      </div>

      {/* Carte du monde */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="font-bold">🌍 Dans le monde</h2>
          <button type="button" onClick={() => setEurope((e) => !e)} className="text-sm px-2.5 py-1 rounded-md border border-gray-300 hover:bg-gray-50">
            {europe ? '🌍 Voir le monde entier' : '🇪🇺 Zoomer sur l’Europe'}
          </button>
        </div>
        <svg viewBox={europe ? WORLD_EUROPE_VIEWBOX : WORLD_VIEWBOX} className="w-full h-auto rounded-lg" style={{ background: '#f1f7fc' }} role="img" aria-label="Carte du monde des commandes">
          {WORLD_COUNTRIES.map(([code, d]) => {
            const v = val(agg.countries[code.toUpperCase()]);
            const isActive = active?.type === 'country' && active.code === code.toUpperCase();
            return (
              <path
                key={code}
                d={d}
                {...pathStyle(v, maxCountry, isActive)}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer"
                onMouseEnter={() => setActive({ type: 'country', code: code.toUpperCase() })}
                onClick={() => setActive({ type: 'country', code: code.toUpperCase() })}
              >
                <title>{`${countryLabel(code.toUpperCase())} : ${fmt(v)}`}</title>
              </path>
            );
          })}
          {Object.entries(WORLD_POINTS).map(([code, [x, y]]) => {
            const v = val(agg.countries[code]);
            const isActive = active?.type === 'country' && active.code === code;
            return (
              <circle
                key={code}
                cx={x}
                cy={y}
                r={europe ? 1.2 : 4}
                fill={v > 0 ? color : '#cbd5e1'}
                fillOpacity={v > 0 ? opacity(v, maxCountry) : 1}
                stroke={isActive ? '#0B5FA5' : '#ffffff'}
                strokeWidth={isActive ? 1.6 : 0.8}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer"
                onMouseEnter={() => setActive({ type: 'country', code })}
                onClick={() => setActive({ type: 'country', code })}
              >
                <title>{`${countryLabel(code)} : ${fmt(v)}`}</title>
              </circle>
            );
          })}
        </svg>
        <p className="text-xs text-gray-400 mt-1">La France comprend la métropole et l’Outre-mer. Les petits pays sans surface sur la carte (Malte, Monaco, Andorre…) sont des points.</p>
      </div>

      {/* Zone survolée + classements */}
      <div className="grid md:grid-cols-3 gap-5">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="font-bold mb-2">📍 Détail de la zone</h2>
          {active ? (
            <div>
              <div className="text-lg font-semibold mb-2">{zoneLabel(active)}</div>
              <table className="w-full text-sm">
                <tbody>
                  {GROUPS.map((g) => {
                    const b = (activeCell ?? emptyCell())[g];
                    return (
                      <tr key={g} className={on[g] ? '' : 'opacity-40'}>
                        <td className="py-1">
                          {GROUP_ICONS[g]} {GROUP_LABELS[g]}
                        </td>
                        <td className="py-1 text-right">{b.n}</td>
                        <td className="py-1 text-right text-gray-500">{eur(b.sum)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t font-semibold">
                    <td className="py-1">Selon ton filtre</td>
                    <td className="py-1 text-right" colSpan={2}>
                      {fmtCell(activeCell)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Survole ou touche une zone de la carte pour voir ses commandes.</p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="font-bold mb-2">🏆 Pays</h2>
          <Ranking rows={rankedCountries} max={rankedCountries[0]?.v ?? 0} fmt={fmt} color={color} onPick={(k) => setActive({ type: 'country', code: k })} />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="font-bold mb-2">🏆 Départements français</h2>
          <Ranking rows={rankedDepts} max={rankedDepts[0]?.v ?? 0} fmt={fmt} color={color} onPick={(k) => setActive({ type: 'fr', code: k })} />
        </div>
      </div>

      {/* France par département */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="font-bold mb-2">🇫🇷 France par département</h2>
        <div className="grid md:grid-cols-[minmax(0,1fr)_260px] gap-4 items-start">
          <svg viewBox={FRANCE_VIEWBOX} className="w-full h-auto max-h-[640px] rounded-lg" style={{ background: '#f1f7fc' }} role="img" aria-label="Carte de France des commandes par département">
            {FRANCE_DEPARTEMENTS.map(([code, name, d]) => {
              const v = val(agg.france[code]);
              const isActive = active?.type === 'fr' && active.code === code;
              return (
                <path
                  key={code}
                  d={d}
                  {...pathStyle(v, maxFrance, isActive)}
                  strokeWidth={isActive ? 2 : 0.8}
                  className="cursor-pointer"
                  onMouseEnter={() => setActive({ type: 'fr', code })}
                  onClick={() => setActive({ type: 'fr', code })}
                >
                  <title>{`${code} – ${name} : ${fmt(v)}`}</title>
                </path>
              );
            })}
          </svg>
          <div className="space-y-4">
            {zoneTiles('Paris et petite couronne', PARIS_ZONES)}
            {zoneTiles('Outre-mer', OUTRE_MER_ZONES)}
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-4">
        <strong>Total selon ton filtre : {fmt(grandTotal)}</strong>
        {unknownVal > 0 && <> · dont <strong>{fmt(unknownVal)}</strong> non localisé (adresse sans code postal reconnu)</>}
        <p className="text-xs text-gray-400 mt-1">
          « Valides » = commandes payées (payées, en préparation, expédiées, livrées). Les paniers non payés ne sont pas comptés, ni les renvois gratuits. Fonds de carte : Natural Earth (domaine public) et
          @svg-maps/france.departments (CC BY 4.0).
        </p>
      </div>
    </div>
  );
}

function Ranking({
  rows,
  max,
  fmt,
  color,
  onPick,
}: {
  rows: { key: string; label: string; v: number }[];
  max: number;
  fmt: (v: number) => string;
  color: string;
  onPick: (key: string) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">Aucune commande pour ce filtre.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.key}>
          <button type="button" onClick={() => onPick(r.key)} className="w-full text-left">
            <div className="flex justify-between text-sm">
              <span className="truncate pr-2">{r.label}</span>
              <span className="font-semibold">{fmt(r.v)}</span>
            </div>
            <div className="h-1.5 rounded bg-gray-100 overflow-hidden">
              <div className="h-full rounded" style={{ width: `${Math.max(4, (r.v / max) * 100)}%`, background: color }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
