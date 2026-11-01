# Checklist de test et de lancement — ROAMING

Mise à jour : 31 octobre 2026. Cible : https://roaminglille.com.

**Actualisation à 14 h 44 Paris :** un essai distinct du 23 au 25 novembre a abouti avec la carte Stripe test 4242 : **GL-2026-DVQ8ZR**, **121 EUR**, confirmée dans GuestLucky, page voyageur et contrat PDF vérifiés, sans doublon après actualisation. E-mail voyageur reçu dans les spams depuis noreply@guestlucky.io, contrat PDF joint uniquement ; copie figée des CGV et notification ROAMING non validées. Anomalie bloquante : calendrier et devis publics acceptent toujours ce séjour après confirmation. La réservation test reste active, à nettoyer par la procédure normale. Les paragraphes ci-dessous sur le premier essai concernent GL-2026-D66QX6, qui reste au statut Paiement. Voir [le compte rendu actualisé](TEST_GUESTLUCKY_20261031.md).

## Livraison pour les tests clients

- [x] Compiler les ressources en mode production.
- [x] Vérifier les tests GuestLucky, légaux, profils et SEO : 82 tests, 1 002 assertions réussies.
- [x] Préparer la livraison : 236 fichiers, sans modification de la base ni des secrets ; 22 avis et avatars vérifiés inclus.
- [x] Transfert FTPS terminé ; 236 fichiers comparés, 61 fichiers nouveaux ou modifiés transférés et relus avec contrôle de leurs empreintes. Sauvegarde des versions remplacées conservée.
- [x] Vérification distante réussie : connexion/déconnexion testeur, 14 pages FR/EN, cinq logements, CGV publiques, 22 avis, logos et 12 avatars.
- [x] Maintenance anonyme et protection des API vérifiées après déploiement.
- [ ] Faire tester le site avec les comptes équipe existants et centraliser les retours dans les tickets. Ne pas diffuser les identifiants dans un document public.

Le passage sur l’hébergement est une livraison de préouverture. La maintenance applicative et les accès testeurs sont conservés. Les clés Stripe de test ont été enregistrées dans GuestLucky le 31 octobre 2026 ; le formulaire voyageur charge bien Stripe en mode test. Un essai avec une carte fictive de refus a affiché le message de fonds insuffisants. Le nouvel essai avec la carte fictive de succès a affiché « These dates are no longer available », malgré un calendrier et un devis frais qui acceptent toujours le séjour. L'administration du Booking Engine montre l'entrée de test **GL-2026-D66QX6** restée au statut **Paiement**, sans action de reprise/annulation ; elle est absente de la liste générale. Aucun paiement accepté ni aucune confirmation de réservation ne sont validés. Le nettoyage/reprise de cette entrée et les opérations Stripe test restent à contrôler. Voir [le compte rendu des essais](TEST_GUESTLUCKY_20261031.md) et [le signalement transmis au support](SIGNALEMENT_GUESTLUCKY_PAIEMENT_20261031.md), distribué sur WhatsApp le 31 octobre à 14 h 38 Paris, réponse attendue.

## CGV et documents du séjour

- [ ] Recevoir le nom, l’adresse et le site du médiateur effectivement désigné, puis les intégrer.
- [ ] Faire valider les CGV par ROAMING pour l’activité réelle : identité du loueur, encaissement, prix, frais, taxe de séjour, annulation et modification.
- [x] Fixer la limite d’annulation/modification : 16 h, heure de Paris, à J−7 inclus.
- [ ] Confirmer le traitement des différences de prix lors d’un changement de dates.
- [ ] Reporter dans GuestLucky l’URL publique des CGV et les mêmes règles commerciales.
- [ ] Vérifier que le récapitulatif présente le logement et son descriptif, le voyageur, les dates, les personnes, le total et les conditions particulières avant validation.
- [ ] Vérifier ce que GuestLucky produit comme contrat de location personnalisé et quelle preuve d’acceptation est conservée. Compléter si nécessaire, selon le résultat du test.
- [ ] Vérifier l’envoi d’une copie figée des CGV et du contrat/récapitulatif sur support durable, puis leur archivage avec la réservation.
- [ ] Après validation, finaliser la version des CGV et retirer leur statut de brouillon. Le drapeau du document ne remplace pas le verrou des réservations.

