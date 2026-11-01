# SEO Roaming Lille — préparation du lancement

État : corrections locales du 27 octobre 2026, déployées et vérifiées le 28 octobre 2026 à la demande du propriétaire. La maintenance reste active ; aucun changement de paiement ni synchronisation de données. Voir `LIVRAISON_20261028.md` pour le rapport de production et le réglage de redirection hPanel nécessaire à la destination canonique en un saut.

## Domaine et exploration

Le domaine public de référence est **https://roaminglille.com**, sans `www`. `SeoUrlGenerator` utilise ce domaine en environnement `prod` pour les métadonnées et le sitemap, tout en conservant le domaine de la requête en développement/test. Les coordonnées e-mail `contact@roamingfr.com` sont légitimes et n’ont pas été remplacées.

`public/robots.txt` déclare `https://roaminglille.com/sitemap.xml`. Les pages publiques, images, CSS, JS et variantes de langue restent explorables. Les exclusions concernent les API, diagnostics, profiler, espace équipe, redirections de réservation et changement de langue. Ces exclusions ne sécurisent pas les données : l’authentification reste nécessaire. Une page à désindexer doit conserver une instruction `noindex` accessible au robot ; ne pas masquer toutes les pages à désindexer avec un `Disallow` général.

Les règles préparées dans `.htaccess` redirigent `http://roaminglille.com`, `http://www.roaminglille.com` et `https://www.roaminglille.com` vers HTTPS sans www, en conservant chemin et paramètres. Elles ne visent ni localhost, ni 127.0.0.1, ni les domaines locaux `.test`. Le bouclier `.maintenance` existant garde sa priorité. Sa désactivation est une opération distincte de publication.

Le sitemap existant reste dynamique : accueil, disponibilités, à propos, contact et logements actifs, en FR/EN. Le catalogue local de cinq logements produit **18 URL**. Les logements archivés, critères de séjour, diagnostics, routes de paiement et documents juridiques provisoires n’y figurent pas. Les dates `lastmod` viennent des données réelles des logements.

## Métadonnées et contenus

Les titres et descriptions FR/EN précisent la location meublée et les destinations réellement présentes, dont Douai (hors métropole lilloise). Les noms courts visibles et les slugs restent inchangés. Les descriptions des fiches reprennent les textes propres aux logements, avec une coupe à la fin d’un mot ; les données structurées utilisent le contenu anglais disponible sur les pages anglaises.

Les canoniques, hreflang, Open Graph et URL JSON-LD utilisent le même générateur. Les critères de séjour et paramètres marketing ne sont pas repris dans les canoniques ; `_locale` est conservé et les alternates sont réciproques. La langue n’est pas changée par une redirection automatique. Le schéma conserve Organization, WebSite, ItemList, LodgingBusiness et BreadcrumbList selon les pages ; l’adresse et les coordonnées connues sont ajoutées aux fiches. Les notes ne sont rendues que lorsqu’un lien de source, une note et un nombre d’avis existent. Aucun nouveau prix, avis, temps de trajet, certification ou promesse de classement n’a été créé. Aucun balisage ne garantit un résultat enrichi Google.

Les images principales disposent déjà de dimensions, variantes responsives, formats optimisés et priorité de chargement ; les autres images sont différées. Le contrôle navigateur vérifie les dimensions, attributs alt, la priorité de l’image principale et l’absence de débordement à 320/390 px. Les images décoratives peuvent garder un alt vide.

## Vérifications locales

```powershell
php bin/console lint:yaml config translations
php bin/console lint:twig templates
php bin/console lint:container --env=prod --no-debug
php -d extension=pdo_sqlite bin/phpunit tests/Seo tests/GuestLucky tests/Legal
npm run build
node tests/browser/seo.cjs
```

Les tests PHP utilisent une base SQLite isolée ; le contrôle navigateur simule les erreurs des API de disponibilité et ne contacte pas GuestLucky. Le rapport des titres/descriptions réels est disponible dans `var/seo-browser-report.json`, avec des captures `var/seo-home-*.png` et `var/seo-property-*.png`.

La matrice de redirection a été vérifiée statiquement pour sept combinaisons de nom d’hôte/TLS. **Apache et son module rewrite ne sont pas disponibles dans cet environnement** : les règles devront être vérifiées par de vraies requêtes HTTP/HTTPS après transfert sur Hostinger. Le serveur PHP intégré ne lit pas `.htaccess`.

## Search Console — compte du client

1. Le client ouvre [Google Search Console](https://search.google.com/search-console/) avec son propre compte et ajoute une propriété **Domaine : roaminglille.com**. Il peut inviter ensuite un gestionnaire sans partager son mot de passe.
2. Google fournit un enregistrement TXT de vérification. Ajouter uniquement cette valeur au DNS du domaine, sans modifier les MX, SPF, DKIM ou autres enregistrements. Ne pas inventer de jeton et ne pas supprimer le TXT après validation.
3. Une fois le site publié et le sitemap accessible en HTTP 200, soumettre `https://roaminglille.com/sitemap.xml` dans « Sitemaps ».
4. Inspecter la version française de l’accueil et une fiche de logement, puis vérifier l’URL canonique, l’accessibilité à Google et la version anglaise. L’indexation n’est ni immédiate ni garantie.
5. Contrôler après publication les erreurs d’exploration, pages indexées et recherches de marque. GuestLucky reste le tableau de bord des réservations ; aucun dashboard marketing supplémentaire, GA4 ou Clarity ajouté.

## Contrôles impératifs lors de la publication

- Confirmer le déploiement des fichiers SEO, notamment `.htaccess` et `robots.txt`, qui sont exclus de certains anciens scripts de transfert ; sauvegarder leurs versions distantes avant remplacement.
- Vérifier que la configuration de production utilise `DEFAULT_URI=https://roaminglille.com`, sans modifier les secrets. La valeur est indiquée dans le fichier d’exemple.
- Ne retirer la maintenance qu’après validation distincte du site, du paiement, de la réservation et des conditions commerciales. Les pages juridiques restent provisoires/non indexables tant qu’elles ne sont pas validées.
- Vérifier les quatre variantes HTTP/HTTPS et www/sans www : une seule destination HTTPS sans www, pas de boucle, chemin et critères de séjour conservés. Vérifier également les fichiers statiques et la protection de l’espace équipe.
- Après ouverture, confirmer que l’accueil, les cinq logements, `robots.txt` et le sitemap répondent correctement. Les URL du sitemap doivent être publiques, indexables et en HTTP 200 ; les erreurs restent de vraies 404.
- Comparer source HTML, canoniques, hreflang, OG et JSON-LD ; aucun domaine local, ancien domaine web, critère de séjour ou jeton privé dans les métadonnées. Tester les URL dans les outils Google appropriés sans présumer l’éligibilité à Google Vacation Rentals.
- Refaire un contrôle mobile et de performances sur le véritable serveur, sans profiler/debug. Les observations locales ne constituent pas une mesure des Core Web Vitals des visiteurs.

## Références

- [Google : robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro?hl=fr)
- [Google : URL canoniques](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls?hl=fr)
- [Google : versions localisées et hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions?hl=fr)
- [Google : premiers pas avec Search Console](https://developers.google.com/search/docs/monitor-debug/search-console-start?hl=fr)
