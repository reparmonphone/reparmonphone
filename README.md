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
- **L'inscription demande maintenant obligatoirement** : prénom, nom, téléphone et adresse complète (rue, code postal, ville). Elle passe par `/api/auth/inscription` (et non plus `supabase.auth.signUp()` directement côté client) afin de capturer aussi l'**adresse IP d'inscription**, visible dans `/admin/utilisateurs`. Le compte est créé avec `email_confirm: true` (pas de double opt-in email, pour simplifier) — la session est établie juste après via une connexion classique.
- `/compte` : **page de profil éditable** — prénom/nom, **téléphone, adresse**, photo de profil, changement de mot de passe. L'email n'est pas modifiable depuis cette page (limitation volontaire, pour éviter les complications de re-confirmation).
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

## Laisser un avis depuis sa commande + relance automatique à J+10

- **Depuis `/compte/commandes/[id]`** : dès qu'une commande passe au statut **"Livrée"**, un petit formulaire d'avis (étoiles + commentaire) apparaît sous chaque produit qui n'a pas encore été commenté par ce client. L'avis publié apparaît immédiatement dans la section "Avis clients" de la fiche produit correspondante.
- **Condition pour laisser un avis** : la commande doit être au statut "Livrée" (pas juste payée) — c'est le déclencheur choisi pour matérialiser "commande reçue".
- **Relance automatique** : 10 jours après le passage au statut "Livrée" (date mémorisée automatiquement dans `deliveredAt`), si le client n'a pas encore laissé d'avis sur au moins un des produits de sa commande, un email lui est envoyé — reprenant son prénom/nom, le numéro de commande et la liste des produits concernés, avec un lien direct vers sa commande pour laisser l'avis. Un seul envoi par commande (`reviewReminderSentAt`). Cron quotidien (`vercel.json`, même principe que la relance des commandes en attente).
- **Relance manuelle** : bouton "✉️ Relancer pour laisser un avis" sur `/admin/commandes/[id]` pour une commande livrée, à tout moment.

## Avis produits (différents des avis Google/Facebook de l'entreprise)

Chaque produit a maintenant ses propres avis (note + commentaire), affichés à 3 endroits :
- **Étoiles sur les étiquettes produit** (boutique, collections) — s'affichent seulement si le produit a au moins 1 avis.
- **Étoiles sous le bouton "Ajouter au panier"** sur la fiche produit.
- **Section "Avis clients" complète**, juste au-dessus de la grande description, avec la liste détaillée.

### Qui peut laisser un avis

Seul un **client connecté ayant réellement commandé ce produit** (commande au statut Payée/En préparation/Expédiée/Livrée) peut laisser un avis — vérifié automatiquement via son historique de commandes, marqué "✔️ Achat vérifié". Un seul avis par client et par produit.

### Import en masse de tes ~17 000 avis existants (CSV)

Un script est prêt : `npm run import-reviews -- chemin/vers/ton-fichier.csv`. Il détecte automatiquement les noms de colonnes courants (`rating`/`note`, `author`/`auteur`, `text`/`commentaire`...) et fait correspondre chaque ligne à un produit par ID WooCommerce, puis par slug, puis par titre exact en dernier recours. Les avis importés ainsi ne portent pas le badge "Achat vérifié" (pas de commande associée dans notre système), mais comptent normalement dans la note moyenne affichée.

**Une fois que tu as ton CSV, envoie-moi les 2-3 premières lignes (ou dis-moi juste les noms de ses colonnes)** — si elles ne correspondent pas à ce que le script détecte automatiquement, je l'ajuste en 2 minutes plutôt que de te laisser deviner.

## Compteur de visites, statistiques, numérotation des factures et codes promo

### Compteur de visiteurs (page d'accueil)

Affiché en bas de la page d'accueil façon compteur à volets, démarrant à **21 120** + le nombre réel de visites enregistrées depuis la mise en ligne (`src/components/VisitorCounter.tsx`, constante `VISIT_COUNTER_OFFSET`). Le tracking se fait via un petit composant invisible (`TrackVisit.tsx`) présent sur toutes les pages, qui enregistre chaque changement de page côté client (n'enregistre donc pas les visiteurs qui ont JavaScript désactivé, ce qui est un compromis volontaire pour rester simple).

