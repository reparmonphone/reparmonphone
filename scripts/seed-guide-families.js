/**
 * Génère automatiquement les guides de réparation pour TOUS les modèles du catalogue
 * appartenant à 4 grandes familles techniques : iPhone Face ID, Galaxy A/J, Galaxy S, Galaxy Z.
 *
 * Pour chaque modèle trouvé dans une famille, crée 3 guides (Écran / Batterie / Connecteur de
 * charge) à partir d'un contenu-type rédigé pour la famille, avec le titre adapté au modèle et
 * le modelId lié (active la correspondance automatique avec les produits de ce modèle).
 *
 * Le script est idempotent : relance-le sans risque, il ignore les guides déjà créés (par slug).
 *
 * MODE DRY-RUN (fortement recommandé en premier, vu le volume) — affiche uniquement la liste des
 * modèles trouvés par famille et le nombre de guides qui seraient créés, sans rien écrire :
 *   node scripts/seed-guide-families.js --dry-run
 *
 * MODE RÉEL :
 *   node scripts/seed-guide-families.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

// ============================================================
// CONTENU DES GUIDES-TYPES (rédaction originale, une par famille technique)
// ============================================================

const TEMPLATES = {
  iphone_faceid: {
    ecran: {
      label: "Remplacer l'écran",
      difficulty: 'MOYEN',
      estimatedTime: '30-45 min',
      toolsNeeded: [
        'Tournevis Pentalobe P2',
        'Tournevis cruciforme #000',
        "Ventouse d'ouverture",
        'Médiators en plastique',
        'Spatule métallique fine',
        'Pince à épiler',
        'Source de chaleur douce (sèche-cheveux ou coussin chauffant)',
      ],
      partsNeeded: ['Écran de remplacement compatible'],
      excerpt: "Procédure de remplacement d'écran pour iPhone à Face ID (encoche ou Dynamic Island).",
      steps: [
        {
          title: 'Préparer le poste de travail et éteindre le téléphone',
          contentHtml:
            "Éteins complètement l'appareil avant toute intervention. Travaille sur une surface propre et bien éclairée, avec de petits contenants pour trier les vis selon leur emplacement.",
          warning: 'Ne jamais intervenir sur un appareil sous tension.',
        },
        {
          title: 'Retirer les deux vis Pentalobe',
          contentHtml:
            "Dévisse les deux vis Pentalobe P2 situées de part et d'autre du connecteur de charge, en bas de l'appareil. Conserve-les à part, elles seront réutilisées en fin de procédure.",
          warning: null,
        },
        {
          title: "Chauffer légèrement le pourtour de l'écran",
          contentHtml:
            "Applique une chaleur douce et homogène sur les bords de l'écran pendant 1 à 2 minutes pour ramollir l'adhésif qui le scelle au châssis, afin de faciliter l'ouverture sans forcer.",
          warning: "Une chaleur excessive peut endommager la batterie ou la dalle. Reste sur une chaleur douce et progressive.",
        },
        {
          title: 'Ouvrir délicatement avec la ventouse',
          contentHtml:
            "Place la ventouse en bas de l'écran, légèrement décentrée pour éviter la zone du module caméra/capteurs. Tire doucement vers le haut pour créer un espace entre l'écran et le châssis.",
          warning: null,
        },
        {
          title: "Détacher l'adhésif au médiator",
          contentHtml:
            "Insère un médiator en plastique dans l'espace créé et fais-le glisser le long des bords pour trancher l'adhésif progressivement, en repassant chauffer les zones encore collées si besoin.",
          warning: 'Ne jamais insérer d\'outil métallique près des bords : plusieurs nappes fragiles longent le châssis.',
        },
        {
          title: "Basculer l'écran sans le déconnecter",
          contentHtml:
            "Une fois l'adhésif détaché sur les côtés, soulève l'écran comme un livre en le laissant relié au châssis par le haut, où passent les nappes de connexion. Ne jamais tirer d'un coup sec.",
          warning: null,
        },
        {
          title: 'Retirer la plaque de protection des connecteurs',
          contentHtml:
            "Dévisse les petites vis cruciformes maintenant la plaque métallique au-dessus des nappes de l'écran, puis retire-la délicatement à la pince à épiler.",
          warning: null,
        },
        {
          title: "Déconnecter les nappes de l'ancien écran",
          contentHtml:
            "À l'aide de la spatule fine, soulève délicatement chaque connecteur (écran, module Face ID/capteurs) en faisant levier avec précaution, sans tirer sur les câbles.",
          warning: 'Les nappes sont extrêmement fragiles. Une déconnexion brusque peut les endommager définitivement, notamment le module de reconnaissance faciale.',
        },
        {
          title: 'Installer et tester le nouvel écran',
          contentHtml:
            "Reconnecte les nappes du nouvel écran dans l'ordre inverse, remets la plaque de protection, puis teste le fonctionnement (tactile, affichage, Face ID) avant de recoller définitivement.",
          warning: "Teste toujours avant de coller — un problème est bien plus facile à corriger à cette étape.",
        },
        {
          title: 'Recoller et revisser',
          contentHtml:
            "Applique un adhésif adapté sur le pourtour du châssis, repositionne l'écran en appuyant fermement sur les bords, puis revisse les deux vis Pentalobe retirées au départ.",
          warning: null,
        },
      ],
    },
    batterie: {
      label: 'Remplacer la batterie',
      difficulty: 'MOYEN',
      estimatedTime: '30-40 min',
      toolsNeeded: [
        'Tournevis Pentalobe P2',
        'Tournevis cruciforme #000',
        "Ventouse d'ouverture",
        'Médiators en plastique',
        "Languettes de retrait d'adhésif (ou alcool isopropylique)",
        'Pince à épiler',
      ],
      partsNeeded: ['Batterie de remplacement compatible'],
      excerpt: "Procédure de remplacement de batterie pour iPhone à Face ID.",
      steps: [
        {
          title: 'Préparer le poste de travail et éteindre le téléphone',
          contentHtml:
            "Éteins complètement l'appareil. Travaille sur une surface propre et bien éclairée, avec de petits contenants pour trier les vis.",
          warning: 'Ne jamais intervenir sur un appareil sous tension, ni perforer une batterie gonflée.',
        },
        {
          title: 'Retirer les vis Pentalobe et ouvrir le châssis',
          contentHtml:
            "Dévisse les deux vis Pentalobe en bas de l'appareil, chauffe légèrement le pourtour de l'écran, puis ouvre-le à la ventouse et au médiator comme pour un remplacement d'écran, sans déconnecter les nappes de l'écran.",
          warning: null,
        },
        {
          title: "Retirer la plaque de protection de la batterie",
          contentHtml:
            "Dévisse les vis cruciformes maintenant la plaque de protection au-dessus du connecteur de batterie, puis retire-la délicatement.",
          warning: null,
        },
        {
          title: 'Déconnecter la batterie en premier',
          contentHtml:
            "Avant toute autre manipulation, déconnecte le connecteur de la batterie de la carte-mère à l'aide de la spatule fine, pour couper l'alimentation et travailler en sécurité.",
          warning: 'Toujours déconnecter la batterie avant de toucher à tout autre composant interne.',
        },
        {
          title: "Retirer les languettes adhésives de l'ancienne batterie",
          contentHtml:
            "Repère les languettes de retrait situées sous la batterie et tire-les lentement et horizontalement pour décoller la batterie de son logement, sans jamais plier ou percer la cellule.",
          warning: "Une batterie pliée, percée ou chauffée excessivement présente un risque d'incendie. Manipule-la avec précaution et ne force jamais si elle résiste.",
        },
        {
          title: "Retirer complètement l'ancienne batterie",
          contentHtml:
            "Une fois les languettes retirées, soulève délicatement la batterie de son logement. Si un reste d'adhésif subsiste, utilise de l'alcool isopropylique pour le ramollir sans endommager le châssis.",
          warning: null,
        },
        {
          title: 'Installer la nouvelle batterie',
          contentHtml:
            "Positionne la nouvelle batterie dans son logement, en veillant à ce que les nouvelles languettes adhésives soient bien orientées et accessibles pour un futur remplacement.",
          warning: null,
        },
        {
          title: 'Reconnecter la batterie et tester',
          contentHtml:
            "Reconnecte le connecteur de la batterie à la carte-mère, remets la plaque de protection et ses vis, puis rallume l'appareil pour vérifier que la batterie est bien détectée avant de refermer.",
          warning: null,
        },
        {
          title: "Refermer l'écran et revisser",
          contentHtml:
            "Repositionne l'écran, appuie fermement sur les bords pour assurer l'adhérence, puis revisse les deux vis Pentalobe.",
          warning: null,
        },
      ],
    },
    connecteur: {
      label: 'Remplacer le connecteur de charge',
      difficulty: 'DIFFICILE',
      estimatedTime: '45-60 min',
      toolsNeeded: [
        'Tournevis Pentalobe P2',
        'Tournevis cruciforme #000',
        "Ventouse d'ouverture",
        'Médiators en plastique',
        'Spatule métallique fine',
        'Pince à épiler',
        'Fer à souder fin (selon modèle, pour les nappes soudées)',
      ],
      partsNeeded: ['Nappe connecteur de charge compatible'],
      excerpt: "Procédure de remplacement du connecteur de charge pour iPhone à Face ID.",
      steps: [
        {
          title: 'Préparer le poste de travail et éteindre le téléphone',
          contentHtml:
            "Éteins complètement l'appareil et prépare un espace de travail propre et bien éclairé.",
          warning: 'Ne jamais intervenir sur un appareil sous tension.',
        },
        {
          title: "Ouvrir l'appareil et déconnecter la batterie",
          contentHtml:
            "Retire les vis Pentalobe, ouvre l'écran comme pour un remplacement classique, puis déconnecte immédiatement la batterie de la carte-mère avant toute autre intervention.",
          warning: 'Toujours déconnecter la batterie avant de manipuler le connecteur de charge.',
        },
        {
          title: 'Repérer les composants reliés au connecteur de charge',
          contentHtml:
            "Le connecteur de charge est généralement solidaire d'une nappe qui intègre aussi le microphone principal et parfois le haut-parleur. Identifie les vis et connecteurs qui la maintiennent en place avant de commencer le retrait.",
          warning: null,
        },
        {
          title: 'Retirer les vis maintenant le module',
          contentHtml:
            "Dévisse les vis cruciformes qui fixent le support métallique du connecteur de charge au châssis, en les conservant triées par emplacement.",
          warning: null,
        },
        {
          title: 'Déconnecter la nappe du connecteur',
          contentHtml:
            "Déconnecte délicatement la nappe reliant le module de charge à la carte-mère, à l'aide de la spatule fine, sans tirer sur le câble.",
          warning: 'Certains modèles ont cette nappe partiellement soudée à la carte-mère : ne force jamais, vérifie le point de fixation avant de tirer.',
        },
        {
          title: 'Retirer le module usagé',
          contentHtml:
            "Une fois libéré de ses fixations et connexions, retire délicatement l'ensemble du module connecteur de charge de son logement dans le châssis.",
          warning: null,
        },
        {
          title: 'Installer le nouveau module',
          contentHtml:
            "Positionne le nouveau connecteur de charge dans son logement, reconnecte sa nappe à la carte-mère, puis revisse le support métallique.",
          warning: null,
        },
        {
          title: 'Reconnecter la batterie et tester la charge',
          contentHtml:
            "Reconnecte la batterie et teste immédiatement la charge avec un câble (et si possible plusieurs câbles différents) avant de refermer complètement l'appareil.",
          warning: null,
        },
        {
          title: "Refermer l'écran et revisser",
          contentHtml:
            "Repositionne l'écran, colle-le fermement sur les bords, puis revisse les deux vis Pentalobe finales.",
          warning: null,
        },
      ],
    },
  },

  galaxy_aj: {
    ecran: {
      label: "Remplacer l'écran",
      difficulty: 'MOYEN',
      estimatedTime: '35-50 min',
      toolsNeeded: [
        "Ventouse d'ouverture",
        'Médiators en plastique',
        'Spatule métallique fine',
        'Tournevis cruciforme #000',
        'Pince à épiler',
        'Source de chaleur douce',
      ],
      partsNeeded: ['Écran de remplacement compatible (bloc complet avec châssis intermédiaire recommandé)'],
      excerpt: "Procédure de remplacement d'écran pour Samsung Galaxy série A ou J.",
      steps: [
        {
          title: 'Préparer le poste de travail et éteindre le téléphone',
          contentHtml:
            "Éteins complètement l'appareil et retire la coque et la carte SIM/microSD si présente. Travaille sur une surface propre et bien éclairée.",
          warning: 'Ne jamais intervenir sur un appareil sous tension.',
        },
        {
          title: "Chauffer le pourtour de l'écran",
          contentHtml:
            "Ces modèles ont un écran collé sur tout le pourtour, sans vis apparente. Chauffe doucement les bords pendant 1 à 2 minutes pour ramollir l'adhésif avant toute tentative d'ouverture.",
          warning: "Une chaleur excessive peut endommager la dalle (particulièrement les écrans AMOLED) ou la batterie sous-jacente.",
        },
        {
          title: 'Ouvrir un coin avec la ventouse',
          contentHtml:
            "Place la ventouse en bas de l'écran, à l'écart de tout bouton physique, et tire doucement pour créer un premier espace entre l'écran et le châssis arrière.",
          warning: null,
        },
        {
          title: "Détacher l'adhésif tout le tour au médiator",
          contentHtml:
            "Fais glisser un médiator le long de chaque bord pour trancher l'adhésif progressivement, en repassant chauffer les zones résistantes. Procède lentement, sans forcer.",
          warning: "Sur ces modèles, la nappe de l'écran passe généralement en haut : évite d'insérer l'outil trop profondément sur ce bord.",
        },
        {
          title: "Soulever l'écran et repérer les nappes",
          contentHtml:
            "Une fois le pourtour détaché, soulève délicatement l'écran d'un côté pour repérer l'emplacement exact du ou des connecteurs de nappe le reliant à la carte-mère.",
          warning: null,
        },
        {
          title: "Déconnecter la nappe de l'écran",
          contentHtml:
            "À l'aide de la spatule fine, déconnecte le connecteur de la nappe d'écran (et du digitizer tactile s'il est séparé) sans tirer sur le câble lui-même.",
          warning: 'Nappe fragile : une manipulation brusque peut la déchirer et rendre le nouvel écran incompatible avec les capteurs restants.',
        },
        {
          title: "Retirer l'ancien écran et nettoyer le châssis",
          contentHtml:
            "Retire complètement l'ancien écran et nettoie les résidus d'adhésif sur le châssis à l'aide d'un médiator ou d'un chiffon imbibé d'un peu d'alcool isopropylique.",
          warning: null,
        },
        {
          title: 'Connecter et tester le nouvel écran',
          contentHtml:
            "Connecte la nappe du nouvel écran, pose-le sans le coller (juste posé) et teste l'affichage et le tactile avant de procéder au collage définitif.",
          warning: "Teste toujours avant de coller — un problème est bien plus facile à corriger à cette étape.",
        },
        {
          title: 'Coller et refermer',
          contentHtml:
            "Applique un adhésif adapté (bande adhésive pré-découpée ou colle liquide selon le kit) sur le pourtour, repositionne l'écran et presse fermement sur les bords pendant plusieurs secondes.",
          warning: null,
        },
      ],
    },
    batterie: {
      label: 'Remplacer la batterie',
      difficulty: 'MOYEN',
      estimatedTime: '35-45 min',
      toolsNeeded: [
        "Ventouse d'ouverture",
        'Médiators en plastique',
        'Spatule métallique fine',
        'Tournevis cruciforme #000',
        "Languettes de retrait d'adhésif",
        'Pince à épiler',
      ],
      partsNeeded: ['Batterie de remplacement compatible'],
      excerpt: "Procédure de remplacement de batterie pour Samsung Galaxy série A ou J.",
      steps: [
        {
          title: 'Préparer le poste de travail et éteindre le téléphone',
          contentHtml:
            "Éteins complètement l'appareil et retire la coque et le tiroir SIM si présent.",
          warning: 'Ne jamais intervenir sur un appareil sous tension, ni perforer une batterie gonflée.',
        },
        {
          title: "Ouvrir l'écran sans le déconnecter",
          contentHtml:
            "Chauffe le pourtour de l'écran, détache l'adhésif à la ventouse et au médiator comme pour un remplacement d'écran, puis soulève-le d'un côté sans déconnecter sa nappe.",
          warning: null,
        },
        {
          title: 'Retirer le châssis arrière ou la coque intermédiaire',
          contentHtml:
            "Selon le modèle, dévisse les vis cruciformes maintenant la coque interne qui protège la batterie et les connecteurs, puis retire-la délicatement.",
          warning: null,
        },
        {
          title: 'Déconnecter la batterie en premier',
          contentHtml:
            "Avant toute autre manipulation, déconnecte le connecteur de la batterie de la carte-mère pour couper l'alimentation et travailler en sécurité.",
          warning: 'Toujours déconnecter la batterie avant de toucher à tout autre composant interne.',
        },
        {
          title: "Retirer les languettes adhésives de l'ancienne batterie",
          contentHtml:
            "Repère les languettes de retrait sous la batterie et tire-les lentement pour la décoller de son logement, sans jamais la plier ou la percer.",
          warning: "Une batterie pliée, percée ou chauffée excessivement présente un risque d'incendie. Ne force jamais si elle résiste.",
        },
        {
          title: 'Installer la nouvelle batterie',
          contentHtml:
            "Positionne la nouvelle batterie dans son logement en veillant à l'orientation correcte des nouvelles languettes adhésives.",
          warning: null,
        },
        {
          title: 'Reconnecter la batterie et tester',
          contentHtml:
            "Reconnecte le connecteur de batterie, remets la coque intermédiaire et ses vis, puis rallume l'appareil pour vérifier la bonne détection de la batterie.",
          warning: null,
        },
        {
          title: "Refermer l'écran et coller",
          contentHtml:
            "Reconnecte la nappe de l'écran si besoin, applique l'adhésif sur le pourtour et presse fermement les bords pour refermer l'appareil.",
          warning: null,
        },
      ],
    },
    connecteur: {
      label: 'Remplacer le connecteur de charge',
      difficulty: 'MOYEN',
      estimatedTime: '30-40 min',
      toolsNeeded: [
        "Ventouse d'ouverture",
        'Médiators en plastique',
        'Spatule métallique fine',
        'Tournevis cruciforme #000',
        'Pince à épiler',
      ],
      partsNeeded: ['Nappe connecteur de charge compatible'],
      excerpt: "Procédure de remplacement du connecteur de charge pour Samsung Galaxy série A ou J.",
      steps: [
        {
          title: 'Préparer le poste de travail et éteindre le téléphone',
          contentHtml: "Éteins complètement l'appareil et retire la coque et le tiroir SIM si présent.",
          warning: 'Ne jamais intervenir sur un appareil sous tension.',
        },
        {
          title: "Ouvrir l'écran et déconnecter la batterie",
          contentHtml:
            "Ouvre l'écran comme pour un remplacement classique, retire la coque intermédiaire si nécessaire, puis déconnecte immédiatement la batterie de la carte-mère.",
          warning: 'Toujours déconnecter la batterie avant de manipuler le connecteur de charge.',
        },
        {
          title: 'Localiser le module connecteur de charge',
          contentHtml:
            "Sur la plupart de ces modèles, le connecteur de charge fait partie d'une petite nappe indépendante, généralement fixée par une ou deux vis à proximité du bas du châssis.",
          warning: null,
        },
        {
          title: 'Retirer les vis de fixation',
          contentHtml:
            "Dévisse les vis cruciformes qui maintiennent le module en place, en les conservant triées.",
          warning: null,
        },
        {
          title: 'Déconnecter et retirer le module usagé',
          contentHtml:
            "Déconnecte la nappe du connecteur de charge de la carte-mère à l'aide de la spatule fine, puis retire l'ensemble du module de son logement.",
          warning: 'Nappe fragile : ne tire jamais directement sur le câble, fais levier près du connecteur uniquement.',
        },
        {
          title: 'Installer le nouveau module',
          contentHtml:
            "Positionne le nouveau connecteur de charge, reconnecte sa nappe à la carte-mère, puis revisse les fixations.",
          warning: null,
        },
        {
          title: 'Reconnecter la batterie et tester la charge',
          contentHtml:
            "Reconnecte la batterie et teste immédiatement la charge avec un câble avant de refermer complètement l'appareil.",
          warning: null,
        },
        {
          title: "Refermer l'appareil",
          contentHtml:
            "Remets la coque intermédiaire si retirée, reconnecte et recolle l'écran sur le pourtour, puis presse fermement pour assurer l'adhérence.",
          warning: null,
        },
      ],
    },
  },

  galaxy_s: {
    ecran: {
      label: "Remplacer l'écran",
      difficulty: 'DIFFICILE',
      estimatedTime: '45-60 min',
      toolsNeeded: [
        "Ventouse d'ouverture",
        'Médiators en plastique fins (pour bords incurvés)',
        'Spatule métallique fine',
        'Tournevis cruciforme #000',
        'Pince à épiler',
        'Source de chaleur douce',
      ],
      partsNeeded: ['Écran de remplacement compatible (bloc complet recommandé, châssis intégré)'],
      excerpt: "Procédure de remplacement d'écran pour Samsung Galaxy série S, avec attention particulière aux bords incurvés.",
      steps: [
        {
          title: 'Préparer le poste de travail et éteindre le téléphone',
          contentHtml:
            "Éteins complètement l'appareil et retire le tiroir SIM. Travaille sur une surface propre, bien éclairée, sans objets pointus à proximité de l'écran incurvé.",
          warning: 'Ne jamais intervenir sur un appareil sous tension. Les écrans incurvés sont plus fragiles aux chocs latéraux.',
        },
        {
          title: "Chauffer le pourtour de l'écran plus longuement",
          contentHtml:
            "L'adhésif est généralement plus résistant sur les Galaxy S. Chauffe le pourtour par sections de 30 secondes, en insistant particulièrement sur les bords incurvés gauche et droit.",
          warning: "Chaleur excessive : les dalles AMOLED incurvées sont sensibles à la surchauffe, procède progressivement.",
        },
        {
          title: 'Ouvrir un coin avec la ventouse',
          contentHtml:
            "Place la ventouse en bas de l'écran, en évitant toute zone incurvée où l'adhérence de la ventouse serait faible. Tire doucement pour créer un premier espace.",
          warning: null,
        },
        {
          title: "Détacher l'adhésif progressivement, bords incurvés en dernier",
          contentHtml:
            "Commence par détacher les bords haut et bas (plats) au médiator, puis termine par les bords latéraux incurvés en procédant très lentement et en repassant chauffer si l'adhésif résiste.",
          warning: "Les bords incurvés sont la zone la plus à risque de casse de la dalle si l'on force. Patience impérative sur ces zones.",
        },
        {
          title: "Soulever l'écran et repérer les nappes",
          contentHtml:
            "Une fois le pourtour détaché, soulève délicatement l'écran d'un côté pour localiser les connecteurs de nappe (écran, capteur d'empreinte sous l'écran le cas échéant).",
          warning: null,
        },
        {
          title: 'Déconnecter les nappes',
          contentHtml:
            "Déconnecte délicatement chaque nappe (écran, et capteur d'empreinte intégré à l'écran selon le modèle) à l'aide de la spatule fine.",
          warning: 'Sur certains modèles, le lecteur d\'empreinte est intégré à l\'écran : sa nappe est particulièrement fine et fragile.',
        },
        {
          title: "Retirer l'ancien écran et nettoyer le châssis",
          contentHtml:
            "Retire complètement l'ancien écran et nettoie les résidus d'adhésif, en particulier sur les bords incurvés où l'adhésif peut être épais.",
          warning: null,
        },
        {
          title: 'Connecter et tester le nouvel écran',
          contentHtml:
            "Connecte les nappes du nouvel écran, pose-le sans coller et teste l'affichage, le tactile et le capteur d'empreinte avant collage définitif.",
          warning: "Teste toujours avant de coller — un problème est bien plus facile à corriger à cette étape.",
        },
        {
          title: 'Coller et refermer avec précision',
          contentHtml:
            "Applique l'adhésif en insistant sur un alignement parfait des bords incurvés (un léger décalage est très visible sur ces modèles), puis presse fermement sur tout le pourtour.",
          warning: null,
        },
      ],
    },
    batterie: {
      label: 'Remplacer la batterie',
      difficulty: 'DIFFICILE',
      estimatedTime: '45-55 min',
      toolsNeeded: [
        "Ventouse d'ouverture",
        'Médiators en plastique fins',
        'Spatule métallique fine',
        'Tournevis cruciforme #000',
        "Languettes de retrait d'adhésif",
        'Pince à épiler',
      ],
      partsNeeded: ['Batterie de remplacement compatible'],
      excerpt: "Procédure de remplacement de batterie pour Samsung Galaxy série S.",
      steps: [
        {
          title: 'Préparer le poste de travail et éteindre le téléphone',
          contentHtml: "Éteins complètement l'appareil et retire le tiroir SIM.",
          warning: 'Ne jamais intervenir sur un appareil sous tension, ni perforer une batterie gonflée.',
        },
        {
          title: "Ouvrir l'écran sans le déconnecter",
          contentHtml:
            "Chauffe et détache le pourtour de l'écran comme pour un remplacement d'écran, en procédant lentement sur les bords incurvés, puis soulève-le d'un côté sans déconnecter sa nappe.",
          warning: "Les bords incurvés des Galaxy S demandent une patience particulière pour éviter de fissurer la dalle.",
        },
        {
          title: 'Accéder au compartiment batterie',
          contentHtml:
            "Selon le modèle, dévisse les vis cruciformes maintenant la coque interne ou le cadre médian qui protège la batterie.",
          warning: null,
        },
        {
          title: 'Déconnecter la batterie en premier',
          contentHtml:
            "Avant toute autre manipulation, déconnecte le connecteur de la batterie de la carte-mère.",
          warning: 'Toujours déconnecter la batterie avant de toucher à tout autre composant interne.',
        },
        {
          title: "Retirer les languettes adhésives de l'ancienne batterie",
          contentHtml:
            "Repère les languettes de retrait sous la batterie et tire-les lentement et à plat pour la décoller, sans la plier ni la percer.",
          warning: "Une batterie pliée, percée ou chauffée excessivement présente un risque d'incendie. Ne force jamais si elle résiste.",
        },
        {
          title: 'Installer la nouvelle batterie',
          contentHtml:
            "Positionne la nouvelle batterie dans son logement en veillant à l'orientation correcte des nouvelles languettes adhésives.",
          warning: null,
        },
        {
          title: 'Reconnecter la batterie et tester',
          contentHtml:
            "Reconnecte le connecteur de batterie, remets le cadre médian/coque interne et ses vis, puis rallume l'appareil pour vérifier la bonne détection de la batterie.",
          warning: null,
        },
        {
          title: "Refermer l'écran avec précision",
          contentHtml:
            "Reconnecte la nappe de l'écran, applique l'adhésif en veillant à l'alignement des bords incurvés, puis presse fermement sur tout le pourtour.",
          warning: null,
        },
      ],
    },
    connecteur: {
      label: 'Remplacer le connecteur de charge',
      difficulty: 'MOYEN',
      estimatedTime: '35-45 min',
      toolsNeeded: [
        "Ventouse d'ouverture",
        'Médiators en plastique fins',
        'Spatule métallique fine',
        'Tournevis cruciforme #000',
        'Pince à épiler',
      ],
      partsNeeded: ['Nappe connecteur de charge compatible'],
      excerpt: "Procédure de remplacement du connecteur de charge pour Samsung Galaxy série S.",
      steps: [
        {
          title: 'Préparer le poste de travail et éteindre le téléphone',
          contentHtml: "Éteins complètement l'appareil et retire le tiroir SIM.",
          warning: 'Ne jamais intervenir sur un appareil sous tension.',
        },
        {
          title: "Ouvrir l'écran et déconnecter la batterie",
          contentHtml:
            "Ouvre l'écran comme pour un remplacement classique en procédant prudemment sur les bords incurvés, puis déconnecte immédiatement la batterie.",
          warning: 'Toujours déconnecter la batterie avant de manipuler le connecteur de charge.',
        },
        {
          title: 'Localiser le module connecteur de charge',
          contentHtml:
            "Le connecteur de charge est généralement intégré à une petite nappe en bas du châssis, parfois combinée au microphone principal, fixée par une ou deux vis.",
          warning: null,
        },
        {
          title: 'Retirer les vis de fixation',
          contentHtml: "Dévisse les vis cruciformes qui maintiennent le module en place.",
          warning: null,
        },
        {
          title: 'Déconnecter et retirer le module usagé',
          contentHtml:
            "Déconnecte la nappe du connecteur de charge de la carte-mère à l'aide de la spatule fine, puis retire l'ensemble du module.",
          warning: 'Nappe fragile : ne tire jamais directement sur le câble.',
        },
        {
          title: 'Installer le nouveau module',
          contentHtml:
            "Positionne le nouveau connecteur de charge, reconnecte sa nappe à la carte-mère, puis revisse les fixations.",
          warning: null,
        },
        {
          title: 'Reconnecter la batterie et tester la charge',
          contentHtml:
            "Reconnecte la batterie et teste immédiatement la charge avec un câble avant de refermer complètement l'appareil.",
          warning: null,
        },
        {
          title: "Refermer l'écran avec précision",
          contentHtml:
            "Reconnecte et recolle l'écran en veillant à l'alignement des bords incurvés, puis presse fermement sur tout le pourtour.",
          warning: null,
        },
      ],
    },
  },

  galaxy_z: {
    ecran: {
      label: "Remplacer l'écran (interne ou externe)",
      difficulty: 'DIFFICILE',
      estimatedTime: '60-90 min',
      toolsNeeded: [
        "Ventouse d'ouverture",
        'Médiators en plastique très fins',
        'Spatule métallique fine',
        'Tournevis cruciforme #000',
        'Pince à épiler',
        'Source de chaleur douce',
      ],
      partsNeeded: ['Écran de remplacement compatible (interne pliable ou externe selon la panne)'],
      excerpt:
        "Procédure de remplacement d'écran pour Samsung Galaxy Z (Flip/Fold), avec précautions spécifiques à la dalle pliable et à la charnière.",
      steps: [
        {
          title: 'Préparer le poste de travail et identifier l\u2019écran concerné',
          contentHtml:
            "Ces appareils ont deux écrans : un écran externe (couvercle) et un écran interne pliable. Identifie clairement lequel doit être remplacé avant de commencer, la procédure diffère selon le cas.",
          warning: 'Ne jamais intervenir sur un appareil sous tension.',
        },
        {
          title: 'Éteindre le téléphone et retirer le tiroir SIM',
          contentHtml: "Éteins complètement l'appareil et retire le tiroir SIM avant toute ouverture.",
          warning: null,
        },
        {
          title: "Cas écran externe : chauffer et ouvrir le couvercle",
          contentHtml:
            "Pour l'écran externe, chauffe doucement son pourtour puis détache-le à la ventouse et au médiator, en procédant très lentement car ce petit écran est fin et cassant.",
          warning: "L'écran externe est particulièrement fin : une pression excessive peut le fissurer immédiatement.",
        },
        {
          title: "Cas écran interne : ouvrir l'appareil par la charnière",
          contentHtml:
            "Pour l'écran interne pliable, l'ouverture se fait généralement par le châssis arrière plutôt que par l'écran lui-même : dévisse les vis du dos de l'appareil et retire délicatement la coque arrière avant d'accéder à la dalle pliable.",
          warning: null,
        },
        {
          title: 'Manipuler la zone de charnière avec précaution',
          contentHtml:
            "Ne jamais forcer sur le pli de l'écran interne ni sur le mécanisme de charnière. Si un dégagement est nécessaire près de la charnière, procède avec des outils fins et des mouvements minimes.",
          warning: 'La dalle pliable et son film de protection sont extrêmement sensibles à toute pression ou pli non naturel. Une manipulation incorrecte peut créer un pli permanent visible.',
        },
        {
          title: 'Déconnecter les nappes concernées',
          contentHtml:
            "Localise et déconnecte délicatement les nappes reliant l'écran (interne ou externe) à la carte-mère, à l'aide de la spatule fine.",
          warning: 'Sur l\'écran interne, la nappe traverse souvent la zone de charnière : manipule-la sans jamais la plier à un angle non prévu.',
        },
        {
          title: "Retirer l'ancien écran",
          contentHtml:
            "Retire complètement l'écran défectueux (interne ou externe) de son logement, en prenant soin de conserver intact le film de protection s'il doit être réutilisé.",
          warning: null,
        },
        {
          title: 'Installer et tester le nouvel écran',
          contentHtml:
            "Connecte les nappes du nouvel écran, positionne-le sans coller et teste l'affichage, le tactile, ainsi que le pliage en douceur pour l'écran interne, avant fixation définitive.",
          warning: "Teste toujours avant fixation définitive, en particulier le mécanisme de pliage pour l'écran interne.",
        },
        {
          title: "Refermer l'appareil",
          contentHtml:
            "Fixe le nouvel écran selon la méthode adaptée (adhésif pour l'externe, clips/vis pour la coque arrière côté interne), revisse la coque arrière si retirée, et vérifie le bon fonctionnement du pliage complet.",
          warning: null,
        },
      ],
    },
    batterie: {
      label: 'Remplacer la batterie',
      difficulty: 'DIFFICILE',
      estimatedTime: '50-70 min',
      toolsNeeded: [
        'Tournevis cruciforme #000',
        'Médiators en plastique',
        'Spatule métallique fine',
        "Languettes de retrait d'adhésif",
        'Pince à épiler',
      ],
      partsNeeded: ['Batterie de remplacement compatible'],
      excerpt: "Procédure de remplacement de batterie pour Samsung Galaxy Z (Flip/Fold).",
      steps: [
        {
          title: 'Préparer le poste de travail et éteindre le téléphone',
          contentHtml: "Éteins complètement l'appareil et retire le tiroir SIM.",
          warning: 'Ne jamais intervenir sur un appareil sous tension, ni perforer une batterie gonflée.',
        },
        {
          title: 'Ouvrir le châssis arrière',
          contentHtml:
            "Dévisse les vis maintenant la coque arrière (généralement autour du contour et près de la charnière), puis retire-la délicatement à l'aide d'un médiator.",
          warning: "Attention à ne pas exercer de pression sur la zone de charnière en ouvrant le châssis.",
        },
        {
          title: 'Déconnecter la batterie en premier',
          contentHtml:
            "Avant toute autre manipulation, déconnecte le connecteur de la batterie de la carte-mère.",
          warning: 'Toujours déconnecter la batterie avant de toucher à tout autre composant interne.',
        },
        {
          title: "Retirer les languettes adhésives de l'ancienne batterie",
          contentHtml:
            "Ces appareils logent souvent deux compartiments de batterie séparés par la charnière : repère les languettes de retrait de chaque côté et tire-les lentement.",
          warning: "Une batterie pliée, percée ou chauffée excessivement présente un risque d'incendie. Ne force jamais si elle résiste.",
        },
        {
          title: 'Installer la nouvelle batterie',
          contentHtml:
            "Positionne la ou les nouvelles cellules de batterie dans leurs logements respectifs, en veillant à l'orientation correcte des languettes adhésives.",
          warning: null,
        },
        {
          title: 'Reconnecter la batterie et tester',
          contentHtml:
            "Reconnecte le connecteur de batterie et rallume l'appareil pour vérifier la bonne détection avant de refermer.",
          warning: null,
        },
        {
          title: "Refermer le châssis arrière",
          contentHtml:
            "Repositionne la coque arrière en évitant toute pression sur la charnière, puis revisse l'ensemble des vis.",
          warning: null,
        },
      ],
    },
    connecteur: {
      label: 'Remplacer le connecteur de charge',
      difficulty: 'MOYEN',
      estimatedTime: '40-50 min',
      toolsNeeded: [
        'Tournevis cruciforme #000',
        'Médiators en plastique',
        'Spatule métallique fine',
        'Pince à épiler',
      ],
      partsNeeded: ['Nappe connecteur de charge compatible'],
      excerpt: "Procédure de remplacement du connecteur de charge pour Samsung Galaxy Z (Flip/Fold).",
      steps: [
        {
          title: 'Préparer le poste de travail et éteindre le téléphone',
          contentHtml: "Éteins complètement l'appareil et retire le tiroir SIM.",
          warning: 'Ne jamais intervenir sur un appareil sous tension.',
        },
        {
          title: 'Ouvrir le châssis arrière et déconnecter la batterie',
          contentHtml:
            "Retire la coque arrière comme pour un remplacement de batterie, puis déconnecte immédiatement la batterie de la carte-mère.",
          warning: 'Toujours déconnecter la batterie avant de manipuler le connecteur de charge.',
        },
        {
          title: 'Localiser le module connecteur de charge',
          contentHtml:
            "Le connecteur de charge se trouve généralement dans la partie basse de l'appareil (côté non-charnière), fixé par une ou deux vis.",
          warning: null,
        },
        {
          title: 'Retirer les vis de fixation',
          contentHtml: "Dévisse les vis cruciformes qui maintiennent le module en place.",
          warning: null,
        },
        {
          title: 'Déconnecter et retirer le module usagé',
          contentHtml:
            "Déconnecte la nappe du connecteur de charge de la carte-mère à l'aide de la spatule fine, puis retire l'ensemble du module.",
          warning: 'Nappe fragile : ne tire jamais directement sur le câble.',
        },
        {
          title: 'Installer le nouveau module',
          contentHtml:
            "Positionne le nouveau connecteur de charge, reconnecte sa nappe à la carte-mère, puis revisse les fixations.",
          warning: null,
        },
        {
          title: 'Reconnecter la batterie et tester la charge',
          contentHtml:
            "Reconnecte la batterie et teste immédiatement la charge avec un câble avant de refermer complètement l'appareil.",
          warning: null,
        },
        {
          title: 'Refermer le châssis arrière',
          contentHtml:
            "Repositionne la coque arrière en évitant toute pression sur la charnière, puis revisse l'ensemble des vis.",
          warning: null,
        },
      ],
    },
  },
};

// ============================================================
// DÉFINITION DES FAMILLES : comment retrouver les modèles concernés en base
// ============================================================

async function getFamilyModels(family) {
  if (family === 'iphone_faceid') {
    const models = await prisma.model.findMany({
      where: {
        productLine: { slug: 'iphone', brand: { slug: 'apple' } },
      },
      include: { productLine: { include: { brand: true } } },
    });
    // Ne garder que les iPhone à Face ID (à partir du X) : slugs commençant par x/xr/xs/11 à 16.
    // Exclut volontairement les iPhone SE (2020/2022), qui utilisent Touch ID et une architecture
    // différente (corps type iPhone 8) malgré une sortie plus récente que le X.
    return models.filter((m) => /^iphone-(x$|x-|xr|xs|11|12|13|14|15|16)/.test(m.slug));
  }

  if (family === 'galaxy_aj') {
    const [fromGalaxyA, fromGalaxyJ, fromSamsungGalaxy] = await Promise.all([
      prisma.model.findMany({
        where: { productLine: { slug: 'galaxy-a', brand: { slug: 'samsung' } } },
        include: { productLine: { include: { brand: true } } },
      }),
      prisma.model.findMany({
        where: { productLine: { slug: 'galaxy-j', brand: { slug: 'samsung' } } },
        include: { productLine: { include: { brand: true } } },
      }),
      prisma.model.findMany({
        where: { productLine: { slug: 'samsung-galaxy', brand: { slug: 'samsung' } } },
        include: { productLine: { include: { brand: true } } },
      }),
    ]);
    // Dans la productLine "samsung-galaxy" (fourre-tout hérité de la migration), on ne garde que
    // les entrées de type Ax0s (slug commençant par "a"), en excluant Note/Note Edge/S10E.
    const extraA = fromSamsungGalaxy.filter((m) => m.slug.startsWith('a'));
    return [...fromGalaxyA, ...fromGalaxyJ, ...extraA];
  }

  if (family === 'galaxy_s') {
    const [fromGalaxyS, fromSamsungGalaxy] = await Promise.all([
      prisma.model.findMany({
        where: { productLine: { slug: 'galaxy-s', brand: { slug: 'samsung' } } },
        include: { productLine: { include: { brand: true } } },
      }),
      prisma.model.findMany({
        where: { productLine: { slug: 'samsung-galaxy', brand: { slug: 'samsung' } } },
        include: { productLine: { include: { brand: true } } },
      }),
    ]);
    const extraS = fromSamsungGalaxy.filter((m) => m.slug.startsWith('s10e'));
    return [...fromGalaxyS, ...extraS];
  }

  if (family === 'galaxy_z') {
    const models = await prisma.model.findMany({
      where: { productLine: { slug: 'galaxy-z', brand: { slug: 'samsung' } } },
      include: { productLine: { include: { brand: true } } },
    });
    return models;
  }

  return [];
}

async function uniqueGuideSlug(title) {
  const base = slugify(title) || 'guide';
  let slug = base;
  let i = 1;
  while (await prisma.repairGuide.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

async function main() {
  const families = ['iphone_faceid', 'galaxy_aj', 'galaxy_s', 'galaxy_z'];
  const repairTypes = ['ecran', 'batterie', 'connecteur'];

  let totalModelsFound = 0;
  let totalGuidesToCreate = 0;
  let totalGuidesCreated = 0;
  let totalGuidesSkipped = 0;

  for (const family of families) {
    const models = await getFamilyModels(family);
    totalModelsFound += models.length;

    console.log(`\n📦 Famille "${family}" — ${models.length} modèle(s) trouvé(s) :`);
    models.forEach((m) => console.log(`   - ${m.productLine.brand.name} ${m.name} (${m.slug})`));

    for (const model of models) {
      for (const repairType of repairTypes) {
        const template = TEMPLATES[family][repairType];
        const guideTitle = `${template.label} — ${model.name}`;
        totalGuidesToCreate += 1;

        if (isDryRun) continue;

        const existingSlugBase = slugify(guideTitle);
        const alreadyExists = await prisma.repairGuide.findFirst({ where: { modelId: model.id, title: guideTitle } });
        if (alreadyExists) {
          totalGuidesSkipped += 1;
          continue;
        }

        const slug = await uniqueGuideSlug(guideTitle);

        await prisma.repairGuide.create({
          data: {
            slug,
            title: guideTitle,
            excerpt: template.excerpt,
            modelId: model.id,
            difficulty: template.difficulty,
            estimatedTime: template.estimatedTime,
            toolsNeeded: template.toolsNeeded,
            partsNeeded: template.partsNeeded,
            published: true,
            steps: {
              create: template.steps.map((step, index) => ({
                order: index,
                title: step.title,
                contentHtml: step.contentHtml,
                imageUrl: null,
                warning: step.warning,
              })),
            },
          },
        });
        totalGuidesCreated += 1;
        process.stdout.write('.');
      }
    }
  }

  console.log('\n\n──────────────────────────────');
  console.log(`Modèles trouvés (toutes familles) : ${totalModelsFound}`);
  console.log(`Guides ${isDryRun ? 'qui seraient créés (simulation)' : 'traités'} : ${totalGuidesToCreate}`);
  if (!isDryRun) {
    console.log(`   ✅ Créés : ${totalGuidesCreated}`);
    console.log(`   ⏭️  Déjà existants (ignorés) : ${totalGuidesSkipped}`);
  }
  console.log('──────────────────────────────\n');

  if (isDryRun) {
    console.log('Pour créer réellement ces guides, relance sans --dry-run :');
    console.log('   node scripts/seed-guide-families.js\n');
  }
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
