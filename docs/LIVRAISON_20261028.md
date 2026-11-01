# Livraison effectuée le 28 octobre 2026

Déploiement effectué sur `https://roaminglille.com` : 202 fichiers comparés, 53 fichiers nouveaux ou modifiés sauvegardés/transférés et relus avec contrôle SHA-256. L’ancien cache est conservé sous `smogii/var/cache/prod-before-release-20261027T231320Z`. Sauvegardes et journal : `var/backups/hostinger-release-20261027T231320Z`.

Vérification réelle réussie après transfert : accès équipe et déconnexion, avis et liens de remplacement masqués en FR/EN, 14 pages HTTP 200, cinq logements déjà présents en base distante, une icône SVG pour chaque équipement affiché, canoniques/OG cohérents et JSON-LD valide. Le sitemap authentifié contient 18 URL et le cinquième logement ; le fichier robots est accessible publiquement. Aucun débordement de l’accueil à 320/390 px et aucune erreur JavaScript observée. Les visiteurs anonymes conservent la maintenance et les API restent bloquées. Rapport : `var/deployment/release-20261028/PRODUCTION-VERIFIED.json`.

Le forçage HTTPS de hPanel créait une double redirection sur `http://www.roaminglille.com`. Il a été désactivé après sauvegarde de son état : les règles `.htaccess` déployées imposent maintenant directement `https://roaminglille.com` en un saut pour les trois variantes. Chemins et paramètres sont conservés. Le certificat SSL reste actif. Ne pas réactiver la redirection hPanel sans vérifier à nouveau cette chaîne.

## Correctif de localisation après livraison

La vérification visuelle demandée ensuite a révélé que La Petite Cour existait bien en production, mais avec `latitude = NULL` et `longitude = NULL`. Les quatre autres logements étaient localisés ; cela expliquait l’impression de panne intermittente selon la fiche affichée. La simple présence du cinquième logement ne suffisait donc pas à valider sa carte.

Après export complet de sauvegarde, une mise à jour SQL strictement ciblée sur GuestLucky 2650, son slug, son adresse exacte et ses coordonnées nulles a enregistré les coordonnées déjà vérifiées dans `config/property_locations.json` : latitude `50.623037`, longitude `3.056473`. Un nouvel export confirme que seules ces deux colonnes de cette ligne ont changé. Les données, sauvegardes et preuves privées sont conservées dans `var/backups/hostinger-map-lille-20261028`.

Contrôles réels réussis : huit chargements OpenFreeMap au fil des navigations Turbo, les cinq fiches, cinq marqueurs dans les disponibilités, retour sur La Petite Cour, rendu sur ordinateur et mobile, maintien de la maintenance. Le contrôle de livraison vérifie désormais les coordonnées numériques de chaque fiche en production, en plus de son HTTP 200. Rapport `MAPS-VERIFIED.json` et captures `lille-map-desktop.png`, `lille-map-mobile.png`. Aucune modification de code applicatif ni nouveau transfert FTPS n’a été nécessaire pour ce correctif de données.

La section d’accueil contenant les avis et les liens Airbnb de remplacement est masquée en FR/EN (`guest_reviews_visible: false`). Le composant reste disponible pour une réactivation ultérieure.

Le paquet local `var/deployment/release-20261028/manifest.json` contient 202 fichiers, avec contrôle SHA-256 : sources applicatives, configuration non secrète, traductions, templates, assets compilés, robots.txt et règles de redirection. Il exclut les environnements privés, le bootstrap public propre au serveur, les données locales, les photos existantes, les caches Windows et les artefacts de tests.

Vérifications réussies : 88 tests PHP / 1 043 assertions ; syntaxe de 42 templates et 33 fichiers YAML ; conteneur de production ; compilation Encore ; tests navigateur du masquage réel, du carrousel isolé, de 14 pages FR/EN, des cinq logements locaux et des 18 URL du sitemap. Les vérifications navigateur couvrent aussi les petits écrans.

## Transfert

La structure du serveur place Symfony dans le dossier privé `smogii`, à côté de `public_html`. L’opération de déploiement générique du connecteur Hostinger ne propose pas cette destination privée. Le script FTPS suit donc cette structure existante :

```powershell
python scripts/hostinger_release_deploy.py stage
python scripts/hostinger_release_deploy.py deploy
```

`stage` ne fait aucune écriture distante. `deploy` demande le mot de passe FTPS sans le sauvegarder, sauvegarde chaque fichier remplacé dans `var/backups/hostinger-release-*`, vérifie les empreintes, active le bouclier de transfert existant pendant les écritures, conserve les anciens assets et le cache précédent, puis vérifie la maintenance Symfony. Une erreur après activation du bouclier le laisse en place pour protéger le site pendant la réparation. Les sauvegardes et le journal indiquent les chemins à restaurer ; les nouveaux fichiers non présents avant le transfert sont indiqués par `before: null`.

Aucune modification des paiements, de la base, des variables d’environnement ou des identifiants équipe pendant le transfert initial. Le correctif de localisation ultérieur, décrit ci-dessus, ne change que deux coordonnées. La maintenance reste active. Le journal de transfert et les rapports de vérification attestent de la livraison.

À l’ouverture publique, refaire les contrôles HTTP et d’indexabilité sans connexion équipe, puis soumettre le sitemap dans le compte Search Console du client. La maintenance doit être retirée dans une opération distincte après validation. Aucun import de base n’a été nécessaire : les cinq logements étaient déjà présents en production.