### Statistiques complètes (`/admin/statistiques`)

Compteur affiché, visites du jour/7 jours/30 jours, graphique des 7 derniers jours, pages les plus visitées. Toutes les données viennent de la même table `page_views`.

### Faire démarrer les factures à un autre numéro que 1

Le numéro de facture (`invoiceNumber`) est un compteur automatique en base — pour le faire démarrer à 11555 (au lieu de 1) :
```bash
npm run reset-invoice-number -- 11555
```
**À lancer une seule fois**, idéalement juste après le tout premier `npm run db:push` de ce projet, avant de créer de vraies commandes.

### Codes promo

`/admin/codes-promo` : créer des codes en pourcentage ou montant fixe, avec date d'expiration et/ou nombre d'utilisations maximum en option. Le client les saisit directement sur `/panier` (validation en direct, réduction affichée avant paiement). Revalidé côté serveur à la création de la commande — impossible de forcer une réduction en trafiquant la requête. Le compteur d'utilisation (`usedCount`) s'incrémente à la création de la commande (pas au paiement effectif), donc un panier abandonné après avoir utilisé un code compte quand même dans son usage — c'est un choix pour rester simple et cohérent sur les 3 moyens de paiement.

Pour **Stripe** spécifiquement : comme Stripe interdit les lignes à montant négatif, la réduction passe par un vrai coupon Stripe généré à la volée (`stripe.coupons.create`) et appliqué via `discounts` sur la session de paiement — le client voit la réduction directement sur la page Stripe.

## SEO & GEO (référencement Google + optimisation pour les moteurs IA)

Chantier complet construit après analyse de tes concurrents directs (Sosav, cPix, Brico-Phone, Phonexpert78, World-Itech) — tous misent sur la profondeur de contenu (guides, tutoriels), la confiance (avis, partenariats marques) et le local. Le site a maintenant tout ce qu'un site e-commerce sérieux doit avoir techniquement ; le contenu éditorial (guides, articles) reste un travail humain que je ne peux pas faire à ta place.

### ⚠️ Avant tout : configurer `NEXT_PUBLIC_SITE_URL`

Toutes les fonctionnalités ci-dessous (sitemap, JSON-LD, IndexNow...) utilisent `NEXT_PUBLIC_SITE_URL` pour construire les URLs. **Sur ton hébergeur (Vercel ou autre), configure impérativement cette variable avec ton vrai domaine** (`https://www.reparmonphone.fr`), sinon ton sitemap et tes données structurées pointeront vers `localhost`.

### Ce qui est fait automatiquement (rien à faire de ton côté)

