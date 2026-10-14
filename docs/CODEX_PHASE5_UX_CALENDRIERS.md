# Roaming Lille — Phase 5 : finitions UX, navigation et calendriers

> Mission **ciblée**, après les phases 1 à 4. Implémenter sur le dépôt **local** Symfony 8/Twig/Bootstrap 5/Stimulus/Turbo/GuestLucky. Préserver le design et les fonctions déjà livrés. Ne pas refaire la refonte globale.
>
> Documents à lire **par sections utiles uniquement** : `docs/CODEX_REFONTE_ROAMING.md`, `docs/Style_Guide.md`, `docs/GuestLucky_Integration.md`. En cas de divergence, le code local et les contrats fournisseur vérifiés priment. La prod contient un catalogue ancien : **ne pas la synchroniser** avec le local.

## Références visuelles fournies

Les captures sont incluses dans `docs/ui-references/` si le ZIP a été extrait à la racine du dépôt :

| Capture | Sujet | Consigne |
| --- | --- | --- |
| `01-home-search-popover.png` | Recherche accueil / popover mal positionné | Corriger l'ancrage, la superposition et les collisions |
| `02-home-datepicker.png` | **Bon exemple** de calendrier compact | Référence prioritaire pour couleurs, sélection, animation et comportement |
| `03-disponibilites-calendar.png` | Calendrier de `/disponibilites` | Uniformiser avec la capture 2 sans perdre les prix et les 2 mois |
| `04-airbnb-datepicker-reference.png` | Référence Airbnb | S'inspirer de la disposition, des champs et des actions, **sans copier** l'interface |
| `05-airbnb-checkout-only.png` | Indication « Départ uniquement » | Produire cet état uniquement lorsqu'il est réellement justifié par les règles de séjour |
| `06-header-controls.png` | Header FR/EN, thème, CTA | Harmoniser tailles, espacements, proportions, arrondis |
| `07-property-booking-panel.png` | Panneau d'une fiche `/property/...` | Réduire nettement la hauteur et la densité du calendrier |

## Critères de réussite prioritaires

1. Les popovers de l'accueil ne se collent plus aux blocs voisins, ne sont ni coupés ni décalés, et restent accessibles sur mobile.
2. Le menu déroulant « Nos logements » et les trois contrôles d'en-tête (thème, FR/EN, « Choisir un séjour ») utilisent un design premium cohérent.
3. Le style et la logique de sélection des dates sont **communs** à l'accueil, `/disponibilites` et aux fiches logement ; une seule source d'état/validation, pas trois comportements divergents.
4. Sans logement sélectionné, le calendrier de l'accueil informe correctement sur la disponibilité **de l'ensemble des logements actifs** ; avec logement sélectionné, sur celle de ce logement uniquement.
5. Les frontières des nuits occupées gèrent correctement les départs possibles et, si pertinent, l'indication accessible « Départ uniquement ».
6. Sur `/property/{slug}`, le bloc de réservation ne nécessite plus de faire défiler un gigantesque calendrier avant de voir le nombre de voyageurs, le devis et l'action principale.

## Lot A — Navigation, popovers et cohérence visuelle

### A1. Popovers sur l'accueil (capture 1)
- Inspecter les popovers recherche (dates, logement, voyageurs). Corriger le conteneur d'ancrage, leur alignement avec le champ déclencheur, `z-index`/stacking context, `overflow: hidden`, calcul des limites du viewport, position au scroll et collisions avec le header ou les sections.
- Le calendrier doit s'ouvrir juste sous le champ, ou se repositionner au-dessus / se centrer si l'espace manque ; **jamais tronqué**. Sur petit écran, préférer une surface adaptée (dialog/bottom sheet si nécessaire) plutôt qu'un popover hors écran.
- Éviter les sauts de layout et toute superposition qui empêche de cliquer ; ouverture/fermeture au clic extérieur, `Esc`, et après validation ; focus restitué au déclencheur. Ne pas casser Turbo/Stimulus après navigation.
- Conserver comme **référence positive** le calendrier compact de la capture 2 : léger, lisible, plage turquoise continue, arrivée/départ bien marqués, flèches, libellés et actions visibles.

