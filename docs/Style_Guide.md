# Style Roaming Lille

Les apparitions de page utilisent `page_reveal_controller.js` : fondu et remontée de 22 px sur 1 150 ms, avec décalage progressif plafonné à 340 ms à l’arrivée et 300 ms par groupe au défilement. Chaque bloc apparaît une seule fois par visite, sous contrôle d’un `IntersectionObserver`. Le conteneur principal ne se déplace pas ; pour cette seule apparition, header, formulaires, dialogues, carrousel et zones fixes utilisent un fondu qui préserve leur placement. Le réglage système de mouvement réduit conserve un fondu de 750 ms sans déplacement. Les ouvertures de recherche et les déplacements de carrousel déclenchés par l'utilisateur ont leurs propres règles, décrites plus bas. Les effets n’empêchent pas les interactions ; clic ou focus termine immédiatement l’apparition du bloc concerné. Les animations sont libérées après lecture et toutes les zones sont rendues visibles avant cache Turbo et à la déconnexion. Le contenu reste visible sans JavaScript et à l’impression ; les pages restaurées depuis le cache conservent leurs blocs déjà révélés.

Les commandes et blocs contenant des liens utilisent également un fondu sans déplacement, pour rester sous le pointeur entre l’appui et le relâchement du clic. Les cartes suivent la même règle. Les anciens délais CSS sont neutralisés pour les blocs révélés : le contrôleur applique déjà les décalages d’apparition et le focus doit rendre un formulaire visible immédiatement.

Les pages `/mentions-legales`, `/politique-de-confidentialite` et `/cookies` reprennent les surfaces du thème, titres sobres, onglets de navigation et encarts à bordure fine. Liens légaux dans le pied de page public et équipe. « Cookies » ouvre un dialogue natif aux couleurs du site avec deux choix indépendants (GuestLucky et carte), deux actions globales de même style et taille et un bouton pour enregistrer les choix individuels, sans bandeau automatique à l’arrivée. Le contact affiche une information avant l’envoi. Voir `docs/Mentions_legales_et_confidentialite.md` pour le contenu, les champs à finaliser et les contrôles techniques.

Référence pour les pages existantes et futures. Direction artistique mise à jour le 23 octobre 2026 à partir de `assets/styles/app.css`, `assets/styles/hospitality.css`, `assets/styles/hospitality-pages.css`, `templates/base.html.twig`, de l'accueil et des fiches logements. Vérifier cette référence avant d'introduire de nouvelles couleurs ou composants. Les sections fonctionnelles ci-dessous restent applicables ; les mentions de phases datent les parcours, pas des palettes à reprendre.

## Identité

ROAMING présente les logements avec une direction chaleureuse et éditoriale : fonds ivoire et lin, texte brun, accents terre cuite, titres à empattements et photographies du catalogue local. Les images, les proportions des sections et la hiérarchie des actions portent l'identité autant que les couleurs. Aucun logement, équipement ou avantage commercial n'est inventé pour remplir une composition.

Le **thème clair est le défaut**, même si le système préfère le sombre. Une préférence explicite `light` ou `dark` stockée sous `localStorage.theme` est conservée et appliquée via `html[data-bs-theme]` avant le rendu, puis à chaque navigation Turbo. Le stockage indisponible ne bloque pas l’interface.

DM Sans variable (graisses 100–1000) est conservée dans `public/fonts/dm-sans-variable.ttf`, avec sa licence OFL, puis émise par Encore sous un nom versionné dans `public/build/fonts`. Le préchargement Twig et le CSS utilisent le même fichier via le manifeste. Un seul `@font-face` global et `font-display: swap` ; pile de repli système `sans-serif`. Aucun appel à un service de polices au chargement.

**DM Sans** reste la police des textes, champs, boutons et informations pratiques. Les grands titres éditoriaux utilisent `--roaming-display-font: Georgia, 'Times New Roman', serif` : une pile système locale sans téléchargement supplémentaire. Conserver cette distinction à travers l'accueil, les fiches, À propos et Contact ; les titres des dialogues et commandes restent sobres et lisibles en sans-serif.

Le header et le footer communs de `base.html.twig` conservent les logos, liens, langues et contrôles existants, dans une composition affinée. Le pied de page commence par une invitation à choisir un séjour puis propose la navigation et les informations de contact. Composer les nouvelles pages avec le conteneur Bootstrap existant et les tokens partagés. Ne pas ajouter un autre framework CSS ni une police spécifique à une seule page.

## Palette Roaming

| Usage / variable CSS | Clair | Sombre |
| --- | --- | --- |
| Fond `--roaming-bg` / `--bs-body-bg` | `#F8F4EC` | `#211D1A` |
| Texte `--roaming-text` / `--bs-body-color` | `#322A27` | `#F5EDE2` |
| Texte secondaire `--roaming-muted` | `#71645B` | `#C7B7A7` |
| CTA `--roaming-primary` | `#9C4934` / blanc | `#9C4934` / blanc |
| Survol CTA `--roaming-secondary` | `#783925` / blanc | `#783925` / blanc |
| Liens `--roaming-accent` / `--teal-primary` | `#9C4934` | `#F0B59D` |
| Carte/champ `--roaming-card-bg` / `--card-bg` | `#FFFCF7` | `#2D2622` |
| En-tête `--roaming-header-bg` | Fond de page `#F8F4EC` | Surface `#2D2622` |
| Section alternée `--section-alt-bg` | `#EEE4D5` | `#372D26` |
| Bordures `--roaming-border` | `#DCCFC0` | `#574A40` |

Les tokens `--roaming-*` sont la source commune ; les variables Bootstrap et les noms historiques `--teal-*` sont des alias de compatibilité, sans obligation de conserver du turquoise. Les CTA gardent le primaire terre cuite profond dans les deux thèmes ; les liens sombres utilisent l'accent pêche clair. Les champs, devis et calendriers suivent les surfaces et textes du thème, avec leurs états fonctionnels existants.

Navigation et fond de page partagent l'ivoire clair, les cartes utilisent une surface légèrement plus lumineuse et les sections alternées une teinte lin. Le thème sombre reprend la même hiérarchie avec des bruns profonds. La photo du logement actif reste naturelle ; les voisines du carrousel sont légèrement réduites et atténuées pour indiquer la sélection. Les dégradés en bas de photo assurent la lisibilité des légendes. Les bordures fines et ombres douces séparent les surfaces ; éviter les halos saturés et l'accumulation de cartes imbriquées.