- **Sitemap XML** dynamique (`/sitemap.xml`) : régénéré à chaque changement, inclut tous les produits actifs, marques, collections, pages de contenu.
- **robots.txt** (`/robots.txt`) : autorise tout sauf `/admin`, `/compte`, `/panier`.
- **Données structurées JSON-LD** :
  - `LocalBusiness`/`ElectronicsStore` sur tout le site (adresse, téléphone, zone desservie, réseaux sociaux) — alimente la fiche Google Maps/Google Business et les résultats enrichis.
  - `Product` + `Offer` + `AggregateRating` sur chaque fiche produit (prix, disponibilité, note moyenne) — permet à Google d'afficher les étoiles directement dans les résultats de recherche.
  - `BreadcrumbList` (fil d'ariane) sur les fiches produit.
- **llms.txt** (`/llms.txt`) : résumé factuel et structuré du site, pensé pour être repris par les IA génératives (ChatGPT, Perplexity, Google AI Overviews) — c'est le "GEO" (Generative Engine Optimization), le pendant du SEO pour les moteurs conversationnels. Se met à jour tout seul (nombre de produits, note moyenne...).
- **IndexNow** : à chaque produit créé ou modifié, Bing et Yandex sont notifiés instantanément (pas d'attente de leur prochain passage de crawl). Google ne supporte pas ce protocole — pour Google, seul le sitemap + Search Console comptent.
- Meta titre/description personnalisables par produit (déjà en place depuis une session précédente).

### Ce qu'il te reste à faire (`/admin/seo`)

1. **Google Search Console** : créer la propriété, méthode "Balise HTML", coller le code dans `/admin/seo`, redéployer, valider côté Google, puis soumettre le sitemap.
2. **Bing Webmaster Tools** : même principe (ou import direct depuis Google Search Console, Bing le permet).
3. **Redirections 301** : le plus important après une migration de site. Google Search Console te remontera dans les prochaines semaines les anciennes URLs WooCommerce en erreur 404 (rubrique Pages → Non indexées). Ajoute chaque redirection dans `/admin/seo` au fur et à mesure — inutile d'essayer de tout anticiper à l'avance, ce sera plus fiable de corriger sur la base des vraies erreurs remontées.

### Limites honnêtes

- Je ne peux pas savoir à l'avance quelles étaient tes anciennes URLs WooCommerce exactes — le gestionnaire de redirections est prêt, mais c'est à toi (ou à Google Search Console) de me/te dire lesquelles sont cassées.
- Le contenu éditorial (articles de blog, guides de réparation détaillés comme le font tes concurrents) reste un travail de rédaction que je n'ai pas produit ici — c'est ce qui ferait le plus progresser ton SEO sur la durée, mais ça demande un vrai travail éditorial, pas juste de la technique.
- GEO (optimisation IA) est un domaine encore jeune et changeant — `llms.txt` est une bonne pratique émergente, mais aucun moteur IA n'a annoncé officiellement le respecter à 100%.

## Liste des commandes : filtres, relance, corbeille

`/admin/commandes` :
- **Filtres** par statut et recherche (nom/email du client).
- **Date + heure** affichées (plus seulement la date).
- **🗑 Supprimer** une commande directement depuis la liste (ou la fiche détail), avec confirmation — irréversible.
- **✉️ Relancer** (visible uniquement sur les commandes "En attente") : envoie immédiatement un email au client lui rappelant que le paiement n'a pas été finalisé.

### Relance automatique après 1h (Vercel Cron)

Une commande restée "En attente" plus d'1h, jamais relancée, reçoit **automatiquement** un email de rappel — via une route cron (`/api/cron/send-pending-reminders`) appelée toutes les 15 min par **Vercel Cron** (configuré dans `vercel.json`, inclus dans le projet, actif automatiquement dès que le projet est déployé sur Vercel — aucune configuration manuelle côté Vercel nécessaire).

Protection : la route vérifie un `CRON_SECRET` — génère une longue chaîne aléatoire et mets-la à la fois dans `.env` (`CRON_SECRET=...`) et dans les variables d'environnement Vercel, sinon la route est appelable par n'importe qui.

⚠️ **Si tu ne déploies pas sur Vercel** (OVH, VPS...), ce cron ne se déclenchera pas automatiquement — il faudra soit configurer un cron système équivalent qui appelle cette URL toutes les 15 min avec l'en-tête `Authorization: Bearer TON_CRON_SECRET`, soit se contenter du bouton "Relancer" manuel dans `/admin/commandes`.

## Activer/désactiver les moyens de paiement

`/admin/paiements` — un interrupteur par moyen de paiement (Stripe, SumUp, PayPal). Désactivé = disparaît immédiatement de `/panier`, sans toucher à sa configuration (clés API...). Si tous sont désactivés, le panier affiche un message invitant à contacter directement la boutique plutôt que des boutons cassés.

## Facturation vs livraison, entreprise, mentions obligatoires

Le formulaire du panier est maintenant explicitement une **adresse de facturation**, avec une case **"Envoyer à une adresse différente ?"** qui révèle un second bloc pour une adresse de livraison distincte (comme sur ton ancien site). Un champ **"Nom de l'entreprise"** facultatif a été ajouté.

En bas de la colonne de paiement : le texte légal sur l'usage des données personnelles (lien vers `/confidentialite`), le rappel de prise de RDV (lien vers `/rdv`), et une case **"J'ai lu et j'accepte les conditions générales"** (lien vers `/cgv`) — **obligatoire, bloque le paiement tant qu'elle n'est pas cochée**, quel que soit le moyen de paiement choisi.

## Frais de port et tunnel de commande

`/admin/livraison` gère les options de livraison proposées sur `/panier` (libellé, description, prix, activable/désactivable, réordonnable). 4 options de départ pré-remplies au premier `db:seed` (Chronopost 24h, Chrono Relais, Lettre Suivie, Réparation Atelier/Domicile) — modifiables ou supprimables à tout moment.

La page panier a été reconstruite en 2 colonnes (coordonnées + articles à gauche, récapitulatif + livraison + paiement à droite, avec total qui se met à jour selon l'option de livraison choisie), sur le modèle de ton ancien tunnel de commande WooCommerce. Les 3 boutons de paiement (Stripe/SumUp/PayPal) prennent tous en compte les frais de port sélectionnés.

**Apple Pay / Google Pay** : pas besoin d'intégration séparée de notre côté — Stripe Checkout et SumUp Hosted Checkout les affichent **automatiquement** sur leur page de paiement si l'appareil/navigateur du client les supporte (aucune configuration ni bouton à ajouter chez nous). Pour PayPal, ce n'est pas inclus nativement avec notre intégration actuelle (en redirection simple) — ça demanderait le SDK JavaScript PayPal avec des boutons dédiés, un chantier séparé si tu veux vraiment l'ajouter côté PayPal spécifiquement.

**Badges de confiance** (Visa/Mastercard/Amex/PayPal/Maestro) affichés sous les boutons de paiement — recréés en CSS/texte stylisé plutôt qu'avec les vrais logos de marque (utiliser les logos officiels de Visa/Mastercard/etc. sans accord de licence n'est pas recommandé).

## Paiement PayPal (en plus de Stripe et SumUp)

Même principe que SumUp : bouton dédié sur `/panier`, réutilise le même petit formulaire d'adresse (PayPal, via l'API Orders v2 en redirection, ne garantit pas toujours de récupérer une adresse complète et structurée depuis le profil de l'acheteur).

### Comment ça marche (sans webhook à configurer)

1. On crée une "commande" PayPal côté serveur (`POST /v2/checkout/orders`) et on redirige le client vers la page d'approbation PayPal.
2. Une fois le paiement approuvé, PayPal redirige le client vers `/api/paypal-return` avec un `token`.
3. Cette route **capture le paiement immédiatement** (`POST /v2/checkout/orders/{id}/capture`), marque la commande comme payée, puis renvoie vers la page de confirmation.

Pas de webhook à configurer dans le dashboard PayPal pour que ça fonctionne — contrairement à Stripe. (Un webhook pourrait être ajouté plus tard en robustesse supplémentaire, ex. si le client ferme son navigateur juste après avoir payé sans revenir sur le site, mais ce n'est pas nécessaire pour le fonctionnement de base.)

### Configuration

1. Crée une app sur [developer.paypal.com/dashboard/applications](https://developer.paypal.com/dashboard/applications) (Sandbox pour tester, Live pour les vrais paiements).
2. Copie le **Client ID** et le **Secret** dans `.env` :
   ```
   PAYPAL_CLIENT_ID="xxxx"
   PAYPAL_CLIENT_SECRET="xxxx"
   PAYPAL_MODE="sandbox"   # ou "live" une fois prêt pour les vrais paiements
   ```
3. En mode sandbox, PayPal fournit des comptes acheteur/vendeur de test dans le Dashboard pour simuler un paiement sans vraie carte.

## Paiement SumUp (en plus de Stripe)

En plus de Stripe, le client peut payer via **SumUp** — deux boutons distincts sur `/panier`.

### Différence importante avec Stripe

La page de paiement hébergée par SumUp **ne demande pas l'adresse du client** (contrairement à Stripe Checkout). C'est pourquoi un petit formulaire (nom, email, téléphone, adresse) apparaît directement sur `/panier` avant le bouton "Payer par carte (SumUp)" — ces infos sont enregistrées sur la commande dès sa création, sans attendre le paiement.

### Configuration

1. Connecte-toi sur [me.sumup.com](https://me.sumup.com) avec ton compte marchand.
2. Menu profil → **Réglages → Pour les développeurs → Clés API** → **Créer une clé** → copie-la dans `.env` :
   ```
   SUMUP_API_KEY="sup_sk_xxxx"
   ```
3. Récupère ton **code marchand** (`merchant_code`, format `MCXXXXXX`) : soit affiché sur cette même page développeur, soit en appelant `GET https://api.sumup.com/v0.1/me` avec ta clé API (le champ `merchant_profile.merchant_code` de la réponse). Ajoute-le dans `.env` :
   ```
   SUMUP_MERCHANT_CODE="MCXXXXXX"
   ```
4. Aucun webhook à créer manuellement dans un dashboard : SumUp notifie directement l'URL `return_url` transmise à chaque paiement (déjà branchée sur `/api/webhook-sumup`) — rien à configurer en plus, y compris en local (contrairement à Stripe qui a besoin du Stripe CLI).

### Sécurité : pas de signature à vérifier, mais une revérification systématique

SumUp ne signe pas ses notifications comme le fait Stripe. La notification reçue ne contient qu'un `id` de checkout — notre webhook (`/api/webhook-sumup`) **rappelle systématiquement l'API SumUp** pour connaître le vrai statut (`PAID`, `FAILED`...) avant de valider la commande, plutôt que de faire confiance au contenu brut reçu.

### Limite connue

Le mode de paiement affiché pour une commande SumUp (sur la fiche commande et la facture PDF) est plus sommaire que pour Stripe : SumUp ne renvoie pas systématiquement la marque de carte ni les 4 derniers chiffres dans la réponse de statut du checkout, donc ces commandes affichent simplement "Payé via SumUp" plutôt que "Visa terminant par 4242".

## Factures PDF, mode de paiement et envoi par email

- **Mode de paiement** : le webhook Stripe récupère automatiquement la marque de carte et les 4 derniers chiffres après paiement (`paymentBrand`/`paymentLast4`), affichés sur la commande côté client et admin.
- **Facture PDF** : générée à la volée (pas stockée sur disque) via `@react-pdf/renderer`, avec numéro de facture séquentiel (`invoiceNumber`, format `AAAA-00001`), coordonnées ReparMonPhone, articles, adresses de livraison/facturation, mode de paiement et suivi si disponible.
  - `/api/factures/[orderId]` : ouvre le PDF dans le navigateur (bouton "🖨️ Voir / imprimer / enregistrer la facture") — utilise ensuite les boutons natifs de la visionneuse PDF du navigateur pour imprimer ou enregistrer, pas besoin de code supplémentaire pour ça.
  - `/api/factures/[orderId]/envoyer` : envoie la facture par email en pièce jointe. Accessible au client (toujours vers son propre email) et à l'admin (vers l'email de son choix, avec l'email du client pré-rempli par défaut).
  - Accès protégé : uniquement le propriétaire de la commande (`userId` ou email) ou un admin.
- **Envoi automatique** : dès qu'un paiement Stripe est confirmé, la facture est automatiquement envoyée par email au client (si Resend est configuré).

### Configuration de l'envoi d'emails (Resend)

Optionnel mais nécessaire pour que "Recevoir par email" et l'envoi automatique fonctionnent :
1. Crée un compte gratuit sur [resend.com](https://resend.com).
2. Vérifie ton domaine `reparmonphone.fr` dans Resend (ajout de quelques enregistrements DNS — sinon tu ne peux envoyer que depuis l'email de test fourni par Resend).
3. Récupère ta clé API → `RESEND_API_KEY` dans `.env`.
4. `RESEND_FROM_EMAIL` : l'adresse d'expédition (doit appartenir à un domaine vérifié dans Resend).

Tant que `RESEND_API_KEY` n'est pas configuré, les boutons "Recevoir par email" affichent une erreur explicite plutôt que d'échouer silencieusement — le téléchargement/impression PDF fonctionne, lui, sans aucune configuration.

⚠️ Ajoute 3 colonnes (`invoiceNumber`, `paymentBrand`, `paymentLast4`) sur `orders` — pense à relancer `npm run db:push`.

## Adresse de livraison vs adresse de facturation

Au paiement, Stripe Checkout demande maintenant l'adresse de facturation en plus de la livraison (`billing_address_collection: 'required'`), avec sa propre case "identique à la livraison" gérée nativement par Stripe — pas besoin de formulaire custom de notre côté. Les deux adresses sont enregistrées séparément sur la commande (`billingName`/`billingLine1`/`billingCity`/`billingZip`, `null` si identique à la livraison) et affichées côte à côte sur `/compte/commandes/[id]` et `/admin/commandes/[id]`.

⚠️ Ajoute 4 colonnes sur `orders` — pense à relancer `npm run db:push`.

## Suivi de livraison & recommander

- **Côté admin** (`/admin/commandes/[id]`) : bloc "Suivi de livraison" pour renseigner le transporteur (Chronopost, Colissimo, Mondial Relay, Relais Colis, ou autre) et le numéro de colis. Le lien de suivi direct est généré automatiquement selon le transporteur (avec un champ "lien personnalisé" pour forcer une autre URL si besoin). La liste des commandes admin affiche aussi en un coup d'œil si le suivi est renseigné ou non.
- **Côté client** (`/compte/commandes/[id]`) : chaque commande de `/compte/commandes` est maintenant cliquable et ouvre une page de détail complète (articles, adresse, statut). Si un suivi a été renseigné par l'admin, un bouton "Suivre mon colis →" apparaît, pointant directement vers la page de suivi du transporteur.
- **Recommander** : sur la page de détail d'une commande, un bouton "🔁 Recommander la même chose" réajoute tous les articles de cette commande au panier (en ignorant ceux qui ne sont plus en stock) puis redirige vers `/panier`.

⚠️ Ajoute une nouvelle table d'énumération et 3 colonnes sur `orders` (`carrier`, `trackingNumber`, `trackingUrlOverride`) — pense à relancer `npm run db:push`.

## Admin — gestion des utilisateurs (`/admin/utilisateurs`)

Liste tous les comptes clients inscrits avec : nom complet, email, téléphone, adresse postale, **adresse IP au moment de l'inscription**, nombre de commandes passées, date d'inscription, date de dernière connexion. Les comptes admin sont repérés par un badge "ADMIN". Utilise `SUPABASE_SERVICE_ROLE_KEY` côté serveur uniquement (jamais exposée au navigateur), avec vérification explicite du rôle admin en plus du middleware (données sensibles : emails, téléphones, adresses, IP).

## Admin — corriger l'affectation Marque / Gamme / Modèle d'un produit

`/admin/produits` affiche maintenant trois colonnes distinctes (Marque / Gamme / Modèle) au lieu d'une seule — utile pour repérer d'un coup d'œil les produits mal classés issus de la migration automatique. Un filtre par marque est aussi disponible.

Sur la fiche d'édition (`/admin/produits/[id]`), un nouveau bloc "Affectation catalogue" en haut du formulaire permet de changer la marque, la gamme et le modèle d'un produit via 3 menus déroulants en cascade (changer la marque réinitialise la gamme et le modèle sur le premier choix disponible, etc.). Utile pour recatégoriser les produits mal affectés par la migration WooCommerce d'origine.

## Page d'accueil : nouvelles sections gérables en admin

- **Badges de confiance**, **Top Nouveautés** (grille + bloc promo), **Top Produits en carrousel** (onglets Nouveautés/En Vedette/Offres Spéciales), **vidéo Repar'Acteurs PACA** (seule, sans texte à côté — cliquable pour lancer la vidéo en grand), **"Pourquoi choisir ReparMonPhone"** (bloc texte séparé, pleine largeur), **texte SEO** (élargi à la largeur du site).
- **Avis clients** (`/admin/avis`) : carrousel Google + carrousel Facebook sur la home, avis gérés à la main dans l'admin (ajout/modification/suppression). ⚠️ **Il n'y a pas de synchronisation automatique avec Google Business Profile ou la page Facebook** — les deux nécessiteraient une intégration OAuth (Google Business Profile API, Facebook Graph API) avec vérification de propriété de la fiche/page, ce qui dépasse la portée de ce qu'on peut mettre en place ici sans que tu crées et configures toi-même ces accès développeur. En attendant, le plus simple est de copier-coller manuellement les nouveaux avis depuis Google/Facebook dans `/admin/avis` — ça prend 30 secondes par avis. Si un jour tu veux la vraie synchronisation automatique, dis-le-moi, ce sera un chantier à part.
- **Partenaires & liens de référencement** (`/admin/partenaires`) : partenaires affichés sur une seule ligne avec leur logo (upload d'image intégré, même principe que la photo de profil), + une liste de liens texte en dessous (annuaires, backlinks SEO). Tout est modifiable dans l'admin, plus besoin de toucher au code pour changer un partenaire ou un lien.

### Bucket de stockage pour les logos partenaires

Même chose que pour les photos de profil, un bucket dédié est nécessaire :
1. Supabase Dashboard → **Storage** → **New bucket** → nom : `partners`, coche **Public bucket**.

## Admin produits : édition complète

### Meta descriptions SEO : remplissage automatique

Sur les 1479 produits migrés, aucun n'avait de meta description (champ absent de l'export WooCommerce). Deux façons de la remplir :
1. **En masse, une fois** : `npm run backfill-seo` génère automatiquement une meta description pour tous les produits qui n'en ont pas encore (à partir du titre, de la marque, du modèle, de l'état/qualité et du prix). Ne touche jamais un produit déjà rempli — sûr à relancer.
2. **Au cas par cas** : sur la fiche produit (`/admin/produits/[id]`), bouton **"✨ Générer automatiquement"** à côté du champ Meta description, pour un produit donné après modification (nouveau titre, nouveau prix...).


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

## Upload de fichiers (logos, avatars, photos produits) : politique RLS obligatoire

**Un bucket "Public" dans Supabase Storage ne fait qu'autoriser la LECTURE libre des fichiers — il n'autorise PAS automatiquement l'envoi (upload) de nouveaux fichiers.** C'est la cause la plus fréquente du message "Erreur lors de l'envoi du logo" même quand le bucket existe bien et est bien coché "Public".

Il faut en plus une **politique RLS (Row Level Security)** sur le bucket, autorisant l'INSERT pour les utilisateurs authentifiés (les uploads admin se font avec la session du compte admin connecté, via la clé publique `anon`, jamais avec la clé secrète).

**Pour corriger, sur chaque bucket utilisé (`partners`, `avatars`, `products`)** :
1. Dashboard Supabase → **Storage** → clique sur le bucket concerné → onglet **Policies**
2. **New policy** → **For full customization** (ou "Get started quickly" → template "Give users authenticated access")
3. Configure une policy avec :
   - **Allowed operation** : `INSERT`
   - **Target roles** : `authenticated`
   - **USING/WITH CHECK expression** : `bucket_id = 'nom_du_bucket'::text` (remplace par le vrai nom) — évite `true` seul si possible, plus précis
4. Sauvegarde.

⚠️ **Cas particulier du bucket `avatars`** : contrairement à `partners`/`products` (où chaque fichier a un nom unique généré aléatoirement), la photo de profil réutilise toujours le même chemin (`userId/avatar.ext`) pour pouvoir la remplacer facilement — le code utilise donc `upsert: true`. Pour que ça fonctionne, ce bucket a besoin **des deux policies : `INSERT` ET `UPDATE`**, toutes les deux pour le rôle `authenticated`, sinon Postgres bloque l'opération même si le fichier n'existe pas encore (la requête SQL générée est un "upsert" qui doit satisfaire les deux permissions).

**Comment vérifier que c'est bien ça le problème** : le message d'erreur affiche maintenant le détail exact renvoyé par Supabase — un message du type *"new row violates row-level security policy"* confirme que c'est bien une policy manquante (pas un bucket manquant).

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
#   r e p a r m o n p h o n e  
 