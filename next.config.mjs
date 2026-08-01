/** @type {import('next').NextConfig} */
const nextConfig = {
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
