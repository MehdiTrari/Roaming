# GuestLucky — intégration Roaming

État vérifié le 27 septembre 2026. Ce fichier complète Guestlucky_MCP.md : il décrit **l'implémentation effective** et évite de rechercher à nouveau les contrats et correspondances.

## État et condition d'ouverture

Le code remplace l'ancienne intégration de réservation par GuestLucky. La disponibilité publique est **désactivée par défaut**, y compris les devis et le point de redirection. Les routes publiques ne font aucun appel GuestLucky lorsque ce verrou est fermé. Les routes de test réservées à `dev` et la commande explicite de diagnostic peuvent effectuer des lectures sans ouvrir ce verrou.

Anomalie fournisseur toujours reproduite pendant l'implémentation :

- Logement Roubaix, identifiant 2474.
- Le MCP retourne une réservation en cours : arrivée 2026-09-26, départ 2026-10-18.
- L'API Booking Engine retourne available=true pour 2026-10-01 et 2026-10-02.
- La lecture pricing pour checkin=2026-10-01, checkout=2026-10-03, guests=2, pets=0 accepte le séjour et retourne total_price=442.
- Ces informations suffisent à reproduire le problème auprès de GuestLucky, sans communiquer de données voyageurs. Aucun message n'a été envoyé au support et aucune réservation n'a été créée.

**Ne pas ouvrir les réservations publiques avant correction et comparaison avec les réservations, blocages manuels et restrictions du calendrier de gestion.** Une simple absence de réservation ne prouve pas qu'une nuit est libre. L'iframe GuestLucky utilise la même source et ne corrige pas l'anomalie.

## Architecture

- GuestLuckyClient : requêtes GET du Booking Engine, validation du contrat, normalisation de la devise Euro en EUR.
- AvailabilityService : calendrier partagé par les fiches et la vue globale, cache 60 secondes, devis non mis en cache, traitement indépendant des erreurs de chaque logement.
- AvailabilityController : planning, API publique et redirection avec une nouvelle lecture du devis.
- CatalogueImporter / app:guestlucky:catalogue : import complet et transactionnel des correspondances. Aucun accès MCP au runtime du site.
- Le paiement et la création de réservation restent chez GuestLucky.
- Après un devis accepté, le visiteur peut ouvrir le module GuestLucky en iframe dans la page ou dans un nouvel onglet. Les deux passent par `/reservation/{slug}` pour relire un devis frais avant de charger le moteur avec les dates et voyageurs. Aucun iframe de réservation n'est chargé automatiquement, ni proposé dans la page de test. Le verrou de publication protège aussi ce parcours.

Le navigateur communique avec Symfony. Il ne reçoit ni réservations brutes, ni identité des voyageurs. Les exceptions de transport ne sont pas journalisées avec leur URL, car celle-ci contient la clé du Booking Engine. Ne pas activer le profiler Symfony en production.

## Configuration

Variables d'environnement, à renseigner dans .env.local ou les variables du serveur :

    GUESTLUCKY_BASE_URL=https://app.guestlucky.io
    GUESTLUCKY_BOOKING_KEY=<clé de votre Booking Engine>
    GUESTLUCKY_AVAILABILITY_ENABLED=0

La clé est le segment gl_… du lien public fourni par GuestLucky ; ce n'est pas un jeton administrateur REST ou une clé MCP. La valeur réelle n'est pas inscrite dans le code, le catalogue ou cette documentation. La redirection finale est une URL publique GuestLucky et contient nécessairement ce segment.

En cas d'utilisation d'un fichier d'environnement PHP compilé, régénérer celui-ci selon le déploiement existant après modification des variables. Ne pas réactiver une ancienne sauvegarde d'environnement.

## Catalogue

Le fichier config/guestlucky/catalogue.json contient uniquement les données publiques vérifiées via MCP, l'horodatage et les correspondances locales :

| ID GuestLucky | Slug Roaming conservé/créé | Capacité |
|---|---|---:|
| 2475 | lambersart | 10 |
| 2474 | roubaix | 10 |
| 2467 | ecrin-noir-croix | 8 |

