export const CARRIER_LABELS: Record<string, string> = {
  CHRONOPOST: 'Chronopost',
  COLISSIMO: 'Colissimo',
  MONDIAL_RELAY: 'Mondial Relay',
  RELAIS_COLIS: 'Relais Colis',
  AUTRE: 'Autre transporteur',
};

// Génère l'URL de suivi directe du transporteur à partir du numéro de colis.
// Pour Mondial Relay, l'URL officielle demande aussi le code postal — à défaut on renvoie
// la page de recherche générique où le client n'a qu'à coller son numéro.
export function buildTrackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
  overrideUrl: string | null | undefined
): string | null {
  if (overrideUrl) return overrideUrl;
  if (!carrier || !trackingNumber) return null;

  const num = encodeURIComponent(trackingNumber);

  switch (carrier) {
    case 'CHRONOPOST':
      return `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${num}`;
    case 'COLISSIMO':
      return `https://www.laposte.fr/outils/suivre-vos-envois?code=${num}`;
    case 'MONDIAL_RELAY':
      return `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${num}`;
    case 'RELAIS_COLIS':
      return `https://www.relaiscolis.com/suivi-colis/?numColis=${num}`;
    default:
      return null;
  }
}
