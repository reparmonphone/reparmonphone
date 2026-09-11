'use client';

import { useMemo, useState } from 'react';

type DailyPoint = { date: string; count: number }; // date = 'YYYY-MM-DD', ordre croissant

const PERIODS = [
  { key: '1j', label: '1 jour' },
  { key: '3j', label: '3 jours' },
  { key: '1sem', label: '1 semaine' },
  { key: '1mois', label: '1 mois' },
  { key: '6mois', label: '6 mois' },
  { key: '1an', label: '1 an' },
] as const;
type PeriodKey = (typeof PERIODS)[number]['key'];

// Palette catégorielle validée (skill dataviz — node scripts/validate_palette.js) : ordre fixe, jamais
// réordonné ni cyclé. Jusqu'à 5 semaines superposées, ce qui reste valide sur les paires ADJACENTES
// (le cas d'usage d'une courbe superposée, par opposition à un nuage de points en "toutes paires").
const WEEK_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
const DOW_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export default function VisitsEvolutionChart({
  dailyVisits,
  todayHourly,
}: {
  dailyVisits: DailyPoint[];
  todayHourly: number[];
}) {
  const [period, setPeriod] = useState<PeriodKey>('1mois');
  const [compare, setCompare] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const series = useMemo(() => buildSeries(period, dailyVisits, todayHourly), [period, dailyVisits, todayHourly]);
  const weeks = useMemo(() => buildWeekComparison(dailyVisits), [dailyVisits]);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold">Visites — évolution</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setPeriod(p.key);
                  setHoverIndex(null);
                }}
                disabled={compare}
                className={`text-xs px-2.5 py-1 rounded-md transition ${
                  period === p.key && !compare ? 'bg-white shadow text-gray-800 font-semibold' : 'text-gray-500 hover:text-gray-700'
                } ${compare ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setCompare((c) => !c);
              setHoverIndex(null);
            }}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
              compare ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            📊 Comparer les semaines
          </button>
        </div>
      </div>

      {compare ? (
        <>
          <p className="text-xs text-gray-400 mb-3">
            Les 5 dernières semaines superposées (lundi à dimanche) pour repérer les tendances — la
            semaine en cours s&apos;arrête à aujourd&apos;hui.
          </p>
          <WeekCompareChart weeks={weeks} hoverIndex={hoverIndex} onHover={setHoverIndex} />
        </>
      ) : (
        <SingleLineChart data={series} hoverIndex={hoverIndex} onHover={setHoverIndex} />
      )}
    </div>
  );
}

function buildSeries(period: PeriodKey, dailyVisits: DailyPoint[], todayHourly: number[]) {
  if (period === '1j') {
    return todayHourly.map((count, h) => ({ label: `${h}h`, value: count }));
  }
  if (period === '3j') {
    return dailyVisits.slice(-3).map((d) => ({ label: formatDayLabel(d.date), value: d.count }));
  }
  if (period === '1sem') {
    return dailyVisits.slice(-7).map((d) => ({ label: formatDayLabel(d.date), value: d.count }));
  }
  if (period === '1mois') {
    return dailyVisits.slice(-30).map((d) => ({ label: formatDayLabel(d.date), value: d.count }));
  }
  if (period === '6mois') {
    return bucketByWeek(dailyVisits.slice(-182));
  }
  // '1an'
  return bucketByMonth(dailyVisits);
}

function formatDayLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function bucketByWeek(days: DailyPoint[]) {
  const buckets: { label: string; value: number }[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    if (chunk.length === 0) continue;
    buckets.push({ label: formatDayLabel(chunk[0].date), value: chunk.reduce((s, d) => s + d.count, 0) });
  }
  return buckets;
}

function bucketByMonth(days: DailyPoint[]) {
  const map = new Map<string, number>();
  for (const d of days) {
    const key = d.date.slice(0, 7); // YYYY-MM
    map.set(key, (map.get(key) ?? 0) + d.count);
  }
  return [...map.entries()].map(([key, value]) => ({
    label: new Date(`${key}-01`).toLocaleDateString('fr-FR', { month: 'short' }),
    value,
  }));
}

// Lundi = 0 ... Dimanche = 6 (dateStr est parsé comme minuit UTC, cohérent avec le bucketing serveur)
function isoDayOfWeek(dateStr: string) {
  const day = new Date(dateStr).getUTCDay(); // 0=Dim..6=Sam
  return (day + 6) % 7;
}

// Regroupe les ~6 dernières semaines calendaires (lundi-dimanche) et garde les 5 plus récentes, pour
// être sûr d'avoir 5 semaines pleines même si la fenêtre de récupération ne tombe pas pile sur un lundi.
// La semaine en cours peut être incomplète : les jours pas encore passés valent `null` (pas 0), pour
// que la courbe s'arrête net à aujourd'hui plutôt que de chuter à zéro.
function buildWeekComparison(dailyVisits: DailyPoint[]) {
  const days = dailyVisits.slice(-42);
  const weekMap = new Map<string, DailyPoint[]>();
  for (const d of days) {
    const dow = isoDayOfWeek(d.date);
    const monday = new Date(d.date);
    monday.setUTCDate(monday.getUTCDate() - dow);
    const key = monday.toISOString().slice(0, 10);
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(d);
  }
  const weekKeys = [...weekMap.keys()].sort();
  const lastWeeks = weekKeys.slice(-5);

  return lastWeeks.map((weekStart, idx) => {
    const byDow = new Map(weekMap.get(weekStart)!.map((d) => [isoDayOfWeek(d.date), d.count]));
    const points = DOW_LABELS.map((label, dow) => ({ label, value: byDow.has(dow) ? byDow.get(dow)! : null }));
    const end = new Date(weekStart);
    end.setUTCDate(end.getUTCDate() + 6);
    return {
      key: weekStart,
      rangeLabel: `${new Date(weekStart).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} – ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`,
      isCurrent: idx === lastWeeks.length - 1,
      points,
    };
  });
}

// Courbe simple (une série) avec survol/tooltip — période réglable via les boutons au-dessus.
function SingleLineChart({
  data,
  hoverIndex,
  onHover,
}: {
  data: { label: string; value: number }[];
  hoverIndex: number | null;
  onHover: (i: number | null) => void;
}) {
  const width = 600;
  const height = 160;
  const padX = 8;
  const topPad = 22;
  const color = WEEK_COLORS[0];

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 py-10 text-center">Pas encore de données sur cette période.</p>;
  }

  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;
  const points = data.map((d, i) => ({
    ...d,
    x: padX + i * stepX,
    y: topPad + (height - topPad) * (1 - d.value / max),
  }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;
  const maxIndex = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  const labeledIndexes = new Set([0, points.length - 1, maxIndex]);
  const showEveryLabel = points.length <= 8;

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = i;
      }
    });
    onHover(nearest);
  }

  const hovered = hoverIndex != null ? points[hoverIndex] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height + 20}`}
        className="w-full h-auto touch-none"
        onPointerMove={handleMove}
        onPointerLeave={() => onHover(null)}
      >
        <defs>
          <linearGradient id="lc-visits" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#lc-visits)" stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {hovered && (
          <line x1={hovered.x} x2={hovered.x} y1={topPad} y2={height} stroke="#c3c2b7" strokeWidth="1" strokeDasharray="3,3" />
        )}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 5 : i === points.length - 1 ? 4 : 3.5}
              fill="white"
              stroke={color}
              strokeWidth="2"
            />
            {labeledIndexes.has(i) && p.value > 0 && hoverIndex !== i && (
              <text
                x={p.x}
                y={Math.max(9, p.y - 8)}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                fontSize="9"
                className="fill-gray-500"
              >
                {p.value.toLocaleString('fr-FR')}
              </text>
            )}
            {(showEveryLabel || labeledIndexes.has(i)) && (
              <text x={p.x} y={height + 16} textAnchor="middle" fontSize="9" className="fill-gray-400">
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {hovered && (
        <div
          className="absolute top-0 bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 pointer-events-none -translate-x-1/2 shadow-lg whitespace-nowrap"
          style={{ left: `${(hovered.x / width) * 100}%` }}
        >
          <div className="font-bold">{hovered.value.toLocaleString('fr-FR')} visite{hovered.value > 1 ? 's' : ''}</div>
          <div className="text-gray-300">{hovered.label}</div>
        </div>
      )}
    </div>
  );
}