`--page-backdrop` et `--hero-gradient` suivent le fond du thème, sans grand dégradé turquoise. Employer les accents pour les actions, liens et petits repères, avec des états normal, survol, focus et désactivé explicites. Le moteur distant GuestLucky conserve sa configuration propre, documentée plus bas : ses anciennes couleurs ne sont pas une palette à appliquer au site local.

## Composition et typographie

### Principes communs

Le conteneur commun atteint 1 480 px au maximum ; ses gouttières suivent `clamp(20px, 4vw, 64px)`. La page Disponibilités utilise un conteneur dédié de 1 680 px maximum, avec des gouttières `clamp(20px, 3vw, 48px)` pour élargir le couple carrousel/carte. Conserver l'alignement des titres, photos, recherche et contenu d'une section à l'autre. L'espacement principal suit `--roaming-section-space: clamp(48px, 6vw, 88px)`.

- Un titre H1 par page, une introduction courte, puis le contenu principal. Les sous-sections utilisent H2 puis H3.
- Les grands titres éditoriaux en Georgia ont une graisse modérée et un interlignage serré ; leur taille s'adapte à la largeur. Les informations pratiques restent en DM Sans, autour de 16 px avec interligne 1,5–1,75.
- Surtitre optionnel : bref, de petite taille, en capitales espacées et dans l'accent du thème.
- Espacements internes sur une base de 4/8 px ; laisser plus d'air entre les grandes séquences qu'entre leurs éléments.
- Arrondis cohérents autour de `--roaming-radius: 20px` sur les grandes surfaces ; contrôles et petites cartes plus discrets. Bordures fines et ombres peu contrastées.
- Les images ont un ratio stable et `object-fit: cover`. Une image décorative accompagnant le nom du logement a `alt=""`. Un logement sans photo reçoit un visuel neutre, jamais la photo d'un autre logement.
- Les actions principales mesurent au moins 44 px de haut. Le focus clavier conserve un contour visible de 3 px dans l'accent du thème.

### Accueil et header

Les sélecteurs de dates, logement et voyageurs de l’accueil utilisent des dialogues natifs dans la couche supérieure : ouverture sous le formulaire sur desktop, surface basse sur mobile. Le panneau est mesuré et positionné avant `showModal`, puis le focus est placé avec `preventScroll` pour éviter le saut natif. Après le déploiement du guide, seule la premi?re ouverture directe peut recentrer la barre, avec un scroll doux, si son centre d?passe le milieu de la zone utile de plus de 10 % de cette zone. Une barre d?j? au milieu ou plus haut reste en place ; les ?tapes suivantes et les r?ouvertures ne d?placent plus la page. Le panneau se déploie toujours dessous sur ordinateur, avec une hauteur limitée et un défilement interne. Aucun alignement contre le header. La hauteur des panneaux reste bornée au viewport avec défilement interne. Fermeture par clic extérieur, Échap, croix ou validation, avec restitution du focus ; fermeture avant la mise en cache Turbo. Le calendrier compact Flatpickr et ses règles sont conservés. Le choix du logement utilise des options aux couleurs du thème et conserve un select masqué comme source des critères.

Le menu Bootstrap des logements garde ses entrées dynamiques, avec carte aux couleurs du thème, titres multilignes et défilement pour les longues listes. Les contrôles thème, langue et séjour ont une hauteur de 44 px ; le CTA utilise le primaire Roaming. Le groupe de langue mesure 44 px, avec segments internes de 36 px. À 320 px, le CTA peut occuper une seconde ligne dans le menu mobile.

Les pictogrammes des atouts (Wi-Fi, clé, tasse, lit, mallette et étiquette) sont centralisés dans `templates/components/_amenity_icon.html.twig`, partagé par l'accueil et la page À propos. Utiliser un SVG de 24 × 24, un trait de 1,8, des extrémités arrondies et `currentColor`. Le support de l'accueil mesure 48 × 48 et ne rétrécit pas dans les lignes flex. Ces icônes accompagnent un libellé : elles sont décoratives (`aria-hidden="true"`, `focusable="false"`).

### À propos et Contact

`assets/styles/hospitality-pages.css` applique les mêmes tokens aux deux pages. À propos associe son titre à une photo identifiée du catalogue, puis présente le récit en colonnes, les atouts sur fond lin et trois principes numérotés. Le récit et les groupes se réorganisent en une colonne sur mobile ; aucune photo de remplacement n'est inventée si le catalogue n'en fournit pas.

Contact associe l'introduction, les coordonnées cliquables et jusqu'à deux aperçus des logements à un panneau de formulaire plus lumineux. Les deux colonnes s'empilent sous 992 px ; nom et e-mail se partagent une ligne sur les grands écrans et retrouvent leur ordre vertical sur mobile. Le formulaire partagé, ses validations, ses messages, le CSRF et les mentions de confidentialité restent ceux de l'application.


## Planning partagé

Source : `templates/calendar/_planning.html.twig`, `assets/controllers/calendar_controller.js` et le bloc CSS « Roaming planning » de `assets/styles/app.css`. Les pages globale, test et logement réutilisent ce composant.

| État | Fond / texte clair | Fond / texte sombre | Indice autre que la couleur |
| --- | --- | --- | --- |
| Disponible | Surface du panneau / texte principal | Surface du panneau / texte principal | Date et prix par nuit |
| Indisponible | Surface du panneau / texte secondaire atténué | Surface du panneau / texte secondaire atténué | Date barrée |
| Non vérifié | Surface du panneau / texte secondaire | Surface du panneau / texte secondaire | Point d'interrogation et bouton désactivé |
| Date passée | Surface du panneau / texte secondaire atténué | Surface du panneau / texte secondaire atténué | Date barrée, sans prix, bouton désactivé |
| Nuits sélectionnées | Teinte légère de l'accent / texte du thème | Teinte légère de l'accent / texte du thème | Bande continue entre arrivée et départ |
| Arrivée / départ sélectionnés | Primaire terre cuite / blanc | Primaire terre cuite / blanc | Bordure et `aria-pressed` |

Les variables `--cal-*` sont limitées au composant. La couleur n'est jamais l'unique indication. Les dates passées ne paraissent pas réservables ; les prix ne sont pas affichés comme une promesse sur ces dates. Les nuits occupées et les erreurs fournisseur restent deux états distincts. Une date indisponible peut servir de départ, puisque la nuit du départ est exclue du séjour.

