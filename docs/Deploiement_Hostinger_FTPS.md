# ROAMING — préparation et déploiement FTPS sans SSH

## État courant : maintenance Symfony et accès équipe, 24 octobre 2026

Après la demande de mise en service de l'accès équipe, le bouclier statique de transfert a été archivé sous `public_html/.maintenance-upload-complete-20261024`. Les fichiers `maintenance.php`, `.htaccess` et `index.php` n'ont pas été modifiés. `SITE_MAINTENANCE=1` reste actif : les visiteurs voient maintenant la maintenance applicative avec son lien « Accès équipe ». L'accueil répond 200 avec `private, no-store`, les liens vers les logements restent fermés et les API anonymes répondent 503. Les assets et la connexion sont accessibles. Les mentions ci-dessous sur le bouclier intégral et les pages 503 décrivent la phase de transfert initiale.

Le compte `equipe@roaming.prod` a été créé avec `ROLE_ADMIN` après confirmation explicite du propriétaire. Les identifiants générés restent dans `var/private/hostinger-team-activation-20261024/identifiants-equipe.txt`, ignoré par Git. Aucun compte local n'a été copié et aucun compte existant réinitialisé.

Les six variables GuestLucky ont été reprises du `.env.local` local vers les deux fichiers privés distants `.env.prod.local` et `.env.local.php`, sans remplacer l'environnement complet. Les valeurs de base de données, d'e-mail, d'`APP_SECRET` et le mode `prod` sans debug restent inchangés. `GUESTLUCKY_AVAILABILITY_ENABLED=1` est maintenant configuré pour les essais connectés demandés ; la maintenance continue à bloquer les API et les réservations anonymes. Les jetons MCP restent côté serveur. Cette opération ne crée pas de synchronisation planifiée : la tâche Windows locale n'est pas un cron Hostinger.

Vérifications réelles réussies : connexion/déconnexion, accueil et quatre fiches accessibles à l'équipe, tickets accessibles, maintenance FR/EN sur ordinateur et mobile sans débordement, API bloquée anonymement, lecture du calendrier GuestLucky de Lambersart avec état `fresh`, aucune réservation ni écriture chez le fournisseur. Rapports : `var/backups/hostinger-team-activation-20261024/TEAM-ACCESS-VERIFIED.json` et `APPLICATION-MAINTENANCE-VERIFIED.json`. La configuration et la base ont été sauvegardées avant cette phase. Pour rétablir le bouclier statique en cas de panne, renommer son marqueur archivé en `.maintenance` via FTP, sans modifier `SITE_MAINTENANCE=1`.

## Déploiement initial

Préparation du 23 octobre 2026, **déploiement confirmé et effectué le 24 octobre 2026** sur `roaminglille.com`, compte `u587053106`. La page de maintenance existante a été conservée à l'identique pendant et après l'opération. Les imports SQL, le transfert FTPS et le complément de configuration sont appliqués.

Résultat vérifié : 161 fichiers transférés et relus avec contrôle SHA-256, 7 558 fichiers inchangés validés contre la sauvegarde, 96 dépendances Composer de production, 33 anciens paquets de développement archivés dans le dossier privé. L'ancien cache est conservé dans `smogii/var/cache/prod-before-20261024` et un dossier de cache vierge est prêt. Le nouvel export SQL confirme huit versions Doctrine, sept logements conservés dont quatre actifs, et la préservation exacte des 160 contacts et 119 références de photos. Les pages FR/EN et la fermeture de l'accès équipe répondent toujours 503 avec le contenu d'origine et `no-store`.

Rapports locaux : `var/backups/hostinger-predeploy-20261024/DEPLOYMENT-COMPLETE.json`, `FTPS-VERIFIED.json`, `DATABASE-VERIFIED.json` et `HTTP-VERIFIED.json`. Le rendu Symfony distant reste masqué par le bouclier intégral, conformément à la demande ; aucun contournement de maintenance n'a été ajouté.

## Cible constatée

- Domaine : `roaminglille.com`, compte `u587053106`, offre Single sans SSH.
- Serveur FTP fourni : `147.93.93.183:21`, accessible par `ftp.roaminglille.com`.
- FTPS explicite : contrôle et données chiffrés, certificat Hostinger vérifié. Aucun repli vers FTP non chiffré.
- Racine du compte FTP : `/`. Racine du domaine : `/domains/roaminglille.com`.
- Application privée : `/domains/roaminglille.com/smogii`.
- Racine web : `/domains/roaminglille.com/public_html`.
- PHP web : 8.4.26 ; `intl`, `fileinfo`, PDO/MySQL, OpenSSL et les extensions nécessaires sont disponibles.
- Base utilisée par la configuration distante : `u587053106_roaming`, MariaDB 11.8.9. L'autre base du compte n'est pas utilisée par Symfony et reste intacte.

