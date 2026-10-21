import { prisma } from '@/lib/prisma';
import { SETTING_KEY, normalizeConfig, parisToday } from '@/lib/seasonalThemes';
import ThemesManager from './ThemesManager';

export default async function AdminThemesPage() {
  let raw: unknown = null;
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY } });
    if (row?.value) raw = JSON.parse(row.value);
  } catch {
    // réglage absent ou illisible : on repart des valeurs par défaut
  }
  const config = normalizeConfig(raw);
  return (
    <div className="max-w-7xl">
      <h1 className="text-2xl font-bold mb-1">🎨 Thèmes saisonniers</h1>
      <p className="text-gray-500 mb-6">
        Habille le site pour les fêtes et saisons. Règle les effets, regarde l’aperçu en direct, puis enregistre
        seulement quand tu es satisfaite : tant que le thème n’est pas activé, les visiteurs ne voient rien.
      </p>
      <ThemesManager initial={config} today={parisToday()} />
    </div>
  );
}
