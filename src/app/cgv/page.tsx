import StaticPage, { getPage } from '@/components/StaticPage';

export async function generateMetadata() {
  const page = await getPage('cgv');
  return { title: `${page?.title ?? 'CGV'} | ReparMonPhone` };
}

export default function CgvPage() {
  return <StaticPage slug="cgv" />;
}