L'`index.php` distant charge `../smogii/vendor/autoload_runtime.php`. Il doit être conservé : l'index de développement local utilise une autre disposition.

La fermeture publique repose actuellement sur **trois fichiers existants** dans `public_html` : `.maintenance`, `maintenance.php` et `.htaccess`. Le marqueur est présent, la page française et anglaise répond en 503 avec `Cache-Control: no-store`. La connexion équipe est elle aussi couverte par ce bouclier. Le chemin `/.env` répond 403 ; les chemins sensibles testés restent derrière la maintenance.

## Sauvegarde réalisée

Dossier local privé et ignoré par Git :

`var/backups/hostinger-predeploy-20261023/`

- `files/public_html/` : copie complète des fichiers publics, uploads et maintenance compris.
- `files/smogii/` : copie complète de l'application, dépendances, configuration privée, cache et fichiers privés compris.
- `manifest.json` : chemin distant, taille, date distante et SHA-256 de chaque fichier.
- `FILES_COMPLETE` : marqueur créé uniquement après téléchargement de tous les fichiers inventoriés.
- `BACKUP_VERIFIED.json` : résultat de la seconde vérification locale des tailles et empreintes.
- `database/u587053106_roaming.sql` : export SQL structure et données obtenu par l'interface Export de phpMyAdmin.
- `http-before.json` : réponses et empreintes des pages publiques avant opération.

La copie des fichiers contient **10 593 fichiers, 93 981 057 octets**. L'export SQL contient sept tables et pèse 112 192 octets. Le mot de passe FTPS est saisi au prompt masqué ; il n'est enregistré ni dans les scripts, ni dans les arguments de commande, ni dans la livraison. Les sauvegardes contiennent naturellement la configuration et les données privées du serveur : elles doivent rester hors du Web et hors du dépôt.

Une sauvegarde FTPS peut être relancée dans un **nouveau dossier daté** :

```powershell
python scripts/hostinger_ftps.py backup --remote /domains/roaminglille.com --output var/backups/hostinger-NOUVELLE-DATE
```

En cas d'interruption, reprendre le même dossier avec `--resume`. Le script ne possède aucune fonction d'envoi, suppression ou commande distante. Il vérifie les copies existantes avant de les réutiliser.

## Livraison locale

Dossier : `var/deployment/roaminglille-20261023/`.

Archive de code : `var/deployment/roaminglille-20261023-code.zip`. Elle contient seulement les deux dossiers de transfert, pas les sauvegardes, les imports SQL ni la configuration privée.

| Dossier local | Destination distante | Contenu |
| --- | --- | --- |
| `smogii/` | `/domains/roaminglille.com/smogii/` | Code Symfony, configuration de code, traductions, migrations, assets sources utiles au conteneur, dépendances Composer sans développement, manifestes privés des assets |
| `public_html/` | `/domains/roaminglille.com/public_html/` | Assets compilés, images graphiques du site, polices et styles |

Sont volontairement absents des dossiers de transfert : `.env*`, `var`, caches de validation, `.git`, `node_modules`, tests du projet, dumps SQL, uploads, scripts de maintenance, `.maintenance`, `.htaccess`, `index.php` et `robots.txt` existants. Les fichiers sensibles et `vendor` ne vont **jamais** dans `public_html`.

Le contrôle a également trouvé un `.env.local.php` dans `public/images/responsive` du projet local. Il a été retiré de cet emplacement et de la livraison, et conservé sous `var/private/hostinger-deployment-20261023/quarantine`. Il n'était présent dans aucun des deux dossiers sauvegardés de production. Le `.gitignore` exclut désormais aussi les variantes imbriquées de ces fichiers privés ; leur historique Git antérieur n'a pas été réécrit.

La comparaison sans affichage des valeurs confirme que ce fichier suivi par Git contenait les mêmes `APP_SECRET`, `DATABASE_URL` et `MAILER_DSN` que la configuration de production. Le retrait du paquet n'annule pas cette présence dans l'historique. Le renouvellement des secrets concernés et le traitement de cet historique doivent être préparés séparément ; aucun identifiant distant n'a été renouvelé pendant cette intervention, conformément à la conservation demandée de la configuration existante.

