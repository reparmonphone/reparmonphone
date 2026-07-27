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

export default async function HomePage() {
  const zones = await prisma.serviceZone.findMany({ orderBy: { extraFee: 'asc' } });

  return (
    <>
      <FacebookPageWidget />

      <section className="bg-gradient-to-b from-brand-light to-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 max-w-4xl mx-auto">
            Réparation & pièces détachées de téléphone Apple, Samsung, Huawei, Xiaomi et autres sur demande
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Réparation en Atelier à <span className="whitespace-nowrap">Sainte-Maxime</span> ou à domicile dans
            tout le Golfe de <span className="whitespace-nowrap">Saint-Tropez</span>. Pour toute la{' '}
            <span className="whitespace-nowrap">France Livraison Chronopost 24h</span> sur toutes les pièces !
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/boutique" className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition">
              Acheter une pièce
            </Link>
            <Link href="/rdv" className="bg-white border border-brand text-brand px-6 py-3 rounded-lg font-semibold hover:bg-brand-light transition">
              Prendre RDV réparation
            </Link>
          </div>
        </div>
      </section>

      <HeroSlider />
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
