'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { updateProduct } from '../actions';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { generateMetaDescription } from '@/lib/seoDescription';
import ImageEraserModal from './ImageEraserModal';

type ModelOpt = { id: string; name: string };
type LineOpt = { id: string; name: string; models: ModelOpt[] };
type BrandOpt = { id: string; name: string; lines: LineOpt[] };

type Product = {
  id: string;
  title: string;
  price: number;
  stockQty: number | null;
  inStock: boolean;
  shortDescription: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  images: string[];
  modelId: string;
  brandId: string;
  productLineId: string;
  condition: string | null;
  quality: string | null;
};

export default function ProductEditForm({ product, brands }: { product: Product; brands: BrandOpt[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(product.title);
  const [price, setPrice] = useState(product.price);
  const [stockQty, setStockQty] = useState(product.stockQty ?? 0);
  const [inStock, setInStock] = useState(product.inStock);
  const [shortDescription, setShortDescription] = useState(product.shortDescription);
  const [description, setDescription] = useState(product.description);
  const [metaTitle, setMetaTitle] = useState(product.metaTitle);
  const [metaDescription, setMetaDescription] = useState(product.metaDescription);
  const [images, setImages] = useState(product.images);
  const [uploading, setUploading] = useState(false);
  const [eraserIndex, setEraserIndex] = useState<number | null>(null);

  const [brandId, setBrandId] = useState(product.brandId);
  const [productLineId, setProductLineId] = useState(product.productLineId);
  const [modelId, setModelId] = useState(product.modelId);

  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBrand = brands.find((b) => b.id === brandId);
  const availableLines = selectedBrand?.lines ?? [];
  const selectedLine = availableLines.find((l) => l.id === productLineId);
  const availableModels = useMemo(() => selectedLine?.models ?? [], [selectedLine]);

  function handleBrandChange(newBrandId: string) {
    setBrandId(newBrandId);
    const brand = brands.find((b) => b.id === newBrandId);
    const firstLine = brand?.lines[0];
    setProductLineId(firstLine?.id ?? '');
    setModelId(firstLine?.models[0]?.id ?? '');
  }

  function handleLineChange(newLineId: string) {
    setProductLineId(newLineId);
    const line = availableLines.find((l) => l.id === newLineId);
    setModelId(line?.models[0]?.id ?? '');
  }

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
        const path = `${product.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('products').upload(path, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('products').getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
      setImages((prev) => [...prev, ...newUrls]);
    } catch {
      setError("Erreur lors de l'envoi. Le bucket 'products' existe-t-il côté Supabase ? (voir README)");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((i) => i !== url));
  }

  function replaceImage(index: number, newUrl: string) {
    setImages((prev) => prev.map((u, i) => (i === index ? newUrl : u)));
    setEraserIndex(null);
  }

  function moveImage(index: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId) {
      setError('Sélectionne une marque, une gamme et un modèle.');
      return;
    }
    startTransition(async () => {
      await updateProduct(product.id, {
        title,
        price,
        stockQty,
        inStock,
        shortDescription,
        description,
        metaTitle,
        metaDescription,
        images,
        modelId,
      });
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Affectation catalogue */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Affectation catalogue</h2>
        <p className="text-sm text-gray-500 -mt-2">
          Corrige ici la marque, la gamme et le modèle si ce produit est mal classé.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Marque</label>
            <select value={brandId} onChange={(e) => handleBrandChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Gamme</label>
            <select value={productLineId} onChange={(e) => handleLineChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {availableLines.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Modèle</label>
            <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
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
              {i === 0 && (
                <span className="absolute top-1 left-1 bg-brand text-white text-[10px] px-1.5 py-0.5 rounded">Principale</span>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                <button type="button" onClick={() => moveImage(i, -1)} className="text-white text-xs px-1" title="Déplacer à gauche">◀</button>
                <button type="button" onClick={() => setEraserIndex(i)} className="text-white text-xs px-1" title="Retoucher (effacer un élément de la photo)">✏️</button>
                <button type="button" onClick={() => removeImage(url)} className="text-white text-xs px-1" title="Supprimer">🗑</button>
                <button type="button" onClick={() => moveImage(i, 1)} className="text-white text-xs px-1" title="Déplacer à droite">▶</button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-brand hover:text-brand transition disabled:opacity-50"
          >
            {uploading ? '...' : '+ Ajouter'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <p className="text-xs text-gray-400">
          La première photo est utilisée comme image principale sur la boutique. Survole une photo et clique sur
          ✏️ pour effacer directement un élément dessus (ex: le logo du fournisseur), sans avoir à la télécharger.
        </p>
      </div>

      {/* Infos de base */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Informations</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Titre du produit</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2" />
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
          <label className="block text-sm font-medium mb-1">Description courte (sous le bouton "Ajouter au panier")</label>
          <textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description longue (pleine largeur, bas de fiche produit)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
          <p className="text-xs text-gray-400 mt-1">HTML accepté (&lt;h2&gt;, &lt;p&gt;, &lt;strong&gt;...).</p>
        </div>
      </div>

      {/* SEO */}
      <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Référencement (SEO)</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Balise titre (si vide : titre du produit utilisé)</label>
          <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder={title} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium">Meta description</label>
            <button
              type="button"
              onClick={() => {
                const modelName = availableModels.find((m) => m.id === modelId)?.name ?? '';
                setMetaDescription(
                  generateMetaDescription({
                    title,
                    brandName: selectedBrand?.name ?? '',
                    modelName,
                    condition: product.condition,
                    quality: product.quality,
                    price,
                  })
                );
              }}
              className="text-xs text-brand hover:underline"
            >
              ✨ Générer automatiquement
            </button>
          </div>
          <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 mt-1">{metaDescription.length}/160 caractères</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="bg-brand text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-60">
          {pending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        {saved && <span className="text-green-600 text-sm">✅ Enregistré</span>}
      </div>

      {eraserIndex !== null && (
        <ImageEraserModal
          imageUrl={images[eraserIndex]}
          productId={product.id}
          onClose={() => setEraserIndex(null)}
          onSaved={(newUrl) => replaceImage(eraserIndex, newUrl)}
        />
      )}
    </form>
  );
}