Les images de logements restent celles du serveur. Croix et Douai n'ont pas de photos confirmées dans le catalogue local ; la livraison conserve leur affichage « Photos à venir » sans réutiliser les images d'un autre bien.

Préparation effectuée dans un dossier isolé : installation Composer verrouillée, `--no-dev --prefer-dist --optimize-autoloader --no-scripts`, build Encore de production, validation du conteneur, installation des assets des bundles et essai de création du cache de production. Les scripts Composer automatiques ne sont pas exécutés contre la production.

Les caches générés sous Windows sont ensuite retirés de la livraison : ils contiennent des chemins propres au poste. Le conteneur et les caches Twig seront reconstruits sur Linux à la première requête Symfony autorisée. Le bouclier `.maintenance` empêche cette requête pendant la fermeture actuelle ; **aucun script HTTP d'administration ni exception publique au bouclier n'est ajouté**. Le rendu réel derrière ce bouclier ne pourra donc être validé à distance tant qu'il reste intégralement actif ; les essais du nouveau code sont réalisés localement sur la copie de base.

## Changements de base préparés, sans remplacement de base

La production ne possède pas d'historique Doctrine et sa structure correspond aux deux premières migrations déjà réalisées. Les tables équipe et les colonnes GuestLucky sont absentes. Lancer toutes les migrations directement tenterait de recréer des tables existantes.

Les fichiers à utiliser dans **phpMyAdmin**, jamais à déposer dans `public_html` :

1. `00-preflight-read-only.sql` : contrôler le nom de base, les sept tables de départ et les cinq logements attendus.
2. `01-database-upgrade-reviewed.sql` : créer l'historique Doctrine, reconnaître les deux migrations de départ et appliquer les six évolutions suivantes. Il ajoute des colonnes et les tables équipe/tickets ; il ne remplace pas les données métier.
3. `02-reviewed-catalogue.sql` : appliquer uniquement le catalogue explicitement choisi par le propriétaire : Lambersart, Roubaix, Croix et Douai. Les deux nouveaux logements sont ajoutés ; les anciens Marcq et Wazemmes restent en base, masqués. Les identifiants et médias des logements existants restent conservés. Les nouvelles associations d'équipements s'ajoutent aux anciennes.

Résultat testé : **sept logements conservés, quatre actifs**. Croix annonce neuf personnes mais reste limité à huit pour une réservation en ligne. Aucun compte équipe ni mot de passe de développement n'est importé. Le provisionnement d'un premier compte équipe restera à réaliser séparément, avant une future ouverture de cet accès.

La simulation a été réalisée sur des copies locales isolées de l'export, avec MySQL 8.4, avant exécution réussie des scripts sur la MariaDB 11.8.9 distante. `database-validation.json` et `catalogue-validation.json` documentent les contrôles initiaux ; `DATABASE-VERIFIED.json` contrôle le résultat réel depuis un nouvel export de production. Les données des contacts, messages, avis et photos restent identiques, ainsi que les équipements et relations préexistants. Répéter l'import du catalogue ne crée pas de doublons ; l'import de structure ne doit pas être relancé sur la base désormais à jour.

**Avant un import effectif**, refaire un export SQL frais, comparer le résultat de `00-preflight-read-only.sql` avec la situation attendue, puis arrêter au premier écart. Ne pas charger les fixtures, ne pas importer la base locale complète et ne pas utiliser `doctrine:schema:update --force`. Le vieux snapshot de catalogue de septembre ne contient que trois logements : ne pas le réimporter par-dessus le catalogue à quatre logements préparé ici.

## Configuration privée à compléter

La production charge un `.env.local.php` compilé qui ne contient pas les nouvelles variables maintenance/GuestLucky. Une proposition privée est préparée dans :

`var/private/hostinger-deployment-20261023/`

- `.env.local.php` : les dix valeurs existantes sont conservées ; seules les sept clés manquantes sont ajoutées. `APP_ENV=prod` et `APP_DEBUG=0` restent inchangés. Les nouveaux réglages maintiennent `SITE_MAINTENANCE=1` et `GUESTLUCKY_AVAILABILITY_ENABLED=0`.
- `.env.prod.local.append` : fragment destiné à être ajouté au fichier privé existant, **sans le remplacer**, pour conserver les nouveaux réglages lors d'une future régénération de l'environnement compilé.

