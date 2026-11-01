# Avis voyageurs via GuestLucky

Intégration vérifiée le 30 octobre 2026, en local. Aucun déploiement ni modification des avis, réservations ou paiements dans GuestLucky.

## Source et résultat réel

Le plugin GuestLucky authentifié confirme le compte ROAMING attendu (`account_owner_id: 3872`). L’outil `gl-list-guest-reviews` renvoie actuellement **22 avis** sur les cinq logements, dont **8 avis Airbnb pour Croix** et 14 avis Booking. Une lecture filtrée par logement a également été vérifiée.

Le site lit le même outil via son client MCP privé existant, authentifié côté serveur. Ce transport partagé avec le catalogue est conservé : il fonctionne et ne doit pas être remplacé par une session navigateur ou des identifiants dans le JavaScript public. Aucun appel au tableau de bord privé depuis le navigateur visiteur ni scraping Airbnb/Booking.

Le champ réel est **`text`**, et non `review_text` comme le supposait l’ancien code. `property` peut être un libellé, `guest_name` et `text` peuvent être nuls ; la note est fournie sur 5. Le filtre MCP par `property_id` associe les avis au bon logement sans tenter de déduire son identité depuis son titre.

## Remplacement de l’ancienne lecture

- La liste fixe de trois sources ne limite plus la synchronisation : tous les logements actifs ayant un identifiant GuestLucky sont lus pour les canaux publics configurés.
- `config/review_sources.json` contient les liens externes vérifiés, les canaux de publication et les éventuelles exclusions pour retrait/correction. L’absence d’un lien d’annonce n’empêche plus de récupérer les avis du logement. Aucun lien inconnu n’est inventé.
- Le contrat actuel de GuestLucky est validé ; une réponse sans champ `text`, une date incorrecte, une note hors de l’échelle, une pagination incomplète, un doublon ou un compte différent empêche le remplacement.
- Le masquage global de la section a été supprimé. Elle affiche les vrais avis dès qu’ils sont disponibles. Les cartes de remplacement et leurs styles/traductions ont été retirés ; sans avis, la section est absente.

## Canaux publiés

**Airbnb et Booking sont désormais affichés sur l’accueil local**, à la demande explicite de l’utilisateur le 31 octobre 2026. Le filtre qui limitait la publication à Airbnb a été retiré. Le contrôle réel renvoie 22 avis : 8 Airbnb pour Croix, 12 Booking pour Lambersart, 1 Booking pour Croix et 1 Booking pour Lille. Les notes seules sont conservées ; aucune sélection selon la note n’est appliquée.

Le champ Booking `negative_feedback` complète le texte public `text` : les deux parties sont conservées dans l’ordre, séparées par un saut de paragraphe. Un avis uniquement négatif est conservé. Ce champ n’est jamais importé pour Airbnb, où des retours privés peuvent exister. Les noms publics disponibles sont abrégés et affichés ; les auteurs Airbnb sans nom restent présentés par « Séjour à [ville] ».

