// Adresse IP du visiteur, telle que transmise par Vercel (en-têtes standards de proxy).
// Utilisée uniquement pour limiter certains codes promo (ex. code de fidélité) à un usage par client.
export function getClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  const raw = (xff ? xff.split(',')[0] : req.headers.get('x-real-ip')) ?? '';
  const ip = raw.trim();
  return ip ? ip.slice(0, 64) : null;
}
