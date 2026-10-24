# Bannière de cookies

Le bandeau non modal apparaît en bas de page lorsqu'aucune décision GuestLucky valide n'est mémorisée. Il propose « Tout refuser », « Tout accepter » avec la même importance visuelle, et « Personnaliser ». La page reste utilisable ; le chargement initial ne déplace pas le focus. Les libellés existent en français et en anglais, avec adaptation aux thèmes clair/sombre et aux écrans de 320 px.

Le module intégré GuestLucky reste bloqué sans autorisation. Une fois accepté dans le bandeau, il s'ouvre normalement à la demande, après vérification du devis. Si une réservation attend une décision, l'acceptation poursuit cette ouverture dans le même parcours, sans case à cocher. Si le module a été refusé, un clic ultérieur pour l'intégrer présente à nouveau le bandeau ; l'ouverture volontaire dans un nouvel onglet reste disponible.

Les clés existantes `roaming.privacy.v1` et `roaming.maps.v1` restent compatibles. Acceptations et refus ont une durée maximale de 180 jours. Les mécanismes essentiels continuent de fonctionner ; la carte conserve ses préférences indépendantes. Modifier seulement la carte ne prolonge pas une autorisation GuestLucky existante. Sans accès au stockage, le choix vaut pour l'onglet courant.

« Personnaliser » et les liens de gestion des cookies ouvrent les réglages détaillés. Fermer ces réglages ou annuler une demande avec Échap ne donne aucune autorisation. Retirer l'accord depuis un autre onglet ferme le module déjà ouvert et annule sa création pendant la vérification d'un devis. Les changements de critères et les navigations Turbo annulent aussi les demandes en attente.

## Validation

`tests/browser/privacy.cjs` couvre le premier affichage, les décisions en un clic, la persistance, les décisions expirées ou mal formées, les retraits entre onglets, le stockage bloqué et 24 combinaisons d'affichage bannière/réglages. Les calendriers, devis et réservations sont simulés ; aucune réservation réelle n'est créée.

`scripts/hostinger_cookie_verify.cjs` vérifie aussi le maintien du choix entre la page de maintenance et la connexion équipe en production. Son fichier temporaire de session est privé et supprimé à la fin du test.

## Déploiement et restauration

`scripts/hostinger_cookie_deploy.py` prépare un instantané puis transfère les fichiers par FTPS. Les nouvelles ressources compilées sont envoyées avant le changement des manifestes Symfony. Les anciennes ressources sont conservées pour les onglets ouverts et une éventuelle restauration. La configuration, le point d'entrée, la maintenance et la base ne sont pas modifiés.

Les fichiers précédents et les empreintes se trouvent dans `var/backups/hostinger-cookies-20261024/`. Pour revenir à la version précédente, rétablir les fichiers avec une empreinte `before` non nulle depuis le sous-dossier `files`, puis archiver le cache courant et rétablir `smogii/var/cache/prod-before-cookies-20261024` sous le nom `prod`. Les nouveaux fichiers compilés peuvent rester présents : les anciens manifestes ne les référencent plus. Vérifier ensuite la maintenance publique et la connexion équipe. Aucun retour arrière de base n'est nécessaire pour ce changement.
