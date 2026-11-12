import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Nombre de connexions simultanées vers la base pour chaque instance du site. Prisma n'en ouvre que 5 par défaut :
// quand beaucoup de fiches sont ouvertes en même temps (robots d'exploration, pic de visites), les requêtes
// patientent puis échouent (erreur P2024 « Timed out fetching a new connection »). On le règle ici, sans toucher
// à DATABASE_URL (secret dans Vercel). Si DATABASE_URL contient déjà connection_limit, c'est sa valeur qui gagne.
const CONNECTION_LIMIT = 10;

function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=${CONNECTION_LIMIT}`;
}

const url = databaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
