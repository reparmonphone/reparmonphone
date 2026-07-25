import StaticPage, { getPage } from '@/components/StaticPage';

export async function generateMetadata() {
  const page = await getPage('mentions-legales');
  return { title: `${page?.title ?? 'Mentions légales'} | ReparMonPhone` };
}

export default function MentionsLegalesPage() {
  return <StaticPage slug="mentions-legales" />;
}
