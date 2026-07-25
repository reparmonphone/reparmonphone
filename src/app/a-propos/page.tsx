import StaticPage, { getPage } from '@/components/StaticPage';

export async function generateMetadata() {
  const page = await getPage('a-propos');
  return { title: `${page?.title ?? 'À propos'} | ReparMonPhone` };
}

export default function AProposPage() {
  return <StaticPage slug="a-propos" />;
}
