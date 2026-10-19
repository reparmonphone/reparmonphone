import { prisma } from './prisma';
import { DEFAULT_VACATION, type VacationConfig } from './vacationShared';

const KEY = 'vacation_config';

/** Réglages du mode vacances (une seule ligne JSON dans site_settings). */
export async function getVacationConfig(): Promise<VacationConfig> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
    if (!row) return DEFAULT_VACATION;
    return { ...DEFAULT_VACATION, ...(JSON.parse(row.value) as Partial<VacationConfig>) };
  } catch {
    return DEFAULT_VACATION;
  }
}

export async function saveVacationConfig(config: VacationConfig) {
  const value = JSON.stringify(config);
  await prisma.siteSetting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}