Les identifiants sont des données d'import puis des colonnes en base, pas des constantes métier. Lambersart et Roubaix conservent leurs descriptions, avis et images. Croix démarre avec les seules informations confirmées ; ses caractéristiques non renseignées sont masquées et ses photos sont annoncées à venir.

Les propriétés absentes sont archivées, sans supprimer les images ni les relations. Les fixtures conservent des exemples historiques archivés et publient les trois propriétés du catalogue.

Pour un futur import :
1. Lire l'identité du compte et toutes les pages de gl-list-properties via MCP.
2. Vérifier le compte et le nombre total. Ne pas utiliser une liste filtrée ou une page partielle.
3. Préparer le JSON avec source="GuestLucky MCP", account, verifiedAt, complete=true, total et properties. Chaque entrée possède id, slug, name, city, capacity.
4. Vérifier les nouveaux rapprochements de slugs ; le nom seul n'est pas une identité fiable.
5. Exécuter la simulation, puis l'application.

Un fichier vide, incomplet, mal formé ou contenant des doublons est refusé avant modification. Un conflit entre identifiant et slug annule la transaction. L'import préserve un slug déjà associé à l'identifiant et peut réactiver un logement réapparu.

Commandes depuis la racine :

    php bin/console doctrine:migrations:migrate --no-interaction
    php bin/console app:guestlucky:catalogue config/guestlucky/catalogue.json
    php bin/console app:guestlucky:catalogue config/guestlucky/catalogue.json --apply

La migration crée guest_lucky_id (nullable, unique) et active (false par défaut). Il faut donc appliquer l'import dans la même fenêtre de déploiement, avant de remettre les pages publiques en service. Ne pas utiliser doctrine:fixtures:load sur la base existante : cette commande peut la purger.

La migration et l'import ont été appliqués sur la base MySQL locale configurée (127.0.0.1:61218, base smogii). Le résultat contrôlé contient trois logements actifs associés aux identifiants GuestLucky 2475, 2474 et 2467 ; Wazemmes et les deux logements de Marcq sont archivés.

### Dépannage local : « Aucun logement à afficher »

Incident du 9 octobre 2026 : `.env.local` pointait vers une autre instance MySQL sur le port 64237. Son schéma existait, mais les tables `property` et `property_image` étaient vides. `/api/calendar` répondait `enabled: true, properties: []` : aucune lecture GuestLucky n'était lancée faute de logements locaux. La clé GuestLucky était valide.

La base Laragon existante, dans `C:/laragon/data/mysql-8.4`, contient six fiches dont trois actives, les identifiants GuestLucky et 119 références d'images. Cette instance a été redémarrée sur `127.0.0.1:61218` et `.env.local` reconnecté à elle (MySQL 8.4.9). La configuration précédente est sauvegardée dans `var/backups/env.local.before-database-fix-20261009` : ce fichier contient des secrets et doit rester local et non versionné. Aucune importation, suppression ni migration des données n'a été effectuée.

Pour relancer cette instance sous PowerShell après un arrêt, vérifier d'abord si le port 61218 écoute déjà, puis, uniquement si elle est arrêtée :

```powershell
Start-Process -FilePath 'C:/laragon/bin/mysql/mysql-8.4.3-winx64/bin/mysqld.exe' -ArgumentList '--defaults-file=C:/laragon/bin/mysql/mysql-8.4.3-winx64/my.ini','--port=61218','--bind-address=127.0.0.1' -WindowStyle Hidden
```

Ne pas lancer un deuxième processus sur le même répertoire de données. La configuration Docker du README correspond à une autre instance : changer de port ne copie pas les données. Pour passer à Docker, transférer explicitement le catalogue et ses contenus plutôt que de charger des fixtures sur une base existante.

