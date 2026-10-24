# Photos des logements et GuestLucky

Les logements actifs associés à un identifiant GuestLucky utilisent sa galerie publique de réservation. Lambersart (identifiant 2475) est exclu : ses images et leur ordre restent locaux. Les logements archivés et ceux sans correspondance ne sont pas modifiés. Cette tâche ne crée aucun logement.

Le connecteur MCP ne fournit actuellement pas les photos. `PhotoClient` lit uniquement le bloc `#gl-gallery` de la page Booking Engine, avec la clé de réservation chargée depuis la configuration privée. Aucune écriture n'est envoyée à GuestLucky. Les images sont affichées directement depuis son stockage public HTTPS ; aucune clé ni aucun jeton ne figure dans leurs URL.

La première image devient la couverture ; les ajouts, suppressions et réordonnancements sont répercutés. La base conserve les URL, les positions et la couverture, sans télécharger les originaux. Les pages, carrousels, cartes, résultats de disponibilité et métadonnées partagent le même résolveur d'images. Les variantes locales de Lambersart restent utilisées.

## Exécution

```sh
php bin/console app:guestlucky:photos              # simulation
php bin/console app:guestlucky:photos --apply      # application
```

Sur Windows, `scripts/guestlucky-sync.ps1` lance aussi cette commande après la synchronisation du catalogue, dans l'environnement `dev` par défaut (`-Environment prod` pour le changer). En production, la tâche Hostinger `j9R5KvD6YF` du compte `u587053106` lance uniquement les photos toutes les cinq minutes ; elle ne publie pas les nouveaux logements du compte GuestLucky.

Commande de production :

```sh
/opt/alt/php84/usr/bin/php /home/u587053106/domains/roaminglille.com/smogii/bin/console app:guestlucky:photos --apply --env=prod --no-debug --no-interaction > /home/u587053106/domains/roaminglille.com/smogii/var/guestlucky/photos-cron.log 2>&1
```

Le délai est de cinq minutes environ, puis un rechargement de la page est nécessaire. Une page déjà ouverte ne reçoit pas de notification. Les images restent soumises au cache du stockage GuestLucky si un fichier est remplacé à URL identique.

Toutes les galeries sont validées avant la transaction en base. Une erreur réseau, une page inattendue ou une URL non reconnue annule la mise à jour du lot et conserve les dernières références valides. Un bloc de galerie explicitement vide retire ses références ; un bloc absent est considéré comme une erreur. Si GuestLucky change son HTML, l'adaptateur doit être ajusté. Une indisponibilité du stockage d'images lui-même peut empêcher leur affichage même si les références sont conservées.

## Suivi et restauration

`var/guestlucky/photos-status.json` indique le dernier succès, la dernière tentative et les comptes par logement. Le verrou `photos.lock` empêche les exécutions concurrentes. Chaque modification crée d'abord un fichier privé `photos-backup-*.json` contenant les anciennes références. Les anciens fichiers sous `public/uploads` ne sont pas supprimés ; ils restent disponibles pour une restauration.

Le déploiement du 24 octobre est journalisé dans `var/backups/hostinger-photos-20261024/` : export SQL complet avant modification, versions précédentes des fichiers, empreintes de la configuration et de la maintenance. `scripts/hostinger_photos_deploy.py` prépare puis transfère uniquement onze fichiers privés par FTPS, sans modifier les secrets, le point d'entrée ou la maintenance.

Pour restaurer : arrêter la tâche de photos dans Hostinger ; restaurer les fichiers privés listés dans `PATCH-PLAN.json` depuis le sous-dossier `files` (retirer les quatre nouvelles classes si leur entrée `before` est nulle) ; restaurer les associations `property_image` des seuls logements concernés depuis l'export SQL ou les journaux privés, sans écraser les autres données métier ; archiver le cache `var/cache/prod` puis régénérer le cache via le prochain accès. Vérifier la connexion équipe et la maintenance publique avant de remettre la tâche en service. L'ancien cache est aussi conservé sous `var/cache/prod-before-photos-20261024`.
