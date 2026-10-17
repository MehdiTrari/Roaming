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

[MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) remplace Leaflet pour afficher les cartes vectorielles d’[OpenFreeMap](https://openfreemap.org/). Le style **Liberty** remplace les fonds minimalistes Positron et Dark : rues, quartiers, parcs, transports et points d’intérêt colorés permettent de mieux situer les logements. Ce même fond détaillé reste visible dans les deux thèmes ; les commandes et la légende suivent les couleurs de Roaming. Un changement de thème conserve la position et le zoom. Le cadrage d’un logement utilise le zoom 14 pour montrer davantage de son quartier. Les repères turquoise, le glissement et le bouton Itinéraire restent communs aux pages. Ce dernier utilise une pilule turquoise avec une icône de navigation, un focus visible et une cible d’au moins 46 px.

Le moteur est chargé dans un morceau JavaScript séparé, uniquement après activation ; son worker est également servi localement avec un fichier versionné par Webpack. Les données vectorielles, les styles, les glyphes et les sprites sont reçus depuis `tiles.openfreemap.org`. Les données géographiques restent issues d’OpenStreetMap ; le fournisseur et le dessin du fond changent. Les attributions OpenFreeMap, OpenMapTiles et OpenStreetMap restent visibles.

La [documentation officielle](https://openfreemap.org/quick_start/) présente un service public gratuit sans clé API ni compte. Aucun abonnement n’a été souscrit. La carte se charge seulement après « Afficher la carte » ou l’autorisation correspondante dans « Cookies », lorsqu’elle approche de la zone visible. Aucun préchargement massif ou téléchargement hors ligne n’est réalisé. **Sur la carte, la molette zoome et dézoome sans faire défiler la page**, sans clic préalable ni touche Ctrl. En dehors de sa surface interactive, le défilement de la page reste normal. Sans WebGL utilisable ou si le fournisseur est indisponible, l’adresse et l’itinéraire restent accessibles.

Le choix `roaming.maps.v1` reste indépendant de `roaming.privacy.v1` (GuestLucky), pendant 180 jours maximum. Son contenu passe en **version 2** : l’ancien accord pour les tuiles OpenStreetMap n’autorise pas silencieusement OpenFreeMap. Le choix GuestLucky reste en version 1. Autoriser uniquement la carte n’autorise ni ne renouvelle GuestLucky. Le retrait supprime la carte distante, son worker et ses ressources dans les onglets ouverts ; l’adresse et l’itinéraire restent accessibles. Les préférences proposent deux cases, « Tout refuser », « Tout autoriser » et l’enregistrement des choix individuels. Les textes de confidentialité FR/EN décrivent ce fonctionnement.

Les requêtes du fond transmettent l’adresse IP et l’origine du site, avec `referrerPolicy: origin` pour éviter d’envoyer les critères de séjour de l’URL, y compris pour les requêtes effectuées par le worker. Le navigateur utilise son cache HTTP normal. Consulter les [conditions OpenFreeMap](https://openfreemap.org/tos/) et sa [politique de confidentialité](https://openfreemap.org/privacy/). Ce service n’offre pas de garantie de disponibilité ; une erreur conserve l’adresse et les liens. Les liens d’itinéraire suivent les [URLs Google Maps officielles](https://developers.google.com/maps/documentation/urls/get-started).

## Vérifications locales

`tests/GuestLucky/PropertyLocationTest.php` et `CatalogueAndRoutesTest.php` vérifient les coordonnées, les changements d’adresse et les liens. `tests/browser/property-maps.cjs` simule les services : quatre points, blocage avant accord et renouvellement pour le nouveau fournisseur, indépendance des choix, style Liberty, zoom/dézoom à la molette sans déplacement de page, défilement normal hors carte, caméra conservée au changement de thème, positions intermédiaires et arrivée exacte après interruption, synchronisation menu/carrousel/repères/glisser, calendrier ciblé, fiche logement, retrait, panne fournisseur, clavier, seize dispositions langue/thème/largeur et replis sans WebGL ou sans JavaScript.

Le mode facultatif `ROAMING_REAL_MAP_TILES=1` effectue seulement une vérification visuelle de tuiles réelles après activation et s’arrête avant la matrice de dispositions. Les calendriers et réservations y restent simulés ou bloqués. Aucune réservation ni écriture GuestLucky n’est effectuée.
