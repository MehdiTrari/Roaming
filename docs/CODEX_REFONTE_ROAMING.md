# Codex — Refonte Roaming Lille

## Mission et périmètre
Refondre progressivement le **site public Roaming Lille** (Symfony/PHP) : UX premium, lumineuse et éditoriale, inspirée de `https://auchatquidort.fr/` (navigation, photos, fiches, recherche, parcours de réservation). **S'inspirer sans copier** marque, textes, images ni code. Aligner strictement l'identité visuelle du site sur le **Booking Engine GuestLucky déjà configuré** : couleurs et police ci-dessous.

**Réaliser seulement la phase demandée. Par défaut : phase 1 (accueil + navigation).** Ne pas refondre le back-office ni réécrire les services métier.

## Environnements : point essentiel
- **La version locale/de développement est volontairement différente de la production.** Le site en ligne est en retard : ses anciennes fiches et son design **ne sont pas la source de vérité** pour le catalogue ou le comportement actuel.
- Le projet local contient **3 logements actifs** : Lambersart, Roubaix et Croix (identifiants et données à lire dans la base/config, jamais à coder en dur). Respecter les statuts et relations existants.
- Se fier **au code, à la base, aux routes et aux docs du dépôt local**. Utiliser la production uniquement comme contexte historique, pas pour rétablir d'anciens biens ou écraser les changements locaux.
- Ne **pas** synchroniser, importer, modifier, purger ou charger de fixtures pour « corriger » l'écart local/production. Ne pas toucher à `.env.local` ni aux données de production.

## Stack et documents (lecture ciblée)
- PHP >= 8.4, Symfony 8, Twig, Doctrine/MySQL ; Bootstrap 5, Webpack Encore, Stimulus, Turbo, Flatpickr. **Réutiliser l'existant** : pas de React, Tailwind, refonte backend ni nouvelles dépendances sans justification.
- Lire les passages utiles de `README.md`, `docs/Style_Guide.md` et, seulement pour les phases de réservation, `docs/GuestLucky_Integration.md` (adapter aux chemins réels).
- `docs/Guestlucky_MCP.md` est une documentation PMS/back-office volumineuse : **ne pas la charger** pour des modifications Twig/CSS. Ne pas utiliser les outils MCP GuestLucky pour une refonte UI.
- FR/EN, SEO, responsive, thèmes, Twig partagés, recherche, catalogue et contact existent : préserver leurs contrats et routes.

## Identité visuelle cible — PRIORITÉ
**Référence de vérité : les captures de configuration et d'aperçu GuestLucky fournies par le propriétaire**, pas les anciennes couleurs par défaut du site. L'identité configurée GuestLucky utilise la police **DM Sans** et cette palette exacte :

| Usage | Valeur |
| --- | --- |
| Couleur primaire, CTA, liens actifs | `#0F766E` |
| Couleur secondaire, survol et accents profonds | `#115E59` |
| Fond général clair | `#F8F9FA` |
| Texte principal clair | `#212529` |
| Fond des champs | `#FFFFFF` |
| Texte des champs | `#212529` |
| Fond des cartes / panneaux | `#FFFFFF` |
| Texte des cartes | `#212529` |
| Texte sur CTA primaire | `#FFFFFF` |

**Consignes d'implémentation :**
1. **Mode clair = rendu de référence et mode par défaut en l'absence de préférence enregistrée.** Fond très clair, cartes blanches, textes anthracite, boutons turquoise foncé, contraste fort. L'ensemble doit sembler appartenir à la même marque que la page GuestLucky. Éviter les teintes turquoise vives `#0D9488` / `#14B8A6` comme couleurs **principales des boutons** ; harmoniser les anciennes variables `--teal-*`/`--bs-*` et les composants existants sans casser le calendrier.
2. Préférer **DM Sans pour l'interface Roaming** afin de correspondre à GuestLucky. Vérifier les polices déjà chargées avant d'en ajouter ; prévoir une pile de repli `sans-serif` et éviter de charger la même police plusieurs fois.
3. Utiliser des **variables CSS globales uniques** (par exemple `--roaming-primary`, `--roaming-secondary`, `--roaming-bg`, `--roaming-text`, `--roaming-card-bg`) et les dériver des valeurs ci-dessus ; **ne pas multiplier les couleurs codées en dur**. Reprendre les variables et classes Bootstrap/Twig déjà présentes lorsque possible.
4. Garder le mode sombre existant **fonctionnel en option** (préférence `localStorage.theme`, `html[data-bs-theme]`) avec tokens sombres distincts et accessibles. Ne pas imposer les surfaces claires en mode sombre. Ne pas écraser une préférence explicite enregistrée. Mettre à jour `docs/Style_Guide.md` après les changements effectifs (notamment défaut clair et DM Sans).
5. Composants : boutons plein `#0F766E` / texte blanc, hover/focus visibles ; actions secondaires sobres ; cartes blanches, bords fins, arrondis modérés, espaces généreux ; champs blancs avec labels lisibles. Ne pas copier l'interface d'administration GuestLucky : c'est **sa charte voyageur**, pas son layout admin, qui doit être cohérente avec Roaming.
6. Les styles locaux **ne peuvent pas modifier l'intérieur** de l'iframe GuestLucky. Garder sa configuration externe actuelle (nom Roaming Lille, couleurs, police, logo/favicon) ; harmoniser le contenant local et le parcours jusqu'à l'iframe. **Ne pas prétendre que Stripe/le paiement est disponible** : la capture montre que les clés d'encaissement restent à saisir.

