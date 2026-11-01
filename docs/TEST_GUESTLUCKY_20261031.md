# Tests de paiement GuestLucky — 31 octobre 2026

**État actuel :** un nouvel essai sur d'autres dates a réussi à **14 h 42 Paris** : **GL-2026-DVQ8ZR**, logement 2650, du 23 au 25 novembre, deux voyageurs, **121 EUR**, carte Stripe fictive 4242. Confirmation voyageur et statut Confirmée dans le Booking Engine vérifiés. **E-mail voyageur reçu dans les spams**, confirmé par l'utilisateur avec capture : expéditeur Roaming Lille <noreply@guestlucky.io>, contrat PDF joint uniquement. Copie figée des CGV absente des pièces jointes signalées ; notification ROAMING encore non vérifiée. Le calendrier et le devis publics acceptent toujours ce même séjour après confirmation (contrôle frais à 14 h 44 min 23 s Paris) : cohérence des disponibilités non validée. La réservation test confirmée reste active et devra être nettoyée par la procédure normale après les contrôles, ainsi que sa mission de ménage liée. L'incident initial GL-2026-D66QX6 reste non résolu ; son diagnostic a été distribué au support WhatsApp à 14 h 38.

## Nouvel essai accepté — 23 au 25 novembre

Essai explicitement demandé par l'utilisateur sur de nouvelles dates, puis contrat et soumission confirmés par lui avant paiement. Voyageur « TEST ROAMING SUCCES Mehdi », même adresse de réception fournie dans le chat, message identifiant un test sans séjour réel.

- Avant paiement : nuits libres, 60 EUR + 61 EUR = 121 EUR, minimum deux nuits ; mode Stripe `keyMode=test` vérifié dans l'iframe. Aucun séjour existant retourné pour le nom de test.
- Une seule soumission avec la carte fictive Stripe 4242 : page « Réservation confirmée ! », référence **GL-2026-DVQ8ZR**, adresse complète, arrivée le 23/11 à 16 h, départ le 25/11 avant 11 h, deux personnes, total payé affiché 121 EUR. La page annonce un e-mail envoyé au voyageur.
- Booking Engine : deux entrées au total, une Confirmée (121 EUR), l'ancienne au statut Paiement (128 EUR). La nouvelle est créée à 14 h 42.
- Plugin MCP : id **511927**, référence identique, plateforme `booking_engine`, statut `upcoming`, mêmes dates, voyageurs et montant. Après actualisation de la page de confirmation : toujours une seule réservation correspondante, pas de doublon observé.
- Contrat téléchargé dans `C:/Users/mehdi/Downloads/contrat-location-GL-2026-DVQ8ZR.pdf` : cinq pages A4 rendues et inspectées. Dates, personnes, logement et 121 EUR cohérents. Dernière page : acceptation en ligne le 31/10/2026 à 14 h 42, adresse IP et référence du séjour. Il s'agit d'une trace inscrite dans le document, pas d'une validation juridique ou d'un audit de signature électronique.
- Écarts maintenus dans le PDF : bailleur Mathis / micro-entreprise, arrivée à 15 h (confirmation à 16 h), caution 100 EUR empreinte ou versement avec libération/restitution sous huit jours, adresse avec code postal/ville dupliqués. Le contrat renvoie aux CGV par URL ; aucune copie intégrale figée des CGV n'est incluse dans ces cinq pages.
- Disponibilités : les contrôles frais à 14 h 42 min 45 s, 14 h 43 min 35 s et 14 h 44 min 23 s Paris indiquent encore les deux nuits disponibles et acceptent le devis de 121 EUR, malgré la confirmation. Le blocage effectif des canaux externes n'a pas été prouvé.
- E-mail voyageur : l'utilisateur confirme la réception dans les spams, sujet « Confirmation de reservation GL-2026-DVQ8ZR », nom Roaming Lille, adresse expéditrice `noreply@guestlucky.io`. Capture fournie : référence, logement, adresse, dates (arrivée à 16 h), deux voyageurs et 121 EUR cohérents ; contrat PDF joint et lien de téléchargement, politique d'annulation dans le corps. L'utilisateur indique que le contrat est l'unique pièce jointe. Le contrat PDF renvoie aux CGV par URL et n'en contient pas une copie intégrale : l'envoi d'une copie figée des CGV reste à compléter/vérifier. Le classement en spam est observé, sa cause n'est pas établie sans examen des en-têtes et de l'acheminement.
- Fiche générale id 511927 : réservation Confirmée, source Booking_engine, mission de ménage liée id **516803**, affectation affichée à Nabia. Onglet Communication : message de bienvenue visible, horodaté **14 h 45** ; sa visibilité dans le journal ne prouve pas sa réception externe.
- Notification ROAMING et rapprochement au tableau de bord Stripe : non vérifiés. La réservation confirmée et sa mission liée devront être nettoyées après validation ; aucune annulation, suppression ou remboursement effectué.

