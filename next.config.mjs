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
  },
};

export default nextConfig;
