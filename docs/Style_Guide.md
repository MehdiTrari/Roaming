# Style Roaming Lille

Référence pour les pages existantes et futures. Établie le 27 septembre 2026 à partir de `assets/styles/app.css`, `assets/app.js`, `templates/base.html.twig`, de l'accueil et des fiches logements. Vérifier cette référence avant d'introduire de nouvelles couleurs ou composants.

## Identité

Le site utilise **DM Sans**, des accents turquoise profonds et les photographies du catalogue local. Le **thème clair est le défaut**, même si le système préfère le sombre. Une préférence explicite `light` ou `dark` stockée sous `localStorage.theme` est conservée et appliquée via `html[data-bs-theme]` avant le rendu, puis à chaque navigation Turbo. Le stockage indisponible ne bloque pas l’interface.

DM Sans variable (graisses 100–1000) est conservée dans `public/fonts/dm-sans-variable.ttf`, avec sa licence OFL, puis émise par Encore sous un nom versionné dans `public/build/fonts`. Le préchargement Twig et le CSS utilisent le même fichier via le manifeste. Un seul `@font-face` global et `font-display: swap` ; pile de repli système `sans-serif`. Aucun appel à un service de polices au chargement.

Conserver le header, le footer et les logos de `base.html.twig`. Composer les nouvelles pages avec le conteneur Bootstrap existant. Ne pas ajouter un autre framework CSS ni une police spécifique à une seule page.

## Palette GuestLucky / Roaming

| Usage / variable CSS | Clair | Sombre |
| --- | --- | --- |
| Fond `--roaming-bg` / `--bs-body-bg` | `#F8F9FA` | `#121212` |
| Texte `--roaming-text` / `--bs-body-color` | `#212529` | `#E9ECEF` |
| CTA `--roaming-primary` | `#0F766E` / blanc | `#0F766E` / blanc |
| Survol CTA `--roaming-secondary` | `#115E59` / blanc | `#115E59` / blanc |
| Liens `--roaming-accent` / `--teal-primary` | `#0F766E` | `#5EEAD4` |
| Carte/champ `--roaming-card-bg` / `--card-bg` | `#FFFFFF` | `#1E1E1E` |
| Section alternée `--section-alt-bg` | `#F8F9FA` | `#1A1A1A` |

Les tokens `--roaming-*` sont la source commune ; les variables Bootstrap et `--teal-*` sont des alias de compatibilité. Les CTA gardent le primaire profond dans les deux thèmes ; les liens sombres utilisent un accent clair pour le contraste. Les champs d’accueil suivent les surfaces et textes du thème. Le calendrier conserve ses tokens `--cal-*`, états et logique partagés.

Réutiliser `--hero-gradient`, `--teal-fade` et `--teal-glow` pour les fonds et ombres. Employer le turquoise pour les actions et liens ; éviter les boutons bleus Bootstrap par défaut. Un bouton avec texte blanc utilise un turquoise assez profond, par exemple `#0f766e`, pour préserver son contraste. Définir explicitement ses états normal, survol, focus et désactivé.

## Composition et typographie

### Accueil et header — lot A

Les sélecteurs de dates, logement et voyageurs de l’accueil utilisent des dialogues natifs dans la couche supérieure : ouverture sous le champ sur desktop, surface basse sur mobile. La page défile si nécessaire ; leur hauteur est limitée au viewport avec défilement interne, sans modifier la hauteur du formulaire. Fermeture par clic extérieur, Échap, croix ou validation, avec restitution du focus ; fermeture avant la mise en cache Turbo. Le calendrier compact Flatpickr et ses règles sont conservés. Le choix du logement utilise des options aux couleurs du thème et conserve un select masqué comme source des critères.

Le menu Bootstrap des logements garde ses entrées dynamiques, avec carte aux couleurs du thème, rayon de 16 px, titres multilignes et défilement pour les longues listes. Les contrôles thème, langue et séjour ont une hauteur de 44 px et un rayon de 12 px ; le CTA utilise le primaire GuestLucky. Le groupe de langue mesure 44 px, avec segments internes de 36 px. À 320 px, le CTA occupe une seconde ligne dans le menu mobile.

