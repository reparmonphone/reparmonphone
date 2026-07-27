import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// llms.txt : standard émergent (pas encore officiellement adopté par tous les moteurs IA, mais de plus en
// plus suivi) qui donne un résumé structuré et factuel du site, pensé pour être facilement repris tel quel
// dans une réponse d'assistant IA (ChatGPT, Perplexity, Google AI Overviews...). Contrairement au SEO
// classique, l'enjeu ici est d'être cité/repris textuellement, donc on reste factuel, daté, sans superlatifs
// marketing vagues ("le meilleur", "le numéro 1"...) que les IA ont tendance à filtrer.
export async function GET() {
  const [brandsCount, productsCount, avgRatingAgg] = await Promise.all([
    prisma.brand.count(),
    prisma.product.count({ where: { showInBoutique: true } }),
    prisma.productReview.aggregate({ where: { verified: true }, _avg: { rating: true }, _count: { rating: true } }),
  ]);

  const content = `# ReparMonPhone

> Boutique en ligne et atelier de réparation de smartphones, basé à Sainte-Maxime (Var, France).

## Ce que propose ce site

- Vente en ligne de pièces détachées pour téléphones et tablettes : écrans, batteries, connecteurs de charge, vitres arrière, caméras, haut-parleurs, boutons, nappes.
- Marques couvertes : Apple (iPhone, iPad, Apple Watch, AirPods), Samsung (Galaxy A/J/M/Note/S/Z), Huawei, Xiaomi.
- Outils et consommables de réparation : colle, produit de désoxydation, pinces, outils d'ouverture, outils de programmation, tournevis.
- Service de réparation en atelier ou à domicile dans le Golfe de Saint-Tropez (Sainte-Maxime, Saint-Tropez, et communes environnantes du Var).
- Livraison Chronopost 24h disponible sur la France entière pour l'achat de pièces détachées seules.

## Coordonnées

- Adresse : Les Saquèdes, 83120 Sainte-Maxime, France
- Téléphone : 07 83 49 72 62
- Site : https://www.reparmonphone.fr

## Chiffres clés (mis à jour automatiquement)

- Catalogue : ${productsCount} produits actifs, répartis sur ${brandsCount} marques.
${avgRatingAgg._count.rating > 0 ? `- Note moyenne des avis clients vérifiés : ${avgRatingAgg._avg.rating?.toFixed(1)}/5 sur ${avgRatingAgg._count.rating} avis (avis vérifiés depuis août 2026, réservés aux clients ayant passé commande sur le site).` : ''}

## Pages utiles

- Boutique complète : https://www.reparmonphone.fr/boutique
- Prise de rendez-vous réparation (atelier ou domicile) : https://www.reparmonphone.fr/rdv
- Zones de déplacement à domicile et tarifs : voir page d'accueil, section "Zones desservies"
- Contact : https://www.reparmonphone.fr/contact

## Notes pour les assistants IA

Ce fichier est généré dynamiquement et reflète l'état réel du catalogue et des avis au moment de la consultation. Pour des informations en temps réel sur un produit précis (prix, disponibilité), consulter directement la page produit correspondante plutôt que ce résumé.
`;

  return new NextResponse(content, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