### A2. Menu « Nos logements »
- Restyler **le menu existant**, sans réécrire la navigation : fond carte blanc (sombre adapté au thème), bord subtil, ombre légère, coins arrondis, marges internes régulières, contraste des états `hover`/`focus`/actif.
- Afficher les **logements actifs de la base**, pas trois entrées codées en dur ; le rendu doit continuer à fonctionner avec 4, 5, 10 logements ou davantage.
- Titres lisibles et clic sur l'entrée entière ; petite information secondaire/miniature uniquement si les données existent et si cela n'alourdit pas le menu. Prévoir menu déroulant long/scroll, clavier, fermeture hors clic, mobile et FR/EN.

### A3. Header (capture 6)
- Uniformiser la hauteur visible (cible ~42–44 px desktop), la taille des icônes, le padding, le rayon d'angle, les bordures et l'espacement du bouton thème, du segment FR/EN et du CTA « Choisir un séjour ».
- Utiliser des arrondis plus généreux (par exemple 10–14 px pour boutons et segment), sans rendre le header disproportionné. Garder une hiérarchie claire : CTA turquoise `#0F766E` prioritaire, contrôles de thème/langue secondaires.
- Aucun saut quand on passe FR → EN, clair → sombre ; états sélectionnés/focus nets ; ergonomie mobile et menu replié.

## Lot B — Calendrier et disponibilité : une UX, plusieurs contextes

