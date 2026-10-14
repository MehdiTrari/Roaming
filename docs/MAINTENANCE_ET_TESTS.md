# Maintenance, accès équipe et tickets

## Fonctionnement

`SITE_MAINTENANCE=1` ferme le nouveau site aux visiteurs anonymes. L'accueil affiche une page Roaming en français ou anglais, avec téléphone, e-mail et « Accès équipe ». Les liens directs sont redirigés temporairement vers l'accueil ; les API et le sitemap répondent 503 sans données. L'accueil répond 200 pour cette période de validation prolongée. Les assets et `robots.txt` restent accessibles.

La connexion est disponible sur `/equipe/connexion`. Les comptes individuels ont accès au site, aux pages de test GuestLucky et aux tickets sur `/equipe/tickets`. Le bouton « Signaler un problème » ouvre une fenêtre sur la page visitée ; sans JavaScript, une page complète prend le relais. La création du ticket ouvre sa fiche ; les erreurs conservent le formulaire. Les tickets et captures restent privés même après ouverture publique.

Les trois personnes voient les tickets et commentaires. Seul un administrateur peut changer priorité et statut. Les captures sont stockées dans `var/private/ticket-captures`, jamais dans `public`. Les URLs enregistrées ne conservent que les paramètres de langue, logement, dates, voyageurs et mois/année ; les fragments sont supprimés. Les métadonnées navigateur sont déclaratives, elles ne constituent pas une preuve technique.

Les contacts et réservations sont réels. Le mode maintenance ne modifie pas `GUESTLUCKY_AVAILABILITY_ENABLED`. Si ce verrou est fermé, les pages de test permettent les lectures mais le parcours de réservation reste fermé. Ne l'ouvrir qu'après vérification de l'anomalie fournisseur décrite dans [GuestLucky_Integration.md](GuestLucky_Integration.md).

## Préparation locale et GitHub

Les changements existants du projet doivent être conservés. Examiner les différences avant commit : `.env` doit rester une configuration d'exemple, sans clé GuestLucky, secret de production, mot de passe SMTP ou accès de production à la base. Les configurations privées `.env.local`, `.env.prod.local` et `.env.local.php` sont ignorées par Git et ne doivent pas entrer dans une archive de déploiement.

La valeur livrée dans `.env` est `SITE_MAINTENANCE=1`. Pour continuer à développer sans connexion, mettre `SITE_MAINTENANCE=0` dans `.env.local`. Les tests utilisent leur propre réglage. Aucun compte réel ni mot de passe n'est fourni dans le dépôt.

Vérifications locales :

```powershell
php -d extension=pdo_sqlite -d extension=fileinfo bin/phpunit
php bin/console lint:yaml config translations
php bin/console lint:twig templates
php bin/console lint:container --env=prod --no-debug
composer validate --no-check-publish
npm run build
```

Sous Linux, activer les extensions dans PHP plutôt que les options `-d` si elles sont déjà compilées. `fileinfo` est indispensable pour vérifier le contenu des captures ; `pdo_sqlite` sert uniquement aux tests isolés. Avant production, vérifier aussi PHP >= 8.4, les extensions Composer et le pilote de la base. Composer signale des vulnérabilités dans les dépendances déjà verrouillées : les examiner avec `composer audit` et traiter les mises à jour séparément, sans ignorer les alertes.

## Déploiement FTP avec terminal

1. Sauvegarder hors du dossier public les fichiers actuels, la base, la configuration privée et les uploads. Garder une copie de l'ancien `.htaccess`.
2. Transférer d'abord `public/maintenance.php`, puis le `.htaccess` comprenant le bloc « Temporary upload shield ». Créer un fichier vide `public/.maintenance` via le panneau/FTP. Vérifier dans un navigateur que le domaine et un lien profond retournent cette page avec HTTP 503. Ce bouclier est indépendant de Symfony et reste actif jusqu'à suppression du fichier. Si le document root diffère de `public`, adapter le chemin de ce marqueur dans le panneau avant le transfert principal.
3. Transférer le code, les migrations et `public/build` entièrement compilé. Préserver les uploads, les configurations privées et tout `var/private`. Ne pas transférer les caches locaux, `node_modules`, `.git`, les bases de test, ni les scripts `tests/`.
4. À la racine du projet sur le serveur, configurer dans `.env.prod.local` (ou les variables du panneau) `APP_ENV=prod`, `APP_DEBUG=0`, `SITE_MAINTENANCE=1`, un `APP_SECRET` unique et non vide, et les accès réels de base/mail/GuestLucky. Vérifier aussi `APP_ENV` dans `.env.local` si ce fichier existe. Ne pas copier la configuration locale de développement sur le serveur.
5. Exécuter les commandes ci-dessous. Lire la liste des migrations en attente avant de les appliquer : il y a aussi des migrations antérieures dans les changements actuels. Ne pas charger les fixtures sur la production.

