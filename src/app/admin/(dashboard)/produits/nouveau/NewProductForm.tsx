'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { createProduct } from '../actions';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

type ModelOpt = { id: string; name: string };
type LineOpt = { id: string; name: string; models: ModelOpt[] };
type BrandOpt = { id: string; name: string; lines: LineOpt[] };

const NEW = '__new__';

export default function NewProductForm({ brands }: { brands: BrandOpt[] }) {
  // Marque
  const [brandChoice, setBrandChoice] = useState(brands[0]?.id ?? NEW);
  const [newBrandName, setNewBrandName] = useState('');

  // Gamme
  const selectedBrand = brands.find((b) => b.id === brandChoice);
  const [lineChoice, setLineChoice] = useState(selectedBrand?.lines[0]?.id ?? NEW);
  const [newLineName, setNewLineName] = useState('');

  // Modèle
  const availableLines = selectedBrand?.lines ?? [];
  const selectedLine = availableLines.find((l) => l.id === lineChoice);
  const [modelChoice, setModelChoice] = useState(selectedLine?.models[0]?.id ?? NEW);
  const [newModelName, setNewModelName] = useState('');

  function handleBrandChange(value: string) {
    setBrandChoice(value);
    if (value === NEW) {
      setLineChoice(NEW);
      setModelChoice(NEW);
    } else {
      const brand = brands.find((b) => b.id === value);
      const firstLine = brand?.lines[0];
      setLineChoice(firstLine?.id ?? NEW);
      setModelChoice(firstLine?.models[0]?.id ?? NEW);
    }
  }

  function handleLineChange(value: string) {
    setLineChoice(value);
    if (value === NEW) {
      setModelChoice(NEW);
    } else {
      const line = availableLines.find((l) => l.id === value);
      setModelChoice(line?.models[0]?.id ?? NEW);
    }
  }

  // Champs produit
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState(0);
  const [stockQty, setStockQty] = useState(0);
  const [inStock, setInStock] = useState(true);
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `nouveau/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('products').upload(path, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('products').getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
      setImages((prev) => [...prev, ...newUrls]);
    } catch {
      setError("Erreur lors de l'envoi. Le bucket 'products' existe-t-il côté Supabase ?");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((i) => i !== url));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (brandChoice === NEW && !newBrandName.trim()) {
      setError('Indique le nom de la nouvelle marque.');
      return;
    }
    if (lineChoice === NEW && !newLineName.trim()) {
      setError('Indique le nom de la nouvelle gamme.');
      return;
    }
    if (modelChoice === NEW && !newModelName.trim()) {
      setError('Indique le nom du nouveau modèle.');
      return;
    }

    startTransition(async () => {
      const result = await createProduct({
        title,
        price,
        stockQty,
        inStock,
        shortDescription,
        description,
        metaTitle,
        metaDescription,
        images,
        brandId: brandChoice !== NEW ? brandChoice : undefined,
        newBrandName: brandChoice === NEW ? newBrandName : undefined,
        productLineId: lineChoice !== NEW ? lineChoice : undefined,
        newLineName: lineChoice === NEW ? newLineName : undefined,
        modelId: modelChoice !== NEW ? modelChoice : undefined,
        newModelName: modelChoice === NEW ? newModelName : undefined,
      });
      // createProduct redirige en cas de succès — si on arrive ici, c'est qu'il y a eu une erreur
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Affectation catalogue */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Marque / Gamme / Modèle</h2>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Marque</label>
            <select value={brandChoice} onChange={(e) => handleBrandChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2">
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
              <option value={NEW}>+ Nouvelle marque...</option>
            </select>
            {brandChoice === NEW && (
              <input value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} placeholder="Nom de la marque" className="w-full border border-brand rounded-lg px-3 py-2 text-sm" />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Gamme</label>
            <select value={lineChoice} onChange={(e) => handleLineChange(e.target.value)} disabled={brandChoice === NEW} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 disabled:opacity-50 disabled:bg-gray-50">
              {availableLines.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
              <option value={NEW}>+ Nouvelle gamme...</option>
            </select>
            {(lineChoice === NEW || brandChoice === NEW) && (
              <input value={newLineName} onChange={(e) => setNewLineName(e.target.value)} placeholder="Nom de la gamme" className="w-full border border-brand rounded-lg px-3 py-2 text-sm" />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Modèle</label>
            <select value={modelChoice} onChange={(e) => setModelChoice(e.target.value)} disabled={lineChoice === NEW || brandChoice === NEW} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 disabled:opacity-50 disabled:bg-gray-50">
              {selectedLine?.models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              <option value={NEW}>+ Nouveau modèle...</option>
            </select>
            {(modelChoice === NEW || lineChoice === NEW || brandChoice === NEW) && (
              <input value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="Nom du modèle" className="w-full border border-brand rounded-lg px-3 py-2 text-sm" />
            )}
          </div>
        </div>
      </div>

      {/* Photos */}
      <div className="bg-white border border-gray-100 rounded-xl p-6">
        <h2 className="font-semibold mb-3">Photos</h2>
        <div className="flex flex-wrap gap-3 mb-3">
          {images.map((url, i) => (
            <div key={url} className="relative w-24 h-24 border border-gray-200 rounded-lg overflow-hidden group">
              <Image src={url} alt="" fill className="object-contain p-1" />
              {i === 0 && <span className="absolute top-1 left-1 bg-brand text-white text-[10px] px-1.5 py-0.5 rounded">Principale</span>}
              <button type="button" onClick={() => removeImage(url)} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs">🗑 Supprimer</button>
            </div>
          ))}
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-brand hover:text-brand transition disabled:opacity-50">
            {uploading ? '...' : '+ Ajouter'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
        </div>
        <p className="text-xs text-gray-400">La première photo est utilisée comme image principale sur la boutique.</p>
      </div>

      {/* Infos de base */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Informations</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Titre du produit</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Prix (€)</label>
            <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Quantité en stock</label>
            <input type="number" min="0" value={stockQty} onChange={(e) => setStockQty(parseInt(e.target.value, 10) || 0)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
          Produit disponible à la vente
        </label>
      </div>

      {/* Descriptions */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Descriptions</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Description courte</label>
          <textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description longue</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
        </div>
      </div>

      {/* SEO */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Référencement (SEO)</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Balise titre</label>
          <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder={title} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Meta description</label>
          <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button type="submit" disabled={pending} className="bg-brand text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60">
        {pending ? 'Création...' : 'Créer le produit'}
      </button>
    </form>
  );
}
