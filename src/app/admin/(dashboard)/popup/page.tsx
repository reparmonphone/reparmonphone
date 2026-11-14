import { prisma } from '@/lib/prisma';
import { SETTING_KEY, normalizeConfig, DEFAULT_PROMO } from '@/lib/promoPopup';
import { parisToday } from '@/lib/seasonalThemes';
import PopupForm from './PopupForm';

export default async function AdminPopupPage() {
  let raw: unknown = null;
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY } });
    if (row?.value) raw = JSON.parse(row.value);
  } catch {
    // réglage absent ou illisible : valeurs par défaut
  }
  const config = raw ? normalizeConfig(raw) : DEFAULT_PROMO;
  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-1">📣 Pop-up d’ouverture</h1>
      <p className="text-gray-500 mb-6">
        Propose une offre (un modèle reconditionné, une promotion…) à tous les visiteurs à leur arrivée sur le site.
        Prépare-le, regarde l’aperçu, puis coche « Activer » : tant que ce n’est pas activé, personne ne voit rien.
      </p>
      <PopupForm initial={config} today={parisToday()} />
    </div>
  );
}
