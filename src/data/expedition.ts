// Réglages de la promesse d'expédition affichée sur les fiches produit
// (« Expédié aujourd'hui avant 20h pour une livraison le lendemain en Chronopost 24h »).
// Modifie ces valeurs si tes horaires d'expédition changent : tout le site suit.

// Heure limite de commande (heure de Paris) pour une expédition le jour même.
export const EXPEDITION_HEURE_LIMITE = 20;

// Jours où tu déposes les colis : 1 = lundi … 5 = vendredi, 6 = samedi, 0 = dimanche.
export const EXPEDITION_JOURS = [1, 2, 3, 4, 5];

// Mets true si tu expédies aussi les jours fériés (par défaut : non).
export const EXPEDIE_JOURS_FERIES = false;
