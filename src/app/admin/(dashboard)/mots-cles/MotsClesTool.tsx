'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  PIECES,
  DEFAULT_CITIES,
  generateKeywords,
  generateTitles,
  generateArticle,
  parseGscCsv,
  type PieceKey,
  type KeywordScope,
} from '@/lib/keywordGenerator';
import { saveKeywordList } from './actions';

type Props = {
  site: string;
  models: { brand: string; name: string }[];
  priorityUrls: string[];
  savedKeywords: string[];
};

type Tab = 'mots-cles' | 'titres' | 'article' | 'gsc';

const TABS: { id: Tab; label: string }[] = [
  { id: 'mots-cles', label: '🔑 Mots-clés' },
  { id: 'titres', label: '🏷️ Titres & méta' },
  { id: 'article', label: '📝 Brouillon d\'article' },
  { id: 'gsc', label: '🔍 Search Console' },
];

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // presse-papiers indisponible : on ignore, l'utilisateur peut sélectionner le texte à la main
  }
}

function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  // BOM pour qu'Excel lise correctement les accents
  const blob = new Blob(['﻿' + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MotsClesTool({ site, models, priorityUrls, savedKeywords }: Props) {
  const [tab, setTab] = useState<Tab>('mots-cles');
  const [target, setTarget] = useState('');
  const [pieceKeys, setPieceKeys] = useState<PieceKey[]>(['ecran', 'batterie']);
  const [scope, setScope] = useState<KeywordScope>('france');
  const [citiesText, setCitiesText] = useState(DEFAULT_CITIES.join(', '));
  const [mainPieceKey, setMainPieceKey] = useState<PieceKey>('ecran');
  const [articleCity, setArticleCity] = useState('Sainte-Maxime');
  const [saved, setSaved] = useState<string[]>(savedKeywords);
  const [saveMsg, setSaveMsg] = useState('');
  const [pending, startTransition] = useTransition();
  const [gscText, setGscText] = useState('');
  const [copied, setCopied] = useState('');

  const cities = useMemo(() => citiesText.split(',').map((c) => c.trim()).filter(Boolean), [citiesText]);
  const groups = useMemo(() => generateKeywords({ target, pieceKeys, cities, scope }), [target, pieceKeys, cities, scope]);

  // Export en masse "France entière" : tous les modèles de ta base × les pièces cochées, une ligne par mot-clé.
  function exportAllModels() {
    const rows: string[] = ['Marque;Modèle;Catégorie;Mot-clé'];
    for (const m of models) {
      const full = m.name.toLowerCase().includes(m.brand.toLowerCase()) ? m.name : `${m.brand} ${m.name}`;
      for (const g of generateKeywords({ target: full, pieceKeys, cities: [], scope: 'france' })) {
        // On garde uniquement les groupes utiles pour l'achat national, pas les symptômes/questions (trop nombreux).
        if (g.title.startsWith('France') || g.title.startsWith('Achat')) {
          for (const k of g.items) rows.push(`"${m.brand}";"${m.name}";"${g.title}";"${k}"`);
        }
      }
    }
    download('mots-cles-france-tous-modeles.csv', rows.join('\n'));
  }
  const allKeywords = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const mainPiece = PIECES.find((p) => p.key === mainPieceKey) ?? PIECES[0];
  const titleMeta = useMemo(() => (target.trim() ? generateTitles({ target, piece: mainPiece }) : null), [target, mainPiece]);
  const article = useMemo(() => (target.trim() ? generateArticle({ target, piece: mainPiece, city: articleCity }) : null), [target, mainPiece, articleCity]);
  const gscRows = useMemo(() => parseGscCsv(gscText), [gscText]);

  // Opportunités : requêtes déjà vues par Google (impressions) mais pas encore bien placées (pos. 8-30)
  const opportunities = useMemo(
    () => gscRows.filter((r) => r.position >= 8 && r.position <= 30 && r.impressions >= 5).sort((a, b) => b.impressions - a.impressions).slice(0, 50),
    [gscRows]
  );

  function togglePiece(k: PieceKey) {
    setPieceKeys((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  }

  function flash(id: string, text: string) {
    copy(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 1500);
  }

  function saveList() {
    startTransition(async () => {
      const merged = Array.from(new Set([...saved, ...allKeywords]));
      const res = await saveKeywordList(merged);
      setSaved(merged);
      setSaveMsg(`✅ ${res.count} mot(s)-clé(s) enregistré(s)`);
      setTimeout(() => setSaveMsg(''), 3000);
    });
  }

  function clearSaved() {
    if (!confirm('Vider la liste de mots-clés enregistrée ?')) return;
    startTransition(async () => {
      await saveKeywordList([]);
      setSaved([]);
    });
  }

  const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const btn = 'px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-100 transition';
  const btnPrimary = 'px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50';

  return (
    <div className="space-y-5">
      {/* Paramètres communs */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Modèle ou appareil ciblé</label>
          <input
            list="modeles-list"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="ex : iPhone 14, Galaxy S23, Redmi Note 12…"
            className={input}
          />
          <datalist id="modeles-list">
            {models.map((m, i) => (
              <option key={i} value={m.name.toLowerCase().includes(m.brand.toLowerCase()) ? m.name : `${m.brand} ${m.name}`} />
            ))}
          </datalist>
          <p className="text-xs text-gray-400 mt-1">Choisis dans la liste de tes modèles ou tape librement.</p>
        </div>

        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">Pièces à couvrir</p>
          <div className="flex flex-wrap gap-2">
            {PIECES.map((p) => (
              <label
                key={p.key}
                className={`px-3 py-1.5 rounded-full text-sm border cursor-pointer select-none transition ${
                  pieceKeys.includes(p.key) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                <input type="checkbox" className="hidden" checked={pieceKeys.includes(p.key)} onChange={() => togglePiece(p.key)} />
                {p.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">Cible géographique</p>
          <div className="flex flex-wrap gap-2">
            {([
              ['france', '🇫🇷 France entière (vente de pièces)'],
              ['both', 'France + local'],
              ['local', '📍 Local (atelier Sainte-Maxime)'],
            ] as [KeywordScope, string][]).map(([id, label]) => (
              <label
                key={id}
                className={`px-3 py-1.5 rounded-full text-sm border cursor-pointer select-none transition ${
                  scope === id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                <input type="radio" name="scope" className="hidden" checked={scope === id} onChange={() => setScope(id)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        {scope !== 'france' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Villes / zones (séparées par des virgules)</label>
            <input value={citiesText} onChange={(e) => setCitiesText(e.target.value)} className={input} />
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Mots-clés */}
      {tab === 'mots-cles' && (
        <div className="space-y-4">
          {!target.trim() && <p className="text-sm text-gray-500">Renseigne un modèle ci-dessus pour générer des mots-clés.</p>}
          {groups.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600">{allKeywords.length} mots-clés</span>
                <button type="button" className={btn} onClick={() => flash('all', allKeywords.join('\n'))}>
                  {copied === 'all' ? '✅ Copié' : '📋 Tout copier'}
                </button>
                <button
                  type="button"
                  className={btn}
                  onClick={() =>
                    download(
                      `mots-cles-${target.trim().toLowerCase().replace(/\s+/g, '-')}.csv`,
                      'Catégorie;Mot-clé\n' + groups.flatMap((g) => g.items.map((k) => `"${g.title}";"${k}"`)).join('\n')
                    )
                  }
                >
                  ⬇️ Export CSV
                </button>
                <button type="button" className={btnPrimary} disabled={pending} onClick={saveList}>
                  💾 Enregistrer dans ma liste
                </button>
                <button type="button" className={btn} onClick={exportAllModels} title="Un CSV avec tous tes modèles × les pièces cochées">
                  ⬇️ Export France : tous les modèles
                </button>
                {saveMsg && <span className="text-sm text-green-700">{saveMsg}</span>}
              </div>
              {groups.map((g) => (
                <div key={g.title} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{g.title}</h3>
                      <p className="text-xs text-gray-500">{g.hint}</p>
                    </div>
                    <button type="button" className={btn} onClick={() => flash(g.title, g.items.join('\n'))}>
                      {copied === g.title ? '✅' : '📋'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {g.items.map((k) => (
                      <span key={k} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">💾 Ma liste enregistrée ({saved.length})</h3>
              <div className="flex gap-2">
                <button type="button" className={btn} disabled={!saved.length} onClick={() => flash('saved', saved.join('\n'))}>
                  {copied === 'saved' ? '✅ Copié' : '📋 Copier'}
                </button>
                <button type="button" className={btn} disabled={!saved.length} onClick={() => download('mots-cles-enregistres.csv', 'Mot-clé\n' + saved.map((k) => `"${k}"`).join('\n'))}>
                  ⬇️ CSV
                </button>
                <button type="button" className={btn} disabled={!saved.length || pending} onClick={clearSaved}>
                  🗑️ Vider
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Réutilise ces mots-clés dans les titres produits, descriptions, guides de réparation et ta fiche Google Business.
            </p>
            {saved.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 max-h-48 overflow-y-auto">
                {saved.map((k) => (
                  <span key={k} className="px-2 py-1 bg-blue-50 rounded text-xs text-blue-800">
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Titres & méta */}
      {tab === 'titres' && (
        <div className="space-y-4">
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">Pièce principale</label>
            <select value={mainPieceKey} onChange={(e) => setMainPieceKey(e.target.value as PieceKey)} className={input}>
              {PIECES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          {!titleMeta && <p className="text-sm text-gray-500">Renseigne un modèle ci-dessus.</p>}
          {titleMeta && (
            <>
              <section className="space-y-2">
                <h3 className="font-semibold text-gray-900">Balises title (idéal ≤ 60 caractères)</h3>
                {titleMeta.titles.map((t, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-blue-700 text-base leading-snug">{t.text}</p>
                      <p className={`text-xs mt-1 ${t.ok ? 'text-green-600' : 'text-orange-600'}`}>
                        {t.length} caractères {t.ok ? '✓' : '(un peu long, Google peut couper)'}
                      </p>
                    </div>
                    <button type="button" className={btn} onClick={() => flash(`t${i}`, t.text)}>
                      {copied === `t${i}` ? '✅' : '📋'}
                    </button>
                  </div>
                ))}
              </section>
              <section className="space-y-2">
                <h3 className="font-semibold text-gray-900">Meta descriptions (idéal ≤ 155 caractères)</h3>
                {titleMeta.metas.map((m, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-700">{m.text}</p>
                      <p className={`text-xs mt-1 ${m.ok ? 'text-green-600' : 'text-orange-600'}`}>
                        {m.length} caractères {m.ok ? '✓' : '(un peu long, Google peut couper)'}
                      </p>
                    </div>
                    <button type="button" className={btn} onClick={() => flash(`m${i}`, m.text)}>
                      {copied === `m${i}` ? '✅' : '📋'}
                    </button>
                  </div>
                ))}
              </section>
              <p className="text-xs text-gray-500">
                Colle ensuite le texte choisi dans les champs « Titre SEO » / « Meta description » de la fiche produit (/admin/produits).
              </p>
            </>
          )}
        </div>
      )}

      {/* Article */}
      {tab === 'article' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pièce principale</label>
              <select value={mainPieceKey} onChange={(e) => setMainPieceKey(e.target.value as PieceKey)} className={input}>
                {PIECES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ville mise en avant</label>
              <input value={articleCity} onChange={(e) => setArticleCity(e.target.value)} className={input} />
            </div>
          </div>
          {!article && <p className="text-sm text-gray-500">Renseigne un modèle ci-dessus.</p>}
          {article && (
            <>
              <div className="flex gap-2">
                <button type="button" className={btnPrimary} onClick={() => flash('art', article.markdown)}>
                  {copied === 'art' ? '✅ Copié' : '📋 Copier le brouillon'}
                </button>
                <button type="button" className={btn} onClick={() => flash('faq', `<script type="application/ld+json">\n${article.faqJsonLd}\n</script>`)}>
                  {copied === 'faq' ? '✅ Copié' : '📋 Copier la FAQ (balisage Google)'}
                </button>
              </div>
              <textarea readOnly value={article.markdown} className={`${input} font-mono h-96`} />
              <p className="text-xs text-gray-500">
                C&apos;est une trame : complète les étapes spécifiques au modèle (vis, nappes, photos) avant de publier dans /admin/guides. Un article généré tel quel,
                sans contenu propre à ton expérience, aide peu au référencement.
              </p>
            </>
          )}
        </div>
      )}

      {/* Search Console */}
      {tab === 'gsc' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">1. Envoyer le sitemap à Google</h3>
            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
              <li>
                Ouvre{' '}
                <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  Google Search Console
                </a>{' '}
                et choisis ta propriété reparmonphone.fr.
              </li>
              <li>Menu « Sitemaps » → colle l&apos;adresse ci-dessous → « Envoyer ».</li>
            </ol>
            <div className="flex items-center gap-2">
              <code className="px-2 py-1 bg-gray-100 rounded text-sm">{site}/sitemap.xml</code>
              <button type="button" className={btn} onClick={() => flash('sm', `${site}/sitemap.xml`)}>
                {copied === 'sm' ? '✅' : '📋'}
              </button>
            </div>
            <p className="text-xs text-gray-500">Ton sitemap est régénéré toutes les heures, et IndexNow (page SEO & Référencement) prévient Bing/Yandex automatiquement.</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">2. Demander l&apos;indexation des pages clés</h3>
            <p className="text-sm text-gray-700">
              Dans Search Console, colle une URL dans la barre du haut (« Inspection de l&apos;URL »), puis « Demander une indexation ». Limite d&apos;environ 10 à 20 demandes
              par jour : commence par les pages ci-dessous.
            </p>
            <div className="flex gap-2">
              <button type="button" className={btn} onClick={() => flash('urls', priorityUrls.join('\n'))}>
                {copied === 'urls' ? '✅ Copié' : '📋 Copier la liste'}
              </button>
            </div>
            <ul className="text-xs text-gray-600 space-y-0.5 max-h-48 overflow-y-auto">
              {priorityUrls.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">3. Trouver les opportunités à partir de tes vraies requêtes</h3>
            <p className="text-sm text-gray-700">
              Dans Search Console → Performances → onglet « Requêtes » → Exporter → CSV. Ouvre le fichier « Requêtes.csv », copie tout son contenu et colle-le ici : les requêtes où Google te montre
              déjà mais mal placé (position 8 à 30) sont les plus faciles à faire monter.
            </p>
            <textarea
              value={gscText}
              onChange={(e) => setGscText(e.target.value)}
              placeholder="Requêtes les plus fréquentes,Clics,Impressions,CTR,Position&#10;écran iphone 14,2,120,1.6%,14.2"
              className={`${input} font-mono h-32`}
            />
            {gscText.trim() && gscRows.length === 0 && <p className="text-sm text-orange-600">Format non reconnu : colle l&apos;export « Requêtes » complet, en-têtes compris.</p>}
            {opportunities.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-1 pr-3">Requête</th>
                      <th className="py-1 pr-3 text-right">Impressions</th>
                      <th className="py-1 pr-3 text-right">Clics</th>
                      <th className="py-1 text-right">Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((r) => (
                      <tr key={r.query} className="border-b border-gray-100">
                        <td className="py-1 pr-3">{r.query}</td>
                        <td className="py-1 pr-3 text-right">{r.impressions}</td>
                        <td className="py-1 pr-3 text-right">{r.clicks}</td>
                        <td className="py-1 text-right">{r.position.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" className={`${btn} mt-3`} onClick={() => flash('opp', opportunities.map((o) => o.query).join('\n'))}>
                  {copied === 'opp' ? '✅ Copié' : '📋 Copier ces requêtes'}
                </button>
                <p className="text-xs text-gray-500 mt-2">Pour chacune : ajoute-la dans le titre/la description du produit ou du guide correspondant, ou crée un guide dédié.</p>
              </div>
            )}
            {gscRows.length > 0 && opportunities.length === 0 && <p className="text-sm text-gray-600">Aucune requête en position 8-30 avec au moins 5 impressions pour l&apos;instant.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
