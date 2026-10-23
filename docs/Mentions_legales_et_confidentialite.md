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
| Session Symfony | Langue, formulaires, accès équipe | Cookie de session ; inactivité applicative de 8 heures |
| Jeton/cookie CSRF si nécessaire | Protection des formulaires | Cookie temporaire supprimé après soumission |
| `localStorage.theme` | Thème choisi | Jusqu’à modification/effacement |
| `localStorage.roaming.privacy.v1` | Accord/refus GuestLucky, version 1 et dates | 180 jours maximum, accord explicite requis |
| `localStorage.roaming.maps.v1` | Préférence de carte modifiée, version 3 et dates | 180 jours maximum ; aucune écriture lors de l’affichage automatique |
| Critères dans l’URL | Logement, dates, voyageurs | Historique, URL partagée et potentiels journaux |
| Cookies GuestLucky | Dépendent du module externe | À vérifier auprès du prestataire |

La police du site et les photos sont locales. MapLibre et son worker sont servis localement ; styles, tuiles vectorielles, glyphes et sprites proviennent d’OpenFreeMap. Aucun outil de publicité, Google Analytics, Meta Pixel ou vidéo distante n’a été trouvé dans le code. Revalider l’environnement de production et les services éventuellement ajoutés par l’hébergeur ou un gestionnaire de balises.

Le contact enregistre les coordonnées et le message en base et les transmet par e-mail. Son information est présentée avant envoi. L’équipe conserve comptes, tickets, commentaires et captures. Les disponibilités et devis GuestLucky passent par le serveur ; la carte ne reçoit aucun nom ou critère de séjour.

## Module GuestLucky et préférence de carte

`assets/privacy.js` conserve deux réglages distincts. GuestLucky reste bloqué sans accord explicite valide, avec demande lors de l’ouverture de son module, puis revalidation du devis avant création de l’iframe. Une recherche ou une carte affichée ne donne jamais cet accord. Refus, fermeture et Échap ne l’autorisent pas. La navigation volontaire dans un nouvel onglet reste un parcours externe distinct.

Le propriétaire a demandé un **affichage automatique des cartes le 20 octobre 2026**. Elles se chargent près de la zone visible, sans clic préalable. Une préférence valide `maps: false`, y compris des versions 1 ou 2, continue de bloquer les requêtes. Les modifications sont écrites en version 3 ; sans préférence valide, l’affichage est actif par défaut. Une préférence expirée reprend ce défaut. L’état par défaut n’est pas présenté comme un consentement obtenu ou enregistré.

Le dialogue Cookies et les liens sous la carte permettent de désactiver celle-ci. « Tout refuser » désactive la carte et refuse GuestLucky ; enregistrer les réglages permet un choix indépendant. Désactiver la carte retire ses ressources dans les onglets ouverts, sans cacher les adresses et itinéraires. Une écriture de stockage bloquée conserve le choix en mémoire dans l’onglet. Les règles d’expiration GuestLucky ne sont pas modifiées par la carte.

## Évaluation de la carte sans suivi

La seule présence d’un service tiers ou transmission d’IP n’implique pas automatiquement un consentement aux cookies. Les règles de la CNIL distinguent les opérations de stockage/lecture nécessitant un consentement et leurs exceptions ; les données personnelles restent également soumises au RGPD.

Le fonctionnement retenu vise à situer les logements publics, à proximité du choix d’un séjour. L’intégration ne demande pas la géolocalisation du visiteur, n’envoie ni identité ni critères de séjour au fond cartographique, ne crée pas d’identifiant publicitaire et utilise `credentials: omit` pour les ressources externes. `referrerPolicy: origin` évite de transmettre l’URL de recherche. L’IP et des informations techniques de connexion restent reçues par le fournisseur : il ne s’agit pas de requêtes anonymes.

OpenFreeMap déclare ne pas utiliser de cookies ni de technologies de suivi. Sa politique prévoit toutefois des journaux techniques, des IP possibles en cas d’erreur ou d’incident et un CDN éventuel. La présence d’un cookie publicitaire ou d’une autre collecte ajoutée par le fournisseur imposerait une nouvelle évaluation ; la déclaration du fournisseur n’est pas une certification de conformité.

La version de travail décrit l’intérêt légitime de ROAMING à montrer ces emplacements, avec information au niveau de la carte et dans la politique, limitation des données et possibilité de désactivation. Cette analyse doit être confirmée pour les pratiques et contrats de production, les implantations et les garanties de transfert. `privacy_reviewed` reste faux : l’affichage automatique ne finalise ni les mentions de l’hébergeur, ni les durées de conservation, ni l’examen des prestataires.

## Contrôles et limites

Le retrait GuestLucky ferme les modules ouverts et reste contrôlé après une revalidation en cours. Les événements entre onglets sont pris en compte. Les demandes en attente sont annulées lors des changements de critères et du cache Turbo. Le site ne peut pas effacer les cookies appartenant au domaine GuestLucky ; iframe et liens n’envoient pas de référent.

Les pages légales restent publiques en maintenance avec le cadre réduit, sans catalogue. Le contenu est disponible en français et en anglais. Un futur service de publicité, statistiques, vidéo ou un changement de fournisseur nécessite une nouvelle vérification et, lorsque requis, un consentement distinct avant chargement.

`tests/Legal/LegalPagesTest.php` vérifie les pages en base isolée. `tests/browser/privacy.cjs` simule l’ouverture GuestLucky, l’accord, le refus, l’expiration, le retrait, les onglets et les dispositions mobiles. `tests/browser/property-maps.cjs` vérifie affichage automatique, anciennes désactivations, indépendance de GuestLucky, absence d’écriture automatique de consentement, désactivation et réactivation, pannes et replis, interactions et dispositions. Son mode réel vérifie les ressources du fournisseur, l’absence de cookies envoyés et de critères dans le référent, sans réservation.

## Sources

- [CNIL — cookies et traceurs](https://cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi).
- [CNIL — intérêt légitime](https://www.cnil.fr/fr/les-bases-legales/interet-legitime).
- [CNIL — information et transparence](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence).
- [Service Public — mentions obligatoires](https://entreprendre.service-public.gouv.fr/vosdroits/F37351).
- [Hostinger — conditions de service](https://www.hostinger.com/fr/legal/termes-universels-de-contrat-de-service).
- [OpenFreeMap — confidentialité](https://openfreemap.org/privacy/).
