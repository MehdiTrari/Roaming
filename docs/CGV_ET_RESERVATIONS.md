# CGV et réservation — 30 octobre 2026

## Intégration

Page publique FR/EN : `/conditions-generales-de-vente`, accessible dans les pieds de page public et maintenance et dans la navigation des pages légales. Les conditions reprennent les informations communiquées par ROAMING, loueur et encaisseur pour tous les logements. Elles restent une version de travail, en `noindex`, tant que `terms_reviewed` est faux ou que les coordonnées du médiateur sont incomplètes.

Le lien local `/reservation/{slug}` affiche les conditions après vérification du séjour. Une case obligatoire, non précochée, est contrôlée côté serveur avec la version des conditions et un jeton CSRF lié au logement, aux dates et au nombre de voyageurs. Un POST accepté revérifie les disponibilités puis redirige en 303 vers GuestLucky. Les liens directs et le module intégré passent par cette étape ; aucun paiement ni réservation n’est créé localement. Les réponses ne sont pas mises en cache. Le verrou existant de disponibilité reste applicable.

Cette étape est une prise de connaissance avant le module externe. Elle ne constitue pas une preuve d’acceptation rattachée à une réservation finalisée : le site ne reçoit pas encore l’identifiant de réservation ni la confirmation du paiement et ne conserve pas cette acceptation en base. Ne pas présenter le parcours contractuel comme finalisé sur cette seule base.

## À finaliser avant ouverture

1. Recevoir le nom, l’adresse et le site HTTPS du médiateur effectivement désigné et renseigner `mediator_name`, `mediator_address`, `mediator_url` dans `config/packages/legal.yaml`. Une adhésion « en cours » ne suffit pas. Le document affiche explicitement l’état provisoire.
2. Heure limite confirmée par l’utilisateur le 30 octobre 2026 : **16 h, heure de Paris, 7 jours calendaires avant l’arrivée, limite incluse**, pour les annulations et modifications. Cette précision est intégrée en français et en anglais.
3. Valider le traitement des différences tarifaires en cas de changement de dates : aucun frais de modification, nouveau prix accepté avant confirmation. Confirmer la procédure de remboursement et la cohérence des prix, frais obligatoires et taxe de séjour dans le module.
4. Configurer les mêmes règles dans GuestLucky et le paiement : paiement intégral ; annulation et modification à J−7 ; non-présentation ; empreinte de 100 €, procédure de prise et de libération sous 3 jours. Le texte des CGV ne configure pas Stripe et ne déclenche aucune empreinte ou restitution. Vérifier la validité de l’autorisation bancaire pour la durée du séjour et le délai bancaire de restitution.
5. Configurer dans le parcours final GuestLucky une acceptation explicite des conditions applicables, avec conservation de leur version et de la preuve rattachée à la réservation. Vérifier le récapitulatif, la correction des erreurs et le bouton final indiquant sans ambiguïté l’obligation de paiement.
6. Joindre à l’e-mail de confirmation une copie figée des CGV acceptées (texte ou pièce jointe), le descriptif du logement, les dates, voyageurs, prix, frais et conditions particulières. Un simple lien vers une page modifiable ne suffit pas comme copie durable. Archiver la version réellement envoyée avec la réservation. Cette livraison ne modifie pas les e-mails ni les réglages distants GuestLucky.
7. Vérifier les faits et les clauses pour l’activité réelle, puis passer `terms_reviewed` à vrai et incrémenter `terms_version` lors de toute modification contractuelle. Ce drapeau contrôle l’état du document et son indexation ; il ne ferme pas techniquement les réservations. Conserver les verrous de lancement existants jusqu’à validation du parcours complet.

Les conditions rappellent l’absence de rétractation pour l’hébergement à dates déterminées, distinguent annulation client et annulation par le loueur, réservent les droits impératifs et imposent une justification des retenues sur caution. Aucun tribunal exclusif ni exonération générale de responsabilité n’est prévu. Le supplément animaux reste sur devis, avec réserve des droits applicables aux chiens guides et d’assistance.

## Vérifications

`tests/Legal/LegalPagesTest.php` couvre les quatre pages FR/EN, leur accès en maintenance sans catalogue et les liens de pied de page. `tests/GuestLucky/CatalogueAndRoutesTest.php` couvre l’étape de lecture, la case non cochée, le refus des POST sans acceptation ou avec CSRF invalide et la redirection après nouvelle vérification des dates. Les appels au prestataire sont simulés, sans réservation réelle.

## Sources consultées

- [Service Public — commerce en ligne et CGV publiques](https://entreprendre.service-public.gouv.fr/vosdroits/F23455).
- [DGCCRF — location saisonnière](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/location-saisonniere-les-regles-connaitre).
- [DGCCRF — exceptions au droit de rétractation](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/delais-de-reflexion-ou-de-retractation-comment-sappliquent-t-ils).
- [Service Public — confirmation du contrat sur support durable](https://www.service-public.fr/particuliers/vosdroits/F10488).
- [Ministère de l’Économie — coordonnées du médiateur sur le site et les CGV](https://www.economie.gouv.fr/mediation-conso/vous-etes-un-professionnel/vos-principales-obligations-0).
- [Adagio — exemple de CGV publiques, complétées par les conditions de réservation](https://www.adagio-city.com/fr/condition-generales-de-vente.shtml). Exemple de présentation, sans reprise de leurs clauses.
