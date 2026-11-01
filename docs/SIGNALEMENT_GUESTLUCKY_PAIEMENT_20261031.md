# Message de support GuestLucky — envoyé le 31 octobre 2026

État : après autorisation explicite de l'utilisateur et connexion WhatsApp effectuée par lui, diagnostic envoyé au support officiel WhatsApp **+33 7 59 94 43 05**, contact « Guestlucky Officiel » affiché sur la page officielle. Message affiché comme **Distribué à 14 h 38 (Paris), le 31 octobre 2026**. Le message demande de reprendre/annuler uniquement GL-2026-D66QX6 et insiste sur la procédure permettant au client de gérer lui-même les réservations de test en attente, ainsi que sur la durée d'expiration éventuelle. Aucune clé ni donnée de réservation réelle transmise. Réponse du support encore attendue au moment de ce compte rendu ; incident non résolu.

Objet : Booking Engine — carte refusée puis nouvel essai impossible, réservation GL-2026-D66QX6 au statut Paiement

Bonjour,

Nous testons le Booking Engine du compte ROAMING avec des clés Stripe de test et des cartes fictives Stripe uniquement.

Séjour concerné : La Petite Cour, logement GuestLucky 2650, du 16 au 18 novembre 2026, deux voyageurs, deux nuits, total 128 EUR. Voyageur identifié « TEST ROAMING Mehdi », sans séjour réel.

Le 31 octobre 2026 :

1. Contrat accepté, soumission avec la carte de test finissant par 9995 : le checkout affiche « Votre carte ne dispose pas de fonds suffisants. Veuillez en utiliser une autre. »
2. Sans changer le séjour ni recharger le formulaire, remplacement par la carte fictive 4242 et nouvelle soumission : le checkout affiche « These dates are no longer available ».
3. Dans Booking Engine → Réservations, une entrée **GL-2026-D66QX6**, créée à **14 h 19**, reste au statut **Paiement**. Les compteurs affichent une réservation totale, zéro confirmée, 0,00 EUR de chiffre d'affaires et une en attente.
4. Aucune action de reprise/annulation ni lien de détail n'est proposé sur cette ligne. La recherche de cette référence dans la liste générale des réservations retourne « Aucune réservation trouvée » ; le plugin MCP ne la retourne pas non plus.
5. Les lectures fraîches du calendrier et du devis, encore à 14 h 26 Paris, indiquent les deux nuits disponibles et acceptent le séjour à 128 EUR (63 EUR + 65 EUR).
6. Une synchronisation normale de la liste générale suivie d'une recherche ne fait pas apparaître la référence. L'assistant intégré Lucky Copilot déclare ne pas avoir d'outil de reprise/annulation de cette entrée. Le serveur MCP expose 81 outils, aucun ne permet sa reprise ou son annulation.

Pouvez-vous vérifier si l'entrée au statut Paiement laissée après le refus empêche le nouvel essai, contrôler le statut du paiement de test associé et reprendre ou annuler proprement **cette seule réservation de test GL-2026-D66QX6**, en nous précisant l'action effectuée ? Merci aussi de vérifier la cohérence des disponibilités entre le checkout, le Booking Engine et les lectures publiques, ainsi que la remise à disposition après échec ou expiration du paiement. Nous devons pouvoir rejouer un refus puis un paiement accepté sans créer de doublon ni maintenir une réservation impayée.

Surtout, pouvons-nous le faire nous-mêmes depuis notre compte ? Quelle est la procédure pour annuler une réservation de test en attente, reprendre un paiement refusé et libérer les dates ? Existe-t-il une expiration automatique, et après quel délai ? Nous sommes en train d'effectuer les tests et ne trouvons actuellement aucune action permettant d'annuler cette entrée.

Nous n'avons modifié aucun blocage ni réservation réelle. Aucun autre paiement n'est relancé en attendant ce contrôle.

Merci.