Ne pas déclarer l'ensemble du parcours validé avant correction des écarts et contrôle des e-mails/disponibilités. Ne pas relancer de paiement sur ce séjour confirmé. Aucune annulation ni remboursement effectué.

## Périmètre et état

Compte ROAMING et cinq logements vérifiés via le plugin GuestLucky. Parcours voyageur testé dans le navigateur. Après confirmation de l'utilisateur, contrat accepté et deux tentatives de paiement Stripe test soumises dans le même formulaire : d'abord une carte de refus, puis une carte de succès. Aucune confirmation de réservation ni de paiement accepté n'a été affichée. Le plugin ne retourne aucune réservation pour l'adresse de test ni aucune arrivée entre le 14 et le 19 novembre sur le logement 2650 ; cela ne suffit pas à exclure une entrée en attente dans les réservations propres au Booking Engine.

Le formulaire de carte Stripe du checkout charge une clé publique `pk_test_` et expose `keyMode=test` dans son iframe, sans recopier la clé. Le refus simulé a été affiché après soumission. Le rapprochement avec les opérations Stripe test reste à faire dans le tableau de bord Stripe.

## Séjour préparé

- Logement : La Petite Cour, identifiant GuestLucky 2650.
- Arrivée : 16 novembre 2026 ; départ : 18 novembre 2026.
- Voyageurs : 2 ; deux nuits, total de 128 EUR.
- Calendrier et devis acceptent le séjour ; le relevé MCP ne contient aucune réservation avec arrivée sur ce séjour. Les blocages éventuels restent sous l'autorité du devis fournisseur.
- Voyageur clairement identifié « TEST ROAMING Mehdi », message indiquant qu'il s'agit d'un test sans séjour réel ; adresse de réception fournie par l'utilisateur dans le chat.
- Carte Stripe de refus finissant par 9995, puis carte fictive de succès finissant par 4242 ; même séjour, expiration fictive future.

## Résultats des soumissions

1. Carte 9995 : message « Votre carte ne dispose pas de fonds suffisants. Veuillez en utiliser une autre. » Le formulaire reste utilisable et conserve les coordonnées, le séjour et la case d'acceptation cochée. Aucune réservation correspondante retournée par le plugin.
2. Nouvelle tentative, carte 4242 : message « These dates are no longer available », sans page de confirmation.
3. Après cette erreur, lecture fournisseur fraîche à 13:21:16 UTC : nuits du 16 et du 17 novembre toujours disponibles (63 EUR et 65 EUR, minimum deux nuits) ; devis de 128 EUR toujours accepté. Le plugin ne retourne aucune réservation avec arrivée du 14 au 19 novembre pour ce logement.

L'erreur du paiement contredit donc le calendrier et le devis. Ne pas multiplier les tentatives ni débloquer les dates à l'aveugle. Le succès, les e-mails, la preuve d'acceptation archivée et le nettoyage éventuel restent non validés. L'absence de confirmation ne prouve pas à elle seule le statut de la seconde opération dans Stripe.

