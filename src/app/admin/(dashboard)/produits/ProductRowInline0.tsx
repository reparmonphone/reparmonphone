'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/lib/format';
import { updateProductModel } from './actions';
import StockToggle from './StockToggle';

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
};

export default function ProductRowInline({ product, brands }: { product: ProductRow; brands: BrandOpt[] }) {
  const [brandId, setBrandId] = useState(product.brandId);
  const [productLineId, setProductLineId] = useState(product.productLineId);
  const [modelId, setModelId] = useState(product.modelId);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

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

  const selectClass =
    'bg-transparent text-xs font-medium px-2 py-0.5 rounded border-0 focus:ring-1 focus:ring-brand cursor-pointer disabled:opacity-50';

  return (
    <tr className="hover:bg-gray-50">
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
      <td className="px-4 py-3">{formatPrice(product.price)}</td>
      <td className="px-4 py-3">
        <StockToggle productId={product.id} inStock={product.inStock} />
      </td>
      <td className="px-4 py-3 text-right">
        <Link href={`/admin/produits/${product.id}`} className="text-brand hover:underline">
          Modifier
        </Link>
      </td>
    </tr>
  );
}
