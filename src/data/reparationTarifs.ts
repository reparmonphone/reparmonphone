// Main d'œuvre de pose en atelier, utilisée par le devis instantané (/devis-reparation).
// Prix TTC en euros, par type de panne. Tant qu'un type n'est pas renseigné ici, le devis affiche le
// prix de la pièce seule et indique que la main d'œuvre est confirmée à la prise de rendez-vous :
// aucun faux prix n'est jamais affiché.
//
// Exemple (décommente et ajuste, ne mets que des prix que tu es sûre de tenir) :
//   ECRAN: 30,
//   BATTERIE: 20,
//   NAPPE_CONNECTEUR: 30,
//
// Types possibles : ECRAN, BATTERIE, NAPPE_CONNECTEUR, CAMERA, VITRE_ARRIERE, HAUT_PARLEUR, VIBREUR, BOUTON, CHASSIS

export const MAIN_OEUVRE: Record<string, number> = {};
