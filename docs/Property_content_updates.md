# Mise à jour des logements existants — 23 octobre 2026

Les données de présentation relues sont centralisées dans `config/property_content.json`. La commande `app:properties:enrich` met à jour les `Property` existantes ; modifier les fixtures ne mettrait pas à jour les lignes déjà enregistrées. Aucune fixture n'est chargée et aucun logement n'est créé.

| Logement | ID local / GuestLucky | Slug conservé | Capacité annoncée | Limite fournisseur conservée | Réservation en ligne |
| --- | --- | --- | --- | --- | --- |
| L’Écrin Noir – Maison Moderne & Accueillante, Croix | 6 / 2467 | `ecrin-noir-croix` | 9 | 8 | 8 |
| L’Élégante Douaisienne • 4 Chambres, Douai | 7 / 2630 | `l-elegante-douaisienne-4-chambres-2630` | 8 | 8 | 8 |
| La Maison du Patio – Terrasse & Jeux, Roubaix | 4 / 2474 | `roubaix` | 9 | 10 | 9 |

Lambersart et les autres logements ne figurent pas dans cette sélection. L'enrichissement ne modifie pas leurs colonnes, associations, images ou dates. Les IDs locaux sont un constat de la base locale ; la résolution utilise les IDs GuestLucky puis vérifie le slug et la ville avant toute modification.

## Sources et rédaction

Les caractéristiques fournies et confirmées par le propriétaire sont la source de référence. Les descriptions courtes, principales, espaces, accès et remarques ont été reformulées pour ROAMING en français et en anglais, sans recopier les annonces.

