'use client';

import { useRef, useState, useTransition } from 'react';
import { runSupplierCheckAction } from './actions';
import type { SupplierCheckSummary } from '@/lib/supplierCheck';

// Remplace la commande `node scripts/weekly-fournisseur-check.js fichier.csv` : Krys dépose ici
// l'export CSV frais de pieces2mobile.com (colonnes Nom / Reference_SKU / Prix_TTC / Disponibilite
// obligatoires, les autres colonnes éventuelles sont ignorées), et la comparaison + les corrections
// automatiques (stock, hausses de prix) se lancent directement depuis la page — le fichier n'est
// jamais stocké sur le serveur, juste lu en mémoire le temps du traitement.
export default function SupplierCsvUploadForm() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SupplierCheckSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileName(file ? file.name : null);
    setError(null);
    setSummary(null);
  }

  function handleSubmit() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Choisis d\'abord un fichier CSV.');
      return;
    }
    setError(null);
    setSummary(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('csv', file);
      const result = await runSupplierCheckAction(formData);
      if ('error' in result) {
        setError(result.error);
      } else {
        setSummary(result.summary);
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 mb-6">
      <h2 className="font-semibold text-gray-800 mb-1">⬆️ Lancer une vérification</h2>
      <p className="text-sm text-gray-500 mb-3">
        Dépose l&apos;export CSV le plus récent de pieces2mobile.com — la comparaison et les corrections
        automatiques (stock, hausses de prix) se lancent tout de suite.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending}
          className="border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-60"
        >
          {fileName || 'Choisir un fichier CSV...'}
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !fileName}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
        >
          {isPending ? 'Vérification en cours...' : 'Lancer la vérification'}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mt-3">⚠️ {error}</p>}

      {summary && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-900">
          <p className="font-semibold mb-1">✅ Vérification terminée</p>
          <p>
            {summary.totalRows} ligne(s) lues · {summary.comparedCount} produit(s) rapproché(s) · {summary.newlyMatched} nouvelle(s)
            correspondance(s) trouvée(s).
          </p>
          <p className="mt-1">
            📈 {summary.priceHausse} hausse(s) appliquée(s) · 📉 {summary.priceBaisse} baisse(s) en attente de ta décision ci-dessous ·
            ✅ {summary.retourStock} retour(s) en stock · ⛔ {summary.ruptureStock} rupture(s).
          </p>
        </div>
      )}
    </div>
  );
}
