// Étude n°1 — simulation MiroFish (octobre 2026).
// Question posée : « Prévisions du marché français des accessoires pour téléphones portables et
// tablettes pour les 6 prochains mois : l'avantage de livraison en 24 heures de ReparMonPhone peut-il
// se traduire par de la croissance ? »
// Ce fichier sert uniquement à créer l'étude (bouton « Importer » dans /admin/etudes) : ensuite tout
// se modifie directement dans l'admin (les tâches, les notes, le rapport complet).

export const MIROFISH_1_SLUG = 'mirofish-1';

export const MIROFISH_1 = {
  slug: MIROFISH_1_SLUG,
  title: 'Étude MiroFish n°1 — la livraison 24h peut-elle créer de la croissance ?',
  question:
    "Marché français des accessoires et pièces pour téléphones et tablettes, 6 prochains mois : l'avantage de livraison en 24 h (Chronopost) de ReparMonPhone peut-il se traduire par de la croissance ?",
  summary:
    "Oui, mais pas à lui seul. La livraison 24h attire au premier achat ; ce qui fait revenir et recommander, c'est la certitude : stock réel, délai tenu, client prévenu à temps, produit compatible. Le principal frein n'est pas le prix, c'est la confiance.",
  findings: [
    "Attraction immédiate ≠ avantage durable : la livraison 24h fait venir le client, mais n'est pas difficile à copier. Ce qui est durable : stock fiable, promesse tenue, communication claire.",
    "Trois profils d'acheteurs : les pressés (téléphone en panne, besoin demain), les sensibles au prix (comparent avec d'autres revendeurs de pièces), et les « convaincus mais instables » (veulent acheter, hésitent sur la compatibilité, la garantie ou le stock).",
    "Le frein n°1 est la confiance : peur de la rupture après paiement, de la pièce incompatible, du délai non tenu. Une rupture non annoncée coûte plus cher en réputation que la pièce ne rapporte.",
    "Trois segments de croissance : les clients en urgence (réparation immédiate), les réparateurs / bricoleurs réguliers (rachats), et les clients rassurés par les guides et la garantie (conversion des indécis).",
    "Concurrents réels : les revendeurs de pièces de téléphone en France (pas AliExpress ni les réparateurs locaux). Ton écart : Chronopost 24h + boutique physique + guides de réparation.",
  ],
  tasks: [
    {
      title: 'Rendre la promesse « 24h » visible et crédible partout',
      description:
        "Heure limite de commande (20h) près du bouton d'ajout au panier, FAQ sur la page d'accueil, mention claire des conditions (France métropolitaine, Chronopost).",
      status: 'DONE' as const,
      notes: 'Fait : mention « Commandez avant 20h » sur les fiches produit + FAQ accueil.',
    },
    {
      title: 'Prévenir vite et bien le client en cas de rupture ou de retard',
      description:
        "Pouvoir retirer un article d'une commande, rembourser la différence et envoyer une note au client. Envois en plusieurs colis avec un lien de suivi par colis.",
      status: 'DONE' as const,
      notes: 'Fait : retrait d\'un article + note client, et lien de suivi par colis (admin + email).',
    },
    {
      title: 'Fiabiliser le stock affiché',
      description:
        "Auditer les produits en rupture ou au mauvais prix, vérifier que le stock du site correspond au stock réel, masquer ou marquer « sur commande » ce qui n'est pas disponible. Objectif : zéro rupture découverte après paiement.",
      status: 'TODO' as const,
      notes: '',
    },
    {
      title: 'Rassurer sur la compatibilité, la garantie et les retours',
      description:
        "Sur chaque fiche : modèles compatibles bien visibles, durée de garantie, conditions de retour, lien vers le guide de réparation correspondant. C'est ce qui débloque les clients « convaincus mais instables ».",
      status: 'TODO' as const,
      notes: '',
    },
    {
      title: 'Parler à chaque profil : urgence, prix, hésitants',
      description:
        "Page ou bandeau « Réparation urgente : commandé avant 20h, chez toi demain » ; mise en avant des kits / lots pour les sensibles au prix ; avis clients et garantie près du bouton d'achat pour les hésitants.",
      status: 'TODO' as const,
      notes: '',
    },
    {
      title: 'Mesurer pour savoir si ça marche',
      description:
        "Suivre chaque mois : taux de rupture, délai réel de livraison, taux de conversion fiche produit → commande, part de clients qui rachètent (Google Analytics + admin Statistiques).",
      status: 'TODO' as const,
      notes: '',
    },
    {
      title: 'Compléter le dossier MiroFish et relancer une 2e simulation',
      description:
        "Ajouter les noms et chiffres réels des concurrents (sections 4 et 6 du dossier source), puis relancer une simulation pour affiner les résultats.",
      status: 'TODO' as const,
      notes: '',
    },
  ],
};