Ces fichiers sont exclus de l'archive de code. Ils doivent être transférés uniquement vers le dossier privé `smogii`, après sauvegarde et validation. Aucun secret existant de base, de messagerie ou d'application n'est modifié. Aucune clé GuestLucky absente n'est inventée et aucune réservation n'est activée.

## Procédure validée et appliquée

1. Vérifier à nouveau la maintenance française et anglaise, puis l'empreinte des trois fichiers du bouclier. Ne jamais les supprimer, les renommer ou les remplacer. Ne pas activer de synchronisation avec suppression des fichiers absents du dossier local.
2. Vérifier la sauvegarde complète et refaire un export SQL frais si l'opération a lieu plus tard. Conserver les anciens fichiers et la configuration dans un emplacement privé de restauration.
3. Dans phpMyAdmin, sélectionner `u587053106_roaming`, contrôler `00-preflight-read-only.sql`, puis importer les fichiers `01` et `02` dans cet ordre. En cas d'erreur, arrêter : les opérations DDL MySQL/MariaDB ne sont pas toutes annulables par une transaction. Contrôler les quatre logements actifs et les huit versions Doctrine après les imports.
4. Décompresser l'archive **sur le poste**, puis envoyer le contenu de `smogii/` dans le dossier privé distant correspondant et le contenu de `public_html/` dans le dossier public correspondant. Ne jamais envoyer la racine du projet dans `public_html`. Les fichiers de code du paquet remplacent leurs versions précédentes ; les uploads, configurations privées et données hors paquet restent en place.
5. Appliquer le complément de configuration privée approuvé. Conserver la version précédente de `.env.local.php` hors du Web. Ne pas remplacer `.env.prod.local` par le fragment : ajouter seulement les lignes manquantes.
6. Par FTP, renommer uniquement `smogii/var/cache/prod` en un nom de sauvegarde daté, sans déplacer ni supprimer `var/private`, les sessions, les logs ou les uploads. Créer si nécessaire `var/cache`, `var/log` et `var/private/ticket-captures`, avec des droits permettant l'écriture au propriétaire PHP ; ne pas utiliser `777`. Ne pas transférer le cache local.
7. Vérifier les tailles/empreintes des fichiers transférés et les correspondances des manifestes Encore privés/publics. Vérifier à nouveau le bouclier inchangé et les réponses HTTP publiques 503 FR/EN, `no-store`, et les chemins sensibles. Le marqueur `.maintenance` reste présent.

### Paramètres FileZilla si le transfert est effectué manuellement

- Protocole : FTP ; chiffrement : **exiger une connexion FTP explicite sur TLS** ; mode passif.
- Hôte : `147.93.93.183` ; port : `21` ; utilisateur : `u587053106` ; saisie du mot de passe au moment de la connexion.
- Le service partagé présente un certificat pour `hstgr.io` / `*.hstgr.io`, et non pour le domaine client. L'identité et la chaîne ont été validées lors des essais FTPS. Empreinte SHA-256 observée : `e09df5ea7a0730280d0d898f18263905c0f980687dd90da5679837db40bdc493`. Si le certificat diffère, le faire vérifier plutôt que d'accepter automatiquement l'avertissement. Un renouvellement de certificat change normalement son empreinte.
- Afficher les fichiers cachés. Transférer les fichiers du paquet, sans effacer les fichiers distants absents du paquet. Aucun mot de passe n'est fourni dans un fichier de site ou dans cette procédure.

## Restauration sans SSH

En cas d'incident, **garder les trois fichiers de maintenance actuels inchangés**. Le public continue à voir la page d'origine pendant la remise en état.

Restaurer les fichiers de code privés et les assets publics depuis `files/smogii` et `files/public_html`, en préservant les éventuelles données reçues depuis la sauvegarde. Restaurer la configuration privée précédente si le complément pose problème. Écarter uniquement le cache de la version échouée afin que l'ancienne version reconstruise le sien. Les colonnes et tables ajoutées peuvent rester en base : ne pas lancer les migrations inverses ou supprimer des tables pour un simple retour au code précédent.

Pour revenir aussi sur le catalogue, préparer une restauration **ciblée** des champs concernés à partir du dump et contrôler les éventuelles nouvelles références aux deux logements ajoutés. Ne pas supprimer automatiquement ces logements ni réimporter aveuglément le dump complet par-dessus des contacts ou autres écritures plus récentes. Toute restauration complète de base exige un export de l'état après incident et une réconciliation des nouvelles données.

La maintenance reste active après la restauration comme après un déploiement réussi. Une ouverture publique ultérieure sera une opération distincte demandée par le propriétaire.