Après connexion de l'utilisateur, contrôle dans l'administration GuestLucky :

- Page `/dashboard/booking-engine/reservations`, filtres « Tous » : une seule entrée, **GL-2026-D66QX6**, voyageur TEST ROAMING Mehdi, logement 2650, du 16 au 18 novembre, deux nuits, 128 EUR, créée le 31 octobre à **14 h 19** (heure affichée par l'interface), statut **« Paiement »**.
- Compteurs : une réservation totale, zéro confirmée, 0,00 EUR de chiffre d'affaires, une en attente.
- Aucun lien de détail, bouton de reprise ou d'annulation dans la ligne de cette entrée.
- Recherche de la référence dans `/dashboard/booking` : « Aucune réservation trouvée ». La réservation propre au Booking Engine n'est donc pas visible dans cette liste générale au moment du contrôle.
- Nouvelle lecture fournisseur à **13:26:07 UTC / 14:26:07 Paris** : les deux nuits restent disponibles et le devis de 128 EUR est accepté.

Une entrée au statut Paiement laissée après le refus est donc confirmée. Qu'elle cause précisément le rejet du nouvel essai reste une hypothèse forte à faire vérifier par GuestLucky. Les contrôles ne démontrent pas un blocage du calendrier Channel Manager : ils montrent une incohérence entre le checkout, les réservations du Booking Engine et les lectures publiques. Aucun élément n'a été annulé, supprimé ou débloqué.

Le guide officiel consulté décrit l'annulation dans la liste générale, mais ne fournit pas de procédure de reprise ou de nettoyage de cette entrée du Booking Engine absente de la liste générale. Les outils du plugin disponibles ne permettent pas non plus cette opération ni le contrôle des transactions Stripe. Un [message de support prêt à envoyer](SIGNALEMENT_GUESTLUCKY_PAIEMENT_20261031.md) est préparé ; il n'a pas été envoyé.

## Recherche de résolution approfondie

À la demande de l'utilisateur, recherche complémentaire effectuée le même jour, sans nouvelle soumission de paiement :

- Actualisation de la liste Booking Engine : l'entrée reste au statut Paiement, sans action proposée.
- Synchronisation normale lancée une fois depuis la liste générale, puis nouvelle recherche : « Aucune réservation trouvée » pour GL-2026-D66QX6. Aucun élément réel n'a été annulé ou modifié manuellement.
- Découverte complète des outils du serveur MCP, via la connexion locale existante : 81 outils sur deux pages (50 + 31), aucun outil dédié à la reprise, l'annulation ou au paiement des réservations du Booking Engine. Aucun appel métier d'écriture par ce canal. La description distante de la suppression des réservations générales mentionne un effet sur les canaux, contrairement à l'inventaire ancien du plugin ; ne pas utiliser cette suppression comme contournement.
- Aucune action WebMCP disponible sur la page des réservations directes.
- Lucky Copilot interrogé pour un diagnostic en lecture seule : il déclare ne pas avoir d'outil pour reprendre/libérer cette réservation ni consulter son PaymentIntent. Sa suggestion d'un délai de sept jours confond empreinte bancaire et réservation ; elle n'est pas retenue comme une durée d'expiration GuestLucky vérifiée.
- Aide intégrée et onglets du Booking Engine consultés : aucune procédure d'expiration/reprise trouvée.
- Plugin WordPress officiel GuestLucky Booking 1.0.0 téléchargé et inspecté sans installation ni exécution : seulement des GET de calendrier/recherche/branding et des iframes/liens vers le moteur hébergé. Aucun endpoint de reprise/annulation.
- Essai de consultation de la référence via l'espace voyageur habituel : code non reconnu, redirection vers l'écran d'erreur. Aucun dossier voyageur de reprise obtenu.

Ces contrôles n'ont pas fourni de moyen client pris en charge pour modifier cette entrée. La correction doit être réalisée avec une capacité d'administration GuestLucky non disponible dans ces interfaces, ou par une procédure fournie par l'éditeur. Accord demandé à l'utilisateur pour transmettre le diagnostic au support officiel WhatsApp, avec la seule référence de test et ses caractéristiques, sans clés ni données de réservations réelles. Aucun envoi au support humain effectué à ce stade.

L'utilisateur a ensuite autorisé l'envoi et demandé une procédure permettant d'annuler/reprendre lui-même les réservations de test en attente. Message préparé au contact WhatsApp « Guestlucky Officiel », numéro issu de l'interface GuestLucky. Le navigateur intégré affiche l'écran de connexion WhatsApp par QR code ; connexion utilisateur demandée. **Message toujours non envoyé à ce stade.**

Après connexion WhatsApp effectuée par l'utilisateur, le message a été envoyé et son statut **Distribué à 14 h 38** a été vérifié dans la conversation avec le numéro officiel +33 7 59 94 43 05. Le message inclut explicitement les demandes de procédure client pour annuler une réservation de test en attente, reprendre un paiement refusé, libérer les dates et connaître la durée d'expiration éventuelle. Aucun succès de paiement ni correction de l'incident ne sont déclarés sur la seule base de cet envoi.

## Documents et écarts observés

Le checkout présente le logement, les dates, les voyageurs, le prix, la politique d'annulation et une case d'acceptation du contrat et des CGV. L'aperçu du contrat est personnalisé avec le voyageur, les dates, le nombre de personnes et le prix. Le fournisseur annonce l'envoi du contrat définitif en PDF après paiement ; cet envoi n'a pas été vérifié.

| Sujet | GuestLucky observé | Site ROAMING / règle attendue |
| --- | --- | --- |
| Bailleur | « Mathis », auto-entrepreneur / micro-entreprise | ROAMING, SAS ; confirmer le véritable bailleur et corriger le paramétrage approprié |
| Arrivée | Contrat : à partir de 15 h | Fiche GuestLucky et CGV du site : 16 h |
| Caution | 100 EUR, empreinte ou versement, restitution/libération sous huit jours | Empreinte distincte, libération par ROAMING sous trois jours après départ |
| Adresse | Seulement « Lille » avant paiement, adresse complète annoncée après paiement | Vérification du récapitulatif et du contrat à poursuivre |
| CGV | Page GuestLucky renvoyant aux CGV de roaminglille.com | Lien configuré ; copie figée envoyée et archivage non vérifiés |

La politique d'annulation affichée dans le checkout, le contrat et la page CGV GuestLucky reprend bien la limite à 16 h (Paris), sept jours calendaires avant l'arrivée, limite incluse.

Des automatisations actives existent, notamment le message de bienvenue deux minutes après confirmation et une demande de caution à J−1. Une transaction Stripe test ne garantit donc pas que la réservation GuestLucky soit isolée du calendrier et des notifications opérationnelles.

## À poursuivre

Faire vérifier et nettoyer/reprendre l'entrée GL-2026-D66QX6 par GuestLucky, rapprocher les opérations Stripe test, puis rejouer le scénario refus → nouvel essai accepté. Tester ensuite 3-D Secure et interruption, contrôler les références et statuts Stripe/GuestLucky, l'absence de doublons, les disponibilités, les e-mails et pièces jointes, puis les modifications, l'annulation, le remboursement et la caution. Nettoyer uniquement les données de ce test par la procédure normale.

## Application locale

Application démarrée sur http://127.0.0.1:8000 avec le serveur PHP local. Conteneurs Docker existants de base et Mailpit redémarrés, sans réinitialisation ni migration. Le port local de `DATABASE_URL` a été ajusté au port réellement attribué au conteneur (55658) ; cinq logements présents et accueil affiché avec succès. Le port peut changer à un prochain redémarrage Docker.
