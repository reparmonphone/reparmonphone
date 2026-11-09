// Nom complet = prénom ET nom (au moins deux mots, le dernier d'au moins 2 lettres ; « A. Martin » est accepté). Sert à refuser « Sandrine » seul :
// sans nom de famille on ne sait pas à qui adresser le colis.
export function isFullName(value: unknown): boolean {
  const parts = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters = (p: string) => p.replace(/[^\p{L}]/gu, '').length;
  return parts.length >= 2 && parts.every((p) => letters(p) >= 1) && letters(parts[parts.length - 1]) >= 2;
}

export const FULL_NAME_MESSAGE = 'Merci d’indiquer ton prénom ET ton nom de famille : il est nécessaire pour t’adresser ton colis.';
