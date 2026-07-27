import { prisma } from '@/lib/prisma';
import MenuItemsList from './MenuItemsList';

export default async function AdminMenuPage() {
  const items = await prisma.headerMenuItem.findMany({ orderBy: { order: 'asc' } });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Menu du header</h1>
      <p className="text-gray-500 mb-6">
        Les marques (Apple, Samsung, Huawei, Xiaomi, Outils) sont toujours générées automatiquement depuis ton
        catalogue. Les liens ci-dessous s&apos;ajoutent après, dans l&apos;ordre choisi — comme "Prendre RDV".
        Ajoute-en d&apos;autres si besoin (Blog, Promotions, une page spécifique...). Pour une page listant des
        produits choisis à la main par modèle (ex: "Reconditionnés"), crée d&apos;abord une{' '}
        <a href="/admin/collections" className="text-brand hover:underline">collection</a>, puis relie ton lien
        vers <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">/collection/ton-slug</code>.
      </p>

      <MenuItemsList
        items={items.map((i) => ({ id: i.id, label: i.label, href: i.href, openInNewTab: i.openInNewTab }))}
      />
    </div>
  );
}
