'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { recordScratch } from './actions';

const W = 320;
const H = 150;
const REVEAL_AT = 0.5; // part de la zone grattée qui déclenche la révélation complète

export default function ScratchCard({
  code,
  label,
  conditions,
  email,
  token,
  alreadyScratched,
}: {
  code: string;
  label: string;
  conditions: string[];
  email: string;
  token: string;
  alreadyScratched: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const moves = useRef(0);
  const [revealed, setRevealed] = useState(alreadyScratched);
  const [copied, setCopied] = useState(false);

  // Dessine la couche argentée à gratter
  useEffect(() => {
    if (revealed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#eceef2');
    g.addColorStop(0.35, '#a9b0bc');
    g.addColorStop(0.55, '#e4e7ec');
    g.addColorStop(1, '#939baa');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // petites paillettes
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    ctx.fillStyle = '#4a5160';
    ctx.font = '800 26px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GRATTE ICI', W / 2, H / 2 + 2);
    ctx.font = '28px Arial, Helvetica, sans-serif';
    ctx.fillText('🪙 ✨ 🪙', W / 2, H / 2 - 32);
    ctx.font = '600 13px Arial, Helvetica, sans-serif';
    ctx.fillText('100 % gagnant', W / 2, H / 2 + 30);
  }, [revealed]);

  const reveal = useCallback(() => {
    setRevealed(true);
    recordScratch(email, token).catch(() => {});
  }, [email, token]);

  function scratchAt(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    const y = ((clientY - rect.top) / rect.height) * H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = canvas.width / W;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // On mesure la zone grattée de temps en temps (pas à chaque mouvement)
    moves.current++;
    if (moves.current % 8 !== 0) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let cleared = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * 24) {
      total++;
      if (data[i] < 40) cleared++;
    }
    if (total > 0 && cleared / total >= REVEAL_AT) reveal();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // sans importance : le code reste affiché et sélectionnable
    }
  }

  return (
    <div>
      {/* Le ticket */}
      <div className="rounded-2xl border-[3px] border-[#fff3c4] bg-gradient-to-br from-[#ffe08a] via-[#f5c542] to-[#e0a91f] p-4 shadow-2xl">
        <div className="flex justify-between text-[11px] font-extrabold tracking-widest uppercase text-[#6b4a00] mb-2">
          <span>🎟️ Ticket à gratter</span>
          <span>Cadeau de bienvenue</span>
        </div>

        <div className="relative mx-auto rounded-xl overflow-hidden bg-white" style={{ width: '100%', maxWidth: W, aspectRatio: `${W} / ${H}` }}>
          {/* Dessous : la surprise */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#fffbeb]">
            <p className="text-xs font-bold uppercase tracking-widest text-[#92400e]">Tu as gagné</p>
            <p className="text-4xl font-black text-gray-900 leading-tight">{label}</p>
            <p className="text-xs text-[#78350f] mb-1">sur ta 1ère commande</p>
            <p className="font-mono text-lg font-extrabold tracking-widest text-gray-900 border-2 border-dashed border-[#f59e0b] rounded-lg px-3 py-0.5 bg-white select-all">{code}</p>
          </div>
          {/* Dessus : la couche argentée */}
          {!revealed && (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full cursor-pointer"
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => {
                drawing.current = true;
                (e.target as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
                scratchAt(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => drawing.current && scratchAt(e.clientX, e.clientY)}
              onPointerUp={() => (drawing.current = false)}
              onPointerCancel={() => (drawing.current = false)}
            />
          )}
        </div>
      </div>

      {!revealed ? (
        <button type="button" onClick={reveal} className="mt-4 text-sm text-[#8fa6c8] underline hover:text-white">
          Je préfère tout révéler d’un clic
        </button>
      ) : (
        <div className="mt-6 text-white">
          <p className="text-2xl font-extrabold mb-1">🎉 Bravo, ton ticket est gagnant !</p>
          <p className="text-[#c9d8ef] mb-4 text-sm">
            Saisis le code <strong className="text-white">{code}</strong> dans le champ « Code promo » de ton panier.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-5">
            <button type="button" onClick={copy} className="bg-white/10 border border-white/30 text-white px-5 py-2.5 rounded-full font-semibold hover:bg-white/20 transition">
              {copied ? '✅ Code copié' : '📋 Copier le code'}
            </button>
            <Link href="/boutique" className="bg-[#ffd54a] text-[#3a2a00] px-6 py-2.5 rounded-full font-extrabold hover:brightness-95 transition">
              🛒 J’en profite
            </Link>
          </div>
          {conditions.length > 0 && <p className="text-xs text-[#8fa6c8]">{conditions.join(' · ')}</p>}
        </div>
      )}
    </div>
  );
}