Les pictogrammes des atouts (Wi-Fi, clé, tasse, lit, mallette et étiquette) sont centralisés dans `templates/components/_amenity_icon.html.twig`, partagé par l'accueil et la page À propos. Utiliser un SVG de 24 × 24, un trait de 1,8, des extrémités arrondies et `currentColor`. Le support de l'accueil mesure 48 × 48 et ne rétrécit pas dans les lignes flex. Ces icônes accompagnent un libellé : elles sont décoratives (`aria-hidden="true"`, `focusable="false"`).

- Un titre H1 par page, une introduction courte, puis le contenu principal. Les sous-sections utilisent H2 puis H3.
- Titres de page : environ 32–48 px, graisse 700–750, interlettrage légèrement resserré. Texte courant : 16 px avec interligne 1,5–1,75.
- Surtitre optionnel : 12 px, turquoise, capitales espacées ; il reste bref.
- Espacements sur une base de 4/8 px : 16–24 px à l'intérieur des panneaux, 24–32 px entre sections, environ 48 px autour d'une page sur ordinateur.
- Arrondis : 10–16 px pour les contrôles et petites cartes ; 16–20 px pour les panneaux principaux. Bordures fines et ombres discrètes.
- Les images ont un ratio stable et `object-fit: cover`. Une image décorative accompagnant le nom du logement a `alt=""`. Un logement sans photo reçoit un visuel neutre, jamais la photo d'un autre logement.

## Planning partagé

Source : `templates/calendar/_planning.html.twig`, `assets/controllers/calendar_controller.js` et le bloc CSS « Roaming planning » de `assets/styles/app.css`. Les pages globale, test et logement réutilisent ce composant.

| État | Fond / texte clair | Fond / texte sombre | Indice autre que la couleur |
| --- | --- | --- | --- |
| Disponible | Surface du panneau / texte principal | Surface du panneau / texte principal | Date et prix par nuit |
| Indisponible | Surface du panneau / texte secondaire atténué | Surface du panneau / texte secondaire atténué | Date barrée |
| Non vérifié | Surface du panneau / texte secondaire | Surface du panneau / texte secondaire | Point d'interrogation et bouton désactivé |
| Date passée | Surface du panneau / texte secondaire atténué | Surface du panneau / texte secondaire atténué | Date barrée, sans prix, bouton désactivé |
| Nuits sélectionnées | `#d9f4e9` / `#115343` | `#153e35` / `#9be6ce` | Bande continue entre arrivée et départ |
| Arrivée / départ sélectionnés | `#0f766e` / blanc | `#0f766e` / blanc | Bordure et `aria-pressed` |

Les variables `--cal-*` sont limitées au composant. La couleur n'est jamais l'unique indication. Les dates passées ne paraissent pas réservables ; les prix ne sont pas affichés comme une promesse sur ces dates. Les nuits occupées et les erreurs fournisseur restent deux états distincts. Une date indisponible peut servir de départ, puisque la nuit du départ est exclue du séjour.