## Parcours complet GuestLucky + Stripe — après configuration du mode test

- [x] ROAMING configure son compte Stripe de test dans GuestLucky, sans transmettre de clé secrète dans le chat ni le navigateur public.
- [ ] Confirmer que le module GuestLucky concerné utilise réellement le mode test : une configuration de clés seule n’est pas une preuve suffisante.
- [ ] Créer un séjour de test identifié : dates disponibles, nombre de voyageurs autorisé, durée minimale et prix/frais/taxe corrects.
- [ ] Vérifier la lecture et l’acceptation des conditions avant paiement, le récapitulatif et le bouton final.
- [ ] Tester un paiement accepté, un refus, une authentification 3-D Secure, une interruption et un nouvel essai, selon les possibilités du mode test.
- [ ] Vérifier la concordance entre Stripe, la réservation GuestLucky, son montant, son statut et les disponibilités ; contrôler l’absence de doublon après actualisation ou nouvel essai.
- [ ] Vérifier la réception des e-mails côté voyageur et ROAMING, les indésirables, l’expéditeur, la réponse, les dates, le total et les documents joints.
- [ ] Tester l’annulation avant/après la limite J−7, le remboursement prévu et sa traçabilité dans Stripe et GuestLucky.
- [ ] Tester une demande de changement de dates et la confirmation du nouveau prix.
- [ ] Tester la caution de 100 € : empreinte distincte du prix, moment de prise, durée de validité, libération demandée sous trois jours après départ et traitement d’une contestation/retenue justifiée.
- [ ] Nettoyer les réservations de test par la procédure normale, en conservant les preuves utiles. N’effectuer aucune suppression ou annulation sur une réservation réelle pendant ces essais.

## Derniers contrôles avant ouverture publique

- [ ] Finaliser les mentions légales et la confidentialité : hébergeur/téléphone restant à vérifier, prestataires, transferts, durées et procédures réelles de conservation/suppression, copies e-mail et sauvegardes.
- [ ] Confirmer les droits applicables à la republication des avis Booking et des profils/avatars publics avant ouverture générale.
- [ ] Prévoir la mise à jour GuestLucky côté serveur : la tâche Windows de ce PC ne s’exécute pas sur Hostinger. Le lot de préouverture inclut un instantané de 22 avis.
- [ ] Vérifier le formulaire de contact et son envoi réel, les tâches e-mail/cron et le suivi des erreurs.
- [ ] Tester mobile/ordinateur, navigation, photos, cartes, langues, liens, consentements et absence de débordement ; contrôler les performances du serveur réel sans profiler.
- [ ] Vérifier sauvegardes, procédure de restauration, accès équipe et permissions des fichiers privés.
- [ ] Seulement après validation du mode test, préparer le passage aux clés Stripe réelles dans GuestLucky et confirmer le compte bénéficiaire ROAMING.
- [ ] Décider explicitement de l’ouverture : lever la maintenance et le verrou de réservation uniquement quand les points bloquants sont validés.
- [ ] Vérifier ensuite les URL publiques, HTTPS/redirections, sitemap et indexabilité, puis soumettre le sitemap dans Search Console.

## Ce qui existe déjà

CGV FR/EN en brouillon, acceptation préalable sur le site, calendrier et devis GuestLucky, espace privé de test et tickets, 22 avis Airbnb/Booking, logos de plateformes, couvertures et profils publics vérifiés pour les correspondances disponibles, carrousel sans recentrage après glissement.

Les tests locaux ne remplacent pas les essais du paiement, des notifications et du contrat dans le compte GuestLucky réel configuré en mode test.