Vérification rapide sans secrets : `php bin/console dbal:run-sql "SELECT slug, active, guest_lucky_id FROM property"`. Une liste vide signale un catalogue absent ; des logements `unverified` signalent plutôt une configuration fournisseur, un verrou ou un problème de lecture. Le 9 octobre, les trois calendriers d'octobre répondent `fresh` et la recherche du 12 au 14 octobre pour deux voyageurs retourne Croix à 327 €, les deux autres séjours étant refusés par GuestLucky. Le réglage de publication existant (`1`) a été conservé ; ce dépannage ne revalide pas l'ancienne incohérence de Roubaix.

En environnement de développement, la page `/test-disponibilites` interroge les calendriers publics GuestLucky, même lorsque le verrou de mise en ligne reste fermé. Son formulaire permet aussi de vérifier un devis frais (GET). Elle ne crée ni réservation, ni tarif, ni blocage. Le devis de test affiche le total et les frais, mais aucun lien de réservation : `bookingUrl` reste null. La page et ses endpoints `/api/test/calendar` et `/api/test/availability` répondent 404 hors de l'environnement `dev`.

Sur `/disponibilites` et les fiches, un verrou fermé affiche une explication et un contact à la place du tableau et du formulaire inutilisables. Un lien vers la page de test est proposé en développement uniquement. Les règles visuelles communes sont documentées dans [Style_Guide.md](Style_Guide.md).

Diagnostic répétable en lecture seule, avec la clé de `.env.local`, sans l'afficher et sans modifier le verrou :

    php bin/console app:guestlucky:check lambersart 2026-10-01 2026-10-03 --guests=2

Adapter les dates si elles sont passées. La commande consulte les mois du séjour et un devis frais, sans cache de calendrier. Un refus 422 explicite signifie que la lecture fonctionne et que le séjour est refusé ; une erreur fournisseur fait échouer le diagnostic. Les correspondances viennent des logements actifs en base.

## Résultats des essais réels du 27 septembre 2026

Clé Booking Engine chargée depuis `.env.local` ; aucune clé administrateur/MCP utilisée. Aucun appel d'écriture chez GuestLucky. Le test navigateur bloque aussi les méthodes autres que GET/HEAD/OPTIONS.

| Contrôle réel | Résultat observé |
| --- | --- |
| Calendriers des trois logements, septembre/octobre/décembre | 9 réponses HTTP 200 ; septembre partiel (19 jours), octobre et décembre complets (31 jours) |
| Clé volontairement invalide, lecture mensuelle | HTTP 404 ; la vraie clé donne HTTP 200 |
| Lambersart, 1–3 octobre, 2 voyageurs | Devis accepté : 306 € d'hébergement + 90 € de ménage = 396 € |
| Lambersart, 30 septembre–2 octobre | Devis accepté : 322 € ; séjour traversant deux mois |
| Lambersart, 1–2 octobre | HTTP 422, séjour refusé (minimum 2 nuits dans le calendrier) |
| Croix, 1–3 octobre | HTTP 422, séjour refusé ; nuits indiquées indisponibles |
| Roubaix, 1–3 octobre | Toujours accepté à 442 € ; incohérent avec la réservation MCP relevée précédemment |
| Page du Booking Engine Lambersart | HTTP 200 ; navigateur : arrivée 01/10, départ 03/10, 3 voyageurs conservés dans les champs et la requête pricing |
| Module GuestLucky en iframe | Chargement réel réussi avec dates/voyageurs conservés, une seule iframe après deux clics, lien externe présent, retrait si les dates/voyageurs changent ; activation simulée uniquement dans le navigateur, verrou serveur toujours fermé |
| Parcours de test Roaming | Sélection arrivée 01/10 puis départ 03/10 (nuit du 03 occupée), devis de 396 €, aucun lien de réservation |
| Panne simulée dans le navigateur | Message d'échec, dates non vérifiées, formulaire désactivé ; aucune disponibilité conservée comme confirmée |

Le calendrier de gestion n'a pas été relu via MCP lors de ces derniers essais. L'acceptation persistante du séjour contradictoire ne permet donc pas de lever le verrou ; il faut comparer à nouveau les réservations, blocages et restrictions côté gestion.

