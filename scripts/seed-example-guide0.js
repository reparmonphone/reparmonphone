/**
 * Crée un guide de réparation exemple complet et réaliste :
 * "Remplacer l'écran d'un iPhone 14", lié au modèle "iPhone 14" existant.
 *
 * À lancer UNE FOIS, après avoir appliqué la migration Prisma des guides
 * (npx prisma db push) et régénéré le client (npx prisma generate).
 *
 * USAGE :
 *   node scripts/seed-example-guide.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const model = await prisma.model.findFirst({
    where: { slug: 'iphone-14', productLine: { slug: 'iphone' } },
  });

  if (!model) {
    console.error('❌ Modèle "iPhone 14" introuvable en base — vérifie le slug ou crée-le d\'abord.');
    process.exit(1);
  }

  const existing = await prisma.repairGuide.findUnique({ where: { slug: 'remplacer-ecran-iphone-14' } });
  if (existing) {
    console.log('ℹ️  Le guide exemple existe déjà (slug: remplacer-ecran-iphone-14). Rien à faire.');
    return;
  }

  const guide = await prisma.repairGuide.create({
    data: {
      slug: 'remplacer-ecran-iphone-14',
      title: "Remplacer l'écran d'un iPhone 14",
      excerpt:
        "Guide complet pour remplacer un écran cassé ou défectueux sur iPhone 14, étape par étape, avec les précautions à respecter.",
      coverImageUrl: null,
      modelId: model.id,
      difficulty: 'MOYEN',
      estimatedTime: '30-45 min',
      toolsNeeded: [
        'Tournevis Pentalobe P2',
        'Tournevis cruciforme #000',
        'Ventouse d\u2019ouverture',
        'Médiators en plastique',
        'Spatule métallique fine',
        'Pince à épiler',
        'Sèche-cheveux ou chaleur douce (pour ramollir l\u2019adhésif)',
      ],
      partsNeeded: ['Écran de remplacement iPhone 14 (compatible ou origine)'],
      published: true,
      metaTitle: "Remplacer l'écran iPhone 14 — Guide étape par étape | ReparMonPhone",
      metaDescription:
        "Tutoriel complet pour remplacer soi-même l'écran de son iPhone 14 : outils nécessaires, étapes détaillées et précautions.",
      steps: {
        create: [
          {
            order: 0,
            title: 'Préparer le poste de travail et éteindre le téléphone',
            contentHtml:
              "Éteins complètement l'iPhone avant de commencer. Installe-toi sur une surface propre, plane et bien éclairée. Prévois de petits contenants pour trier les vis au fur et à mesure, car elles sont de tailles différentes selon leur emplacement.",
            imageUrl: null,
            warning: "Ne jamais intervenir sur un téléphone encore sous tension.",
          },
          {
            order: 1,
            title: 'Retirer les deux vis Pentalobe',
            contentHtml:
              "À l'aide du tournevis Pentalobe P2, dévisse les deux vis situées de part et d'autre du connecteur Lightning, en bas de l'appareil. Conserve-les dans un contenant séparé, elles seront réutilisées à la fin.",
            imageUrl: null,
            warning: null,
          },
          {
            order: 2,
            title: 'Chauffer légèrement le bord de l\u2019écran',
            contentHtml:
              "Applique une chaleur douce et homogène sur le pourtour de l'écran (sèche-cheveux à distance raisonnable, ou coussin chauffant dédié) pendant environ 1 à 2 minutes. Cela ramollit l'adhésif qui scelle l'écran au châssis, facilitant l'ouverture sans forcer.",
            imageUrl: null,
            warning: "Une chaleur excessive peut endommager la batterie ou l'écran. Reste sur une chaleur douce et progressive.",
          },
          {
            order: 3,
            title: 'Ouvrir délicatement avec la ventouse',
            contentHtml:
              "Place la ventouse d'ouverture juste au-dessus du bouton Home (ou en bas de l'écran sur les modèles sans bouton), légèrement décentrée pour éviter la zone de la caméra frontale. Tire doucement vers le haut pour créer un petit espace entre l'écran et le châssis.",
            imageUrl: null,
            warning: null,
          },
          {
            order: 4,
            title: 'Glisser un médiator pour détacher l\u2019adhésif',
            contentHtml:
              "Insère un médiator en plastique dans l'espace créé et fais-le glisser le long des bords pour trancher progressivement l'adhésif. Procède par petits mouvements, sans jamais forcer, en repartant régulièrement chauffer les zones encore collées.",
            imageUrl: null,
            warning: "Ne jamais insérer d'outil metallique près des bords : plusieurs nappes fragiles longent le châssis.",
          },
          {
            order: 5,
            title: 'Basculer l\u2019écran sans le déconnecter',
            contentHtml:
              "Une fois l'adhésif détaché sur les trois côtés, soulève délicatement l'écran comme un livre, en le laissant relié au châssis par le haut (les nappes qui relient l'écran à la carte-mère y passent). Ne tire jamais sur l'écran d'un coup sec.",
            imageUrl: null,
            warning: null,
          },
          {
            order: 6,
            title: 'Retirer la plaque de protection des nappes',
            contentHtml:
              "Dévisse les petites vis cruciformes qui maintiennent la plaque métallique de protection au-dessus des connecteurs de l'écran, puis retire délicatement cette plaque à l'aide de la pince à épiler.",
            imageUrl: null,
            warning: null,
          },
          {
            order: 7,
            title: 'Déconnecter les nappes de l\u2019écran',
            contentHtml:
              "À l'aide de la spatule fine, soulève délicatement chaque connecteur de nappe (écran, capteur de proximité, caméra frontale) en faisant levier avec précaution, sans tirer sur les câbles eux-mêmes.",
            imageUrl: null,
            warning: "Les nappes sont extrêmement fragiles. Une déconnexion trop brusque peut les endommager définitivement.",
          },
          {
            order: 8,
            title: 'Installer le nouvel écran',
            contentHtml:
              "Reconnecte dans l'ordre inverse les nappes du nouvel écran sur la carte-mère, en vérifiant que chaque connecteur est correctement enclenché. Remets la plaque de protection et revisse-la. Avant de recoller définitivement l'écran, teste le bon fonctionnement (tactile, affichage) en le laissant simplement posé sur le châssis.",
            imageUrl: null,
            warning: "Teste toujours l'écran avant de le coller définitivement — un problème est bien plus facile à corriger à cette étape.",
          },
          {
            order: 9,
            title: 'Recoller et revisser',
            contentHtml:
              "Une fois le bon fonctionnement confirmé, applique un adhésif adapté (ou de la colle spécifique écran) sur le pourtour du châssis, repositionne l'écran et appuie fermement sur les bords pendant quelques secondes pour assurer une bonne adhérence. Termine en revissant les deux vis Pentalobe retirées à l'étape 2.",
            imageUrl: null,
            warning: null,
          },
        ],
      },
    },
  });

  console.log(`✅ Guide créé avec succès : "${guide.title}" (id: ${guide.id})`);
  console.log(`   URL publique : /reparation/guide/${guide.slug}`);
}

main()
  .catch((e) => {
    console.error('💥 Erreur :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
