'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateProductModel, deleteProduct } from './actions';
import StockToggle from './StockToggle';
import PriceEditable from './PriceEditable';

type ModelOpt = { id: string; name: string };
type LineOpt = { id: string; name: string; models: ModelOpt[] };
type BrandOpt = { id: string; name: string; lines: LineOpt[] };

type ProductRow = {
  id: string;
  title: string;
  price: number;
  inStock: boolean;
  modelId: string;
  brandId: string;
  productLineId: string;
  image: string | null;
  imageCount: number;
};

export default function ProductRowInline({ product, brands }: { product: ProductRow; brands: BrandOpt[] }) {
  const [brandId, setBrandId] = useState(product.brandId);
  const [productLineId, setProductLineId] = useState(product.productLineId);
  const [modelId, setModelId] = useState(product.modelId);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const router = useRouter();
  // Zoom au survol : position fixe (le tableau a overflow-hidden et couperait un popover absolu)
  const [zoom, setZoom] = useState<{ top: number; left: number } | null>(null);

  const ZOOM_SIZE = 340;

  function showZoom(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.right + 12;
    if (left + ZOOM_SIZE > vw - 8) left = Math.max(8, rect.left - ZOOM_SIZE - 12);
    let top = rect.top + rect.height / 2 - ZOOM_SIZE / 2;
    top = Math.min(Math.max(8, top), Math.max(8, vh - ZOOM_SIZE - 8));
    setZoom({ top, left });
  }

  function openEraser() {
    const retour = window.location.pathname + window.location.search;
    router.push(`/admin/produits/${product.id}?retoucher=1&retour=${encodeURIComponent(retour)}`);
  }

  const selectedBrand = brands.find((b) => b.id === brandId);
  const availableLines = selectedBrand?.lines ?? [];
  const selectedLine = availableLines.find((l) => l.id === productLineId);
  const availableModels = selectedLine?.models ?? [];

  function save(newModelId: string) {
    startTransition(async () => {
      await updateProductModel(product.id, newModelId);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function handleBrandChange(newBrandId: string) {
    const brand = brands.find((b) => b.id === newBrandId);
    const firstLine = brand?.lines[0];
    const firstModel = firstLine?.models[0];
    setBrandId(newBrandId);
    setProductLineId(firstLine?.id ?? '');
    setModelId(firstModel?.id ?? '');
    if (firstModel) save(firstModel.id);
  }

  function handleLineChange(newLineId: string) {
    const line = availableLines.find((l) => l.id === newLineId);
    const firstModel = line?.models[0];
    setProductLineId(newLineId);
    setModelId(firstModel?.id ?? '');
    if (firstModel) save(firstModel.id);
  }

  function handleModelChange(newModelId: string) {
    setModelId(newModelId);
    save(newModelId);
  }

  function handleDelete() {
    if (!confirm(`Supprimer définitivement "${product.title}" ? Cette action est irréversible.`)) return;
    setDeleting(true);
    startTransition(async () => {
      const result = await deleteProduct(product.id);
      if (result?.error) {
        alert(result.error);
        setDeleting(false);
      } else {
        setHidden(true);
      }
    });
  }

  if (hidden) return null;

  const selectClass =
    'bg-transparent text-xs font-medium px-2 py-0.5 rounded border-0 focus:ring-1 focus:ring-brand cursor-pointer disabled:opacity-50';

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2 w-[72px]">
        {product.image ? (
          <button
            type="button"
            onClick={openEraser}
            onMouseEnter={(e) => showZoom(e.currentTarget)}
            onMouseLeave={() => setZoom(null)}
            onFocus={(e) => showZoom(e.currentTarget)}
            onBlur={() => setZoom(null)}
            className="relative block w-14 h-14 rounded border border-gray-200 bg-white overflow-hidden hover:ring-2 hover:ring-brand focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
            title="Cliquer pour retoucher la photo principale"
            aria-label={`Retoucher la photo de ${product.title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-contain"
            />
            {product.imageCount > 1 && (
              <span className="absolute bottom-0 right-0 bg-gray-800/80 text-white text-[10px] leading-none px-1 py-0.5 rounded-tl">
                {product.imageCount}
              </span>
            )}
          </button>
        ) : (
          <Link
            href={`/admin/produits/${product.id}`}
            className="flex w-14 h-14 items-center justify-center rounded border border-dashed border-gray-300 text-[10px] text-gray-400 text-center leading-tight hover:border-brand hover:text-brand"
            title="Aucune photo : ouvrir la fiche pour en ajouter"
          >
            Pas de photo
          </Link>
        )}
        {zoom && product.image && (
          <div
            className="fixed z-50 pointer-events-none rounded-lg border border-gray-300 bg-white shadow-2xl p-1"
            style={{ top: zoom.top, left: zoom.left, width: ZOOM_SIZE, height: ZOOM_SIZE }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image} alt="" className="w-full h-full object-contain" />
          </div>
        )}
      </td>
      <td className="px-4 py-3 font-medium text-gray-800 max-w-[220px] truncate">{product.title}</td>
      <td className="px-4 py-3">
        <select
          value={brandId}
          onChange={(e) => handleBrandChange(e.target.value)}
          disabled={pending}
          className={`${selectClass} bg-gray-100 text-gray-700`}
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          value={productLineId}
          onChange={(e) => handleLineChange(e.target.value)}
          disabled={pending}
          className={`${selectClass} bg-blue-50 text-blue-700`}
        >
          {availableLines.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          value={modelId}
          onChange={(e) => handleModelChange(e.target.value)}
          disabled={pending}
          className={`${selectClass} bg-purple-50 text-purple-700`}
        >
          {availableModels.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        {saved && <span className="ml-1 text-green-600 text-xs">✅</span>}
      </td>
      <td className="px-4 py-3">
        <PriceEditable productId={product.id} price={product.price} />
      </td>
      <td className="px-4 py-3">
        <StockToggle productId={product.id} inStock={product.inStock} />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <Link href={`/admin/produits/${product.id}`} className="text-brand hover:underline">
          Modifier
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="ml-3 text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
          title="Supprimer définitivement ce produit"
        >
          {deleting ? '...' : 'Supprimer'}
        </button>
      </td>
    </tr>
  );
}
