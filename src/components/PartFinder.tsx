import { getFinderBrands } from '@/lib/partFinder';
import PartFinderClient from './PartFinderClient';

// Section d'accueil « Trouvez la bonne pièce » : charge marques et gammes (léger), les modèles arrivent
// à la demande. En cas d'erreur de base de données, la section disparaît sans casser la page.
export default async function PartFinder({
  mode = 'finder',
  labor = {},
}: {
  mode?: 'finder' | 'quote';
  labor?: Record<string, number>;
}) {
  let brands: Awaited<ReturnType<typeof getFinderBrands>> = [];
  try {
    brands = await getFinderBrands();
  } catch {
    brands = [];
  }
  if (brands.length === 0) return null;
  return <PartFinderClient brands={brands} mode={mode} labor={labor} />;
}
