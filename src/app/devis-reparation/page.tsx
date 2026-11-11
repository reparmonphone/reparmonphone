import type { Metadata } from 'next';
import Link from 'next/link';
import PartFinder from '@/components/PartFinder';
import { MAIN_OEUVRE } from '@/data/reparationTarifs';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.reparmonphone.fr';

export const metadata: Metadata = {
  title: 'Devis réparation téléphone à Sainte-Maxime : prix immédiat',
  description:
    'Choisissez votre téléphone et votre panne : voyez le prix de la réparation tout de suite, puis prenez rendez-vous en atelier à Sainte-Maxime ou à domicile.',
  alternates: { canonical: `${SITE_URL}/devis-reparation` },
};

export default function DevisReparationPage() {
  return (
    <div className="pb-12">
      <div className="max-w-6xl mx-auto px-4 pt-10">
        <h1 className="text-3xl font-bold text-gray-900">Devis de réparation</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          Écran cassé, batterie fatiguée, connecteur de charge&nbsp;: choisissez votre modèle et votre panne, le prix s&apos;affiche
          aussitôt. Réparation en atelier à Sainte-Maxime ou à domicile dans le Golfe de Saint-Tropez.
        </p>
      </div>
      <PartFinder mode="quote" labor={MAIN_OEUVRE} />
      <p className="max-w-6xl mx-auto px-4 mt-6 text-sm text-gray-500">
        Vous êtes loin de Sainte-Maxime ?{' '}
        <Link href="/reparation-a-distance" className="text-brand hover:underline">
          Réparation par correspondance
        </Link>{' '}
        partout en France métropolitaine. Déjà client ?{' '}
        <Link href="/suivi-reparation" className="text-brand hover:underline">
          Suivre ma réparation
        </Link>
        .
      </p>
    </div>
  );
}
