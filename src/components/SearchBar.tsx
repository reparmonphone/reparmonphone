'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/format';

type ModelSuggestion = {
  id: string;
  name: string;
  brandSlug: string;
  brandName: string;
  lineSlug: string;
  lineName: string;
  modelSlug: string;
};
type ProductSuggestion = { id: string; title: string; slug: string; price: number };

export default function SearchBar({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [models, setModels] = useState<ModelSuggestion[]>([]);
  const [products, setProducts] = useState<ProductSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setModels([]);
      setProducts([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setModels(data.models ?? []);
        setProducts(data.products ?? []);
        setOpen(true);
      } catch {
        // silencieux : la recherche reste utilisable via la soumission du formulaire
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setOpen(false);
    router.push(`/boutique?q=${encodeURIComponent(query.trim())}`);
  }

  function goToModel(m: ModelSuggestion) {
    setOpen(false);
    setQuery('');
    router.push(`/boutique?marque=${m.brandSlug}&gamme=${m.lineSlug}&modele=${m.modelSlug}`);
  }

  function goToProduct(p: ProductSuggestion) {
    setOpen(false);
    setQuery('');
    router.push(`/produit/${p.slug}`);
  }

  const hasResults = models.length > 0 || products.length > 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Rechercher un modèle (ex: iPhone 14, Galaxy A54...)"
          className="w-full border border-gray-200 rounded-full pl-4 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button type="submit" aria-label="Rechercher" className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-brand">
          🔍
        </button>
      </form>

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
          {!hasResults ? (
            <p className="px-4 py-3 text-sm text-gray-400">Aucun résultat pour &quot;{query}&quot;.</p>
          ) : (
            <>
              {models.length > 0 && (
                <div className="py-2">
                  <p className="px-4 py-1 text-[11px] font-semibold text-gray-400 uppercase">Modèles</p>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => goToModel(m)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span>{m.name}</span>
                      <span className="text-xs text-gray-400">{m.brandName} / {m.lineName}</span>
                    </button>
                  ))}
                </div>
              )}
              {products.length > 0 && (
                <div className="py-2 border-t border-gray-100">
                  <p className="px-4 py-1 text-[11px] font-semibold text-gray-400 uppercase">Produits</p>
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => goToProduct(p)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{p.title}</span>
                      <span className="text-xs text-brand-dark font-medium shrink-0">{formatPrice(p.price)}</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={handleSubmit}
                className="w-full text-left px-4 py-2.5 text-sm text-brand font-medium hover:bg-brand-light border-t border-gray-100"
              >
                Voir tous les résultats pour &quot;{query}&quot; →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