La page Disponibilités affiche le planning d'un seul logement après l'étape de choix décrite plus bas. La fiche logement utilise le même composant sans afficher le sélecteur. Deux mois consécutifs sont présentés en grilles de sept jours : le mois courant et le suivant à l'ouverture, puis navigation d'un mois à la fois. Ils sont côte à côte lorsque le composant dépasse 480 px de large, empilés sinon (requêtes de conteneur CSS, pour respecter aussi la colonne d'une fiche).

Les champs arrivée/départ sont regroupés en haut, avec le nombre de nuits et le minimum de séjour après choix d'une arrivée. Le lien « Effacer les dates » remet le séjour à zéro. Une arrivée et un départ sont mis en évidence par des pastilles dans le primaire ; les nuits intermédiaires forment une bande claire. Aucun tableau horizontal multi-logements ni liste déroulante redondante de logements. Les commandes principales restent accessibles au clavier ; les flèches du clavier parcourent les jours activés du calendrier visible.

Les prix des cases évitent les décimales inutiles (`119 €`) pour rester lisibles sur mobile. Le devis conserve les montants détaillés. Les tarifs les plus longs doivent être vérifiés à 320 px.

Le module de réservation GuestLucky peut s'ouvrir après le devis dans la modale décrite plus bas. Le cadre et ses commandes suivent Roaming ; l'intérieur conserve le style GuestLucky, car il est servi sur un autre domaine. Conserver un lien de repli « Ouvrir dans un nouvel onglet ». Ne charger l'iframe qu'à la demande et après revalidation du séjour.

### Identité visuelle GuestLucky — configuration externe existante

Le Booking Engine GuestLucky reste indépendant de la refonte locale. Les valeurs ci-dessous documentent sa configuration externe existante et ne définissent pas la palette du site Roaming. Le moteur doit rester en thème clair tant qu'il force son en-tête, certaines cartes et les champs en blanc dans son CSS généré. Une configuration sombre produirait des contrastes incohérents.

| Champ GuestLucky | Configuration documentée | Usage |
| --- | --- | --- |
| Nom de marque | `Roaming Lille` | Remplace « Mathis » dans l'en-tête et le pied de page |
| Police | `DM Sans` | Même police que l’interface Roaming |
| URL du logo | `https://roaminglille.com/images/logo-footer-black.png` | Logo noir sur l'en-tête clair |
| URL du favicon | `https://roaminglille.com/images/logo-footer-black.png` | Icône adaptée au fond clair du moteur |
| Primaire | `#0F766E` | Boutons, dates sélectionnées et liens ; contraste blanc 5,47:1 |
| Secondaire | `#115E59` | Actions secondaires ; contraste blanc 7,58:1 |
| Fond | `#F8F9FA` | Fond général clair propre au moteur distant |
| Texte | `#212529` | Texte principal, contraste élevé sur fond clair |
| Fond des champs | `#FFFFFF` | Champs de formulaire |
| Texte des champs | `#212529` | Valeurs et saisies |
| Fond des cards | `#FFFFFF` | Calendrier, informations et récapitulatif |
| Texte des cards | `#212529` | Texte des cartes |

Ne pas utiliser `#0D9488` pour le bouton principal GuestLucky : son texte est forcé en blanc et le contraste obtenu (3,74:1) est trop faible pour du texte courant. Le primaire `#0F766E` garde l'identité turquoise avec un contraste AA.

Ces valeurs documentent la configuration existante du moteur, sans la modifier depuis le site. Le CSS local harmonise le contenant et ne peut pas modifier l’intérieur de l’iframe. La configuration des clés d’encaissement reste indépendante : ne pas annoncer le paiement disponible sur cette seule base. Les URLs de logo ci-dessus répondaient HTTP 200 le 28 septembre 2026.

## Accueil et navigation

Le hero associe un texte éditorial à gauche et une grande photographie à droite sur ordinateur ; les deux parties s'empilent sur mobile. La photographie vient du premier logement actif ayant une image, et sa légende permet d'ouvrir la fiche correspondante. À défaut de photo, conserver un fond neutre sans photo empruntée. Image prioritaire, photos des cartes différées, ratios stables. Le formulaire de recherche occupe la largeur du conteneur sous le hero ; la hiérarchie reste logement, dates, voyageurs et recherche.

La sélection à l'ancre `/#featured` présente tous les logements actifs dans un carrousel centré : quatre logements dans le catalogue local actuel, sans limite ni identifiant codé dans les templates. Les logements photographiés apparaissent en premier ; les fiches sans photo gardent une surface neutre annoncée « Photos à venir », jamais la photo d'un autre logement. Chaque carte donne une grande place à la photo, puis à la ville, au nom, aux informations disponibles et aux actions. Le carrousel précède les atouts et le contact. La recherche conserve son contrat dates/voyageurs ; son maximum de voyageurs vient des capacités actives.

Navigation repliée sous 1200 px, liens actifs, lien d’évitement, boutons de sélecteur accessibles au clavier, état `aria-expanded`, fermeture par Échap et résultats `aria-live`. Les dialogues de recherche sont placés en bas de l'écran sur mobile. Les animations et leurs exceptions explicites sont décrites dans ce guide ; le contenu d’accueil reste visible sans JavaScript. Tous les nouveaux libellés existent en FR/EN.

Si la publication est désactivée, afficher une explication et un contact utilisable. Ne pas présenter un tableau entièrement gris et un formulaire inactif comme écran principal. Le lien vers le diagnostic et les explications techniques sont réservés au développement.

## Catalogue et fiches (phase 2, 10 octobre 2026)

### Carrousel partagé et recherche guidée

L'accueil utilise `home/_property_showcase.html.twig`, `home/_showcase_card.html.twig` et `property_showcase_controller.js`. Le logement actif est centré et plus grand, avec une photo dominante et les actions clairement séparées. Le slug actif de l'URL est respecté ; à défaut, le premier logement photographié est sélectionné. Les suggestions des fiches conservent le composant `templates/components/_property_card.html.twig`.

`calendar/_property_explorer.html.twig` utilise le même contrôleur pour le choix de logement sur Disponibilités. Les deux carrousels proposent flèches, choix de ville, indicateur de position et nom du logement actif, clic sur une voisine, glissement horizontal et clavier (flèches, Début/Fin), sans défilement automatique. Les commandes mesurent au moins 44 px. Les villes restent sur une seule ligne dans un rail horizontal borné : le catalogue peut grandir sans repousser les flèches hors du viewport. Seul le choix actif est dans l'ordre de tabulation ; le clavier parcourt les autres. Le contrôleur garde ce choix visible en défilant uniquement le rail, y compris après un redimensionnement, sans déplacer la page. Les liens des cartes inactives sont inertes. Sans JavaScript, les fiches et leurs liens restent disponibles dans une grille.

Le déplacement suit continûment le pointeur, puis une projection de vitesse et un ressort à amortissement critique, avec interruption et boucle continues. La carte active passe d'une échelle de 0,88 à 1 ; la rotation des voisines est limitée à 3° et leur voile à 25 %, avec une ombre chaude discrète. Aucun redémarrage brutal lors d'un geste inversé ou d'une commande pendant le mouvement. Avec `prefers-reduced-motion`, les déplacements explicitement demandés restent lisibles mais se terminent plus vite ; rotation et changement d'échelle sont supprimés. Les gestes verticaux conservent le défilement de page ; animations arrêtées à la déconnexion et calées avant cache Turbo. `tests/browser/showcase-motion.cjs` couvre les déplacements, l'inertie, l'interruption, la boucle, le toucher natif et la préférence réduite.

### Ouverture du parcours de recherche

Les sélecteurs de logement, dates et voyageurs de l'accueil utilisent `animateSearchSurface` dans `assets/ui-motion.js`. L'ouverture dure 300 ms avec un déploiement discret : opacité, perspective de 1 000 px, rotation initiale de −5°, translation verticale de −8 px, échelle de 0,985 et masque inférieur de 10 %, puis retour à la surface entière. L'origine en haut du panneau et l'easing `cubic-bezier(.22, 1, .36, 1)` donnent une sensation d'ouverture progressive. La fermeture dure 150 ms ; le dialogue natif est réellement fermé et le focus rendu après l'animation. En préférence réduite, seul un fondu de 100 ms est utilisé.

Un changement d'étape termine la fermeture du panneau précédent avant d'ouvrir le suivant : un seul dialogue modal reste actif. Les fermetures en cours peuvent être annulées ou finalisées, sans callback ancien qui déplace ensuite le focus. Le guide déploie sa hauteur sur 300 ms à sa première apparition, ou un fondu de 100 ms en préférence réduite. Placement et hauteur disponible utilisent les dimensions de mise en page, indépendantes de la transformation visuelle ; un `ResizeObserver` suit le déploiement. Le nettoyage Turbo annule les animations et ferme immédiatement les dialogues. Les tests de fermeture doivent attendre `dialog.open === false` et le retour effectif du focus, plutôt qu'imposer une fermeture synchrone.

Le formulaire d’accueil suit l’ordre logement, dates, voyageurs et recherche dans le DOM, au clavier et visuellement. Ouvrir le sélecteur de logement lance le guide à l’étape 1. Confirmer une option ouvre directement les dates à l’étape 2, y compris « Tous les logements » ou l’option déjà sélectionnée. Changer de logement efface les anciennes dates et borne le nombre de voyageurs à sa capacité pour garder le calendrier utilisable. Fermer le choix sans confirmer annule le guide. « Choisir un séjour » sur une carte conserve le logement explicitement choisi, annule les anciens devis, efface les dates et ramène en douceur au formulaire, directement à l’étape 2. Après validation des dates, le guide ouvre les voyageurs à l’étape 3, puis donne le focus au vrai bouton « Rechercher » à l’étape 4 ; celui-ci est ramené à l'écran si nécessaire.

Le projecteur accompagne le guide avec un fondu d'entrée de 240 ms et de sortie de 140 ms, ramenés à 100 ms en préférence réduite. La barre de recherche, le header et son menu ouvert restent hors du voile ; les dialogues natifs passent dans la couche supérieure. La géométrie des ouvertures est recalculée à chaque frame pour suivre les limites réelles pendant le défilement et les changements de dimensions. Aucun bouton n'est copié et les liens restent utilisables. Le voile et ses animations sont retirés avant cache Turbo et à la déconnexion.

À l'étape 4 seulement, le bouton de recherche utilise une pulsation Web Animations à 106 %, sans modifier les dimensions de mise en page. Elle conserve un cycle plus lent et une variation de luminosité plus faible en préférence réduite. Elle se suspend au survol pour stabiliser la cible du clic et reprend lorsque le pointeur quitte le bouton. Elle est annulée lors de la recherche, d’un clic ailleurs, d’un changement de focus, d’Échap, de la fermeture du guide ou d’une navigation Turbo. Aucun devis n’est lancé avant un clic volontaire. Fermer le panneau voyageurs par sa croix ou par clic extérieur passe aussi à l’étape 4 si les dates sont valides. Le compteur reste borné à la capacité réelle du logement ; disponibilité, minimum de nuits et validation du devis restent partagés. Le sélecteur de logement conserve son dialogue et son nom accessible, sans le caractère décoratif « ⌄ » après le nom sélectionné.

Styles du carrousel et du guide : `assets/styles/property-showcase.css`, harmonisés par `assets/styles/hospitality.css`. Libellés : namespace `showcase`, en français et en anglais. Événement interne : `booking:guide`, avec un slug validé contre les options réelles du formulaire. Les ancres conservent un lien vers le formulaire avec slug en repli sans JavaScript ou en nouvel onglet. Vérifier annulation, panne, absence de JavaScript, thèmes, langues, mobile et catalogue étendu ; `tests/browser/property-showcase.cjs` et `tests/browser/hospitality.cjs` couvrent ces parcours, les contrôles et les surfaces animées, avec réponses fournisseur simulées.

### Défilement vers les sections

`assets/ui-motion.js` fournit le défilement partagé par les ancres de la page et le retour au formulaire depuis une carte. Une seule boucle `requestAnimationFrame` est active ; l'easing quintique accélère et ralentit progressivement sur une durée de 320 à 800 ms selon la distance. La position d'arrivée tient compte de la hauteur réelle du header fixe et d'une marge de 20 px par défaut. Depuis une carte, le formulaire est centré dans la zone utile, après déploiement de son guide. Une ouverture directe d'un champ recentre aussi le formulaire, même s'il est déjà visible. Les liens conservent leur ancre et l'historique. À la fin d'un défilement d'ancre réussi, le focus rejoint le titre ou la cible sans provoquer un second déplacement.

Une nouvelle demande, la molette, un geste tactile, l'appui du pointeur, Tab, une touche de déplacement ou un redimensionnement du viewport annule le mouvement en cours, y compris l'attente du déploiement du guide. Le guide n'ouvre pas ensuite un panneau si son retour au formulaire a été interrompu ; une navigation clavier ne doit pas se voir reprendre le focus à la fin du scroll. La déconnexion et les événements Turbo annulent les callbacks ; aucune ancienne demande ne doit déplacer le focus sur une autre page. En préférence réduite, les ancres ordinaires restent immédiates ; exception explicitement demandée pour la recherche : un recentrage nécessaire dure 220 ms et ne téléporte jamais le formulaire. Le lien d'évitement conserve une arrivée immédiate. Le petit défilement du rail de villes reste indépendant de celui de la page.

### Contenu du catalogue et fiches

Le catalogue conserve son emplacement et son ancre `/#featured`. Les cartes du carrousel exposent la ville et la capacité ; les fiches et suggestions détaillent les chambres, lits et salles de bain avec `_property_facts.html.twig`. Les valeurs non renseignées ne sont pas présentées comme des équipements confirmés. Les descriptions, photos, notes et équipements proviennent des relations locales des logements actifs. Aucun logement, tarif ou contenu de remplacement n’est inventé.

Les fiches utilisent les mêmes tokens et la même distinction typographique : grandes photos, titres éditoriaux, surfaces du thème, bordures fines et CTA primaires. Sur ordinateur, une mosaïque associe une photo principale sur deux tiers de la largeur et jusqu'à deux aperçus cliquables sur le tiers restant. Sur mobile, la galerie principale et ses miniatures gardent une présentation compacte. Le carousel Bootstrap existant assure le tactile et les flèches du clavier, avec commandes de 48 px et miniatures défilantes nommées. Le petit contrôleur Stimulus `property_gallery_controller.js` initialise et libère les instances à chaque visite Turbo, sans défilement automatique, et garde la miniature active visible. Une seule photo n’affiche pas de commandes inutiles ; sans photo, une surface neutre de hauteur limitée explique l’absence de visuel. Les images principales sont prioritaires, les miniatures et cartes différées.

Les équipements affichent toujours leur libellé, avec icône décorative si renseignée. Sans équipement, présenter une explication et un contact. Les sections descriptives vides sont omises ; aucun texte générique ne prétend confirmer une cuisine, un parking ou une terrasse. La carte partagée indique l’adresse exacte et les coordonnées vérifiées du logement, avec un lien d’itinéraire.

Les ancres de section et le fil d’Ariane relient catalogue, fiche et disponibilités. Le planning existant est inclus une seule fois, sans modifier son Twig, son contrôleur Stimulus, son API ou ses règles. Il apparaît à côté des informations sur ordinateur, puis avant celles-ci sur mobile ; son dimensionnement en conteneur conserve les deux mois. Le lien « Choisir un séjour » mène au planning, sans promesse de réservation. Les suggestions excluent la fiche courante et utilisent uniquement `navProperties`, déjà filtré par le repository.

## Recherche et réservation (phase 3, 10 octobre 2026)

Le formulaire d'accueil conserve son sélecteur de dates Flatpickr et son compteur de voyageurs. Un choix facultatif de logement utilise uniquement les logements actifs locaux et leurs capacités. Dates, voyageurs et logement sont conservés dans les paramètres `arrivalDate`, `departureDate`, `guests`, `slug` de l'URL, via `assets/booking-state.js`. Le contrôleur Stimulus `booking_journey_controller.js` transmet ces critères aux liens du catalogue, des fiches, des disponibilités et du contact, y compris les liens copiés ou ouverts dans un autre onglet. La fiche impose son propre slug, conserve les dates et affiche leur mois. Aucune restauration de navigation ne rétablit un ancien devis ou une iframe.

Le calendrier partagé conserve ses deux mois, prix, flèches, raccourcis clavier et règle du départ exclu. Une modification des critères invalide immédiatement le devis et annule ses requêtes. Les séjours trop courts, surcapacité, nuits occupées ou nuits non vérifiées disposent d'un message explicite. Les mois du séjour saisi sont lus avant le devis frais fournisseur. Depuis le lot B, changer de logement dans le sélecteur d’accueil ou par « Changer de logement » efface les dates, le devis et le module, en conservant les voyageurs. Les lectures simultanées identiques sont évitées ; un calendrier déjà lu n'est pas relu pendant ses 60 secondes de fraîcheur. Le cache serveur existant reste inchangé.

### Calendriers et disponibilités — lot B

`assets/calendar-availability.js` centralise les nuits du séjour, la validation, la capacité, le minimum à l’arrivée, la sélection et le chargement des mois pour Flatpickr et le contrôleur Stimulus du planning. L’accueil charge sur demande le mois affiché et le suivant via les routes Symfony existantes. Le booléen public du verrou est exposé dans le HTML, sans clé : fermé, aucun calendrier ni devis n’est interrogé depuis l’accueil, et le contact reste disponible. L’ouverture, le mois et le retour de visibilité respectent cache/déduplication/annulation ; aucun appel au survol. Aucun nouveau moteur de rendu ni changement métier côté serveur.

Sans slug, une nuit confirmée ouverte sur au moins un logement actif est candidate à la recherche ; toutes confirmées fermées donnent une nuit indisponible ; absence de confirmation avec au moins un état inconnu donne « Non vérifié ». Un séjour est évalué intégralement sur chaque logement : jamais d’assemblage de nuits issues de logements différents. Aucune moyenne de prix n’est inventée ; seul le devis frais peut confirmer le séjour et son tarif.

« Départ uniquement » / « Check-out only » est contextuel : nuit confirmée occupée, arrivée déjà choisie, capacité et minimum respectés, toutes les nuits précédentes confirmées ouvertes sur un même logement. Le départ est exclu. La veille d’un blocage ne reçoit aucun état arbitraire. Marque ↗, libellé ARIA, titre et indication au survol/focus ; les nuits inconnues restent distinctes.

### Fiches logements — lot C

Les fiches activent uniquement la variante `compact` de `_planning.html.twig` et du contrôleur `calendar`. Le panneau présente le logement, « Réservez votre séjour », les deux déclencheurs de dates, le nombre de nuits, les voyageurs puis les actions. « Effacer les dates » se trouve immédiatement à gauche de « Vérifier le séjour », avant le résultat ; `/disponibilites` utilise le même groupe d’actions. Le devis compact évite de répéter le titre du logement et les dates déjà affichées dans les champs. Aucun tarif définitif sans devis ; aucune iframe sans clic et revalidation. Le select de voyageurs propose les capacités réelles du logement. La publication fermée laisse une explication et le contact, sans lecture API depuis cette variante.

À partir de 992 px, la colonne de réservation reste dans la hauteur disponible sous l’en-tête. Un devis long défile dans le panneau, sans allonger la page ni nécessiter le défilement de la colonne descriptive ; voyageurs et actions restent accessibles pendant ce défilement. Sur mobile, le panneau garde le flux normal de la page. Le contrôleur réutilise `SearchProgress`, comme l’accueil : pourcentage estimé en attente, 100 % après réponse, annulation et nettoyage dès qu’un critère change ou que Turbo quitte la page. Validation : `node tests/browser/booking-panel.cjs` (devis longs, défilement interne, placement des actions, progression et annulation, FR/EN, deux thèmes, 320 à 1440 px, aucune requête fournisseur réelle).

Deux mois sont rendus dans un dialogue natif fermé au chargement, placé près du champ sur desktop et adapté au viewport mobile (deux colonnes sur ordinateur, mois empilés sur mobile). Le contrôleur et les règles `CalendarAvailability` du lot B restent communs ; `/disponibilites` conserve son rendu étendu à deux mois avec tarifs. Les nuits, minimums, départ exclu et « Départ uniquement » suivent la même validation. Les tarifs indicatifs sont masqués dans la variante compacte ; la sélection seule ne demande pas un devis automatiquement. Le bouton « Vérifier le séjour » conserve le parcours existant.

La sélection peut modifier l’arrivée ou le départ, naviguer entre les mois et être validée avant fermeture. Échap, clic extérieur et croix ferment également ; focus restitué au champ déclencheur. La couche supérieure évite le clipping, limite la hauteur avec défilement interne, ne réserve aucun espace fermé et ne déplace pas le panneau. Nettoyage des dialogues et devis avant cache Turbo et à la déconnexion. Validation locale avec `node tests/browser/property-compact.cjs` (API et réservations simulées), puis les régressions A/B.

### Référence de mouvement des calendriers

La référence pour les interactions des jours reste le Flatpickr **inline** de l’accueil dans `#date-panel`. Son CSS `.animate.open` prévoit `fpFadeInDown 300ms cubic-bezier(0.23, 1, 0.32, 1)` pour un autre mode ; cette classe n’est pas active ici. Sélection/effacement, hover/focus des jours et navigation de mois sont immédiats (durée calculée 0 s, aucun déplacement). L'ouverture et la fermeture du dialogue d'accueil utilisent séparément l'animation de surface décrite plus haut : elles ne changent pas les règles ni le mouvement des jours. Seuls les chemins SVG des flèches Flatpickr changent de `fill` en 100 ms, easing `ease` ; les flèches des plannings reprennent ce timing sur leur couleur. Les hover/focus utilisent les surfaces secondaires du thème, les bornes le primaire et les plages une teinte légère de l'accent. Les contours de focus clavier des boutons restent accessibles.

L’aperçu de plage sur l’accueil est géré dans `booking-search.js` avec `CalendarAvailability.canDepart`, au survol et au clavier. Ne pas utiliser l’aperçu natif Flatpickr : il considère une date désactivée comme une nuit occupée, même lorsqu’elle est seulement trop proche pour être un départ. Cela ajoute à tort `notAllowed` aux départs suivants et supprime leur aperçu. Le rendu commun restaure les classes de plage, conserve les véritables jours désactivés et rend les nuits intermédiaires lisibles. Le déplacement du pointeur ne sélectionne aucune date et ne demande aucun devis. Les tests `minimum-stay.cjs` couvrent ce cas avec minimums de deux et trois nuits, départ sur une nuit occupée, déplacement du pointeur, sortie du calendrier et navigation au clavier.

Pendant une lecture des disponibilités, l’accueil et les plannings partagés affichent `_calendar_loading.html.twig` : trame de calendrier, icône, barre indéterminée dans l'accent et texte « Vérification des disponibilités ». Les couleurs viennent des variables Roaming ; `calendar-loading.css` adapte le composant aux deux thèmes et désactive ses mouvements avec `prefers-reduced-motion`. Les vrais jours restent dans le flux pour préserver la hauteur, mais sont invisibles et inertes ; les points d’interrogation sont réservés aux dates effectivement non vérifiées après la réponse. Le mois reste navigable et le dialogue peut toujours être fermé. Aucun délai artificiel ni pourcentage fictif ; le cache frais est utilisé immédiatement. Un ancien appel annulé ne peut masquer le chargement du nouveau mois. Une erreur restaure le message et le lien de contact, sans laisser un indicateur permanent. Validation avec réponses retardées, erreurs et navigation : `node tests/browser/calendar-loading.cjs` (session équipe locale si maintenance active).

Les plannings partagés et leur dialogue compact conservent ces interactions immédiates, sans reprendre le déploiement visuel des sélecteurs d'accueil ni animer l'entrée du planning étendu. Après choix de l’arrivée, le hover/focus d’un départ valide prévisualise instantanément la plage avec les mêmes couleurs : classes temporaires seulement, validation `canDepart` commune, aucune modification des dates ni requête de devis. Sortir du calendrier, changer de sélection ou naviguer efface cet aperçu ; les événements sont déclarés dans le composant Twig et gérés par Stimulus. Les animations des cartes et des surfaces de recherche restent indépendantes. `prefers-reduced-motion` supprime les transitions décoratives des jours ; les exceptions explicites du guide et du carrousel sont décrites plus haut. Contrôle comparatif local : `node tests/browser/calendar-motion.cjs`, avec API simulées, captures desktop/mobile et styles calculés comparés à l’accueil.

Validation : `node --experimental-vm-modules tests/browser/calendar-rules.cjs`, `node tests/browser/calendar-lot-b.cjs`, puis les suites `booking-journey.cjs`, `home-header.cjs` et `availability-choice.cjs`. Réponses fournisseur simulées et domaines externes bloqués ; aucune réservation ni lecture réelle GuestLucky.

`assets/booking-ui.js` fournit un récapitulatif commun à la recherche et au planning : logement, dates, voyageurs, nuits, total et frais non nuls réellement retournés. Les logements disponibles précèdent les autres. Les états « disponible », « indisponible » et « non vérifié » ont chacun leur libellé, sans dépendre uniquement de la couleur. Les cartes et messages suivent les tokens communs, avec surfaces ivoire en clair, surfaces brunes en sombre, grille de frais lisible et commandes d'au moins 44 px. Une publication fermée masque prix et actions de réservation, même si une réponse incohérente contient une ligne disponible, et propose le contact.

Un devis possède une durée d'utilisation locale de 60 secondes ; expiration, erreur, changement de critères ou de mois empêchent sa réutilisation. L'ouverture du module demande un nouveau devis sans cache. Si le tarif ou les frais changent, présenter ce nouveau récapitulatif et demander un nouveau clic. Si le séjour est refusé ou non vérifié, retirer les actions. Ensuite seulement charger l'iframe vers `/reservation/{slug}`, qui effectue toujours sa revalidation serveur existante avant la redirection GuestLucky. Conserver le repli dans un nouvel onglet vers cette même route protégée. L'iframe reste ouverte à l'expiration du devis pour ne pas interrompre un parcours déjà commencé ; toute modification des critères la retire. Le mode diagnostic n'affiche jamais d'action de réservation.

Validation reproductible : `node tests/browser/booking-journey.cjs` utilise Playwright et Chrome déjà présents, sur l'application locale (`ROAMING_BROWSER_URL` optionnel). Toutes les API, toutes les routes de réservation et tous les popups sont interceptés au niveau du contexte ; les autres domaines sont bloqués. Les scénarios couvrent refus 422, panne, état non vérifié, fermeture, absence de résultats, minimum, capacité, changements de critères, devis périmés, annulation, tarif modifié, revalidation, module à la demande, repli, Turbo et 12 combinaisons FR/EN, clair/sombre, 1440/390/320 px. `ROAMING_BROWSER_SCREENSHOTS=1` enregistre des captures de travail dans `var/phase3-*.png`. Ces simulations ne certifient pas l'état réel du fournisseur ni le fonctionnement d'un paiement ; aucune réservation réelle n'est effectuée.

## Choix du logement sur les disponibilités

`/disponibilites` propose deux étapes. Sans slug actif valide, tous les logements actifs défilent dans le carrousel à ressort partagé avec l'accueil : glisser continu, flèches, villes dans un rail borné, indicateur du logement actif et menu déroulant. Les cartes gardent leurs photos locales via `_picture.html.twig`, avec la ville, le nom, l'adresse réelle et « Voir les disponibilités » sur un dégradé lisible. Une fiche sans photo garde une surface du thème et « Photos à venir ». La carte interactive suit le logement actif et ses repères permettent aussi de changer de sélection.

La composition dédiée atteint 1 680 px de large, avec une introduction répartie entre titre et explication, puis le titre du choix et le sélecteur. À partir de 1 200 px, le carrousel occupe environ 46 % et la carte 54 % de la largeur utile. La surface cartographique et le plateau du carrousel mesurent 500 px de haut, puis 540 px à partir de 1 600 px ; les commandes du carrousel et l'adresse de la carte restent sous leurs visuels. De 992 à 1 199 px, les colonnes se partagent la largeur à parts égales. Sous 992 px, elles s'empilent ; la carte mesure 400 px sur tablette et 340 px sous 768 px. Les photos utilisent un `sizes` adapté aux nouvelles largeurs, sans agrandissement des fichiers source. Les contrôles de carte mesurent 44 px.

La carte partagée entre disponibilités et fiches logement indique les coordonnées vérifiées au numéro de rue. Elle voyage progressivement vers le logement choisi. Le fond pastel se charge près de la zone visible, sauf préférence de désactivation ; les choix de confidentialité restent disponibles. Adresse et bouton Itinéraire restent utilisables sans fond distant. Sur le planning choisi, le calendrier dispose d'environ 62 % et la carte de 38 % de la largeur utile, avec une surface cartographique de 420 à 520 px de haut. La carte est latérale et collante à partir de 1 200 px, puis passe sous le calendrier. Les proportions propres aux disponibilités sont limitées à `.availability-explorer` et `.availability-location-aside` dans `property-map.css` ; elles ne redimensionnent pas les cartes des fiches logement. Voir [Emplacements et cartes](Property_locations_et_cartes.md).

Le choix et « Changer de logement » utilisent les visites Turbo et les URLs existantes, sans nouveau système de calendrier ni chargement GuestLucky pendant le choix. Seuls les deux mois du logement sélectionné sont lus. Un lien profond avec slug valide ouvre le planning ; un slug inconnu revient au choix. Les liens portent `data-booking-slug` ou `data-booking-reset-property` pour transmettre les dates/voyageurs/langue tout en choisissant ou retirant explicitement le slug. Le lien Disponibilités du menu revient toujours aux cartes. Focus sur le titre de l'étape, historique navigateur conservé, devis et modale invalidés par le cycle Turbo existant ; les critères incompatibles restent soumis à la validation partagée.

Le bouton « Effacer les dates » / « Clear dates » réutilise `components/_clear_dates.html.twig` sur l’accueil et les plannings. Dans les fiches et disponibilités, il est placé à gauche de « Vérifier le séjour » ; l’accueil conserve son bouton dans le sélecteur de dates. Il possède une bordure discrète, un fond secondaire du thème, une icône décorative et une cible de 44 px. Il est désactivé sans date, reste indépendant du fieldset de chargement et efface dates/devis/module en conservant logement et voyageurs. Le focus revient au déclencheur sur l’accueil et à l’arrivée active sur le planning.

Validation locale reproductible : `node tests/browser/availability-choice.cjs` avec les API et réservations simulées, zéro trafic fournisseur ; compléter avec `booking-journey.cjs` pour les règles et le module.

## Module de réservation en modale

Sur l'accueil, les fiches et les disponibilités, le composant partagé de devis ouvre désormais un `<dialog>` natif après la même revalidation du séjour. La modale est centrée, jusqu'à 1280 px de large (96 % de la fenêtre), et occupe 92 % de sa hauteur ; sous 576 px, elle prend tout l'écran avec une hauteur dynamique `100dvh`. L'iframe remplit l'espace disponible entre l'en-tête et le lien de secours, sans hauteur fixe de 900 px.

L'en-tête rappelle le logement et le séjour et présente une fermeture de 44 px. Le fond devient inerte, son défilement est bloqué, le focus entre dans la modale ; fermeture par bouton ou Échap avec retour au déclencheur. Un changement de critères, un nettoyage des devis ou une mise en cache Turbo ferme et détruit le module, puis libère le défilement. Le repli dans un nouvel onglet reste accessible dans la modale et sur le devis, via la route locale protégée. Aucun chargement automatique du module ni modification du verrou de publication.

## Finitions et images (phase 4, 10 octobre 2026)

Les sections restent visibles sans JavaScript ; les effets `.reveal` ne masquent plus le contenu avant son observation. Le lien d'évitement place explicitement le focus sur `main-content` avec Turbo. Les menus s'ouvrent par leur commande Bootstrap, se ferment par Échap et rendent le focus à leur déclencheur. `site_shell_controller.js` possède les événements globaux, instances Bootstrap et frame de défilement pour une seule visite ; il les libère à la déconnexion. Les liens vers À propos et les changements de langue conservent aussi les critères du séjour.

Sur une surface sombre, les textes accentués utilisent `--roaming-dark-accent: #F0B59D`, y compris les sections `.bg-dark` en thème clair. Les CTA conservent `#9C4934` et `#783925`. Les formulaires de contact de l'accueil et de la page dédiée partagent `_contact_form.html.twig` : labels FR/EN, autocomplete, erreurs liées au champ, message accessible et réponse HTTP 422 pour une soumission invalide. Le jeton CSRF et le traitement existant sont conservés.

`components/_picture.html.twig` ajoute des sources WebP avec `srcset`, `sizes` et dimensions intrinsèques, à partir de `public/images/responsive/manifest.json`. Le JPEG/PNG original reste le repli ; une image absente du manifeste fonctionne sans conversion. Les 41 photos des logements actifs ont des dérivés locaux de 320/640/960/1440 px, sans agrandissement. L'image principale est prioritaire ; cartes, photos suivantes et miniatures sont différées. Aucun visuel n'est créé pour Croix.

Régénération facultative : `php -d extension=gd bin/generate-responsive-images.php`, à partir des clés du manifeste ; un argument JSON peut fournir une liste de noms de fichiers réels dans `public/uploads`. Cette commande écrit uniquement les dérivés et le manifeste, sans réseau ni modification des originaux ou du catalogue. De nouvelles photos gardent leur repli original jusqu'à une génération explicite.

Les métadonnées utilisent des canoniques sans critères de séjour et des URLs FR/EN réellement interprétées via `_locale`. Le sitemap publie leurs alternates et seulement les dates de modification connues. Les pages de diagnostic, de réservation fermée et les erreurs ne doivent pas être indexées. Les valeurs JSON-LD passent par `json_encode(15)` ; ne pas construire des chaînes JSON avec un échappement JavaScript ou ajouter des avis/prix non confirmés.

Le rapport [AUDIT_FINAL.md](AUDIT_FINAL.md) décrit les contrôles navigateur à 320/390/768/1024/1440 px et leurs limites. La conformité WCAG et les Core Web Vitals réels nécessitent encore une validation dans l'environnement cible.

## Accessibilité et interactions

Sur l’accueil, les panneaux de recherche s’ouvrent sous la barre recentrée. Leurs limites tiennent compte du header et du viewport, même après redimensionnement ; ils restent défilables intérieurement. Sur mobile, ils gardent leur présentation en bas de l’écran. Le choix du logement utilise une surface native `dialog` aux couleurs du thème, des options de 48 px, une sélection dans l'accent du thème et la navigation clavier (flèches, Début/Fin, Entrée, Échap). Le select masqué conserve les valeurs et métadonnées réelles utilisées par la recherche ; changer de logement invalide toujours dates et devis.

- Cibles des commandes principales d'au moins 44 px de haut. Focus clavier visible : contour de 3 px dans l'accent du thème ; ne pas le supprimer.
- Légendes textuelles, noms accessibles incluant logement/date/état, titres de lignes et de colonnes du tableau.
- Messages de lecture et de devis dans des régions `aria-live="polite"`. Une erreur supprime les disponibilités confirmées et invalide le devis précédent.
- Respecter `prefers-reduced-motion`. Éviter les animations qui cachent les informations utiles.
- Chaque ajout de texte existe en français et en anglais (`translations/messages.*.yaml` pour Twig et dictionnaire de `assets/booking-ui.js` pour les interactions).
- Avec Turbo, attacher les événements via Stimulus ; annuler requêtes et timers à la déconnexion. Aucun nouveau timer sur une prévisualisation Turbo.

## Vérification avant livraison

1. Compiler `npm run build` et vérifier que CSS/JS sont servis avec leur type réel, pas du HTML.
2. Vérifier les deux thèmes à 1 440 et 1 920 px, puis à 1 024, 768, 390 et 320 px ; ouvrir aussi une fiche logement quand le composant est partagé.
3. Vérifier chargement, succès, absence de données, panne, verrou public et sélection, avec focus clavier visible.
4. Vérifier FR/EN, prix longs, nom de logement long, logement sans photo et navigation Turbo. Tester les carrousels avec un catalogue étendu, le rail actif visible, les flèches accessibles, le glissement et les préférences de mouvement. Contrôler le défilement d'ancre et son interruption, l'arrivée sous le header, le focus après fermeture animée et l'absence de dialogue ou voile résiduel.
5. Faire évoluer ce document si une règle visuelle commune change ; ne pas multiplier des palettes propres à chaque page.

Captures de validation locale de cette refonte : `var/redesign-after-*.png` (fichiers de travail non versionnés). Régression dédiée : `ROAMING_BROWSER_URL=http://127.0.0.1:8017 node tests/browser/hospitality.cjs` sur l'aperçu local isolé ; toutes les réponses fournisseur sont simulées. Les suites de réservation vérifient les mêmes parcours sans créer de réservation réelle.

Les barres de défilement utilisent un pouce fin et arrondi, sans flèches ajoutées, avec les couleurs du thème. Le défilement reste natif (souris, tactile et clavier) ; le mode de contraste forcé conserve les couleurs système.
