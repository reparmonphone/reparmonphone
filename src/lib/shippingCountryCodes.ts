// Codes pays ISO utilisés par le widget d'adresse de Stripe Checkout (shipping_address_collection).
// Stripe traite les départements/collectivités d'Outre-mer français comme des pays à part entière
// (pas "FR") — sans ça, un client de Guyane ne peut pas sélectionner son vrai territoire sur la page
// Stripe et est forcé de choisir "France" (métropole), ce qui prête à confusion. On les ajoute donc
// explicitement à la liste autorisée, en plus de "FR". Le tarif facturé, lui, est déjà déterminé
// AVANT la redirection Stripe à partir du code postal saisi sur notre propre page panier (voir
// src/lib/shippingZones.ts) — cette liste ne sert qu'à ce que le champ pays de Stripe soit cohérent.
export const DOMTOM_STRIPE_COUNTRY_CODES = [
  'GP', // Guadeloupe
  'MQ', // Martinique
  'GF', // Guyane française
  'RE', // Réunion
  'YT', // Mayotte
  'PM', // Saint-Pierre-et-Miquelon
  'BL', // Saint-Barthélemy
  'MF', // Saint-Martin
  'WF', // Wallis-et-Futuna
  'PF', // Polynésie française
  'NC', // Nouvelle-Calédonie
] as const;
