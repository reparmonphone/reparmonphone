import StaticPage, { getPage } from '@/components/StaticPage';

export async function generateMetadata() {
  const page = await getPage('livraison-retours');
  return { title: `${page?.title ?? 'Livraison & Retours'} | ReparMonPhone` };
}

export default function LivraisonRetoursPage() {
  return <StaticPage slug="livraison-retours" />;
}