### B1. Harmonisation des sélecteurs (captures 2, 3, 4)
- Réutiliser les composants, tokens CSS et règles de sélection existants ; repérer les deux interfaces actuelles avant d'éditer. **Une logique date/intervalle partagée** doit gérer toutes les entrées (accueil, `/disponibilites`, `/property/{slug}`). Ne pas entretenir deux calculateurs concurrents.
- Conserver sur `/disponibilites` son **aperçu de deux mois avec les prix par nuit, les états GuestLucky, la navigation et le calendrier partagé**. Améliorer son style/animation pour retrouver l'élégance du calendrier compact d'accueil (plage continue, date d'arrivée/départ, hover, focus, labels, densité) ; ne pas supprimer les informations utiles pour une simple homogénéité.
- Le champ date compact de l'accueil et le dialogue/calendrier d'une fiche doivent présenter les mêmes dates, contraintes et états. Adapter la présentation (compact vs 2 mois), **pas les règles métier**.
- Reprendre l'esprit de la capture Airbnb : champs arrivée/départ identifiables, consignes claires, commandes groupées et « Effacer les dates » à proximité immédiate de la sélection ou en pied du dialogue, avec l'action principale à côté si pertinente. Ne pas créer plusieurs boutons d'effacement redondants.
- Conserver traduction FR/EN, navigation clavier, focus visible, `aria-live`, `prefers-reduced-motion`, fonctionnement sur 320/390/768/1440 px, actualisation et annulation de requêtes sous Turbo.

### B2. Accueil : calendrier de **tous les logements** (pas de slug)
- Identifier **dynamiquement** les logements actifs pour les calendriers. Pas de liste de slugs/IDs codée en dur ; actuellement trois logements locaux, mais solution extensible.
- Se baser exclusivement sur les calendriers/API Symfony déjà connectés à GuestLucky (ex. `/api/calendar` si adapté au contrat). N'interroger les calendriers que si le parcours public est autorisé ; respecter le cache existant, sans appel fournisseur inutile par case ou par survol.
- Pour une **nuit** donnée :
  - Si **au moins un logement** est confirmé disponible (`fresh` + `available=true`) : date **candidate** à la recherche, pas réservation garantie.
  - Si **tous les logements actifs** ont été vérifiés et indiquent indisponible : date **grisée/indisponible**.
  - Si aucun logement ne confirme disponible **et** au moins un calendrier est non vérifié/en erreur : date **« Non vérifiée »**, distincte visuellement d'une indisponibilité certaine ; ne pas l'annoncer réservable.
  - Si aucune donnée exploitable / verrou public fermé : afficher l'état prévu par l'application et le message explicatif approprié ; ne pas maquiller un échec en « disponible ».
- Lors du choix d'un **séjour** (dates + voyageurs), vérifier qu'**un même logement** peut accueillir toutes les nuits du séjour et satisfait capacité/minimum de nuits ; ne jamais considérer une succession de nuits appartenant à des logements différents comme un séjour possible. Le devis frais GuestLucky reste arbitre définitif.
- N'ajouter ni prix globaux fictifs ni multiplication des devis au survol. Conserver les paramètres de recherche lors du parcours suivant.

### B3. Accueil : logement choisi
- Si un logement précis est choisi, appliquer à son sélecteur **exactement les règles de `/disponibilites` pour ce logement** : calendrier par slug, jours occupés, non vérifiés, minStay, capacité, départ exclu, navigation entre mois.
- Conformément au comportement documenté du planning partagé, **changer de logement efface les dates, le devis et l’iframe éventuelle** (ne pas conserver une sélection héritée d’un autre logement). Relire les données selon la politique de cache actuelle.

### B4. Frontières des réservations et « Départ uniquement » (capture 5)
- Important : GuestLucky retourne des **nuits occupées**, pas forcément la cause exacte du blocage. La date de départ (checkout) est **exclue** des nuits consommées. Une date qui n'est pas disponible **pour y dormir** peut quand même servir de départ d'un séjour précédent, si toutes les nuits de ce séjour sont admises et si le devis frais l'accepte.
- Ajouter un état visuel « Départ uniquement » **contextuel** lorsqu'une date peut être utilisée comme checkout mais pas comme arrivée pour le séjour en cours. Indice au survol, mais aussi accessible au focus/clavier (label/infobulle), avec légende/contraste et traduction EN « Check-out only ».
- **Ne pas coder la règle naïve « la veille d'une réservation est toujours départ uniquement ».** La veille peut parfois être une nuit valide, selon calendrier, minimum de séjour et contraintes. Calculer cet état sur les nuits et limites réelles, et laisser le devis fournisseur trancher les restrictions non exposées par l'API.
- Ne pas rendre un jour « départ uniquement » sélectionnable comme arrivée. Ne pas interdire un checkout le matin du début d'un blocage si le séjour antérieur est admissible ; ne pas permettre qu'un séjour traverse une nuit occupée ou non vérifiée.
- Si les données fournisseur ne suffisent pas à garantir la restriction d'arrivée/départ, **ne pas inventer de certitude** : garder un état prudent et vérifier par devis.

### B5. « Effacer les dates » partout
- Une action **visuellement secondaire mais identifiable** (texte + petite icône, hover/focus, contraste AA), inspirée du placement Airbnb et cohérente avec le thème. Ne pas créer une grosse action turquoise qui concurrence « Rechercher » ou « Vérifier le séjour ».
- À activer seulement lorsqu'une sélection existe ; au clic, effacer arrivée/départ, invalidation du devis et de l'iframe, puis rafraîchir les indicateurs. Garder le logement sélectionné et les voyageurs. Cohérence du comportement entre accueil, `/disponibilites` et fiches.

## Lot C — Panneau de réservation compact des fiches (capture 7)

- La fiche `/property/{slug}` affiche aujourd'hui **un immense calendrier à deux mois toujours ouvert** : le bloc occupe trop de hauteur, et le visiteur doit défiler pour atteindre voyageurs, devis et CTA.
- Convertir sur les fiches **uniquement** le panneau en module compact : titre/logement bref, deux champs arrivée/départ lisibles, « Effacer les dates » discrètement placé juste dessous ou dans le pied de la fenêtre, voyageurs, résumé (nuits/prix réellement vérifié), action principale et message d'état.
- Le calendrier s'ouvre **sur demande** par clic sur les dates : popover correctement ancré sur desktop, dialogue accessible adapté sur mobile. Utiliser le même comportement et le même style que le calendrier d'accueil, tout en gardant les contraintes GuestLucky. **Ne plus réserver une grande hauteur vide** à un calendrier toujours visible.
- Le CTA et les informations essentielles doivent rester visibles sans devoir faire défiler un calendrier de plusieurs centaines de pixels. Pas d'iframe chargée sans demande explicite ; la vraie iframe GuestLucky peut rester grande lorsqu'elle est effectivement ouverte.
- Si la réservation publique est verrouillée, respecter l'écran d'information/contact existant, sans bouton de réservation trompeur.
- Sur `/disponibilites`, conserver au contraire le calendrier de consultation étendu : **pas besoin de forcer le mode compact sur cette page**.

## Invariants techniques et interdits

- Palette existante alignée sur GuestLucky : **DM Sans**, `#0F766E` primaire, `#115E59` secondaire, `#F8F9FA` fond clair, `#212529` texte, `#FFFFFF` cartes/champs ; mode sombre fonctionnel via tokens.
- Réutiliser `templates/calendar/_planning.html.twig`, `assets/controllers/calendar_controller.js` et les éventuels composants recherche/date-picker existants, ou extraire une **petite** logique commune si nécessaire. Ne pas ajouter un second moteur de disponibilités ou une grosse dépendance UI.
- Conserver tous les contrats API, les routes/slugs, le statut `available/unavailable/unverified`, le rafraîchissement/cache, la sélection d'un départ sur une nuit bloquée, `minStay`, le devis **frais**, le verrou `GUESTLUCKY_AVAILABILITY_ENABLED`, les règles de sécurité, les traductions et l'accessibilité.
- Aucune écriture/booking/paiement/effacement de données côté GuestLucky ; aucun appel MCP, aucun changement de `.env.local`, migration de base ou déploiement. Ne pas contourner ni prétendre corriger l'incohérence GuestLucky/Roubaix documentée.

## Tests d'acceptation minimaux

- **Placement :** popover accueil ne dépasse pas sur 1440/768/390/320 px ; pas de clipping dans hero/header ; scroll, `Esc`, clic extérieur, focus, Turbo fonctionnent.
- **Header :** FR/EN, mode clair/sombre, CTA, menu « Nos logements », clavier/mobile et longue liste de biens restent proportionnés.
- **Sans logement :** date bloquée sur **tous** les biens → grisée ; au moins un disponible → candidate ; panne sur un bien + autres bloqués → « Non vérifié » ; changement mois/année ; 0 logement actif.
- **Séjour complet :** A ouvert la nuit 1, B ouvert la nuit 2 mais aucun ouvert les deux → **aucun logement compatible** ; capacité voyageurs et durée minimale respectées ; devis frais avant possibilité de réserver.
- **Un seul logement :** mêmes dates bloquées/états et contraintes que `/disponibilites` ; test d'un séjour traversant 2 mois ; changement de logement invalide un devis périmé.
- **Départ uniquement :** arrivée non proposée sur une nuit occupée ; départ le matin d'une nuit bloquée autorisé uniquement si séjour antérieur valide ; cas voisin avec durée mini de 2 nuits ; aucune sélection à travers des nuits bloquées/non vérifiées ; tooltip lisible au clavier.
- **Fiche :** calendrier fermé au chargement, ouverture/choix/fermeture sans gros espace vide, CTA et voyageurs visibles ; « Effacer les dates » retire aussi le devis/iframe ; FR/EN.
- **Sécurité :** verrou public fermé, erreurs GuestLucky, pas de faux état « disponible », pas de réservation test ni mutation distante.
- Exécuter les tests pertinents (mocks/fournisseur **lecture seule** uniquement si déjà autorisé), `php bin/console lint:twig templates`, `php bin/console lint:yaml config translations`, `npm run build`, PHPUnit ciblé ; signaler honnêtement tout contrôle impossible.

## Stratégie d'exécution / économie de tokens

1. Inspecter uniquement les contrôleurs Stimulus, templates Twig, styles et API **directement** concernés (`rg` ciblé). Ne pas relire tout `Guestlucky_MCP.md`.
2. **Exécuter par lots** pour limiter les régressions et le contexte : A (UI/navigation), B (logique calendrier), C (fiche compacte). Si le temps/quota est limité, finir un lot complètement avant le suivant. Dans chaque lot, implémenter et tester directement ; pas de longs comptes rendus intermédiaires.
3. Ne pas annuler les modifications déjà réalisées par d'autres étapes ; ne pas toucher aux autres pages.
4. Mettre à jour `docs/Style_Guide.md` seulement si la règle commune a réellement changé.
5. Bilan final **12 lignes max** : fichiers touchés, comportements, tests réellement passés/non passés, éventuels points bloquants. Aucune affirmation de conformité sans tests.
