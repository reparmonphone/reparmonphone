import type { Metadata } from 'next';
import SuiviForm from './SuiviForm';

export const metadata: Metadata = {
  title: 'Suivre ma réparation | ReparMonPhone',
  description: 'Suivez l’avancement de la réparation de votre téléphone : demande, rendez-vous, diagnostic, réparation.',
  robots: { index: false },
};

export default function SuiviReparationPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Suivre ma réparation</h1>
      <p className="mt-2 mb-6 text-gray-600">
        Saisissez l’e-mail et le téléphone de votre demande : vous voyez où en est votre téléphone, sans avoir à appeler.
      </p>
      <SuiviForm />
    </div>
  );
}
