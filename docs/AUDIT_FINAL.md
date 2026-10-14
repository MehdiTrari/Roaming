# Audit final Roaming — phase 4

Audit local du 10 octobre 2026. Périmètre : accueil/catalogue, trois fiches actives, disponibilités, contact, À propos, diagnostic dev et erreurs/archives. Phases 1–3 conservées, DM Sans et palette GuestLucky réutilisées. Aucun déploiement, synchronisation avec la production, migration, changement de catalogue/slug/secret/verrou ou écriture GuestLucky.

## Corrections appliquées

| Constat | Correction et fichiers principaux |
| --- | --- |
| Photos originales trop lourdes, tailles uniques | 145 dérivés WebP des 41 photos actives, manifeste local, `bin/generate-responsive-images.php`, `src/Twig/ResponsiveImageExtension.php`, `_picture.html.twig` et inclusions accueil/cartes/fiches. Originaux inchangés, repli original, dimensions stables, source principale prioritaire, autres images différées. Croix reste sans photo. |
| Lectures d'images répétées pour les cartes | `PropertyRepository::findActiveWithImages` charge les collections ensemble, après sélection des logements pour préserver ordre et limite. Utilisé par accueil/navigation/suggestions 404 ; aucune méthode métier GuestLucky modifiée. |
| Initialisations et événements globaux répétés avec Turbo | `assets/app.js` simplifié, `site_shell_controller.js` assure installation/libération des événements, tooltips, toasts et frame de défilement. Imports des modules Bootstrap nécessaires ; suppression de l'ancien observateur cachant les sections. Version des assets suivie par Turbo. |
| Menu encore visible après Échap, focus du lien d'évitement intercepté | Ouverture explicite Bootstrap, fermeture clavier avec restitution du focus, focus explicite sur le contenu. Aucun contenu masqué en attente de JS. |
| Critères perdus sur À propos/changement de langue ; URL traduite sans effet | `booking_journey_controller.js`, `LocaleSubscriber` et `LocaleController` transmettent les critères et interprètent `_locale`. Redirection de langue limitée à un chemin local, langue validée. |
| Formulaires de contact dupliqués, labels/erreurs anglais manquants | `_contact_form.html.twig` partagé, traductions messages/validators, autocomplete et erreurs associées au champ, validation invalide en HTTP 422 compatible Turbo. CSRF et traitement conservés. Lien téléphone corrigé. |
| Faible contraste turquoise sur sections sombres | Token commun `--roaming-dark-accent: #5EEAD4`, sans changer les CTA `#0F766E`/`#115E59`. Champs et commandes dimensionnés pour mobile. |
| Canonique contenant les critères, alternates non fonctionnels, JSON-LD fragile | `base.html.twig`, templates publics, sitemap et traductions : canoniques FR/EN sans séjour, alternates cohérents, dates sitemap réelles, JSON sérialisé avec protection HTML, suppression du SearchAction sans recherche correspondante, dimensions OG réelles. |
| Page 404 débordante et suggestions utilisant une image inexistante | Template 404 réutilisant les cartes, trois logements actifs, titre adaptatif, noindex ; `ExceptionSubscriber` prépare leurs images. Diagnostic non indexable, chemins techniques exclus dans robots.txt. |
| Erreur de la barre Symfony pendant le remplacement Turbo de son DOM | Surcharge Twig minimale de `WebProfiler/Profiler/cancel.html.twig` : le squelette de chargement ne se fait plus passer pour le compteur AJAX d'une barre complète. Barre, suivi AJAX, profils serveur et diagnostic dev conservés ; aucune modification vendor. |

## Vérifications exécutées

