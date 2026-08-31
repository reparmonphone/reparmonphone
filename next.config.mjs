/** @type {import('next').NextConfig} */
const nextConfig = {
  // Génère les pages statiques une par une au lieu de plusieurs en même temps pendant `next build`.
  // Le site a beaucoup de pages (179, dont ~160 pages /livraison/[ville]) et chacune interroge la
  // base de données : en parallèle, ça sature le pool de connexions Supabase (limité à quelques
  // connexions simultanées) et fait échouer l'export de certaines pages au hasard ("Export
  // encountered errors on following paths"). En série, c'est un peu plus lent mais fiable.
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  images: {
    remotePatterns: [
      // Images encore hébergées sur l'ancien WordPress le temps de la migration
      { protocol: 'https', hostname: 'www.reparmonphone.fr' },
      { protocol: 'https', hostname: 'reparmonphone.fr' },
      // Supabase Storage (une fois les images migrées)
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
    // Désactive l'optimisation automatique des images par Vercel (redimensionnement/conversion
    // à la volée). Le plan Hobby limite ce service à 5000 transformations/mois — largement
    // dépassé vu le volume du catalogue (1657+ photos produits). Comme les images sont déjà
    // hébergées et correctement dimensionnées sur Supabase, on n'a pas besoin de ce retraitement :
    // on les sert telles quelles, sans risque de quota ni d'images cassées en cours de mois.
    unoptimized: true,
  },
};

export default nextConfig;