Le module embarqué est la page GuestLucky d'un logement, chargée après le devis (hauteur 900 px, largeur 100 %, titre accessible). Son contenu est servi par un autre domaine : les styles Roaming s'appliquent à son cadre, pas aux boutons internes GuestLucky. Le lien externe reste disponible si l'intégration est bloquée par le navigateur ou si le paiement nécessite un nouvel onglet. Le paiement réel n'a pas été testé et aucune réservation n'a été soumise.

La palette à saisir dans « Identité visuelle » de GuestLucky, les URLs du logo et les contraintes de contraste sont centralisées dans [Style_Guide.md](Style_Guide.md#identité-visuelle-guestlucky). Le module reste volontairement clair car le CSS GuestLucky observé force encore plusieurs surfaces en blanc.

Validation locale : 19 tests PHPUnit, 109 assertions, aucun ignoré avec `php -d extension=pdo_sqlite bin/phpunit` ; Twig, YAML, conteneur et compilation validés. Sans `pdo_sqlite`, les tests de base isolée sont ignorés : ne pas annoncer une réussite complète à partir de cette seule exécution. Contrôles navigateur FR/EN, clair/sombre, 1440/390/320 px et fiche logement ; aucune erreur JavaScript détectée.

## Contrat fournisseur observé

Les endpoints ci-dessous ont été découverts dans le JavaScript de la page publique d'un logement et testés en lecture. Ils ne figuraient pas dans la spécification REST générale docs.guestlucky.io consultée pendant la préparation. Leur stabilité doit être suivie avec GuestLucky ; pas de scraping HTML au runtime.

    GET /api/v1/booking/listings/{id}/availability?key=…&year=2026&month=10

Réponse mensuelle complète attendue :

    {"listing_id":2475,"year":2026,"month":10,"days":[
      {"date":"2026-10-01","available":true,"price":119,"min_stay":2},
      "... une entrée par jour du mois ..."
    ]}

Le mois courant peut être partiel dans la réponse GuestLucky ; les dates absentes restent « non vérifiées » dans Roaming. Le client refuse les dates hors du mois demandé, les dates dupliquées, les types incorrects et une réponse pour le mauvais mois/logement. La disponibilité, le tarif et le minimum sont consommés tels que fournis. La cause d'une indisponibilité et les restrictions détaillées d'arrivée/départ ne sont pas exposées : elles ne sont pas inventées.

    GET /api/v1/booking/listings/{id}/pricing?key=…&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&guests=2&pets=0

Le contrat consommé comprend listing_id, checkin, checkout, guests, nights, total_price, currency et les montants subtotal_nightly, cleaning_fee, linen_fee, extra_guest_fee, pet_fee, service_fee, discount_amount, tax_amount. Les frais retournés sont affichés ; le total n'est pas reconstruit à partir du prix de base.

Le refus connu est HTTP 422 avec error="Dates not available or constraints not met". Un autre 422 ou une panne devient « non vérifié », pas « indisponible ». Un devis mal formé n'active jamais un bouton de réservation.

La sélection de cette V1 concerne un séjour sans animaux (pets=0). Leur ajout éventuel doit être traité comme une évolution explicite du parcours.

## API Roaming et interface

- GET /api/calendar?year=YYYY&month=M : enabled, year, month, properties[].
- GET /api/properties/{slug}/availability?year=YYYY&month=M : même enveloppe, un seul logement.
- Chaque calendrier contient slug, name, city, maxGuests, image, detailsUrl, status, fetchedAt, days[]. status vaut fresh ou unverified ; un jour contient date, available, price, minStay.
- GET /api/availability?arrivalDate=…&departureDate=…&guests=…[&slug=…] conserve le point d'entrée de recherche. availability[] distingue available, unavailable, unverified ; bookingUrl est null tant que le devis n'est pas confirmé.
- GET /reservation/{slug}?arrivalDate=…&departureDate=…&guests=… vérifie un devis **non caché**, puis redirige vers /book/{clé}/{id}?checkin=…&checkout=…&guests=…. En cas de changement : page explicative, HTTP 409 pour refus, 503 pour non vérifié, 400 pour paramètres invalides.
- Les fiches archivées et leurs API répondent 404. Les redirections approximatives ont été retirées pour éviter de ressusciter un ancien logement ou de boucler.
- Les réponses de ces API et de redirection sont no-store ; seul le calendrier fournisseur bénéficie d'un cache serveur de 60 secondes, isolé par compte, logement et mois.

Le planning couvre le mois actuel et les onze mois suivants, en Europe/Paris. La date de départ est exclue des nuits occupées. Une date occupée peut être sélectionnée comme départ d'un séjour antérieur ; le devis reste l'autorité sur son admissibilité.

Depuis le 9 octobre 2026, le planning affiche un seul logement choisi par boutons, avec le mois courant et le suivant en deux grilles. Les fiches utilisent la même vue, directement sur leur logement. Deux lectures mensuelles du seul logement sélectionné sont lancées en parallèle via `/api/properties/{slug}/availability`. Sur la page de test, `/api/test/calendar` accepte un paramètre `slug` pour limiter également la lecture. `/api/calendar` multi-logements reste disponible pour compatibilité.

La navigation avance d'un mois, sur une fenêtre de douze mois au total ; la dernière paire contient les mois 11 et 12. Un changement de logement efface dates et devis. Les dates occupées sont barrées ; une date occupée peut servir de départ, mais une sélection ne peut traverser une nuit occupée ou non vérifiée. Le minimum de nuits est pris en compte pour les départs proposés. Les saisies manuelles et toutes les réservations sont toujours validées par un devis frais. « Effacer les dates » invalide aussi le devis et retire toute iframe ouverte.

Le planning se rafraîchit toutes les 60 secondes s'il est visible et lorsque l'onglet revient au premier plan. Les contrôleurs Stimulus annulent leurs requêtes et timers à la déconnexion Turbo. Les états en erreur désactivent la sélection et le devis. Validation navigateur de la refonte : changement de logement, deux requêtes par logement, séjour octobre/novembre, minimum de nuits, départ sur une nuit occupée, intervalle bloqué, décembre/janvier, panne, thèmes clair/sombre et écrans 1440/390/320 px. Les cas de sélection sont testés avec réponses contrôlées ; les lectures réelles et le rendu des fiches sont aussi vérifiés, sans soumettre de réservation.

En cas d'échec, les dates concernées redeviennent « non vérifié » et la réservation n'est pas proposée. fetchedAt est l'heure de lecture par Roaming, pas une promesse sur la dernière synchronisation Airbnb/Booking du fournisseur.

## Validation et bascule

Tests locaux sans écriture chez GuestLucky :

    php bin/phpunit
    php -d extension=pdo_sqlite bin/phpunit
    php bin/console lint:container
    php bin/console lint:twig templates
    php bin/console lint:yaml config translations
    npm run build

Sur les installations où pdo_sqlite n'est pas chargé, la deuxième commande l'active pour ce processus uniquement et permet les tests de base isolée. Les autres plateformes peuvent activer l'extension dans leur PHP de test.

Avant activation :
- Faire corriger l'écart Roubaix et vérifier que le séjour contradictoire est refusé.
- Comparer les trois calendriers à GuestLucky sur une réservation, un blocage manuel, un minimum de séjour et une restriction existants ; ne pas créer/modifier des blocages pour ce contrôle sans autorisation.
- Vérifier le transfert du logement, des dates et des voyageurs vers le moteur.
- Vérifier mobile, français/anglais, changements de mois/année, capacité, panne et actualisation.
- Configurer la clé sur le serveur, appliquer migration/import, compiler les assets.
- Seulement ensuite passer GUESTLUCKY_AVAILABILITY_ENABLED à 1 et renouveler le cache/configuration de déploiement.

Repli immédiat : remettre GUESTLUCKY_AVAILABILITY_ENABLED=0. Les fiches restent consultables et le contact reste accessible. Ne pas réintroduire l'ancien fournisseur ni afficher des disponibilités calculées par défaut.