- **PHPUnit : 24 tests, 162 assertions, aucun test ignoré.** SQLite activé pour ce seul processus : `php -d extension=pdo_sqlite bin/phpunit`. Tests existants de contrats GuestLucky conservés ; ajout de contrôles locale/canonique/redirection (y compris les antislashs normalisés par le navigateur), formulaire invalide/CSRF sans persistance, JSON-LD avec caractères spéciaux, 404/archives et chargement complet des collections d'images avec limite.
- **Lints : 18 fichiers Twig, 30 fichiers YAML, conteneur Symfony valides.** Commandes `php bin/console lint:twig templates`, `lint:yaml config translations`, `lint:container`.
- **Compilation :** `npm run build`, succès. Entrypoint environ 694 KiB non compressés, contre 707 KiB avant l'audit ; scripts différés, police locale préchargée, aucun ajout de dépendance.
- **160 rendus navigateur** : 8 pages × FR/EN × clair/sombre × 320/390/768/1024/1440 px, Chrome installé via Playwright. Aucun débordement, erreur JS, image visible cassée, contrôle visible sans nom, erreur JSON-LD ou CTA principal hors palette. Vérification d'un H1 et de métadonnées sur chaque rendu, menus mobiles/Échap, URLs de langue/canoniques ; captures comparées aux composants établis. Catalogue couvert dans l'accueil.
- Une passe intermédiaire a signalé une miniature différée avant stabilisation de sa source. Original et quatre variantes répondent bien 200 avec leur type image réel. Le contrôle attend désormais le décodage des images dans la fenêtre, distingue les sources non encore sélectionnées et capture aussi les événements d'erreur image : les images différées hors écran ne sont pas assimilées à des images cassées.
- **Interactions** : lien d'évitement au clavier, navigation/historique Turbo, thème sur retour en cache, critères après changement de langue, nombre d'écouteurs de défilement sans accumulation, sitemap (14 URLs FR/EN, trois logements actifs, aucun logement archivé), 42 paires de contraste représentatives ≥ 4,5:1, mouvement réduit et contact visible sans JS. Galerie : commandes, miniatures, flèches clavier et gestes tactiles simulés à 320/1440 px ; images WebP et cartes différées chargées après défilement.
- **11 routes avec un vrai kernel local `prod`, debug désactivé** : pages principales 200 ; page absente, logement archivé, diagnostic et `/.env.local` 404. Erreurs réelles avec suggestions actives/noindex, sans débordement à 320 px ; absence de toolbar, `X-Debug-Token` et marqueurs de configuration sensible dans ces réponses. Le cache prod local préexistant contenait d'anciennes métadonnées Doctrine : nettoyé/réchauffé avec `cache:clear --env=prod --no-debug`, sans modification de données.
- **Réservation simulée** : `node tests/browser/booking-journey.cjs` réussi, 12 combinaisons FR/EN/thèmes/1440/390/320. Disponible, refus 422, panne, non vérifié, verrou fermé, minimum de nuits, capacité, nuit occupée/départ exclu, changement de critères/mois, annulation, ancien devis inutilisable, devis frais/tarif modifié, iframe à la demande, repli nouvel onglet et diagnostic sans action. Contrats HTTP 400/409/422/503 couverts par les tests PHP existants.

Les scripts `tests/browser/final-audit.cjs` et `final-interactions.cjs` sont reproductibles avec Chrome/Playwright déjà installés. Ils bloquent les domaines externes et les routes de réservation, remplacent toutes les API par des mocks. Le test d'interactions bloque aussi toutes les soumissions POST. Aucun contact valide envoyé, aucun paiement, réservation ou appel fournisseur réel. `ROAMING_BROWSER_URL` permet de choisir le serveur dev ; `ROAMING_PROD_BROWSER_URL` le serveur local prod, attendu sur le port 8001 par défaut. Ce dernier doit être lancé séparément avec un kernel prod réel, sans changer les secrets.

Commande responsive stricte : `ROAMING_AUDIT_STRICT=1` dans l'environnement du processus, puis `node tests/browser/final-audit.cjs`. `ROAMING_AUDIT_METRICS_ONLY=1` limite aux mesures et ne remplace pas le contrôle responsive ; `ROAMING_AUDIT_TAG` choisit le nom du rapport. Les rapports/captures de travail `var/audit-*.json`, `var/audit-*.png` ne sont pas versionnés.

## Mesures avant/après

Chrome local sur serveur dev, sans limitation CPU/réseau ; trois chargements avec cache navigateur vidé par page et largeur. Cache Symfony/OS non purgé. DOM et données locaux identiques, appels fournisseur mockés, font prête puis fenêtre d'observation. Transfert des ressources chargées pendant cette fenêtre, pas de l'ensemble des photos différées. Rapports : `var/audit-before.json`, `var/audit-after.json`, `var/audit-final.json` (160 rendus stricts), `var/audit-final-metrics.json` (mesure finale isolée).

