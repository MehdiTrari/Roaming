# Mentions légales, confidentialité et services externes

Version de travail intégrée le 18 octobre 2026, en français et en anglais : `/mentions-legales`, `/politique-de-confidentialite`, `/cookies`. Le pied de page comporte les trois liens ; « Cookies » ouvre les préférences et conserve une page de repli sans JavaScript.

## Finalisation des informations

La capture fournie par le propriétaire le 18 octobre 2026 corrige la TVA en **FR44951207166** et indique le SIRET du siège **951 207 166 00020**. Ces deux valeurs ont été reportées dans les mentions ; le numéro de TVA précédemment déduit a été remplacé.

Les données publiques sont centralisées dans `config/packages/legal.yaml`, sans aucun secret. ROAMING, siège, capital, SIREN, RCS, directeur de publication et TVA reprennent les informations fournies et confirmées par le propriétaire, qui prévoit une vérification ultérieure sur ses documents. Les fiches Annuaire des entreprises/Pappers n’ont pas permis de vérifier ces informations indépendamment pendant ce travail.

L’hébergeur annoncé est **Hostinger**. Ses [conditions officielles](https://www.hostinger.com/fr/legal/termes-universels-de-contrat-de-service) distinguent plusieurs entités selon le pays et les documents contractuels. Reprendre de la facture/du contrat les champs `host_entity`, `host_address`, `host_phone`. Le pays du centre de données se vérifie séparément dans hPanel et les contrats de traitement.

Les pages restent une **version de travail**, avec les inconnues visibles et en `noindex`, tant que ces champs sont incomplets et que `privacy_reviewed` est faux. Ce drapeau décrit la finalisation du texte : ce n’est ni un certificat de conformité ni un verrou de déploiement.

Pour finaliser :

1. Définir les durées et procédures pour les messages, copies e-mail, journaux, comptes, tickets, captures et sauvegardes ; compléter les trois champs `*_retention` en français et anglais.
2. Identifier la messagerie de production, les implantations des prestataires, leurs sous-traitants et les éventuels transferts hors EEE et garanties. Compléter `providers_location` et le paragraphe des destinataires dans les traductions.
3. Appliquer les procédures annoncées : la base conserve actuellement les messages et tickets sans purge automatique. Aucun effacement des données existantes n’a été exécuté. Ne pas promettre une suppression automatique sans la mettre en place, y compris pour la messagerie, les sauvegardes et les prestataires.
4. Vérifier les conditions du séjour et les obligations commerciales des réservations, dont CGV et médiation de la consommation selon le fonctionnement effectif. Ces pages ne remplacent pas les documents contractuels du séjour.
5. Vérifier les faits et le texte pour l’activité réelle, puis passer `privacy_reviewed` à vrai lorsque le contenu correspond aux pratiques. Ne pas laisser des durées ou lieux inconnus en activant ce champ.

Un prestataire peut rédiger les pages ; le responsable de l’activité doit fournir les faits et vérifier qu’elles correspondent aux traitements réels. Une relecture juridique est utile pour les conditions de location et les traitements des réservations.

## Inventaire constaté dans le code

| Mécanisme | Usage | Conservation constatée |
| --- | --- | --- |
| Session Symfony | Langue, formulaires, accès équipe | Cookie de session ; `gc_maxlifetime` de 28 800 secondes, restauration dépendante du navigateur |
| Jeton/cookie CSRF si nécessaire | Protection des soumissions | Cookie temporaire supprimé par le contrôleur après soumission |
| `localStorage.theme` | Thème explicitement choisi | Jusqu’à modification/effacement |
| `localStorage.roaming.privacy.v1` | Accord/refus GuestLucky, version et dates | 180 jours, même durée pour les deux choix |
| `localStorage.roaming.maps.v1` | Accord/refus du fond OpenFreeMap, indépendant de GuestLucky | 180 jours, sans prolongation de l’autre choix |
| Critères dans l’URL | Logement, dates, voyageurs | Historique, URL partagée et potentiels journaux ; aucun nom/e-mail dans ces critères |
| Cookies de GuestLucky | Dépendent du service externe | À vérifier auprès du prestataire, sans inventer de noms/durées |

Aucune intégration de publicité, Google Analytics, Meta Pixel, vidéo distante ou police Google n’a été trouvée dans le code courant. La police du site et les photos sont servies localement ; les glyphes et sprites de la carte viennent d’OpenFreeMap après activation. L’ancienne iframe Google de la fiche logement a été remplacée par MapLibre local et un fond vectoriel OpenFreeMap chargé seulement après accord. Le navigateur transmet alors son IP, les ressources demandées et l’origine du site, sans critères de séjour dans le référent. Aucun accès à la géolocalisation n’est demandé ; le lien Itinéraire ouvre volontairement Google Maps avec l’adresse du logement. Voir [Emplacements et cartes](Property_locations_et_cartes.md). Revalider sur l’hébergement : des outils ajoutés par un hébergeur, proxy ou gestionnaire de balises ne se déduisent pas du dépôt local.

Le contact stocke les coordonnées et le message en base puis les envoie par e-mail. Une information apparaît avant l’envoi avec lien vers la politique ; aucune case de consentement artificielle n’est imposée à la demande de contact. L’espace équipe conserve comptes, tickets, commentaires, captures et contexte technique. Les disponibilités et prix sont consultés auprès de GuestLucky par le serveur.

## Gestion des services externes

`assets/privacy.js` ouvre un dialogue natif depuis « Cookies » ou lors d’une demande d’ouverture du module non autorisé. Aucun bandeau automatique à l’arrivée pour les seules fonctions techniques. Deux cases indépendantes couvrent GuestLucky et le fond de carte. « Tout refuser » et « Tout autoriser » ont le même style et la même taille ; « Enregistrer mes choix » applique les cases sélectionnées. Fermer ou appuyer sur Échap ne donne aucun accord. « Afficher la carte » active uniquement OpenFreeMap et ne prolonge pas GuestLucky.

L’autorisation permet l’intégration puis le code revalide le devis avant de créer l’iframe ; elle ne réserve rien. Le refus conserve calendrier, recherche, contact et ouverture volontaire dans un nouvel onglet. Ce lien quitte le site et relève des informations/choix du service externe ; il n’autorise jamais l’iframe silencieusement.

Chaque décision contient `version`, `guestlucky` ou `maps`, `updatedAt`, `expiresAt`, sans identifiant publicitaire. Les échéances des deux services sont indépendantes. Valeurs mal formées/expirées : aucun accord. En cas d’échec d’écriture, le choix fonctionne en mémoire dans l’onglet et peut être redemandé au rechargement. Le stockage local n’est pas un registre central de preuve du consentement : prévoir un dispositif adapté si l’activité ou de nouveaux traceurs le nécessitent.

Le contenu du choix carte passe en version 2 : l’ancien accord pour le fond précédent ne permet pas le chargement d’OpenFreeMap. GuestLucky garde sa version 1 et son échéance.

Le retrait depuis le pied de page ferme une iframe ouverte ou retire les tuiles de carte selon le service ; le changement reçu depuis un autre onglet fait de même. Adresses et liens restent disponibles. Un contrôle après revalidation empêche aussi le chargement du module si le choix a changé pendant la requête. Le site ne peut pas effacer les cookies du domaine GuestLucky, ce qui est expliqué dans la page. Iframe et liens externes ne transmettent pas de référent ; les tuiles transmettent seulement l’origine.

Les demandes d’accord en attente sont annulées lors des changements de critères, de l’expiration du devis et du cache Turbo. Un futur outil de statistiques/publicité/vidéo exige une nouvelle vérification, une information et, si nécessaire, un accord distinct avant chargement. Les deux permissions actuelles couvrent seulement les services décrits ; renouveler leur version en cas de changement important de finalité.

Les pages restent publiques en maintenance avec le cadre réduit, sans exposer le catalogue. Les liens figurent aussi sur la maintenance et les pages équipe.

## Sources consultées

- [Service Public — mentions obligatoires](https://entreprendre.service-public.gouv.fr/vosdroits/F37351).
- [Service Public — cookies et traceurs](https://entreprendre.service-public.gouv.fr/vosdroits/F31228).
- [CNIL — cookies et traceurs : que dit la loi ?](https://www.cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi).
- [CNIL — information des personnes et transparence](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence).
- [Hostinger — conditions de service](https://www.hostinger.com/fr/legal/termes-universels-de-contrat-de-service).
- [OpenFreeMap — confidentialité](https://openfreemap.org/privacy/).

## Vérifications

`tests/Legal/LegalPagesTest.php` utilise une base SQLite isolée : accès public en maintenance sans catalogue, traductions, brouillon, liens et information de contact. `tests/browser/privacy.cjs` simule calendriers, devis et réservations : refus, accord, fermeture sans accord, durées égales, valeurs expirées/invalides, retrait entre onglets et pendant une requête, lien externe explicite, focus, Turbo, stockage bloqué et 12 dispositions langue/thème/mobile. Aucun appel fournisseur réel ni réservation.

`tests/browser/property-maps.cjs` couvre en plus l’absence de tuiles avant accord, l’indépendance du choix carte, le retrait individuel, les adresses et itinéraires, les animations et les dispositions mobiles. Son mode de vérification visuelle réel est décrit dans le document des cartes.
