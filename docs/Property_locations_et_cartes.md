# Emplacements des logements et cartes

Les quatre adresses fournies ont été retrouvées dans GuestLucky par le connecteur en lecture seule le 18 octobre 2026. Leurs coordonnées ont été vérifiées au numéro de rue avec le [géocodage IGN / Base Adresse Nationale](https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/geocodage/). Aucun logement GuestLucky n’a été modifié.

| Identifiant GuestLucky | Adresse | Latitude | Longitude |
| --- | --- | --- | --- |
| 2475 | 256 Avenue de Dunkerque, 59130 Lambersart | 50.637488 | 3.024341 |
| 2474 | 195 Rue du Collège, 59100 Roubaix | 50.698811 | 3.176124 |
| 2630 | 118 Rue de l’Hippodrome, 59500 Douai | 50.363717 | 3.082143 |
| 2467 | 34 Rue Paul Bert, 59170 Croix | 50.689014 | 3.150681 |

`config/property_locations.json` conserve les correspondances, les identifiants BAN et la date de vérification. Les points correspondent à ces adresses, sans prétendre localiser une entrée intérieure ou une place de stationnement.

## Installation et mises à jour

La migration `Version20261018010000` ajoute `address`, `latitude` et `longitude` à `Property`. Pour une autre installation, appliquer les migrations du projet, importer le catalogue GuestLucky si nécessaire, puis vérifier et appliquer les emplacements :

```powershell
php bin/console app:properties:locations
php bin/console app:properties:locations --apply
```

La commande ne crée aucun logement : elle rapproche les identifiants GuestLucky déjà présents. Ne pas réappliquer un ancien fichier si les logements ont changé d’adresse ; vérifier et corriger d’abord sa source.

La synchronisation GuestLucky conserve désormais les adresses non vides. Un ancien catalogue sans adresse, ou une réponse vide, ne supprime pas une adresse connue. Les variations d’apostrophes, de virgules, de casse ou d’espaces gardent les coordonnées. Un véritable changement d’adresse les efface afin de ne pas afficher un ancien emplacement. Pour un nouveau logement ou un déménagement, ajouter des coordonnées vérifiées au fichier et appliquer la commande ; aucun géocodage automatique n’est effectué à chaque visite. Une fiche sans coordonnées conserve son adresse et son lien d’itinéraire.

## Parcours et interface

Sur `/disponibilites`, le carrousel réutilise le contrôleur à ressort de l’accueil et le dessin des anciennes cartes photo. Cliquer sur une carte latérale, utiliser les flèches, les villes, le menu déroulant ou glisser change le logement mis en avant. Le repère sélectionné et l’adresse suivent ce choix ; la carte effectue un trajet animé de 1,65 seconde qui peut être interrompu par un nouveau choix. Les repères sont utilisables au clavier. « Voir les disponibilités » ouvre ensuite le calendrier du logement choisi, avec les critères et la langue existants.

La carte reste à côté du calendrier sur grand écran, puis passe en dessous sur les écrans plus étroits. Les fiches `/property/{slug}` utilisent le même composant à la place de l’ancienne iframe Google limitée à la ville. « Itinéraire » ouvre Google Maps avec l’adresse exacte du logement, sans transmettre d’origine ni demander la géolocalisation au navigateur. Le trajet peut ensuite être choisi dans ce service.

## Services externes

[MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) affiche les cartes vectorielles d’[OpenFreeMap](https://openfreemap.org/). Le style maison **Roaming Pastel** est appliqué à Liberty par `assets/map-style.js`, via `transformStyle` : fond crème, routes gris bleuté, parcs verts, eau bleu clair, bâtiments discrets sans arêtes 3D, noms français ou anglais selon la page et pictogrammes ronds dessinés localement. Les restaurants, commerces, lieux culturels, hébergements et équipements ont des couleurs distinctes. Les arrêts de bus apparaissent seulement à partir du zoom 16,2 pour laisser place aux repères utiles. Le fond détaillé reste identique dans les deux thèmes ; les commandes suivent Roaming. Le cadrage d’un logement utilise le zoom 14,7. Les coordonnées vérifiées, le glissement et le bouton Itinéraire sont conservés. Ce dernier utilise une pilule turquoise avec une icône de navigation, un focus visible et une cible d’au moins 46 px.

Le moteur est chargé dans un morceau JavaScript séparé, uniquement après activation ; son worker est également servi localement avec un fichier versionné par Webpack. Les données vectorielles, les styles, les glyphes et les sprites sont reçus depuis `tiles.openfreemap.org`. Les données géographiques restent issues d’OpenStreetMap ; le fournisseur et le dessin du fond changent. Les attributions OpenFreeMap, OpenMapTiles et OpenStreetMap restent visibles.

La [documentation officielle](https://openfreemap.org/quick_start/) présente un service public gratuit sans clé API ni compte. Aucun abonnement n’a été souscrit. À la demande du propriétaire le **20 octobre 2026**, la carte se charge automatiquement lorsqu’elle approche de la zone visible, sauf préférence de désactivation. Un chargement discret remplace le panneau d’autorisation ; les liens de fournisseur et de réglages restent sous la carte. Aucun téléchargement hors ligne n’est réalisé. **Sur la carte, la molette zoome et dézoome sans faire défiler la page**, sans clic préalable ni touche Ctrl. En dehors de sa surface interactive, le défilement de la page reste normal. Sans WebGL utilisable ou si le fournisseur est indisponible, l’adresse et l’itinéraire restent accessibles.

La clé `roaming.maps.v1` conserve désormais une **préférence d’affichage**, en version 3, pendant 180 jours maximum. L’affichage automatique ne crée aucun enregistrement de consentement. Les désactivations valides des versions 1 et 2 sont respectées ; elles ne sont pas effacées par cette évolution. Sans préférence valide, la carte s’affiche par défaut. La désactivation depuis la carte ou Cookies retire le fond et ses ressources des onglets ouverts. Le choix GuestLucky reste indépendant, en version 1, avec un consentement explicite et une échéance propre : l’affichage automatique de la carte ne l’active jamais. Les textes FR/EN expliquent cette différence.

Les requêtes du fond transmettent l’adresse IP et l’origine du site, avec `referrerPolicy: origin` pour exclure les critères de séjour de l’URL, y compris dans le worker. Les requêtes externes utilisent explicitement `credentials: omit`, sans cookies envoyés par cette intégration. OpenFreeMap déclare ne pas utiliser de cookies ou de suivi, mais peut traiter des journaux techniques et recourir à un CDN. La politique de travail décrit l’intérêt légitime de présenter les emplacements publics, l’information et l’opposition possible ; la transmission d’IP reste un traitement de données. Voir [le dossier de confidentialité](Mentions_legales_et_confidentialite.md), les [conditions OpenFreeMap](https://openfreemap.org/tos/) et sa [politique](https://openfreemap.org/privacy/). Les pages légales restent en brouillon tant que les faits de production ne sont pas finalisés. Ce service n’offre pas de garantie de disponibilité. Les liens d’itinéraire suivent les [URLs Google Maps officielles](https://developers.google.com/maps/documentation/urls/get-started).

## Vérifications locales

`tests/GuestLucky/PropertyLocationTest.php` et `CatalogueAndRoutesTest.php` vérifient les emplacements. `tests/browser/property-maps.cjs` couvre l’affichage automatique sans consentement enregistré, le respect des anciennes désactivations, l’indépendance de GuestLucky, le zoom à la molette, la caméra, les repères, le glisser, les calendriers ciblés, le retrait, les pannes, seize dispositions et les replis sans WebGL ou JavaScript. Le mode réel contrôle aussi les ressources du fond pastel et l’absence de cookies envoyés ou de critères de séjour dans le référent.

Le mode facultatif `ROAMING_REAL_MAP_TILES=1` effectue seulement une vérification visuelle de tuiles réelles après activation et s’arrête avant la matrice de dispositions. Les calendriers et réservations y restent simulés ou bloqués. Aucune réservation ni écriture GuestLucky n’est effectuée.