| Page / largeur | Transfert avant → après | Lectures SQL avant → après | LCP médian avant → après | CLS maximal après |
| --- | --- | --- | --- | --- |
| Accueil 1440 | 1,57 → 1,22 Mo (−22 %) | 5 → 3 | 176 → 144 ms | 0,00041 |
| Lambersart 1440 | 5,78 → 1,40 Mo (−76 %) | 6 → 4 | 148 → 152 ms | 0 |
| Accueil 390 | 1,31 → 1,13 Mo (−14 %) | 5 → 3 | 140 → 160 ms | 0 |
| Lambersart 390 | 3,85 → 1,27 Mo (−67 %) | 6 → 4 | 132 → 168 ms | 0 |

LCP final observé au plus à 188 ms ; l'ensemble des mesures après correction (y compris l'autre série) reste ≤ 964 ms et CLS ≤ 0,00041, sous les objectifs locaux 2,5 s / 0,1. Le LCP n'améliore pas uniformément : ces très petites durées locales varient entre séries, malgré la baisse nette des octets et requêtes.

Event Timing sur les interactions échantillonnées : durée maximale finale 40 ms, seuil de collecte 16 ms. Une valeur zéro signifie qu'aucune entrée n'a dépassé ce seuil. **Il ne s'agit pas d'une mesure INP de terrain ni d'une certification CWV**. La barre dev et son coût réseau sont inclus dans ces mesures. Les 41 originaux pèsent 10,08 Mo ; les 145 variantes ensemble 6,02 Mo, mais une seule variante est sélectionnée par image affichée. Les originaux sont conservés.

## Limites et points à valider avant production

1. **GuestLucky réel non validé pendant cet audit.** Incohérence historique Roubaix non corrigée ; autorisation publique conservée telle qu'elle existait, sans ouverture/fermeture. Les tests avec verrou fermé sont des simulations ou une configuration isolée de test. Ne pas considérer ces tests comme une autorisation d'ouvrir les réservations ; revalider tarifs/calendriers, correspondances fournisseur et paiement dans un cadre autorisé.
2. **Pas de Lighthouse ni axe-core disponibles** ; aucun outil ajouté, aucun score annoncé. L'audit navigateur et les contrastes mesurés ne certifient pas WCAG 2.2 AA : contrôle humain avec lecteur d'écran, appareils tactiles réels et calendrier externe GuestLucky encore nécessaire. Les gestes tactiles testés sont synthétiques.
3. **Pas de mesure réseau mobile/CPU limitée ni de CWV de terrain.** Refaire les mesures en préproduction puis suivre LCP/CLS/INP réels. La police locale TTF et les CSS Bootstrap/Flatpickr restent des postes de transfert ; une conversion de police/purge globale n'a pas été introduite sans outil ou analyse suffisamment sûre.
4. **Configuration cible à vérifier, sans synchroniser les données locales :** cache prod propre/réchauffé, debug/profiler désactivés, domaine HTTPS/canoniques/OG/hreflang ; l'URL Sitemap statique historique de robots.txt reste `https://www.roamingfr.com/sitemap.xml`. Vérifier sa concordance avec le domaine cible.
5. **Serveur HTTP réel non audité :** compression Brotli/gzip, cache long immutable des seuls assets à nom versionné, en-têtes TLS/sécurité, accès aux fichiers privés et politique iframe/CSP doivent être vérifiés en préproduction. Ne pas mettre en cache public les formulaires CSRF, devis ou réponses de disponibilité. Aucun en-tête susceptible de casser GuestLucky/paiement n'a été ajouté aveuglément.
6. **Alertes CLI préexistantes lors du nettoyage prod :** extension intl absente, auto-mapping Doctrine déprécié, version serveur MySQL configurée ancienne pour DBAL. Non bloquantes pour les tests réalisés ; contrôler le runtime cible plutôt que modifier sa configuration ou migrer pendant cet audit.

**Verdict : prêt pour validation préproduction du code et de l'interface. La mise en production et l'ouverture des réservations restent conditionnées aux validations fournisseur, paiement, accessibilité et configuration cible ci-dessus.**
