import StaticPage, { getPage } from '@/components/StaticPage';

export async function generateMetadata() {
  const page = await getPage('confidentialite');
  return { title: `${page?.title ?? 'Confidentialité'} | ReparMonPhone` };
}

export default function ConfidentialitePage() {
  return <StaticPage slug="confidentialite" />;
}
