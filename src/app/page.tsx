import { Fragment } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import HeroSlider from '@/components/HeroSlider';
import FacebookPageWidget from '@/components/FacebookPageWidget';
import CategoriesEnVedette from '@/components/CategoriesEnVedette';
import SeoIntro from '@/components/SeoIntro';
import TrustBadgesBar from '@/components/TrustBadgesBar';
import TopNouveautesSection from '@/components/TopNouveautesSection';
import TopProduitsSection from '@/components/TopProduitsSection';
import ReparActeursSection from '@/components/ReparActeursSection';
import AppleAccessoriesRow from '@/components/AppleAccessoriesRow';
import AvisSection from '@/components/AvisSection';
import NewsletterBar from '@/components/NewsletterBar';
import ProductTagCloud from '@/components/ProductTagCloud';
import PartnersSection from '@/components/PartnersSection';
import VisitorCounter from '@/components/VisitorCounter';
import IntroSplash from '@/components/IntroSplash';

// Découpe une phrase en mots qui arrivent un par un (animations .hero-word dans globals.css).
// Le texte reste identique pour Google et les lecteurs d'écran.
function AnimatedWords({
  text,
  start = 0,
  step = 0.07,
  className = '',
}: {
  text: string;
  start?: number;
  step?: number;
  className?: string;
}) {
  const words = text.split(' ');
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span
            className={`hero-word ${className}`.trim()}
            style={{ '--d': `${(start + i * step).toFixed(2)}s` } as CSSProperties}
          >
            {w}
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </>
  );
}

const delay = (s: number) => ({ '--d': `${s}s` }) as CSSProperties;

// Petite étoile à 4 branches, comme sur le logo
function Star({ className, d, color }: { className: string; d: number; color: string }) {
  return (
    <svg className={`hero-star ${className}`} style={delay(d)} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={color}
        d="M12 0C12.8 7 17 11.2 24 12C17 12.8 12.8 17 12 24C11.2 17 7 12.8 0 12C7 11.2 11.2 7 12 0Z"
      />
    </svg>
  );
}

export default async function HomePage() {
  const zones = await prisma.serviceZone.findMany({ orderBy: { extraFee: 'asc' } });

  return (
    <>
      <IntroSplash />
      <FacebookPageWidget />

      <section className="relative overflow-hidden bg-gradient-to-b from-brand-light to-white py-16">
        {/* Décor animé (étoiles + halos), purement décoratif */}
        <div className="hero-decor absolute inset-0" aria-hidden="true">
          <span className="hero-blob -left-16 top-4 h-56 w-56 bg-brand/15" style={delay(0)} />
          <span className="hero-blob -right-20 top-1/3 h-64 w-64 bg-sky-300/25" style={delay(-6)} />
          <Star className="hidden md:block left-[7%] top-[18%] h-7 w-7" d={0} color="#2C67B1" />
          <Star className="hidden md:block right-[8%] top-[14%] h-9 w-9" d={1.1} color="#2C67B1" />
          <Star className="hidden md:block left-[16%] bottom-[14%] h-5 w-5" d={2.2} color="#A9DEF1" />
          <Star className="hidden md:block right-[17%] bottom-[18%] h-6 w-6" d={0.6} color="#A9DEF1" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 max-w-4xl mx-auto text-balance">
            <AnimatedWords text={'Écran cassé, batterie fatiguée\u00A0?'} />{' '}
            <AnimatedWords text={'On répare, ou on vous envoie la\u00A0pièce.'} start={0.5} className="text-brand" />
          </h1>
          <p className="hero-fade mt-4 text-lg text-gray-600 max-w-2xl mx-auto" style={delay(1.1)}>
            Apple, Samsung, Huawei, Xiaomi et plus : réparation en atelier à{' '}
            <span className="whitespace-nowrap">Sainte-Maxime</span>, à domicile dans tout le Golfe de{' '}
            <span className="whitespace-nowrap">Saint-Tropez</span>, ou par correspondance partout en{' '}
            <span className="whitespace-nowrap">France métropolitaine</span>. Besoin d&apos;une pièce
            seule ? Livraison en <span className="whitespace-nowrap">24h</span> par Chronopost, France
            entière.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/boutique"
              className="hero-btn hero-cta hero-cta--primary bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition"
              style={delay(1.35)}
            >
              <span className="hero-emoji" aria-hidden="true">🛒</span> Acheter une pièce
            </Link>
            <Link
              href="/rdv"
              className="hero-btn hero-cta bg-white border border-brand text-brand px-6 py-3 rounded-lg font-semibold hover:bg-brand-light transition"
              style={delay(1.5)}
            >
              <span className="hero-emoji" aria-hidden="true">🔧</span> Prendre RDV réparation
            </Link>
            <Link
              href="/reparation-a-distance"
              className="hero-btn hero-cta bg-white border border-brand text-brand px-6 py-3 rounded-lg font-semibold hover:bg-brand-light transition"
              style={delay(1.65)}
            >
              <span className="hero-emoji" aria-hidden="true">📮</span> Réparation par correspondance
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 pt-4">
  <HeroSlider />
</div>
      <CategoriesEnVedette />
      <SeoIntro />
      <TopNouveautesSection />
      <TrustBadgesBar />
      <AppleAccessoriesRow />

      <section id="zones" className="bg-white py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl font-bold mb-2">Zones desservies pour les interventions à domicile</h2>
          <p className="text-gray-600 mb-6">
            Sainte-Maxime : intervention sans supplément. Villes suivantes : +30€ de frais de déplacement.
          </p>
          <div className="flex flex-wrap gap-2">
            {zones.map((z) => (
              <span key={z.id} className="bg-brand-light text-brand-dark px-3 py-1 rounded-full text-sm font-medium">
                {z.cityName}{Number(z.extraFee) > 0 ? ` (+${z.extraFee}€)` : ''}
              </span>
            ))}
          </div>
        </div>
      </section>

      <TopProduitsSection />
      <ReparActeursSection />
      <AvisSection />

      <NewsletterBar />
      <ProductTagCloud />
      <VisitorCounter />
      <PartnersSection />
    </>
  );
}