## Cible UX / fonctionnelle
- **Accueil** : navigation plus sobre, hero photographique immersif, H1/proposition de valeur claire, CTA utile, recherche existante (dates + voyageurs et destination si réellement pertinente), logements actifs mis en avant avec leurs vraies images, atouts réels, contact.
- **Catalogue et fiches** : grilles aérées, images en grand, galerie mobile, localisation/capacité/équipements exacts, hiérarchie éditoriale, bloc dates/voyageurs/disponibilités/réservation visible. Aucune image d'un autre logement, aucun prix, équipement, avis ou disponibilité inventé.
- **Parcours** : recherche fluide de l'accueil à la fiche, conserver les paramètres, retours d'état explicites, calendrier partagé, devis fournisseur fiable, accès au moteur GuestLucky **seulement si le parcours est autorisé**. Les améliorations sont UX, non des nouvelles APIs.
- **Qualité** : mobile-first 320/390/1440 px, FR/EN, un seul H1, clavier/focus visible, contrastes AA, `aria-live`, `prefers-reduced-motion`, LCP/chargement images, attributs alt pertinents, slugs/routes/métadonnées SEO préservés.

## Invariants GuestLucky et sécurité (non négociables)
- GuestLucky demeure la source de disponibilité, prix/devis et réservation. Symfony est l'intermédiaire ; ne pas refaire le moteur.
- **Ne jamais modifier** `GUESTLUCKY_AVAILABILITY_ENABLED` ni lever/contourner le verrou de publication. L'incohérence documentée sur Roubaix n'est **pas** résolue par une refonte graphique.
- Préserver les API publiques, les statuts `available` / `unavailable` / `unverified`, les codes d'erreur, le **devis frais** avant `/reservation/{slug}`, les règles de dates, la capacité, la durée minimale et le cache actuel. Une erreur fournisseur = **non vérifié**, jamais « disponible ».
- Préserver le planning partagé (`templates/calendar/_planning.html.twig`, `assets/controllers/calendar_controller.js`) : deux mois, navigation, arrivée/départ, accessibilité, annulation des requêtes/timers. Le restyler sans dupliquer la logique.
- Charger l'iframe de réservation seulement à la demande et après revalidation ; conserver le lien externe de secours. Si la publication est fermée, présenter un message clair et un moyen de contact, jamais un CTA de réservation trompeur.
- **Aucune écriture GuestLucky**, réservation test, paiement, changement de prix, modification de BDD, suppression, migration, déploiement ou manipulation de secrets sans accord explicite. Ne pas révéler/committer `.env.local`.

## Phases — une seule à la fois
### Phase 1 — Accueil + navigation (**par défaut, à faire maintenant**)
1. Repérer **uniquement** templates/contrôleurs/styles/JS concernés, composants existants et routes. Lire les parties utiles du guide de style et les variables CSS actuelles.
2. Implémenter le **nouveau thème clair Roaming ↔ GuestLucky** et la police DM Sans, préserver le mode sombre et les préférences. Refaire accueil, header, footer, cards d'accueil et moteur de recherche existant **sans toucher au backend métier**.
3. Réutiliser les vrais logements actifs et liens ; privilégier des partials Twig seulement en cas de duplication réelle. Mettre à jour les passages devenus obsolètes de `docs/Style_Guide.md`.
4. Vérifier visuellement le rendu à 1440/390/320 px (si navigateur accessible), FR/EN et thème sombre, puis tests pertinents.

### Phase 2 — Catalogue + fiches (**sur demande**)
Harmoniser cartes, galeries, contenus et fiches avec le thème. Préserver données/slugs ; gérer logement sans photo/équipement ; conserver le calendrier partagé.

### Phase 3 — Recherche + réservation (**sur demande**)
Améliorer ergonomie et transmission dates/voyageurs sans modifier contrats API. Tester disponible, refus 422, erreur/non vérifié, verrou fermé, séjour minimal, changement de logement/date et iframe à la demande. **Ne pas ouvrir la réservation publique.**

### Phase 4 — Finitions (**sur demande**)
Auditer responsive, accessibilité, perfs, SEO, FR/EN, Turbo, thèmes, régressions ; consolider les tokens et `docs/Style_Guide.md`.

## Discipline Codex : économiser les tokens
- **Agir directement sur la phase demandée**. Inspection ciblée (`rg` puis quelques fichiers), pas d'exploration exhaustive, d'analyse de 3 000 lignes ni d'appel MCP inutile.
- Pas de long plan, de nouveaux frameworks, de refactor non demandé, de spéculation sur les données, de dumps de diff ou de recopies de docs. Conserver les modifications préexistantes sans les annuler.
- Si la référence `auchatquidort.fr` est inaccessible, appliquer cette direction artistique sans affirmer l'avoir inspectée. Les **valeurs de palette et DM Sans ci-dessus sont obligatoires**.
- Tests suivant fichiers touchés : `php bin/console lint:twig templates`, `php bin/console lint:yaml config translations`, `npm run build`, PHPUnit ciblé au besoin. Ne pas déclarer comme réussis des tests non exécutés.
- **Bilan de 10 lignes max :** résultat, fichiers modifiés, tests exécutés, limites et prochaine phase.

## Acceptation de la phase 1
Un accueil clairement modernisé, **fond clair `#F8F9FA`, surfaces blanches, CTA `#0F766E`, police DM Sans**, cohérent avec GuestLucky, avec navigation et recherche fonctionnelles ; contenu issu **du catalogue local à 3 logements actifs** ; FR/EN, mobile, sombre optionnel ; aucun changement de réservation, données, secrets ni déploiement ; aucune nouvelle erreur de build/Twig.
