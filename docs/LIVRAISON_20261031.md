# Livraison de préouverture — 31 octobre 2026

Cible : https://roaminglille.com. Livraison réalisée avec sauvegardes des fichiers remplacés, transfert FTPS vérifié par empreinte et conservation des anciennes ressources et du cache précédent. Aucune modification de la base ni des secrets. La maintenance et les accès testeurs existants sont conservés.

Validation locale : compilation de production ; 82 tests, 1 002 assertions ; conteneur de production valide.

Validation distante : 14 pages FR/EN en HTTP 200, cinq fiches et leurs coordonnées, CGV publiques, 22 avis et logos, 12 avatars locaux, connexion/déconnexion testeur, absence d’erreur JavaScript, disposition mobile, sitemap et redirections canoniques. Les visiteurs anonymes voient la maintenance ; leurs appels API sont bloqués. Aucun appel de réservation ou paiement n’a été effectué par le contrôle.

Rapport : `var/deployment/release-20261031/PRODUCTION-VERIFIED.json`.
Journal et sauvegardes : `var/backups/hostinger-release-20261030T232357Z/`.
Cache précédent distant : `smogii/var/cache/prod-before-release-20261030T232357Z`.

Les avis livrés sont un instantané. Le cron Hostinger et les profils des prochains avis restent à prévoir. Les CGV et la confidentialité conservent leur statut de travail ; le parcours GuestLucky/Stripe, les notifications et le contrat personnalisé restent à tester lorsque le mode Stripe de test sera configuré.

Suivi : [CHECKLIST_LANCEMENT.md](CHECKLIST_LANCEMENT.md).
