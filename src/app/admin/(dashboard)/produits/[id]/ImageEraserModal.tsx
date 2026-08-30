'use client';

// Éditeur d'image intégré à la fiche produit : permet d'effacer un élément gênant sur une photo
// (typiquement le filigrane/logo du fournisseur) directement depuis l'admin, sans avoir à
// télécharger l'image, la modifier dans un logiciel externe, puis la réimporter.
//
// Principe : on peint (au doigt/souris) une zone sur l'image à effacer, puis un algorithme de
// "comblement" (diffusion / relaxation de Gauss-Seidel — la même famille de technique que l'ancien
// "inpainting" par extension harmonique, avant les outils basés IA) reconstruit cette zone à partir
// des pixels tout autour. Ça fonctionne très bien pour un petit filigrane/logo sur un fond plutôt
// uni (typique des photos de pièces détachées sur fond blanc/gris studio) — moins bien pour effacer
// un objet complexe sur un fond très texturé, ce qui n'est pas le besoin ici.
//
// Tout se passe dans le navigateur (canvas), rien n'est envoyé à un service externe : au clic sur
// "Enregistrer cette photo", le résultat est uploadé directement sur le bucket Supabase du produit,
// exactement comme un nouvel ajout de photo classique.

import { useEffect, useRef, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function ImageEraserModal({
  imageUrl,
  productId,
  onClose,
  onSaved,
}: {
  imageUrl: string;
  productId: string;
  onClose: () => void;
  onSaved: (newUrl: string) => void;
}) {
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const originalDataRef = useRef<ImageData | null>(null);
  const drawingRef = useRef(false);

  const [brushSize, setBrushSize] = useState(30);
  const [loaded, setLoaded] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dimensions d'affichage (CSS) — le canvas garde en interne la résolution réelle de la photo pour
  // ne pas perdre en qualité, on affiche juste en plus petit sur les grandes images.
  const [displaySize, setDisplaySize] = useState({ width: 500, height: 500 });

  // Chargement de l'image dans le canvas via un blob (évite tout souci de canvas "taint" CORS que
  // provoquerait un <img crossOrigin> selon la configuration du bucket).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          if (cancelled) return;
          const canvas = imageCanvasRef.current;
          const maskCanvas = maskCanvasRef.current;
          if (!canvas || !maskCanvas) return;
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          maskCanvas.width = img.naturalWidth;
          maskCanvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          originalDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

          const maxDisplayWidth = 560;
          const scale = Math.min(1, maxDisplayWidth / img.naturalWidth);
          setDisplaySize({ width: Math.round(img.naturalWidth * scale), height: Math.round(img.naturalHeight * scale) });
          setLoaded(true);
          URL.revokeObjectURL(objectUrl);
        };
        img.src = objectUrl;
      } catch {
        if (!cancelled) setError("Impossible de charger cette photo pour la retoucher.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const getCanvasCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  function paintAt(x: number, y: number) {
    const ctx = maskCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
    setHasMask(true);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    const { x, y } = getCanvasCoords(e);
    paintAt(x, y);
  }
  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const { x, y } = getCanvasCoords(e);
    paintAt(x, y);
  }
  function handlePointerUp() {
    drawingRef.current = false;
  }

  function clearMask() {
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
  }

  function resetImage() {
    const canvas = imageCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && originalDataRef.current) {
      ctx.putImageData(originalDataRef.current, 0, 0);
    }
    clearMask();
  }

  // Comble la zone peinte en résolvant une équation de diffusion (moyenne des voisins, répétée) sur
  // les seuls pixels marqués, avec pour "bords fixes" les pixels réels juste autour de la zone —
  // limité à la boîte englobante du masque (+ une marge) pour rester rapide même sur une grande photo.
  function eraseMaskedArea() {
    const imageCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!imageCanvas || !maskCanvas) return;
    setProcessing(true);
    setError(null);

    // Laisse le temps au spinner de s'afficher avant le calcul (potentiellement bloquant côté JS).
    setTimeout(() => {
      try {
        const w = imageCanvas.width;
        const h = imageCanvas.height;
        const maskCtx = maskCanvas.getContext('2d')!;
        const maskData = maskCtx.getImageData(0, 0, w, h).data;

        // 1) boîte englobante des pixels marqués (alpha du masque > seuil)
        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const a = maskData[(y * w + x) * 4 + 3];
            if (a > 40) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0) {
          setProcessing(false);
          return; // rien de peint
        }

        const margin = 12; // anneau de pixels réels tout autour, utilisé comme "bord" fixe pour la diffusion
        const bx0 = Math.max(0, minX - margin);
        const by0 = Math.max(0, minY - margin);
        const bx1 = Math.min(w - 1, maxX + margin);
        const by1 = Math.min(h - 1, maxY + margin);
        const bw = bx1 - bx0 + 1;
        const bh = by1 - by0 + 1;

        const imgCtx = imageCanvas.getContext('2d')!;
        const region = imgCtx.getImageData(bx0, by0, bw, bh);
        const isMasked = new Uint8Array(bw * bh);
        for (let y = 0; y < bh; y++) {
          for (let x = 0; x < bw; x++) {
            const a = maskData[((y + by0) * w + (x + bx0)) * 4 + 3];
            isMasked[y * bw + x] = a > 40 ? 1 : 0;
          }
        }

        // Init : chaque pixel masqué démarre à la moyenne globale des pixels non masqués de la boîte
        // (meilleur point de départ que du noir, converge plus vite).
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let i = 0; i < bw * bh; i++) {
          if (!isMasked[i]) {
            sumR += region.data[i * 4];
            sumG += region.data[i * 4 + 1];
            sumB += region.data[i * 4 + 2];
            count++;
          }
        }
        const avgR = count ? sumR / count : 255;
        const avgG = count ? sumG / count : 255;
        const avgB = count ? sumB / count : 255;

        const R = new Float32Array(bw * bh);
        const G = new Float32Array(bw * bh);
        const B = new Float32Array(bw * bh);
        for (let i = 0; i < bw * bh; i++) {
          if (isMasked[i]) {
            R[i] = avgR; G[i] = avgG; B[i] = avgB;
          } else {
            R[i] = region.data[i * 4];
            G[i] = region.data[i * 4 + 1];
            B[i] = region.data[i * 4 + 2];
          }
        }

        // 2) relaxation de Gauss-Seidel : chaque pixel masqué devient la moyenne de ses 4 voisins,
        // répété plusieurs centaines de fois — converge vers un comblement lisse cohérent avec le
        // pourtour réel de la photo.
        const ITERATIONS = 400;
        for (let it = 0; it < ITERATIONS; it++) {
          for (let y = 0; y < bh; y++) {
            for (let x = 0; x < bw; x++) {
              const i = y * bw + x;
              if (!isMasked[i]) continue;
              const left = x > 0 ? i - 1 : i;
              const right = x < bw - 1 ? i + 1 : i;
              const up = y > 0 ? i - bw : i;
              const down = y < bh - 1 ? i + bw : i;
              R[i] = (R[left] + R[right] + R[up] + R[down]) / 4;
              G[i] = (G[left] + G[right] + G[up] + G[down]) / 4;
              B[i] = (B[left] + B[right] + B[up] + B[down]) / 4;
            }
          }
        }

        for (let i = 0; i < bw * bh; i++) {
          if (isMasked[i]) {
            region.data[i * 4] = Math.round(R[i]);
            region.data[i * 4 + 1] = Math.round(G[i]);
            region.data[i * 4 + 2] = Math.round(B[i]);
          }
        }

        imgCtx.putImageData(region, bx0, by0);
        clearMask();
      } catch {
        setError('Erreur pendant la retouche — réessaie avec une zone plus petite.');
      } finally {
        setProcessing(false);
      }
    }, 30);
  }

  async function saveImage() {
    const canvas = imageCanvasRef.current;
    if (!canvas) return;
    setUploading(true);
    setError(null);
    try {
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('export impossible');
      const supabase = createSupabaseBrowserClient();
      const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2)}-retouche.jpg`;
      const { error: uploadError } = await supabase.storage.from('products').upload(path, blob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('products').getPublicUrl(path);
      onSaved(data.publicUrl);
    } catch {
      setError("Erreur lors de l'envoi de la photo retouchée.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Retoucher la photo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Peins la zone à effacer (ex: le logo du fournisseur), puis clique sur « Effacer la zone peinte ».
          Tu peux recommencer plusieurs fois avant d&apos;enregistrer.
        </p>

        <div className="flex items-center gap-3 mb-3">
          <label className="text-sm text-gray-600 flex items-center gap-2">
            Taille du pinceau
            <input type="range" min={8} max={80} value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value, 10))} />
          </label>
        </div>

        <div
          className="relative mx-auto border border-gray-200 rounded-lg overflow-hidden bg-[repeating-conic-gradient(#f3f4f6_0%_25%,white_0%_50%)] bg-[length:16px_16px]"
          style={{ width: displaySize.width, height: displaySize.height }}
        >
          {!loaded && <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Chargement...</div>}
          <canvas
            ref={imageCanvasRef}
            style={{ width: displaySize.width, height: displaySize.height, position: 'absolute', top: 0, left: 0 }}
          />
          <canvas
            ref={maskCanvasRef}
            style={{ width: displaySize.width, height: displaySize.height, position: 'absolute', top: 0, left: 0, touchAction: 'none', cursor: 'crosshair' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          {processing && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-sm font-medium text-gray-700">
              Retouche en cours...
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            type="button"
            onClick={eraseMaskedArea}
            disabled={!hasMask || processing || uploading}
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-50"
          >
            Effacer la zone peinte
          </button>
          <button
            type="button"
            onClick={clearMask}
            disabled={!hasMask || processing}
            className="text-gray-600 text-sm px-3 py-2 hover:underline disabled:opacity-40"
          >
            Effacer le dessin
          </button>
          <button
            type="button"
            onClick={resetImage}
            disabled={processing}
            className="text-gray-600 text-sm px-3 py-2 hover:underline disabled:opacity-40"
          >
            Réinitialiser la photo
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="text-gray-500 text-sm px-3 py-2">Annuler</button>
          <button
            type="button"
            onClick={saveImage}
            disabled={uploading || processing || !loaded}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {uploading ? 'Envoi...' : 'Enregistrer cette photo'}
          </button>
        </div>
      </div>
    </div>
  );
}
