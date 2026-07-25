# ReparMonPhone — Next.js

Clone du site reparmonphone.fr (actuellement WooCommerce/WordPress) en Next.js 14 + Prisma + Supabase + Stripe.

## Contenu déjà fait

- **Migration des données** : `data/products_final.json` contient les **1479 produits** extraits depuis ton export WooCommerce (`Produits.xml`), avec :
  - marque, **gamme** (iPhone / iPad / Galaxy S / Galaxy A / Redmi Note...), modèle
  - type de pièce (auto-catégorisé depuis le titre)
  - prix, stock
  - **toutes les images** (galerie complète par produit, pas juste la miniature — 88 produits ont plusieurs photos)
  - **description courte** (`short_description`, l'extrait WooCommerce)
  - **description longue** (`description`, le contenu HTML complet de la fiche produit d'origine)
- **Hiérarchie Marque → Gamme → Modèle → Produit** dans Prisma (`Brand` → `ProductLine` → `Model` → `Product`), déduite automatiquement des catégories WooCommerce (ex : tous les "A02s", "A12", "S23"... de Samsung sont rattachés à leur gamme "Galaxy A" ou "Galaxy S").
- **Méga-menu** dans le header : ordre fixe **Apple / Samsung / Huawei / Xiaomi / Outils** (renommage de la marque "Autre" issue de la migration) **/ Prendre RDV**, plus un menu "Mon compte" (connexion/inscription si déconnecté, ou profil + commandes + RDV si connecté). Survol d'une marque → affiche ses gammes et leurs modèles (`Apple / iPhone / [modèles]`, `Apple / iPad / [modèles]`, `Samsung / Galaxy S / [modèles]`, etc.), cliquables vers la boutique filtrée.
- **Boutique** : `/boutique` avec filtres marque → gamme → modèle → type de pièce (en cascade), `/produit/[slug]` fiche produit avec :
  - galerie d'images cliquable (miniatures)
  - description courte affichée **sous le bouton "Ajouter au panier"**
  - description longue affichée **pleine largeur, sous toute la fiche produit**
- Panier persistant (`/panier`), checkout Stripe (`/api/checkout` + webhook `/api/webhook`).
- **Prise de RDV** : `/rdv`, atelier ou domicile, avec calcul automatique du supplément selon la ville (reprend les zones de ton site actuel : Sainte-Maxime gratuit, Saint-Tropez/Grimaud/Cogolin/La Croix-Valmer/Gassin/Plan-de-la-Tour/Les Issambres +30€).
- **Pages statiques / légales** extraites de `pages.xml` (`data/static_pages.json`) et nettoyées (suppression des commentaires Gutenberg, correction des URLs d'images) : `/a-propos`, `/mentions-legales`, `/cgv`, `/confidentialite`, `/livraison-retours`.
- **Page contact** (`/contact`) : formulaire réel (nom/email/sujet/message) reconstruit à partir de ton export Contact Form 7 (`Formulaire_de_contact.xml`), avec tes vraies coordonnées (adresse Les Saquèdes, téléphone, email) et enregistrement des messages en base (`ContactMessage`) via `/api/contact`.
- **Logo réel** intégré dans le header (récupéré depuis `media.xml`).
- **Interface d'administration** (`/admin`), protégée par Supabase Auth (email/mot de passe) :
  - **Tableau de bord** (`/admin`) : compteurs produits, ruptures de stock, commandes en attente, RDV à confirmer, messages non traités.
  - **Produits & stock** (`/admin/produits`) : recherche, filtre par stock, pagination (1479 produits), toggle rapide en-stock/rupture, page d'édition (titre, prix, quantité, disponibilité).
  - **Commandes** (`/admin/commandes`) : liste + détail + changement de statut (en attente → payée → préparation → expédiée → livrée...).
  - **Rendez-vous** (`/admin/rdv`) : liste des demandes de RDV avec changement de statut (demandé/confirmé/terminé/annulé).
  - **Messages de contact** (`/admin/messages`) : liste des messages reçus via `/contact`, marquage traité/non traité.
  - **Zones & tarifs de déplacement** (`/admin/zones`) : ajout/suppression/modification des villes et de leurs frais de déplacement — **répercuté automatiquement** sur `/rdv` et la page d'accueil (ces pages ne sont plus en dur, elles lisent la table `service_zones`).

### ❓ "Je suis connecté mais je n'ai pas accès à `/admin`" — comprendre les 2 comptes

Il y a **deux systèmes de comptes distincts**, qui utilisent tous les deux Supabase Auth mais avec des accès différents :

| | Créé via | Accès |
|---|---|---|
| **Compte client** | `/compte/inscription` (ouvert à tout le monde) | `/compte`, `/compte/commandes`, `/compte/rdv` — **jamais** `/admin` |
| **Compte admin** | Étape manuelle ci-dessous | `/admin` (gestion du site) **+** peut aussi utiliser `/compte` comme un client normal |

Un compte client ne devient donc **jamais** admin automatiquement, même après connexion — c'est voulu (sécurité). Si tu t'es inscrit via `/compte/inscription`, ce compte n'a accès qu'à l'espace client. Pour en faire un admin, utilise la procédure ci-dessous.

### Créer/promouvoir ton compte admin (méthode simple)

1. Crée d'abord un compte normalement via `/compte/inscription` (ou récupère l'email d'un compte déjà créé).
2. En local, dans le dossier du projet, avec `.env` déjà rempli (notamment `SUPABASE_SERVICE_ROLE_KEY`) :
   ```bash
   npm install
   npm run make-admin -- ton-email@exemple.fr
   ```
3. Connecte-toi sur `/admin/login` avec cet email + le mot de passe choisi à l'inscription.

<details>
<summary>Méthode alternative (SQL manuel, si tu préfères ne pas utiliser le script)</summary>

Dans Supabase Dashboard → **SQL Editor** :
```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
where email = 'ton-email@exemple.fr';
```
(Le champ "User Metadata" du formulaire "Add user" du dashboard écrit dans `user_metadata`, modifiable par l'utilisateur lui-même — ce n'est **pas** ce qu'on veut pour un rôle. `app_metadata` n'est modifiable que par le service_role, d'où le passage par SQL ou par le script `make-admin`.)
</details>

### ⚠️ Point de sécurité important

Les Server Actions de l'admin (`src/app/admin/(dashboard)/*/actions.ts`) appellent `requireAdminUser()` en tout premier, qui vérifie que la session Supabase a bien `app_metadata.role === 'admin'` — pas seulement qu'un utilisateur est connecté. Le `middleware.ts` fait la même vérification pour toutes les routes `/admin/*`. **Ne remplace jamais ces vérifications par un simple "session existe"** : depuis l'ouverture de l'inscription publique (`/compte/inscription`), n'importe quel client peut créer un compte, donc seul le rôle `app_metadata.role === 'admin'` (non auto-attribuable) distingue un admin d'un client. Prisma se connecte par ailleurs à la base avec un accès complet (`DATABASE_URL`), donc c'est bien ce contrôle applicatif qui protège tes données, pas Row Level Security côté Supabase (Prisma ne passe pas par l'API Supabase, donc les RLS ne s'appliquent pas à ces requêtes).

## Espace client (`/compte`)

- `/compte/inscription`, `/compte/connexion` : auth Supabase publique (email/mot de passe).
- `/compte` : **page de profil éditable** — prénom/nom, photo de profil, changement de mot de passe. L'email n'est pas modifiable depuis cette page (limitation volontaire, pour éviter les complications de re-confirmation).
- `/compte/commandes`, `/compte/rdv` : historique du client, rattaché via un vrai champ `userId` (uuid Supabase Auth) sur `Order` et `Appointment`.

**Comment ça marche** : si le client est connecté au moment où il passe commande (`/api/checkout`) ou prend RDV (`/api/rdv`), son `userId` Supabase est automatiquement enregistré sur la commande/le RDV. S'il n'est pas connecté (commande "invité"), `userId` reste vide — dans ce cas, `/compte/commandes` et `/compte/rdv` retrouvent quand même ces anciennes commandes par correspondance d'email, en complément des commandes liées par `userId`.

⚠️ **Cette évolution ajoute deux colonnes** (`userId` sur `orders` et `appointments`) — pense à relancer `npm run db:push` après avoir tiré ces changements.

### Photo de profil : créer le bucket de stockage

L'upload de photo de profil utilise Supabase Storage. Avant que ça fonctionne, crée le bucket une fois :
1. Supabase Dashboard → **Storage** → **New bucket** → nom : `avatars`, coche **Public bucket**.
2. C'est tout — le code gère l'upload dans un dossier par utilisateur (`avatars/<user_id>/avatar.xxx`) et enregistre l'URL publique sur le profil.

Tant que ce bucket n'existe pas, le bouton "Changer la photo" affichera une erreur explicite plutôt que de planter silencieusement.

### Bonus : le flux de commande crée maintenant une vraie commande en base

Jusqu'ici, `/api/checkout` ne faisait que créer une session Stripe — **aucune ligne `Order` n'était jamais enregistrée**, ce qui aurait empêché "Mes commandes" et l'admin de fonctionner correctement. C'est corrigé : une commande `PENDING` (avec ses `OrderItem`) est créée dès le clic sur "Passer au paiement", puis complétée (nom, email, adresse de livraison réels, statut `PAID`) par le webhook une fois le paiement confirmé par Stripe.

## Page d'accueil : nouvelles sections gérables en admin

- **Badges de confiance**, **Top Nouveautés** (grille + bloc promo), **Top Produits en carrousel** (onglets Nouveautés/En Vedette/Offres Spéciales), **vidéo Repar'Acteurs PACA** (seule, sans texte à côté — cliquable pour lancer la vidéo en grand), **"Pourquoi choisir ReparMonPhone"** (bloc texte séparé, pleine largeur), **texte SEO** (élargi à la largeur du site).
- **Avis clients** (`/admin/avis`) : carrousel Google + carrousel Facebook sur la home, avis gérés à la main dans l'admin (ajout/modification/suppression). ⚠️ **Il n'y a pas de synchronisation automatique avec Google Business Profile ou la page Facebook** — les deux nécessiteraient une intégration OAuth (Google Business Profile API, Facebook Graph API) avec vérification de propriété de la fiche/page, ce qui dépasse la portée de ce qu'on peut mettre en place ici sans que tu crées et configures toi-même ces accès développeur. En attendant, le plus simple est de copier-coller manuellement les nouveaux avis depuis Google/Facebook dans `/admin/avis` — ça prend 30 secondes par avis. Si un jour tu veux la vraie synchronisation automatique, dis-le-moi, ce sera un chantier à part.
- **Partenaires & liens de référencement** (`/admin/partenaires`) : partenaires affichés sur une seule ligne avec leur logo (upload d'image intégré, même principe que la photo de profil), + une liste de liens texte en dessous (annuaires, backlinks SEO). Tout est modifiable dans l'admin, plus besoin de toucher au code pour changer un partenaire ou un lien.

### Bucket de stockage pour les logos partenaires

Même chose que pour les photos de profil, un bucket dédié est nécessaire :
1. Supabase Dashboard → **Storage** → **New bucket** → nom : `partners`, coche **Public bucket**.

## Admin produits : édition complète

`/admin/produits/[id]` permet maintenant d'éditer :
- **Photos** : upload direct (glisser plusieurs fichiers), réorganisation (flèches), suppression, la 1ère photo devient l'image principale affichée sur la boutique.
- **Informations** : titre, prix, stock, disponibilité (comme avant).
- **Descriptions** : courte (sous "Ajouter au panier") et longue (pleine largeur, bas de fiche) — HTML accepté.
- **SEO** : balise `<title>` et meta description personnalisées par produit (si vides, on retombe sur le titre du produit).

### Bucket de stockage pour les photos produits

Même principe que les autres uploads (photo de profil, logos partenaires) :
1. Supabase Dashboard → **Storage** → **New bucket** → nom : `products`, coche **Public bucket**.

### Zoom sur les photos (fiche produit publique)

Sur `/produit/[slug]`, la photo principale a maintenant :
- un **zoom au survol** sur desktop (loupe qui suit le curseur, zoom x2.2),
- une **vue plein écran** au clic (fonctionne aussi au tactile sur mobile/tablette), avec navigation entre les photos.

## Pages de contenu éditables (`/admin/pages`)

À propos, Mentions légales, CGV, Confidentialité, Livraison & Retours sont maintenant stockées en base (table `pages`) au lieu d'un fichier JSON figé dans le code. Édition en HTML brut avec bouton "Aperçu" pour vérifier le rendu avant d'enregistrer — plus besoin de moi (ni de connaissances en code) pour changer un mot dans les mentions légales.

## Avis clients : import automatique Google + limite Facebook

- **Google** : `/admin/avis` a un bouton **"🔄 Synchroniser les avis Google"** qui appelle l'API Google Places (Place Details) et importe automatiquement tes avis. ⚠️ Limite **côté Google, pas la nôtre** : leur API ne renvoie que les **5 avis les plus pertinents**, jamais la totalité (donc pas moyen d'avoir tes 98 avis synchronisés automatiquement — Google ne le permet à personne via cette API).

  **Configuration nécessaire** (gratuite, quelques minutes) :
  1. Va sur [Google Cloud Console](https://console.cloud.google.com/), crée un projet (ou réutilise un existant), active l'**API "Places API"**.
  2. Crée une clé API (Credentials → Create Credentials → API Key), restreins-la à l'API Places pour la sécurité → c'est ton `GOOGLE_PLACES_API_KEY`.
  3. Trouve ton `GOOGLE_PLACE_ID` avec l'outil [Place ID Finder de Google](https://developers.google.com/maps/documentation/places/web-service/place-id) (cherche "ReparMonPhone Sainte-Maxime").
  4. Ajoute les deux valeurs dans `.env`.

- **Facebook** : il n'existe plus d'API fiable pour récupérer automatiquement les avis d'une page, même pour les pages dont tu es propriétaire (accès restreint par Facebook depuis plusieurs années). L'ajout manuel dans `/admin/avis` (déjà en place) reste la solution la plus simple — 30 secondes par avis. Si tu veux une vraie synchronisation automatique **Google + Facebook**, ton ancien site utilisait un widget **Trustindex** (visible dans le code source) qui sait faire ça — je peux l'intégrer à la place de notre solution maison si tu as/refais un compte Trustindex, dis-le-moi.

## Démarrage

```bash
npm install
cp .env.example .env   # puis remplis avec tes clés Supabase + Stripe
npm run db:push        # crée les tables dans Supabase
npm run db:seed        # importe les 1479 produits
npm run dev
```

## Reste à faire

1. **Créer le projet Supabase** (si pas déjà fait) et remplir `.env` avec `DATABASE_URL`, `DIRECT_URL`, les clés `NEXT_PUBLIC_SUPABASE_*` et `SUPABASE_SERVICE_ROLE_KEY`.
2. **Stripe** : créer un compte/mode test, récupérer `STRIPE_SECRET_KEY`, configurer un webhook pointant vers `/api/webhook` pour `STRIPE_WEBHOOK_SECRET`.
3. **Images** : elles pointent actuellement vers `https://www.reparmonphone.fr/wp-content/uploads/...` (hotlink temporaire, déjà autorisé dans `next.config.mjs`). À terme, migrer vers Supabase Storage pour ne plus dépendre de l'ancien site.
4. **Frais de port** : le checkout Stripe actuel ne calcule pas encore les frais de livraison Chronopost — à ajouter dans `/api/checkout/route.ts` (Stripe gère nativement les `shipping_options`).
5. **Emails de confirmation** (commande + RDV) — pas encore branchés, à faire avec Resend ou l'API Supabase.
6. **Auth admin** pour gérer stock/commandes — pas encore fait.
7. **Emails du formulaire de contact et des commandes** : actuellement les messages de contact sont enregistrés en base (table `contact_messages`) et loggés en console, mais aucun email n'est réellement envoyé. Branche un service comme Resend ou Postmark dans `/api/contact/route.ts` et `/api/webhook/route.ts` pour recevoir les notifications par email comme avant.
8. **`slides.xml`** : ce fichier était vide (aucun slide exporté), donc pas de bandeau/carrousel d'accueil à reprendre — si tu veux un carrousel sur la page d'accueil, dis-moi quelles images/textes y mettre.
9. **`static_block.xml`** : ne contenait que des blocs de démonstration du thème WordPress (XStore, menus "Electronics" en anglais, images de démo non liées à ReparMonPhone) — rien d'exploitable n'a été trouvé, donc rien n'a été repris de ce fichier.

## Bon à savoir sur les descriptions produits

Les descriptions longues contiennent du HTML brut tel qu'exporté de WordPress (titres `<h2>`, `<strong>`, etc.) — elles s'affichent via `dangerouslySetInnerHTML`, donc pas de mise en forme à refaire, mais pense à les relire : certaines contiennent encore des liens internes vers l'ancien site WordPress à corriger au fil de l'eau.

## Structure des données migrées

- 618 produits Samsung, 532 Apple, 247 Xiaomi, 18 Huawei
- 289 modèles distincts
- Catégorisation auto par type de pièce : Écran (712), Nappe/Connecteur (296), Batterie (248), Caméra (72), Outillage (55), Vitre arrière (48), etc.
#   r e p a r m o n p h o n e V 2  
 