- [Croix — annonce officielle](https://www.airbnb.fr/rooms/1765420065815429494) : annonce consultée le 23 octobre 2026, avec 140 m², 9 voyageurs, 4 chambres, 4 lits et 1 salle de bain. Le jacuzzi correspond à une **baignoire balnéo intérieure**, avec une douche séparée ; aucun spa extérieur n'est annoncé dans les nouvelles données. Terrasse, salle de sport privée, une place de stationnement réservée, boîte à clés, cuisine équipée, Wi-Fi, télévision et animaux acceptés sont confirmés.
- [Douai — URL officielle fournie](https://www.airbnb.fr/rooms/1796954021774541556) : la page n'a pas pu être consultée lors de la vérification. Les données retenues sont celles confirmées par le propriétaire : 8 voyageurs, 4 chambres et 4 lits doubles, 2 salles de bain, 3 niveaux, climatisation, petite terrasse, cuisine, lave-linge, Wi-Fi, télévision, proximité immédiate du Barlet et animaux acceptés.
- [Roubaix — annonce officielle](https://www.airbnb.fr/rooms/1791266310046498117) : annonce consultée le 23 octobre 2026, avec 9 voyageurs, 5 chambres, 5 lits et 2 salles de bain. Patio abrité, baby-foot, jeux de société, espace de travail, cuisine équipée, Wi-Fi, télévision, linge et serviettes fournis, proximité du métro et de La Piscine et animaux acceptés sont confirmés.

L'adresse exacte et les coordonnées déjà vérifiées dans `config/property_locations.json` restent inchangées. Une commune ou la carte approximative d'une annonce n'est jamais utilisée pour recalculer une adresse ou une position.

Les notes et comptes d'avis ne sont pas actualisés à partir d'informations partielles. La note du profil de l'hôte ne devient jamais celle d'un logement : Roubaix était une nouvelle annonce sans avis de logement à la vérification. Si une correction d'URL concerne un logement ayant une ancienne note, celle-ci et son compte sont remis à `null` pour ne pas les attribuer à une autre annonce ; les entités `Review` locales sont conservées.

## Champs et synchronisation

Les champs existants suffisent pour les titres, descriptions FR/EN, type de maison, surface connue, capacité annoncée, chambres, lits, salles de bain, équipements et liens Airbnb. Les niveaux de Douai et les lits doubles sont décrits dans `accommodation` / `accommodationEn`, sans créer une seconde structure de données.

Un seul champ nullable est ajouté : **`providerCapacity`**, via `Version20261023010000`. Il conserve la limite du moteur de réservation indépendamment de `travelers`, qui présente la capacité publique confirmée. `getBookingCapacity()` renvoie le minimum des deux ; avec `providerCapacity = null`, il conserve le comportement historique de `travelers`. La migration ajoute seulement la colonne nullable, sans réécrire les données de Lambersart.

À la première application, la commande mémorise l'ancienne capacité issue du fournisseur avant de changer la capacité annoncée. Les futures synchronisations GuestLucky actualisent `providerCapacity`, le minimum de séjour et les autres champs opérationnels. `CatalogueImporter` reprend les titres et capacités publiques relus du fichier central pour ces trois logements, afin qu'un ancien libellé fournisseur ne remplace pas « La Maison du Patio » et qu'un import ne rétablisse pas 10 voyageurs sur Roubaix. Les descriptions, relations et médias ne sont pas importés par cette synchronisation.

Le serveur, les réponses de disponibilités, les attributs `data-capacity` de recherche et les contrôles voyageurs utilisent la capacité de réservation effective. Les fiches et cartes de présentation utilisent la capacité publique. Pour Croix, une indication FR/EN propose de contacter l'équipe au-delà de 8 voyageurs ; aucune demande pour 9 personnes n'est envoyée à un fournisseur limité à 8. Cette divergence doit être confirmée auprès du propriétaire puis corrigée à la source dans GuestLucky si nécessaire. Pour Roubaix, la limite publique de 9 reste respectée même si le fournisseur permet 10.

## Application

Sauvegarder la base cible avant la migration et l'enrichissement, puis vérifier son identité. Dans cette intervention, la base locale autorisée est `smogii`, sur `127.0.0.1:61218` ; la base Docker vide ne doit pas être utilisée par erreur.

```powershell
php bin/console doctrine:migrations:migrate --no-interaction
php bin/console app:properties:enrich
php bin/console app:properties:enrich --apply
php bin/console app:properties:enrich
```

Sans `--apply`, la commande ne modifie rien et présente les IDs, slugs, titres, capacités, nombres de photos conservées et champs à modifier. Elle résout et valide **toutes** les correspondances avant de commencer. Un logement absent, inactif ou associé à une autre ville / un autre slug fait échouer l'ensemble avant toute écriture. L'application utilise une transaction ; elle ajoute uniquement les associations d'équipements confirmés manquantes et conserve les associations existantes. Les équipements partagés ne sont ni renommés ni modifiés.

Une seconde application ne crée ni doublon de logement ni doublon de relation ou d'équipement par clé ; les valeurs déjà identiques et `updatedAt` ne sont pas réécrits. L'aperçu local est conservé comme fichier de travail dans `var/property-enrichment-preview.txt`. Les sauvegardes et artefacts `var/` ne sont pas des sources à versionner.

L'application locale a été réalisée après la sauvegarde `var/backups/before-property-enrichment-20261023.sql` et un état de référence JSON. Le contrôle après application conserve **7 logements et 119 références d'images** au total, dont les archives ; toutes les colonnes et relations de Lambersart restent identiques. Une nouvelle simulation indique les trois logements « inchangé ». Les références actives d'images restent 21 sur Lambersart et 20 sur Roubaix, sans ajout sur Croix ou Douai.

L'affichage des équipements utilise le filtre Twig générique `display_amenities` de `AmenityPresentationExtension`. Ses alias centralisés traduisent les anciens noms français et les rapprochent des nouvelles clés sans toucher aux lignes partagées ni à leurs relations ou icônes. Wi-Fi, télévision et espace de travail n'apparaissent qu'une fois ; une cuisine équipée confirmée remplace le simple libellé « Cuisine ». Le libellé historique « Serviettes, draps de lit » est présenté avec les deux clés correspondantes, sans les dupliquer. Terrasse, petite terrasse et patio abrité restent distincts puisqu'ils peuvent désigner des espaces différents. Les libellés inconnus restent visibles tels quels.

## Médias et informations à confirmer

Les galeries, leurs associations, positions et photos principales restent intactes. Le contrôle local a trouvé 20 références d'images valides sur Roubaix, 21 sur Lambersart et aucune sur Croix ou Douai. La couverture de Roubaix montre un baby-foot et une autre image un patio abrité, cohérents avec les caractéristiques fournies ; cela ne certifie pas à lui seul qu'il s'agit de la même annonce Airbnb. La correspondance complète doit être confirmée par le propriétaire. Aucun média n'a été téléchargé depuis Airbnb ni réaffecté entre logements.

Les photos de Croix et Douai restent à fournir avec les droits d'utilisation ; les placeholders actuels sont conservés. Restent aussi à confirmer : la répartition exacte et les types des lits de Croix (contradiction entre le texte et les cartes des chambres Airbnb), les types des lits de Roubaix, les surfaces de Douai et Roubaix, le nombre de toilettes, l'accessibilité, les modalités d'arrivée et le stationnement de Douai et Roubaix, ainsi que les éventuelles conditions ou frais pour les animaux. Aucune valeur artificielle n'est créée pour ces informations.

Les informations inconnues et absentes du fichier sont laissées telles quelles. Les surfaces nulles ne sont pas affichées ; les chambres, lits et salles de bain sont affichés seulement lorsque renseignés. La DA, les animations, les itinéraires, les slugs et les autres plateformes de réservation restent ceux de l'application.

## Vérification reproductible

Fichiers concernés par cette intervention :

- Données : `config/property_content.json` ; modèle `src/Entity/Property.php` ; migration `migrations/Version20261023010000.php`.
- Application idempotente : `src/Service/PropertyContentCatalogue.php` et `src/Command/PropertyEnrichmentCommand.php`.
- Synchronisation et limites de réservation : `src/Integration/GuestLucky/CatalogueImporter.php`, `src/Service/AvailabilityService.php`, `src/Command/GuestLuckyCheckCommand.php`.
- Présentation : `src/Twig/AmenityPresentationExtension.php`, `templates/home/index.html.twig`, `templates/calendar/_planning.html.twig`, `templates/components/_property_facts.html.twig`, `templates/property/show.html.twig` et `translations/messages.fr.yaml` / `messages.en.yaml`.
- Correction du déplacement du formulaire : `assets/booking-search.js`, `assets/ui-motion.js`, `assets/styles/hospitality.css`, avec les règles correspondantes dans `docs/Style_Guide.md`. Les panneaux sont placés avant le focus natif ; une ouverture haute reste au-dessus de toute la barre pour laisser le guide lisible.
- Tests : `tests/GuestLucky/PropertyEnrichmentTest.php`, `tests/GuestLucky/AmenityPresentationTest.php`, `tests/browser/search-position.cjs` et adaptation de `tests/browser/home-header.cjs` au placement au-dessus ou au-dessous.

```powershell
php -d extension=pdo_sqlite bin/phpunit tests/GuestLucky
php bin/console lint:yaml translations/messages.fr.yaml translations/messages.en.yaml
php bin/console lint:twig templates/home/index.html.twig templates/calendar/_planning.html.twig templates/components/_property_facts.html.twig
```

`PropertyEnrichmentTest` crée un schéma SQLite en mémoire et n'écrit jamais dans MySQL. Il couvre la simulation, les applications répétées, l'absence de création, les correspondances invalides, la conservation de toutes les colonnes de Lambersart et des médias / avis, la synchronisation ultérieure, les limites côté serveur et formulaires, les liens officiels et les libellés FR/EN. `AmenityPresentationTest` vérifie également les alias, l'absence de mutation des icônes et la conservation des équipements distincts. Les réponses fournisseur sont simulées et aucune réservation n'est créée.

Résultats locaux : la suite GuestLucky a passé 49 tests et 343 assertions après l'enrichissement ; les ajouts ultérieurs de présentation ont passé les 8 tests ciblés et 90 assertions des deux fichiers ci-dessus. La syntaxe des fichiers YAML et des templates modifiés a été vérifiée.