Depuis le 9 octobre 2026, la page Disponibilités utilise des boutons de logements et affiche un seul logement à la fois. La fiche logement utilise le même composant sans afficher le sélecteur. Deux mois consécutifs sont présentés en grilles de sept jours : le mois courant et le suivant à l'ouverture, puis navigation d'un mois à la fois. Ils sont côte à côte lorsque le composant dépasse 480 px de large, empilés sinon (requêtes de conteneur CSS, pour respecter aussi la colonne d'une fiche).

Les champs arrivée/départ sont regroupés en haut, avec le nombre de nuits et le minimum de séjour après choix d'une arrivée. Le lien « Effacer les dates » remet le séjour à zéro. Une arrivée et un départ sont mis en évidence par des pastilles turquoise ; les nuits intermédiaires forment une bande claire. Aucun tableau horizontal multi-logements ni liste déroulante redondante de logements. Les commandes principales restent accessibles au clavier ; les flèches du clavier parcourent les jours activés du calendrier visible.

Les prix des cases évitent les décimales inutiles (`119 €`) pour rester lisibles sur mobile. Le devis conserve les montants détaillés. Les tarifs les plus longs doivent être vérifiés à 320 px.

Le module de réservation GuestLucky peut s'ouvrir après le devis dans une iframe de 100 % de largeur, 900 px de hauteur et 12 px d'arrondi. Le cadre et ses commandes suivent Roaming ; l'intérieur conserve le style GuestLucky, car il est servi sur un autre domaine. Conserver un lien de repli « Ouvrir dans un nouvel onglet ». Ne charger l'iframe qu'à la demande et après revalidation du séjour.

### Identité visuelle GuestLucky

Le Booking Engine GuestLucky doit rester en thème clair tant qu'il force son en-tête, certaines cartes et les champs en blanc dans son CSS généré. Une configuration sombre produirait des contrastes incohérents. Renseigner les champs de l'écran « Identité visuelle » comme suit :

| Champ GuestLucky | Valeur Roaming | Usage |
| --- | --- | --- |
| Nom de marque | `Roaming Lille` | Remplace « Mathis » dans l'en-tête et le pied de page |
| Police | `DM Sans` | Même police que l’interface Roaming |
| URL du logo | `https://roaminglille.com/images/logo-footer-black.png` | Logo noir sur l'en-tête clair |
| URL du favicon | `https://roaminglille.com/images/logo-footer-black.png` | Icône adaptée au fond clair du moteur |
| Primaire | `#0F766E` | Boutons, dates sélectionnées et liens ; contraste blanc 5,47:1 |
| Secondaire | `#115E59` | Actions secondaires ; contraste blanc 7,58:1 |
| Fond | `#F8F9FA` | Fond général clair, identique au thème clair Roaming |
| Texte | `#212529` | Texte principal, contraste élevé sur fond clair |
| Fond des champs | `#FFFFFF` | Champs de formulaire |
| Texte des champs | `#212529` | Valeurs et saisies |
| Fond des cards | `#FFFFFF` | Calendrier, informations et récapitulatif |
| Texte des cards | `#212529` | Texte des cartes |

Ne pas utiliser `#0D9488` pour le bouton principal GuestLucky : son texte est forcé en blanc et le contraste obtenu (3,74:1) est trop faible pour du texte courant. Le primaire `#0F766E` garde l'identité turquoise avec un contraste AA.

Ces valeurs documentent la configuration existante du moteur, sans la modifier depuis le site. Le CSS local harmonise le contenant et ne peut pas modifier l’intérieur de l’iframe. La configuration des clés d’encaissement reste indépendante : ne pas annoncer le paiement disponible sur cette seule base. Les URLs de logo ci-dessus répondaient HTTP 200 le 28 septembre 2026.

## Accueil et navigation (phase 1, 10 octobre 2026)

Hero avec la première photo d’un logement actif et lien identifiant ce logement ; à défaut de photo, fond neutre sans photo empruntée. Image prioritaire, photos des cartes différées, ratios stables. Les trois logements sont issus du repository local avec leurs statuts, capacités et routes, sans identifiants codés dans les templates. Les cartes précèdent les atouts et le contact. La recherche conserve son contrat dates/voyageurs ; le faux champ destination fixe est supprimé. Son maximum de voyageurs vient des capacités actives.

Navigation repliée sous 1200 px, liens actifs, lien d’évitement, boutons de sélecteur accessibles au clavier, état `aria-expanded`, fermeture par Échap et résultats `aria-live`. Les panneaux s’insèrent dans le flux sur mobile. Les animations respectent `prefers-reduced-motion` et le contenu d’accueil reste visible sans attendre un observateur JS. Tous les nouveaux libellés existent en FR/EN.

Si la publication est désactivée, afficher une explication et un contact utilisable. Ne pas présenter un tableau entièrement gris et un formulaire inactif comme écran principal. Le lien vers le diagnostic et les explications techniques sont réservés au développement.

## Catalogue et fiches (phase 2, 10 octobre 2026)

Le catalogue conserve son emplacement et son ancre `/#featured`. Les cartes de l’accueil et les suggestions des fiches partagent `templates/components/_property_card.html.twig`. La capacité, les chambres, les lits et les salles de bain utilisent `_property_facts.html.twig` ; les valeurs non renseignées ne sont pas présentées comme des équipements confirmés. Les descriptions, photos, notes et équipements proviennent des relations locales des logements actifs. Aucun logement, tarif ou contenu de remplacement n’est inventé.

Les fiches utilisent les tokens de phase 1, sans autre police ni palette : grandes photos, surfaces du thème, bordures fines et CTA primaires. Le carousel Bootstrap existant assure le tactile et les flèches du clavier, avec commandes de 48 px et miniatures défilantes nommées. Le petit contrôleur Stimulus `property_gallery_controller.js` initialise et libère les instances à chaque visite Turbo, sans défilement automatique, et garde la miniature active visible. Une seule photo n’affiche pas de commandes inutiles ; sans photo, une surface neutre de hauteur limitée explique l’absence de visuel. Les images principales sont prioritaires, les miniatures et cartes différées.

Les équipements affichent toujours leur libellé, avec icône décorative si renseignée. Sans équipement, présenter une explication et un contact. Les sections descriptives vides sont omises ; aucun texte générique ne prétend confirmer une cuisine, un parking ou une terrasse. La carte différée nomme la commune et précise qu’elle ne représente pas l’adresse exacte.

Les ancres de section et le fil d’Ariane relient catalogue, fiche et disponibilités. Le planning existant est inclus une seule fois, sans modifier son Twig, son contrôleur Stimulus, son API ou ses règles. Il apparaît à côté des informations sur ordinateur, puis avant celles-ci sur mobile ; son dimensionnement en conteneur conserve les deux mois. Le lien « Choisir un séjour » mène au planning, sans promesse de réservation. Les suggestions excluent la fiche courante et utilisent uniquement `navProperties`, déjà filtré par le repository.

## Recherche et réservation (phase 3, 10 octobre 2026)

Le formulaire d'accueil conserve son sélecteur de dates Flatpickr et son compteur de voyageurs. Un choix facultatif de logement utilise uniquement les logements actifs locaux et leurs capacités. Dates, voyageurs et logement sont conservés dans les paramètres `arrivalDate`, `departureDate`, `guests`, `slug` de l'URL, via `assets/booking-state.js`. Le contrôleur Stimulus `booking_journey_controller.js` transmet ces critères aux liens du catalogue, des fiches, des disponibilités et du contact, y compris les liens copiés ou ouverts dans un autre onglet. La fiche impose son propre slug, conserve les dates et affiche leur mois. Aucune restauration de navigation ne rétablit un ancien devis ou une iframe.

Le calendrier partagé conserve ses deux mois, prix, flèches, raccourcis clavier et règle du départ exclu. Une modification des critères invalide immédiatement le devis et annule ses requêtes. Les séjours trop courts, surcapacité, nuits occupées ou nuits non vérifiées disposent d'un message explicite. Les mois du séjour saisi sont lus avant le devis frais fournisseur. Depuis le lot B, changer de logement dans le sélecteur d’accueil ou par « Changer de logement » efface les dates, le devis et le module, en conservant les voyageurs. Les lectures simultanées identiques sont évitées ; un calendrier déjà lu n'est pas relu pendant ses 60 secondes de fraîcheur. Le cache serveur existant reste inchangé.

### Calendriers et disponibilités — lot B

`assets/calendar-availability.js` centralise les nuits du séjour, la validation, la capacité, le minimum à l’arrivée, la sélection et le chargement des mois pour Flatpickr et le contrôleur Stimulus du planning. L’accueil charge sur demande le mois affiché et le suivant via les routes Symfony existantes. Le booléen public du verrou est exposé dans le HTML, sans clé : fermé, aucun calendrier ni devis n’est interrogé depuis l’accueil, et le contact reste disponible. L’ouverture, le mois et le retour de visibilité respectent cache/déduplication/annulation ; aucun appel au survol. Aucun nouveau moteur de rendu ni changement métier côté serveur.

Sans slug, une nuit confirmée ouverte sur au moins un logement actif est candidate à la recherche ; toutes confirmées fermées donnent une nuit indisponible ; absence de confirmation avec au moins un état inconnu donne « Non vérifié ». Un séjour est évalué intégralement sur chaque logement : jamais d’assemblage de nuits issues de logements différents. Aucune moyenne de prix n’est inventée ; seul le devis frais peut confirmer le séjour et son tarif.

« Départ uniquement » / « Check-out only » est contextuel : nuit confirmée occupée, arrivée déjà choisie, capacité et minimum respectés, toutes les nuits précédentes confirmées ouvertes sur un même logement. Le départ est exclu. La veille d’un blocage ne reçoit aucun état arbitraire. Marque ↗, libellé ARIA, titre et indication au survol/focus ; les nuits inconnues restent distinctes.

### Fiches logements — lot C

Les fiches activent uniquement la variante `compact` de `_planning.html.twig` et du contrôleur `calendar`. Le panneau présente le logement, « Réservez votre séjour », les deux déclencheurs de dates, l’effacement secondaire, les voyageurs, le résumé puis le devis vérifié et l’action principale. Aucun tarif définitif sans devis ; aucune iframe sans clic et revalidation. Le select de voyageurs propose les capacités réelles du logement. La publication fermée laisse une explication et le contact, sans lecture API depuis cette variante.

Deux mois sont rendus dans un dialogue natif fermé au chargement, placé près du champ sur desktop et adapté au viewport mobile (deux colonnes sur ordinateur, mois empilés sur mobile). Le contrôleur et les règles `CalendarAvailability` du lot B restent communs ; `/disponibilites` conserve son rendu étendu à deux mois avec tarifs. Les nuits, minimums, départ exclu et « Départ uniquement » suivent la même validation. Les tarifs indicatifs sont masqués dans la variante compacte ; la sélection seule ne demande pas un devis automatiquement. Le bouton « Vérifier le séjour » conserve le parcours existant.

La sélection peut modifier l’arrivée ou le départ, naviguer entre les mois et être validée avant fermeture. Échap, clic extérieur et croix ferment également ; focus restitué au champ déclencheur. La couche supérieure évite le clipping, limite la hauteur avec défilement interne, ne réserve aucun espace fermé et ne déplace pas le panneau. Nettoyage des dialogues et devis avant cache Turbo et à la déconnexion. Validation locale avec `node tests/browser/property-compact.cjs` (API et réservations simulées), puis les régressions A/B.

### Référence de mouvement des calendriers

La référence est le Flatpickr **inline** de l’accueil dans `#date-panel`, inchangé. Son CSS `.animate.open` prévoit `fpFadeInDown 300ms cubic-bezier(0.23, 1, 0.32, 1)` pour un autre mode ; cette classe n’est pas active ici. Ouverture/fermeture du dialogue, sélection/effacement, hover/focus des jours et navigation de mois sont immédiats (durée calculée 0 s, aucun déplacement). Seuls les chemins SVG des flèches Flatpickr changent de `fill` en 100 ms, easing `ease` ; les flèches des plannings reprennent ce timing sur leur couleur. Les hover/focus des jours utilisent le gris `#E6E6E6` en clair et le blanc à 10 % en sombre ; les bornes restent turquoise et la plage conserve son fond de thème. Les contours de focus clavier des boutons restent accessibles.

Les plannings partagés suivent ce comportement sans animation JavaScript, fondu de dialogue de 150/120 ms ni entrée animée du planning étendu. Après choix de l’arrivée, le hover/focus d’un départ valide prévisualise instantanément la plage avec les mêmes couleurs : classes temporaires seulement, validation `canDepart` commune, aucune modification des dates ni requête de devis. Sortir du calendrier, changer de sélection ou naviguer efface cet aperçu ; les événements sont déclarés dans le composant Twig et gérés par Stimulus. L’animation des cartes de choix de logement reste indépendante. `prefers-reduced-motion` conserve la désactivation globale des transitions. Contrôle comparatif local : `node tests/browser/calendar-motion.cjs`, avec API simulées, captures desktop/mobile et styles calculés comparés à l’accueil.

Validation : `node --experimental-vm-modules tests/browser/calendar-rules.cjs`, `node tests/browser/calendar-lot-b.cjs`, puis les suites `booking-journey.cjs`, `home-header.cjs` et `availability-choice.cjs`. Réponses fournisseur simulées et domaines externes bloqués ; aucune réservation ni lecture réelle GuestLucky.

`assets/booking-ui.js` fournit un récapitulatif commun à la recherche et au planning : logement, dates, voyageurs, nuits, total et frais non nuls réellement retournés. Les logements disponibles précèdent les autres. Les états « disponible », « indisponible » et « non vérifié » ont chacun leur libellé, sans dépendre uniquement de la couleur. Les cartes et messages suivent les tokens existants, avec surfaces blanches en clair, surfaces du thème en sombre, grille de frais lisible et commandes d'au moins 44 px. Une publication fermée masque prix et actions de réservation, même si une réponse incohérente contient une ligne disponible, et propose le contact.

Un devis possède une durée d'utilisation locale de 60 secondes ; expiration, erreur, changement de critères ou de mois empêchent sa réutilisation. L'ouverture du module demande un nouveau devis sans cache. Si le tarif ou les frais changent, présenter ce nouveau récapitulatif et demander un nouveau clic. Si le séjour est refusé ou non vérifié, retirer les actions. Ensuite seulement charger l'iframe vers `/reservation/{slug}`, qui effectue toujours sa revalidation serveur existante avant la redirection GuestLucky. Conserver le repli dans un nouvel onglet vers cette même route protégée. L'iframe reste ouverte à l'expiration du devis pour ne pas interrompre un parcours déjà commencé ; toute modification des critères la retire. Le mode diagnostic n'affiche jamais d'action de réservation.

Validation reproductible : `node tests/browser/booking-journey.cjs` utilise Playwright et Chrome déjà présents, sur l'application locale (`ROAMING_BROWSER_URL` optionnel). Toutes les API, toutes les routes de réservation et tous les popups sont interceptés au niveau du contexte ; les autres domaines sont bloqués. Les scénarios couvrent refus 422, panne, état non vérifié, fermeture, absence de résultats, minimum, capacité, changements de critères, devis périmés, annulation, tarif modifié, revalidation, module à la demande, repli, Turbo et 12 combinaisons FR/EN, clair/sombre, 1440/390/320 px. `ROAMING_BROWSER_SCREENSHOTS=1` enregistre des captures de travail dans `var/phase3-*.png`. Ces simulations ne certifient pas l'état réel du fournisseur ni le fonctionnement d'un paiement ; aucune réservation réelle n'est effectuée.

## Choix du logement sur les disponibilités

`/disponibilites` propose deux étapes. Sans slug actif valide, les trois cartes affichent leurs photos locales via `_picture.html.twig`, le nom sur un dégradé lisible et « Voir les disponibilités ». Une fiche sans photo garde un fond turquoise et son propre libellé « Photos à venir ». Trois colonnes sur ordinateur, deux sur tablette et une sur mobile ; effets de zoom/élévation et apparition désactivés avec `prefers-reduced-motion`.

Le choix et « Changer de logement » utilisent les visites Turbo et les URLs existantes, sans nouveau système de calendrier ni chargement GuestLucky pendant le choix. Seuls les deux mois du logement sélectionné sont lus. Un lien profond avec slug valide ouvre le planning ; un slug inconnu revient au choix. Les liens portent `data-booking-slug` ou `data-booking-reset-property` pour transmettre les dates/voyageurs/langue tout en choisissant ou retirant explicitement le slug. Le lien Disponibilités du menu revient toujours aux cartes. Focus sur le titre de l'étape, historique navigateur conservé, devis et modale invalidés par le cycle Turbo existant ; les critères incompatibles restent soumis à la validation partagée.

Le bouton « Effacer les dates » / « Clear dates » réutilise `components/_clear_dates.html.twig` sur l’accueil et les plannings. Sous les champs ou près de la validation, il possède une bordure discrète, un fond secondaire du thème, une icône décorative et une cible de 44 px. Il est désactivé sans date, reste indépendant du fieldset de chargement et efface dates/devis/module en conservant logement et voyageurs. Le focus revient au déclencheur sur l’accueil et à l’arrivée active sur le planning.

Validation locale reproductible : `node tests/browser/availability-choice.cjs` avec les API et réservations simulées, zéro trafic fournisseur ; compléter avec `booking-journey.cjs` pour les règles et le module.

## Module de réservation en modale

Sur l'accueil, les fiches et les disponibilités, le composant partagé de devis ouvre désormais un `<dialog>` natif après la même revalidation du séjour. La modale est centrée, jusqu'à 1280 px de large (96 % de la fenêtre), et occupe 92 % de sa hauteur ; sous 576 px, elle prend tout l'écran avec une hauteur dynamique `100dvh`. L'iframe remplit l'espace disponible entre l'en-tête et le lien de secours, sans hauteur fixe de 900 px.

L'en-tête rappelle le logement et le séjour et présente une fermeture de 44 px. Le fond devient inerte, son défilement est bloqué, le focus entre dans la modale ; fermeture par bouton ou Échap avec retour au déclencheur. Un changement de critères, un nettoyage des devis ou une mise en cache Turbo ferme et détruit le module, puis libère le défilement. Le repli dans un nouvel onglet reste accessible dans la modale et sur le devis, via la route locale protégée. Aucun chargement automatique du module ni modification du verrou de publication.

## Finitions et images (phase 4, 10 octobre 2026)

Les sections restent visibles sans JavaScript ; les effets `.reveal` ne masquent plus le contenu avant son observation. Le lien d'évitement place explicitement le focus sur `main-content` avec Turbo. Les menus s'ouvrent par leur commande Bootstrap, se ferment par Échap et rendent le focus à leur déclencheur. `site_shell_controller.js` possède les événements globaux, instances Bootstrap et frame de défilement pour une seule visite ; il les libère à la déconnexion. Les liens vers À propos et les changements de langue conservent aussi les critères du séjour.

Sur une surface sombre, les textes turquoise utilisent `--roaming-dark-accent: #5EEAD4`, y compris les sections `.bg-dark` en thème clair. Les CTA conservent exactement `#0F766E` et `#115E59`. Les formulaires de contact de l'accueil et de la page dédiée partagent `_contact_form.html.twig` : labels FR/EN, autocomplete, erreurs liées au champ, message accessible et réponse HTTP 422 pour une soumission invalide. Le jeton CSRF et le traitement existant sont conservés.

`components/_picture.html.twig` ajoute des sources WebP avec `srcset`, `sizes` et dimensions intrinsèques, à partir de `public/images/responsive/manifest.json`. Le JPEG/PNG original reste le repli ; une image absente du manifeste fonctionne sans conversion. Les 41 photos des logements actifs ont des dérivés locaux de 320/640/960/1440 px, sans agrandissement. L'image principale est prioritaire ; cartes, photos suivantes et miniatures sont différées. Aucun visuel n'est créé pour Croix.

Régénération facultative : `php -d extension=gd bin/generate-responsive-images.php`, à partir des clés du manifeste ; un argument JSON peut fournir une liste de noms de fichiers réels dans `public/uploads`. Cette commande écrit uniquement les dérivés et le manifeste, sans réseau ni modification des originaux ou du catalogue. De nouvelles photos gardent leur repli original jusqu'à une génération explicite.

Les métadonnées utilisent des canoniques sans critères de séjour et des URLs FR/EN réellement interprétées via `_locale`. Le sitemap publie leurs alternates et seulement les dates de modification connues. Les pages de diagnostic, de réservation fermée et les erreurs ne doivent pas être indexées. Les valeurs JSON-LD passent par `json_encode(15)` ; ne pas construire des chaînes JSON avec un échappement JavaScript ou ajouter des avis/prix non confirmés.

Le rapport [AUDIT_FINAL.md](AUDIT_FINAL.md) décrit les contrôles navigateur à 320/390/768/1024/1440 px et leurs limites. La conformité WCAG et les Core Web Vitals réels nécessitent encore une validation dans l'environnement cible.

## Accessibilité et interactions

Sur l’accueil, les panneaux de recherche s’ouvrent sous leur champ sur ordinateur : la page défile si nécessaire et le panneau reste défilable dans la hauteur disponible, sans placement au-dessus. Sur mobile, ils gardent leur présentation en bas de l’écran. Le choix du logement utilise une surface native `dialog` aux couleurs du thème, des options de 48 px, une sélection turquoise et la navigation clavier (flèches, Début/Fin, Entrée, Échap). Le select masqué conserve les valeurs et métadonnées réelles utilisées par la recherche ; changer de logement invalide toujours dates et devis.

- Cibles des commandes principales d'au moins 44 px de haut. Focus clavier visible : contour turquoise de 3 px ; ne pas le supprimer.
- Légendes textuelles, noms accessibles incluant logement/date/état, titres de lignes et de colonnes du tableau.
- Messages de lecture et de devis dans des régions `aria-live="polite"`. Une erreur supprime les disponibilités confirmées et invalide le devis précédent.
- Respecter `prefers-reduced-motion`. Éviter les animations qui cachent les informations utiles.
- Chaque ajout de texte existe en français et en anglais (`translations/messages.*.yaml` pour Twig et dictionnaire de `assets/booking-ui.js` pour les interactions).
- Avec Turbo, attacher les événements via Stimulus ; annuler requêtes et timers à la déconnexion. Aucun nouveau timer sur une prévisualisation Turbo.

## Vérification avant livraison

1. Compiler `npm run build` et vérifier que CSS/JS sont servis avec leur type réel, pas du HTML.
2. Vérifier les deux thèmes à 1440 px, puis à 390 et 320 px ; ouvrir aussi une fiche logement quand le composant est partagé.
3. Vérifier chargement, succès, absence de données, panne, verrou public et sélection, avec focus clavier visible.
4. Vérifier FR/EN, prix longs, nom de logement long, logement sans photo et navigation Turbo.
5. Faire évoluer ce document si une règle visuelle commune change ; ne pas multiplier des palettes propres à chaque page.

Captures de validation locale de cette refonte : `var/guestlucky-browser/redesign-*.png` (fichiers de travail non versionnés).