// Courbe superposée (jusqu'à 5 semaines), alignée par jour de semaine — légende obligatoire (>= 2
// séries), texte toujours en encre neutre (jamais dans la couleur de série), tooltip listant toutes
// les semaines au jour survolé.
function WeekCompareChart({
  weeks,
  hoverIndex,
  onHover,
}: {
  weeks: { key: string; rangeLabel: string; isCurrent: boolean; points: { label: string; value: number | null }[] }[];
  hoverIndex: number | null;
  onHover: (i: number | null) => void;
}) {
  if (weeks.length === 0) {
    return <p className="text-sm text-gray-400 py-10 text-center">Pas encore assez de données pour comparer.</p>;
  }

  const width = 600;
  const height = 180;
  const padX = 10;
  const topPad = 14;
  const stepX = (width - padX * 2) / (DOW_LABELS.length - 1);

  const allValues = weeks.flatMap((w) => w.points.map((p) => p.value).filter((v): v is number => v != null));
  const max = Math.max(1, ...allValues);
  const yFor = (v: number) => topPad + (height - topPad) * (1 - v / max);

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.round((relX - padX) / stepX);
    onHover(Math.max(0, Math.min(DOW_LABELS.length - 1, idx)));
  }

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height + 20}`}
          className="w-full h-auto touch-none"
          onPointerMove={handleMove}
          onPointerLeave={() => onHover(null)}
        >
          {hoverIndex != null && (
            <line
              x1={padX + hoverIndex * stepX}
              x2={padX + hoverIndex * stepX}
              y1={topPad}
              y2={height}
              stroke="#c3c2b7"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
          )}
          {weeks.map((w, wi) => {
            const color = WEEK_COLORS[wi % WEEK_COLORS.length];
            const segments: string[] = [];
            let drawing = false;
            w.points.forEach((p, i) => {
              const x = padX + i * stepX;
              if (p.value == null) {
                drawing = false;
                return;
              }
              const y = yFor(p.value);
              segments.push(`${drawing ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`);
              drawing = true;
            });
            return (
              <g key={w.key}>
                <path
                  d={segments.join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth={w.isCurrent ? 2.5 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={w.isCurrent ? 1 : 0.85}
                />
                {w.points.map((p, i) =>
                  p.value == null ? null : (
                    <circle
                      key={i}
                      cx={padX + i * stepX}
                      cy={yFor(p.value)}
                      r={hoverIndex === i ? 4.5 : 3.5}
                      fill="white"
                      stroke={color}
                      strokeWidth="2"
                    />
                  )
                )}
              </g>
            );
          })}
          {DOW_LABELS.map((label, i) => (
            <text key={label} x={padX + i * stepX} y={height + 16} textAnchor="middle" fontSize="9" className="fill-gray-400">
              {label}
            </text>
          ))}
        </svg>
        {hoverIndex != null && (
          <div
            className="absolute top-0 bg-gray-900 text-white text-xs rounded-lg px-2.5 py-2 pointer-events-none shadow-lg -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${((padX + hoverIndex * stepX) / width) * 100}%` }}
          >
            <div className="font-semibold mb-1">{DOW_LABELS[hoverIndex]}</div>
            {weeks.map((w, wi) => {
              const v = w.points[hoverIndex].value;
              return (
                <div key={w.key} className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-0.5 rounded" style={{ backgroundColor: WEEK_COLORS[wi % WEEK_COLORS.length] }} />
                  <span className="text-gray-300">
                    {w.rangeLabel}
                    {w.isCurrent ? ' (en cours)' : ''} :
                  </span>
                  <span className="font-bold">{v == null ? '—' : v.toLocaleString('fr-FR')}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {weeks.map((w, wi) => (
          <div key={w.key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: WEEK_COLORS[wi % WEEK_COLORS.length] }} />
            {w.rangeLabel}
            {w.isCurrent ? ' (en cours)' : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