La [documentation officielle de l’API Guest Reviews Booking](https://developers.booking.com/connectivity/docs/review-api) indique un usage interne de son API. Ce point avait motivé le filtre initial et a été expliqué à l’utilisateur. L’ajout demandé pour l’aperçu local ne confirme pas les droits contractuels de republication du flux GuestLucky ; ce sujet reste à vérifier avec le prestataire avant un déploiement public. Aucun déploiement n’a été réalisé.

## Synchronisation et stockage

```powershell
# Lecture sans remplacer le fichier local.
php bin/console app:guestlucky:reviews --no-debug

# Actualiser le seul instantané des avis, sans écriture chez GuestLucky.
php bin/console app:guestlucky:reviews --apply --no-debug --no-interaction
```

Le résultat réel vérifié est **22 avis importés**, dont les 12 avis Booking de Lambersart. L’instantané privé `var/guestlucky/reviews.json` passe en version 2 ; les anciens instantanés de version 1 ne sont plus affichés. Il ne conserve que l’identifiant technique, le logement, la plateforme, le nom public abrégé lorsqu’il existe, la note, le texte public et la date. Ni coordonnées, références de réservation, avatars, réponses de l’hôte ni données privées ne sont conservés.

Une lecture complète réussie remplace atomiquement l’instantané, y compris si elle est vide ; un échec conserve le dernier fichier valide. Le verrou empêche deux synchronisations simultanées. Les logements actifs, canaux et exclusions sont à nouveau contrôlés lors du rendu, pour retirer immédiatement un logement désactivé ou un avis exclu.

Le script existant `scripts/guestlucky-sync.ps1` appelle cette commande indépendamment du succès des photos. La tâche Windows `Roaming-GuestLucky-Catalogue` exécute déjà ce script toutes les cinq minutes ; aucune nouvelle automatisation n’est nécessaire. Cela fonctionne lorsque la machine, la base et le réseau sont disponibles. Un déploiement ultérieur devra prévoir un cron côté hébergement : la tâche Windows n’existe pas sur Hostinger.

## Interface et contrôles

Le carrousel est placé entre les équipements et le contact sur l’accueil, en français et anglais, avec textes dans leur langue d’origine et liens vers les annonces connus. L’affichage des avis ne déclenche aucune requête vers Airbnb ou Booking ; les visiteurs lisent l’instantané servi par Symfony.

Les contrôles couvrent le format réel GuestLucky (`text`, propriété sous forme de chaîne, auteur absent), les avis sans commentaire et de faible note, pagination, erreurs, compte, exclusions, retrait d’un canal, logements sans lien externe, contenu privé et échappement HTML. Le test de rendu produit une fixture isolée dans `var/review-carousel-qa.html`, jamais injectée dans le véritable instantané.

```powershell
php -d extension=pdo_sqlite bin/phpunit tests/GuestLucky tests/Seo tests/Legal
npm run dev
node tests/browser/reviews.cjs
```

Le contrôle navigateur compare les cartes de l’accueil réel à l’instantané importé et vérifie les commandes, le défilement, la pause, les longs textes, les thèmes, les formats mobiles et la réduction des animations. Captures réelles : `var/reviews-guestlucky-desktop.png` et `var/reviews-guestlucky-mobile.png`.

## Présentation du carrousel — 30 octobre 2026

Le texte explicatif sous le carrousel a été retiré à la demande du propriétaire, en français et en anglais. Les cartes affichent une miniature de couverture du logement, sélectionnée par `isCover` avec repli sur la première photo. La photo et le nom conduisent à sa fiche ; les images utilisent le composant commun avec chargement différé et réutilisent les URLs déjà présentes sur le site.

Le flux réel GuestLucky a été relu : les huit auteurs Airbnb ont `guest_name: null` et aucun champ avatar/photo/profil n’est fourni. Aucune identité n’a été déduite des réservations ni inventée ; la page publique Airbnb n’a pas pu être lue lors du contrôle. Les noms publics abrégés seront affichés lorsqu’ils sont effectivement fournis. L’absence de photo est traitée par une composition typographique sans rond de remplacement.

Navigation continue sans pagination serveur. Pour borner le poids de l’accueil, seuls les 24 avis les plus récents sont rendus ; l’instantané privé conserve tout l’historique. Avec les 22 avis actuels, tous restent affichés.

Le glissement souris/stylet suit le pointeur et reste exactement à la position de relâchement, sans recentrage ni alignement automatique (ajustement du 31 octobre 2026). Les flèches conservent leur animation amortie. Le tactile conserve le défilement natif et le défilement vertical de la page. Les liens sont bloqués après un vrai glissement, pas après un clic simple. Flèches, Home/End, pause et préférence de réduction des animations sont pris en charge ; événements et animations sont nettoyés lors des navigations Turbo.

## Logos de plateformes

Les logos remplacent les libellés textuels « Airbnb ↗ » et « Booking.com ». Fichiers SVG locaux : `public/images/brands/airbnb.svg` et `booking.svg`. Les noms restent présents en texte alternatif ; les liens Airbnb vérifiés sont conservés. Pour Booking, aucun lien d’annonce non vérifié n’est inventé : le logo est une indication de source.

Sources :
- Airbnb : [Simple Icons 14.15.0](https://cdn.jsdelivr.net/npm/simple-icons@14.15.0/icons/airbnb.svg), pictogramme vectoriel de la marque, couleur #FF5A5F. Bibliothèque [Simple Icons](https://github.com/simple-icons/simple-icons), CC0 ; la marque conserve ses droits sur son signe.
- Booking.com : [fichier vectoriel Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Booking.com_logo.svg), logotype attribué à Booking.com, marqué PD-textlogo ; le fichier original est conservé sans redessiner le mot-symbole.

Les logos sont des attributions de source et n’indiquent pas une approbation ou un partenariat. Leur affichage ne charge aucun CDN, widget ou traceur tiers.

## Profils publics vérifiés — 31 octobre 2026

Les huit noms manquants des avis Airbnb de Croix ont été retrouvés sur [l’annonce publique Airbnb](https://www.airbnb.fr/rooms/1765420065815429494/reviews) dans un onglet IAB distinct, sans connexion : Sylvie, Chaima, Benjamin, Priscilla, Fannie, Hina (deux avis) et Théo. Chaque commentaire du flux GuestLucky correspond à un seul commentaire original public, après normalisation des espaces ; le texte néerlandais de Fannie a été vérifié avec l’option de texte d’origine. Un neuvième avis public absent du flux GuestLucky n’a pas été importé artificiellement.

Six de ces huit avis Airbnb possèdent une vraie photo (cinq photos différentes, Hina ayant deux avis). Sylvie et Benjamin utilisent l’avatar à initiale fourni par Airbnb. Quatre avatars Booking ont été vérifiés sur les commentaires publics exacts de [Lambersart](https://www.booking.com/hotel/fr/duplex-cosy-lambersart.fr.html) : Non, Hetru, Maxime et Jose. La vérification visuelle montre une vraie photo pour Non et des initiales générées pour les trois autres ; une URL Google de profil ne prouve pas la présence d’un portrait photographique.

`config/review_profiles.json` contient les correspondances explicitement vérifiées : identifiant GuestLucky de l’avis, logement, canal, empreinte SHA-256 du texte original normalisé, prénom public, fichier local d’avatar et provenance de la vérification. Le service `VerifiedReviewProfiles` applique l’enrichissement à l’affichage, indépendamment de la synchronisation : le renouvellement de l’instantané GuestLucky n’efface donc pas les profils vérifiés.

Une correspondance exige le même identifiant d’avis, le même logement/canal et exactement le même texte (hors espaces). Un changement de texte ou d’identité ne déclenche aucun rapprochement approximatif. Les doublons contradictoires sont écartés ; les avis sans commentaire ne sont pas rapprochés. Les noms déjà fournis par GuestLucky restent prioritaires, et une divergence de nom empêche l’ajout d’une photo.

Les 12 avatars affichés utilisent 11 petits fichiers locaux dans `public/images/reviewers/`, environ 43 Ko au total. Les types MIME et signatures JPEG/PNG/WebP ont été contrôlés lors de leur récupération, et les fichiers sont décodés dans le contrôle navigateur. Aucun avatar distant ni URL arbitraire du catalogue n’est chargé par le visiteur ; les photos sont différées, avec taille réservée. Les autres avis gardent le guillemet sans photo inventée. Pour retirer un profil, enlever sa correspondance et son fichier local ; pour retirer un avis, utiliser les exclusions existantes.

L’enrichissement est une vérification ponctuelle des profils actuels, pas un nouveau scraper automatique des plateformes. Les nouveaux avis sans profil fourni par GuestLucky conservent la présentation de repli jusqu’à vérification de leur source publique. Les preuves publiques d’extraction restent dans `var/guestlucky/*-public-review-profiles.json` et ne sont pas servies par le site. Aucune identité n’a été déduite des réservations privées.

Tests : `VerifiedReviewProfilesTest` couvre correspondance exacte, identifiant différent, texte modifié, mauvais logement, conflit d’auteur, doublon, URL distante, chemin invalide, image absente et catalogue manquant/corrompu. Le test navigateur confirme les noms, le nombre d’avatars et leur décodage depuis la même origine ; les contrôles de glissement, absence de recentrage, liens, thèmes et formats restent applicables.