```bash
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction --no-scripts
php -r 'exit(extension_loaded("fileinfo") ? 0 : 1);'
php bin/console doctrine:migrations:status --env=prod --no-debug
php bin/console doctrine:migrations:migrate --env=prod --no-debug
php bin/console app:team:user votre-email@example.com --name="Votre prénom" --admin --env=prod --no-debug
php bin/console app:team:user testeur1@example.com --name="Testeur 1" --env=prod --no-debug
php bin/console app:team:user testeur2@example.com --name="Testeur 2" --env=prod --no-debug
php bin/console assets:install public --env=prod --no-debug
php bin/console cache:clear --env=prod --no-debug
```

La commande de comptes demande le mot de passe deux fois, sans affichage ni argument dans l'historique. Utiliser au moins 12 caractères et au plus 72 octets ; transmettre les accès individuellement hors du dépôt. Les comptes existants ne sont jamais écrasés implicitement. Pour réinitialiser un mot de passe en conservant les droits :

```bash
php bin/console app:team:user testeur1@example.com --reset-password --env=prod --no-debug
```

Le changement du mot de passe invalide les sessions existantes lors de leur prochain rafraîchissement. Le site n'a pas d'inscription publique ni de récupération du mot de passe par e-mail. Les cookies sont HttpOnly, SameSite=Lax et sécurisés lorsque la requête est HTTPS. Si l'hébergeur utilise un proxy, vérifier que Symfony reconnaît HTTPS avec sa configuration de confiance existante.

6. Si le serveur utilise une configuration d'environnement compilée `.env.local.php`, la régénérer selon sa procédure existante avant de reconstruire le cache. Vérifier les droits d'écriture de `var/cache`, `var/log` et `var/private/ticket-captures`. Configurer `upload_max_filesize` à au moins 5M et `post_max_size` à au moins 8M ; vérifier que `fileinfo` est aussi actif dans le PHP web, pas seulement le terminal.
7. Retirer **uniquement** `public/.maintenance` par FTP. L'accueil doit alors afficher la maintenance applicative avec HTTP 200, et la connexion doit fonctionner. Tester dans un navigateur privé et un navigateur connecté : accueil, API, liens directs, connexion/déconnexion, création d'un ticket et accès à sa capture. Purger/désactiver les caches HTML du panneau/CDN pendant les tests ; ne jamais mettre en cache les pages privées ni `/equipe`.

Les messages de contact utilisent le transport Messenger existant. Si l'envoi est asynchrone, conserver le consommateur/cron déjà prévu par l'hébergement ; les tickets ne dépendent ni d'e-mail ni d'un worker.

## Ouverture publique et retour arrière

Pour ouvrir le site, définir `SITE_MAINTENANCE=0` dans la configuration privée du serveur, régénérer la configuration compilée si utilisée, reconstruire le cache `prod` et purger les caches du panneau/CDN. Vérifier le nouveau site sans cookie et l'accès privé aux tickets. Ne pas oublier que le verrou GuestLucky est indépendant.

En cas d'échec de déploiement, recréer `public/.maintenance` pour masquer immédiatement les pages. Restaurer les anciens fichiers et dépendances, préserver les uploads/configurations et capturer une sauvegarde des nouveaux tickets/captures avant toute restauration de base. Les nouvelles tables sont additives : ne pas lancer de migration inverse ni restaurer aveuglément une ancienne base après des réservations/contacts réels. Une restauration de base doit réconcilier les données reçues depuis la sauvegarde. Reconstruire le cache de l'ancienne version ; retirer le marqueur uniquement après validation de celle-ci.

## Vérification navigateur locale isolée

Ces fixtures utilisent exclusivement `var/team-browser.sqlite` et ne doivent jamais être lancées ou transférées sur le serveur de production. Elles créent deux comptes fictifs, aucune réservation.

```powershell
$env:DATABASE_URL='sqlite:///%kernel.project_dir%/var/team-browser.sqlite'
php -d extension=pdo_sqlite tests/browser/team-fixture.php
$env:APP_ENV='prod'
$env:APP_DEBUG='0'
$env:SITE_MAINTENANCE='1'
$env:GUESTLUCKY_AVAILABILITY_ENABLED='0'
php bin/console cache:clear --env=prod --no-debug
php -d extension=pdo_sqlite -d extension=fileinfo -S 127.0.0.1:8014 -t public tests/browser/team-router.php
```

Dans un second terminal : `node tests/browser/team-preview.cjs`. Playwright et Chrome sont nécessaires. Le script bloque les domaines externes et les parcours de réservation, vérifie FR/EN, les largeurs 320/390/1440 px, deux sessions distinctes, connexion, dialogue, ticket et déconnexion. Arrêter ensuite le serveur et fermer le terminal dédié pour rétablir l'environnement local habituel.
