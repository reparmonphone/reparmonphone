// Étude n°2 — simulation MiroFish (octobre 2026) : conversion du service de réparation par
// correspondance (envoi du téléphone par la poste). Sert uniquement au bouton « Importer » de
// /admin/etudes ; ensuite tout se modifie dans l'admin.
// NB : la section 2 du rapport (« principales préoccupations ») n'a pas été générée par MiroFish
// (message d'erreur à la place du texte) — d'où l'action « Relancer la section 2 » ci-dessous.

export const MIROFISH_2_SLUG = 'mirofish-2';

export const MIROFISH_2 = {
  slug: MIROFISH_2_SLUG,
  title: 'Étude MiroFish n°2 — réparation par correspondance : ce qui fait passer commande',
  question:
    "Prévisions de conversion pour les services de réparation par correspondance : la confiance, la rapidité et la sécurité des données détermineront-elles le succès de ReparMonPhone ?",
  summary:
    "Les clients acceptent très bien l'idée d'envoyer leur téléphone. Ce qui bloque la commande, ce n'est pas le principe, c'est le manque de contrôle : que se passe-t-il après l'envoi, le prix va-t-il grimper après le diagnostic, mes données sont-elles vues, quand commence le délai de 24h ? Plus la page rend ces quatre points visibles et vérifiables avant la commande, plus la conversion monte.",
  findings: [
    "Le déclencheur d'achat est le sentiment de maîtriser le processus : le client veut savoir quand son colis est reçu, quand le diagnostic démarre, quand il paie et quand il récupère son téléphone.",
    "Le « paiement après diagnostic » rassure seulement si les règles sont claires : quand c'est gratuit, quand c'est payant, devis refusable, remboursement intégral en cas de refus. Sinon il crée la peur d'une facture gonflée.",
    "La sécurité des données est un frein à part entière : les clients craignent surtout que photos, conversations et comptes soient consultés. Ils veulent des engagements simples (sauvegarde conseillée, ce qui n'est pas consulté ni conservé), à lire AVANT de payer.",
    "Le « retour sous 24h » convainc s'il est précis : à partir de quand le délai court, heure limite, jours fériés, exceptions (pièce manquante). Sans cela, il passe pour un slogan.",
    "Les 4 questions avant commande : où est mon appareil ? le prix peut-il changer ? mes données sont-elles protégées ? quand le récupère-je ?",
    "Refonte la plus efficace : mettre les mécanismes de confiance dès le premier écran : parcours complet en étapes, fourchette de prix, frais de retour inclus, engagement données, avis vérifiés, photos de l'atelier, suivi du colis.",
    "Risque principal à mesure que l'activité grandit : l'écart entre ce qui est promis et ce qui est vécu (délai non tenu, frais ajoutés à la fin). Il détruit la confiance plus vite que n'importe quelle panne.",
    "Ton atout face aux concurrents : la livraison Chronopost 24h, à condition de la transformer en règle vérifiable. La concurrence se jouera sur la confiance plus que sur le prix.",
  ].join('\n'),
  report: [
    "SYNTHÈSE DU RAPPORT MIROFISH N°2 (version condensée, utilise « Modifier » pour coller le texte complet)",
    "",
    "1. La condition préalable : le sentiment de contrôle",
    "Les clients n'hésitent pas à envoyer leur appareil ; ce qui freine, c'est de ne pas savoir ce qui se passe après l'envoi. Un parcours découpé en étapes traçables (envoi, réception, diagnostic, devis, paiement, réparation, retour) fait nettement monter l'acceptation. Le paiement après diagnostic n'est rassurant que si les critères et les tarifs sont transparents. La protection des données est une condition de la commande, pas une information annexe.",
    "",
    "2. Principales préoccupations (données, délai, prix)",
    "Section non générée par MiroFish (message d'erreur à la place du texte). À relancer.",
    "",
    "3. Refonte du site la plus efficace : mécanismes de confiance en première page",
    "Cinq changements ressortent : (a) afficher le parcours complet dès le premier écran avec types de réparation, marques, mode d'envoi, délai et frais de retour ; (b) mettre en avant les preuves de tiers : avis vérifiés (type Trustpilot), photos du processus, suivi du colis ; (c) déplacer la déclaration sur les données des CGV vers l'avant-commande (sauvegarde recommandée, ce qui n'est pas consulté ni conservé, checklist avant/après) ; (d) afficher la fourchette de prix des pannes courantes et les frais de retour inclus, pour éviter la surprise après diagnostic ; (e) formaliser le délai de 24h en règle vérifiable (point de départ, transporteurs Chronopost/Colissimo, notifications, conditions).",
    "",
    "4. Tendances et risques",
    "La demande de réparation par correspondance va croître, mais la croissance sera inégale : le trafic ne se transforme en commandes que si la plateforme dissipe l'incertitude. La concurrence passera du prix à l'« infrastructure de confiance » (processus transparent, notifications, explications sur les données, paiement sécurisé, suivi logistique, règles de retour). Risque : l'écart entre promesse et réalité (délai non tenu, frais de dernière minute, sécurité affirmée sans précisions).",
  ].join('\n'),
  tasks: [
    {
      title: 'Afficher le parcours complet en haut de la page « réparation par correspondance »',
      description:
        "Frise en 7 étapes visible dès le premier écran : envoi, réception, diagnostic, confirmation du devis, paiement, réparation, retour. Avec le délai prévu à chaque étape, les marques et types de réparation acceptés, le mode d'envoi et les frais de retour.",
      status: 'TODO' as const,
      notes: '',
    },
    {
      title: 'Expliquer clairement les règles du « paiement après diagnostic »',
      description:
        "Écrire noir sur blanc : diagnostic gratuit ou payant selon les cas, fourchette de prix des pannes courantes, devis toujours refusable, remboursement ou retour de l'appareil sans frais en cas de refus, frais de retour inclus. Objectif : zéro surprise sur le prix final.",
      status: 'TODO' as const,
      notes: '',
    },
    {
      title: 'Mettre l\'engagement « protection des données » avant la commande',
      description:
        "Bloc visible avant le paiement (pas seulement dans les CGV) : sauvegarde conseillée avant l'envoi, ce qui n'est ni consulté ni conservé, checklist avant/après réparation, vérification de la compatibilité du modèle.",
      status: 'TODO' as const,
      notes: '',
    },
    {
      title: 'Transformer le « retour sous 24h » en règle vérifiable',
      description:
        "Préciser quand le délai commence (réception du colis ?), l'heure limite, le traitement des jours fériés, les exceptions (pièce en rupture) et le transporteur (Chronopost / Colissimo). Aucune promesse que tu ne peux pas tenir à chaque fois.",
      status: 'TODO' as const,
      notes: '',
    },
    {
      title: 'Placer les preuves de confiance dans le premier écran',
      description:
        "Avis clients vérifiés (Trustpilot ou avis du site), photos de l'atelier et du processus de réparation, lien de suivi du colis. À mettre en haut de page, pas en pied de page.",
      status: 'TODO' as const,
      notes: '',
    },
    {
      title: 'Prévenir le client à chaque étape (emails de statut)',
      description:
        "Emails automatiques : colis reçu, diagnostic en cours, devis prêt (avec lien de paiement sécurisé expliqué), réparation terminée, retour expédié avec lien de suivi. Le client doit toujours savoir où en est son téléphone.",
      status: 'TODO' as const,
      notes: '',
    },
    {
      title: 'Relancer la section 2 du rapport (préoccupations principales)',
      description:
        "MiroFish n'a pas produit cette section (message d'erreur à la place du texte). Relancer la génération du rapport ou la section, puis coller le résultat dans le rapport complet de cette étude.",
      status: 'TODO' as const,
      notes: '',
    },
    {
      title: 'Suivre l\'écart entre promesse et réalité',
      description:
        "Chaque mois : part des devis finaux hors de la fourchette annoncée, délais réels de retour par rapport aux 24h promises, commandes abandonnées avant paiement. C'est ce qui protège la réputation quand l'activité grandit.",
      status: 'TODO' as const,
      notes: '',
    },
  ],
};
