// Fourchettes de prix affichées sur la page /reparation-a-distance (section « Prix indicatifs »).
// La section n'apparaît QUE si cette liste n'est pas vide : tant que tu n'as pas rempli de prix,
// rien ne s'affiche (aucun faux prix en ligne).
//
// Exemple à copier-coller dans la liste (prix TTC, renvoi Chronopost 24h inclus) :
//   { label: 'Écran iPhone 13', prix: 'de 89 € à 129 €' },
//   { label: 'Batterie iPhone 12', prix: 'de 49 € à 69 €' },
//   { label: 'Connecteur de charge Samsung Galaxy S21', prix: 'de 59 € à 79 €' },
//
// Mets seulement des prix que tu es sûre de tenir : c'est exactement ce qui rassure les clients.

export type PrixReparation = { label: string; prix: string };

export const PRIX_REPARATIONS: PrixReparation[] = [];
