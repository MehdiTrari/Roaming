Je te conseille de mettre ce fichier à la racine de Roaming, par exemple **`docs/GUESTLUCKY_MCP.md`**. Il est volontairement écrit comme une documentation technique + des règles destinées à Codex, pour qu’il comprenne ce que GuestLucky peut servir à faire, ce qui est local, ce qui touche le Channel Manager et les précautions à prendre.

# GuestLucky MCP — Documentation d’intégration pour Roaming

> Mise à jour du 17 octobre 2026 : cet inventaire contient des observations historiques. La connexion MCP de Symfony et la synchronisation automatique du catalogue (quatre logements, dont Douai) sont documentées dans [MCP et synchronisation automatique](GuestLucky_MCP_et_Synchronisation.md). La clé réelle reste uniquement dans la configuration privée.

> Documentation technique destinée au projet **Roaming** et aux agents de développement tels que **Codex**.
>
> Cette documentation décrit les capacités exposées par le MCP GuestLucky actuellement connecté au compte Roaming.
>
> **Important :** GuestLucky doit être considéré comme le PMS / Channel Manager / back-office opérationnel.  
> Roaming peut devenir une couche métier supplémentaire : dashboard, automatisations, analyses, intelligence métier, revenue management, alertes et interfaces personnalisées.

---

# 1. Objectif de l’intégration

Architecture générale envisagée :

```text
Airbnb / Booking / autres canaux
             │
             ▼
        GuestLucky
 PMS / Channel Manager / Ops
             │
             │ MCP / API / Webhooks
             ▼
          Roaming
             │
             ├── Dashboard
             ├── Analytics
             ├── Revenue management
             ├── Alertes
             ├── Automatisations
             ├── Gestion opérationnelle
             └── IA / Assistant métier
```

Le but n’est pas nécessairement de remplacer GuestLucky.

Roaming peut utiliser GuestLucky comme :

- source de données ;
- moteur opérationnel ;
- Channel Manager ;
- gestionnaire de réservations ;
- gestionnaire des missions ;
- gestionnaire des incidents ;
- gestionnaire des stocks ;
- gestionnaire des propriétaires/prestataires ;
- moteur d’automatisation.

Roaming peut se concentrer sur une UX et des fonctionnalités métier plus adaptées à SAS Roaming.

---

# 2. Compte actuellement connecté

Le MCP GuestLucky est actuellement connecté au compte :

```text
Entreprise : SAS Roaming
Rôle : Client
```

Le compte possède actuellement 3 logements.

| ID GuestLucky | Logement | Capacité | Prix de base | Ménage |
|---:|---|---:|---:|---:|
| 2475 | Appartement 10 personnes Lille Lambersart | 10 | 150 € | 90 € |
| 2474 | Charmant et confort Roubaix | 10 | 150 € | 90 € |
| 2467 | L’Écrin Noir – Maison Moderne & Accueillante | 8 | 150 € | 90 € |

Les trois logements sont actuellement configurés en :

```text
sync_mode = channel_manager
```

## Règle importante

**Ne jamais coder ces IDs en dur dans la logique métier.**

Ils peuvent changer.

Toujours récupérer les logements via GuestLucky puis conserver éventuellement leur correspondance dans la base Roaming.

Exemple :

```text
roaming_property_id
guestlucky_property_id
name
active
```

---

# 3. Identification / connexion

## Capacités disponibles

Le MCP peut récupérer l’identité du compte GuestLucky connecté.

Informations disponibles :

- ID utilisateur ;
- nom ;
- email ;
- rôles ;
- tenant / équipe ;
- propriétaire du compte ;
- serveur MCP utilisé.

### Usage Roaming possible

Permet notamment :

- vérifier que la connexion GuestLucky fonctionne ;
- vérifier quel compte est connecté ;
- empêcher une action si le mauvais compte est utilisé ;
- afficher l’état de la connexion dans une page d’administration.

---

# 4. Gestion des logements

GuestLucky permet de :

- lister les logements ;
- rechercher un logement ;
- créer un logement ;
- modifier un logement ;
- supprimer un logement.

## Informations disponibles

Pour un logement :

```text
id
name
internal_name
address
capacity
nightly_base_rate
cleaning_fee
currency
min_stay
max_stay
checkin_time
checkout_time
sync_mode
```

## Création

Il est possible de créer un logement avec :

- nom ;
- nom interne ;
- adresse ;
- prix de ménage ;
- propriétaire.

La limite du nombre de logements dépend de l’abonnement GuestLucky.

## Modification

Modifiable :

- nom public ;
- nom interne ;
- adresse ;
- prix du ménage ;
- propriétaire.

Le tarif de nuit de base utilise une commande séparée.

## Suppression

Un logement peut être supprimé.

Si des réservations futures existent, la suppression peut être refusée.

Une suppression forcée existe mais doit être utilisée avec beaucoup de précautions.

---

# 5. Réservations

GuestLucky permet de récupérer les réservations.

## Données disponibles

Pour chaque réservation :

```text
id
reference
status
checkin
checkout
nights
guest
guest_email
guest_phone
guests_count
property
total_price
currency
platform
```

Statuts possibles :

```text
upcoming
in_progress
completed
cancelled
```

## Filtres

Il est possible de rechercher par :

- dates ;
- logement ;
- statut ;
- nom/email du voyageur.

---

# 6. Création de réservations manuelles

Une réservation directe peut être créée depuis Roaming via GuestLucky.

Champs :

```text
property_id
guest_name
checkin
checkout
guests_count
total_price
email
phone
```

Lors de la création, GuestLucky crée également la mission de ménage associée, comme le ferait son formulaire natif.

## Important

Ces réservations sont des créations **locales GuestLucky**.

Elles ne sont pas nécessairement poussées vers les plateformes externes.

---

# 7. Modification d’une réservation

Une réservation peut être modifiée.

Champs modifiables :

- date d’arrivée ;
- date de départ ;
- nom voyageur ;
- nombre de voyageurs ;
- prix total ;
- email ;
- téléphone.

Le nombre de nuits est recalculé automatiquement.

## Important

Les modifications réalisées de cette manière sont locales à GuestLucky.

Elles ne garantissent pas une modification de la réservation sur Airbnb ou Booking.

---

# 8. Suppression d’une réservation

Une réservation peut être supprimée définitivement.

Cette action :

- est irréversible ;
- est locale ;
- ne constitue pas une annulation Airbnb/Booking.

## Règle Codex

Ne jamais créer une interface qui supprime automatiquement une réservation sans confirmation utilisateur explicite.

Préférer :

```text
confirmation humaine
→ suppression
```

---

# 9. Occupation et chiffre d’affaires

GuestLucky permet de calculer les statistiques d’occupation entre deux dates.

Données disponibles :

- taux d’occupation ;
- nuits réservées ;
- nuits disponibles ;
- chiffre d’affaires ;
- comparaison avec la période précédente équivalente ;
- détail par logement.

Exemple :

```text
01/10 → 31/10

Occupation : 71 %
Nuits réservées : ...
Nuits disponibles : ...
Revenue : ...
Variation vs septembre : ...
```

## Attention

Le revenu correspond au prix total des réservations chevauchant la période.

Il n’y a pas forcément de proratisation du revenu par nuit.

Ne pas interpréter cette valeur comme un chiffre comptable exact sans vérifier le comportement attendu.

---

# 10. Dashboard Roaming possible

Ces données permettent de créer :

```text
Occupancy Rate
ADR
Revenue
Revenue / logement
Nuits réservées
Nuits disponibles
Evolution N-1 / période précédente
```

Roaming peut également calculer ses propres KPI.

Exemples :

```text
ADR = revenu hébergement / nombre de nuits vendues

RevPAR = revenu hébergement / nombre de nuits disponibles

Lead Time = checkin - date de réservation

Average Length of Stay = moyenne du nombre de nuits
```

Certains KPI nécessiteront cependant des données supplémentaires non directement fournies par les statistiques GuestLucky.

---

# 11. Missions

GuestLucky possède un système de missions.

Types :

```text
MENAGE
INTERVENTION
AUTRES
```

Correspondance MCP :

```text
cleaning
maintenance
other
```

Statuts :

```text
available
assigned
in_progress
done
cancelled
```

Pour chaque mission :

```text
id
title
type
status
scheduled_date
amount
paid
property
reservation_reference
providers
```

---

# 12. Création de missions

Roaming peut créer directement une mission GuestLucky.

Exemple :

```text
Nettoyage après checkout
Date : 28/09/2026
Logement : Roubaix
Montant prestataire : 45 €
Assigné à : prestataire X
```

Champs disponibles :

```text
amount
date
mission_type
title
property_id
assignee_name
description
```

---

# 13. Modification d’une mission

On peut modifier :

- montant ;
- date ;
- titre ;
- type ;
- logement ;
- description ;
- prestataire assigné.

On peut également retirer l’assignation.

---

# 14. Suppression d’une mission

Une mission peut être supprimée.

Cette suppression est visible pour tous les utilisateurs GuestLucky.

## Règle Codex

Toujours demander une confirmation utilisateur avant toute suppression.

---

# 15. Missions récurrentes

GuestLucky permet de créer des missions récurrentes.

Fréquences :

```text
daily
weekly
monthly
yearly
```

Exemples :

```text
Inspection tous les vendredis
Nettoyage mensuel
Maintenance trimestrielle
Contrôle annuel
```

Configuration possible :

```text
frequency
interval
days_of_week
days_of_month
start_date
end_date
property
amount
assignee
description
```

### Exemple

```text
Tous les vendredis
→ contrôle logement Lambersart
→ 15 €
→ assigné à un prestataire
```

---

# 16. Incidents

GuestLucky permet de gérer les incidents.

Exemples :

- objet cassé ;
- objet manquant ;
- dégradation ;
- problème ménage ;
- panne ;
- intervention technique.

Informations disponibles :

```text
id
description
type
priority
resolved
property
reservation
technician
actions_taken
created_at
```

Priorités :

```text
low
normal
urgent
```

---

# 17. Création d’incident

Roaming peut créer un incident directement.

Exemple :

```text
Télévision cassée dans le salon
Logement : Croix
Priorité : urgent
Technicien : ...
```

---

# 18. Cycle de vie d’un incident

Roaming peut :

```text
Créer
→ assigner technicien
→ modifier priorité
→ ajouter actions réalisées
→ marquer résolu
```

Il est également possible de rouvrir un incident.

---

# 19. Réclamations voyageurs

GuestLucky distingue les incidents internes des réclamations voyageurs.

Une réclamation peut contenir :

```text
id
title
claimant
description
priority
status
reservation
property
created_at
```

Il est possible de :

- lister ;
- créer ;
- modifier ;
- résoudre ;
- rouvrir ;
- supprimer.

---

# 20. Avis voyageurs

GuestLucky permet d’accéder aux avis voyageurs.

Informations :

```text
property
channel
guest_name
rating / 5
review_text
negative_feedback
host_responded
submitted_at
```

Filtres disponibles :

- logement ;
- plateforme ;
- avis non répondus ;
- avis négatifs.

Un avis est considéré comme négatif si :

```text
rating <= 3
```

---

# 21. Utilisations Roaming des avis

Créer un dashboard :

```text
Note moyenne
Avis négatifs
Avis non répondus
Répartition par logement
Répartition par plateforme
Evolution de la note
```

Créer des alertes :

```text
Avis <= 3
→ alerte Roaming

Avis sans réponse depuis X heures
→ alerte manager
```

Il pourrait également être possible d’utiliser un LLM côté Roaming pour proposer une réponse.

Attention : le MCP actuellement disponible permet de **lire les avis**, mais aucune action d’écriture d’une réponse aux avis n’est exposée.

---

# 22. Qualité du ménage

GuestLucky expose également des notes spécifiques au ménage.

Informations :

```text
score / 5
rated_by
comments
retake
reservation
property
date
```

`retake` indique qu’un nouveau ménage / une reprise a été demandée.

Filtres :

```text
par logement
notes <= 3
```

## Usage Roaming

Dashboard prestataire :

```text
note moyenne ménage
nombre de reprises
nombre de mauvaises notes
qualité par logement
```

Cela permettrait éventuellement de construire un scoring prestataire côté Roaming.

---

# 23. Factures propriétaires

GuestLucky expose les factures propriétaires.

Informations :

```text
owner
reference
amounts
total
settled
comment
date
```

Filtres :

```text
settled
unsettled
owner
```

GuestLucky fournit également des totaux :

```text
total_amount
unsettled_amount
unsettled_count
```

---

# 24. Facturation prestataires

Les lignes de facturation des missions sont accessibles.

Statuts :

```text
paid
billed_unpaid
not_billed
```

Le filtre :

```text
unpaid
```

regroupe ce qui reste à payer.

Informations :

```text
mission
type
amount
billing_status
property
provider
scheduled_date
```

## Usage Roaming

Créer :

```text
Montant à payer aux cleaners
Montant payé ce mois
Missions non facturées
Factures prestataires impayées
```

---

# 25. Gestion des stocks

GuestLucky expose un vrai système de stock.

Il comporte :

```text
Stock Item
Category
Store
Movement
```

---

# 26. Articles de stock

Un article possède :

```text
id
name
current_quantity
min_threshold
low_stock
category
store
EAN
```

Exemples :

```text
Papier toilette
Capsules café
Draps doubles
Serviettes
Sacs poubelle
Liquide vaisselle
Produits ménagers
```

---

# 27. Catégories de stock

Roaming peut :

- créer une catégorie ;
- renommer une catégorie ;
- supprimer une catégorie.

Exemples :

```text
Hygiène
Cuisine
Linge
Consommables
Produits ménagers
```

---

# 28. Lieux de stockage

GuestLucky appelle les emplacements de stockage des `stores`.

Types :

```text
commercial
cleaning
laundry
```

Un emplacement peut avoir :

```text
name
type
address
```

Exemples :

```text
Stock central Roaming
Stock cleaner Roubaix
Blanchisserie
```

---

# 29. Mouvements de stock

Trois mouvements existent :

```text
entry
exit
transfer
```

### Entry

Réapprovisionnement.

```text
+ 40 rouleaux papier toilette
```

### Exit

Consommation / perte.

```text
- 6 rouleaux
```

### Transfer

Déplacement entre deux stocks.

```text
Stock central
      ↓
Stock cleaner Roubaix
```

---

# 30. Alerte stock faible

Chaque article peut disposer d’un :

```text
min_threshold
```

Si :

```text
current_quantity <= min_threshold
```

alors :

```text
low_stock = true
```

## Usage Roaming

Dashboard :

```text
⚠ Papier toilette : 4 restants
⚠ Capsules café : 12 restantes
✓ Draps : stock suffisant
```

---

# 31. Livret d’accueil

GuestLucky permet de remplir plusieurs sections du livret voyageur.

Sections disponibles :

```text
checkin_instructions
checkout_instructions
wifi
parking
tv
heating
air_conditioning
oven_cooking
trash
contact
```

Roaming peut modifier ou vider chacune de ces sections.

Le contenu peut être :

```text
texte simple
HTML
```

---

# 32. Recommandations locales

Le livret possède également une section type :

```text
Autour de moi
```

On peut créer des recommandations :

```text
Restaurant
Bar
Activité
Lieu utile
Commerce
```

Une recommandation peut contenir :

```text
title
description
category
Google Maps URL
website URL
property
```

Roaming peut :

- lister ;
- créer ;
- modifier ;
- supprimer.

---

# 33. Templates de messages

GuestLucky possède des templates réutilisables.

Informations :

```text
id
name
description
content
active
```

Un template peut utiliser des variables GuestLucky.

Exemples :

```text
{nom_voyageur}
{checkin}
{checkout}
```

Exemple :

```text
Bonjour {nom_voyageur},

Votre arrivée est prévue le {checkin}.

Voici les instructions...
```

Roaming peut :

- créer ;
- modifier ;
- activer/désactiver ;
- supprimer.

---

# 34. Auto Actions GuestLucky

C’est l’un des éléments les plus importants pour l’intégration Roaming.

Une Auto Action est une automatisation de type :

```text
TRIGGER
   ↓
CONDITIONS
   ↓
ACTIONS
```

---

# 35. Triggers disponibles

GuestLucky expose les triggers suivants :

```text
booking_created
booking_confirmed
booking_cancelled
booking_modified

checkin_offset
checkout_offset

tag_added
tag_removed

message_received
```

### Exemple

```text
booking_confirmed
→ envoyer message de confirmation
```

---

# 36. Offset check-in / checkout

Il est possible de déclencher une automatisation :

```text
X jours avant/après check-in
X jours avant/après checkout
```

Avec une heure précise.

Exemple :

```text
checkin_offset
days = -1
hour = 18
```

Signifie approximativement :

```text
veille de l'arrivée à 18h
```

---

# 37. Conditions Auto Action

Conditions disponibles :

```text
channel
listing
booking_status
tag_present
tag_absent
nights_min
nights_max
guests_min
guests_max
price_min
price_max
checkin_from
checkin_to
country
```

Plusieurs conditions peuvent être combinées.

Toutes doivent être satisfaites.

---

# 38. Actions automatiques disponibles

Les Auto Actions peuvent exécuter :

```text
send_message
send_email
send_catapush

request_caution

add_tag
remove_tag

webhook

create_mission

assign_member
```

Chaque action peut avoir un délai :

```text
delay_minutes
```

---

# 39. Webhooks — intégration majeure pour Roaming

GuestLucky peut appeler une URL externe depuis une Auto Action.

Méthodes disponibles :

```text
GET
POST
```

Cela permet :

```text
GuestLucky
    ↓
Auto Action
    ↓
Webhook
    ↓
API Roaming
```

Exemple :

```text
Nouvelle réservation
        ↓
GuestLucky booking_created
        ↓
Webhook
        ↓
POST /api/webhooks/guestlucky
        ↓
Roaming
```

Roaming pourrait ensuite :

```text
synchroniser réservation
créer événement interne
mettre à jour dashboard
déclencher une alerte
lancer une automatisation métier
```

---

# 40. Exemple d’architecture webhook

```text
GuestLucky
   │
   │ POST
   ▼
/api/webhooks/guestlucky
   │
   ▼
WebhookController
   │
   ▼
GuestLuckyEventHandler
   │
   ├── ReservationCreatedHandler
   ├── ReservationModifiedHandler
   ├── ReservationCancelledHandler
   └── MessageReceivedHandler
   │
   ▼
Database / Queue
```

Recommandation :

Ne pas mettre toute la logique directement dans le contrôleur.

Préférer :

```text
Controller
→ Validator
→ Event
→ Handler
→ Service
```

---

# 41. Exemple d’Auto Action

```text
Trigger:
booking_confirmed

Conditions:
listing = 2474

Actions:
1. send_message
2. add_tag
3. create_mission
4. webhook -> Roaming
```

---

# 42. Gestion des tarifs

GuestLucky expose plusieurs niveaux de pricing.

Il faut bien les différencier.

---

# 43. Tarif de base

Chaque logement possède un tarif de nuit par défaut.

Exemple :

```text
150 €/nuit
```

Il peut être modifié.

## Important

Cette modification est **locale GuestLucky**.

Elle n’est pas nécessairement publiée vers Airbnb/Booking.

---

# 44. Saisons tarifaires

Une saison permet de définir :

```text
property
date_from
date_to
nightly_price
min_nights
```

Exemple :

```text
Haute saison été

01/07/2027
→
31/08/2027

200 €/nuit
minimum 3 nuits
```

Roaming peut :

- lister ;
- créer ;
- modifier ;
- supprimer les saisons.

---

# 45. Dynamic Pricing Rules

GuestLucky expose plusieurs types de règles tarifaires.

Types disponibles :

```text
season
last_minute
early_bird
length_of_stay
day_of_week
event
occupancy_boost
gap_filler
```

---

# 46. Last Minute

Exemple :

```text
Si arrivée dans <= 3 jours
→ -15 %
```

Configuration :

```text
max_days_before_checkin
```

---

# 47. Early Bird

Exemple :

```text
Réservation >= 60 jours avant arrivée
→ -10 %
```

Configuration :

```text
min_days_before_checkin
```

---

# 48. Length of Stay

Exemple :

```text
7 nuits ou plus
→ -8 %
```

Configuration :

```text
min_nights
max_nights
```

---

# 49. Day of Week

Exemple :

```text
Vendredi + samedi
→ +20 %
```

Les jours sont représentés :

```text
1 = lundi
2 = mardi
3 = mercredi
4 = jeudi
5 = vendredi
6 = samedi
7 = dimanche
```

---

# 50. Event Pricing

Permet une règle sur une période événementielle.

Exemple :

```text
Braderie de Lille
→ +35 %
```

---

# 51. Occupancy Boost

Permet d’ajuster les prix selon le taux d’occupation.

Exemple :

```text
Occupation >= 80 %
→ +15 %
```

ou :

```text
Occupation <= 30 %
→ -10 %
```

Selon la configuration utilisée.

---

# 52. Gap Filler

Très intéressant pour Roaming.

Permet de cibler les trous de calendrier.

Exemple :

```text
Trou <= 2 nuits
→ -12 %
```

Configuration :

```text
gap_max_nights
```

Maximum :

```text
10 nuits
```

---

# 53. Types d’ajustement tarifaire

Une règle peut appliquer :

```text
percent
fixed
absolute
```

### Percent

```text
-10 %
+15 %
```

### Fixed

```text
-20 €
+30 €
```

### Absolute

```text
prix = 149 €
```

---

# 54. Floor / Ceiling

Une règle peut posséder :

```text
min_price
max_price
```

Exemple :

```text
last minute -20 %

mais jamais sous :
110 €

et jamais au-dessus :
350 €
```

Roaming devrait toujours encourager l’utilisation de `min_price` pour éviter les prix accidentellement trop faibles.

---

# 55. Activation / désactivation des règles

Une règle peut être :

```text
active = true
active = false
```

Pour désactiver temporairement une stratégie, préférer :

```text
active = false
```

plutôt que supprimer la règle.

---

# 56. Publication des règles

Attention :

La création d’une règle de dynamic pricing dans GuestLucky ne signifie pas nécessairement qu’elle est immédiatement publiée sur les plateformes externes.

Le MCP précise que la publication externe reste une action distincte/manuelle selon le workflow GuestLucky.

---

# 57. Channel Manager

Les logements actuellement connectés utilisent :

```text
sync_mode = channel_manager
```

GuestLucky expose plusieurs actions directement liées au calendrier Channel Manager.

---

# 58. Bloquer des dates

Roaming peut demander à GuestLucky :

```text
bloquer du 03/10 au 05/10
```

avec éventuellement une raison.

Exemple :

```text
Travaux
Usage propriétaire
Maintenance
```

---

# 59. Débloquer des dates

Une période précédemment bloquée peut être rendue disponible.

---

# 60. Modifier le prix d’une période

Contrairement au tarif de base, il existe une commande pour modifier directement le prix d’une période du calendrier Channel Manager.

Exemple :

```text
01/12 → 10/12

175 €/nuit
```

C’est très intéressant pour le module de revenue management de Roaming.

---

# 61. Minimum / maximum de nuits

Roaming peut modifier :

```text
min_nights
max_nights
```

Deux modes existent.

### Sans période

Modifie la règle par défaut du logement.

### Avec période

Modifie la règle seulement sur une période du calendrier Channel Manager.

Exemple :

```text
Braderie :
minimum 3 nuits
```

---

# 62. Restrictions d’arrivée / départ

Il est possible d’appliquer :

```text
none
no_checkin
no_checkout
no_checkin_no_checkout
```

Exemples :

```text
Interdire les arrivées le dimanche
Interdire les départs le samedi
Bloquer arrivées + départs pendant une intervention
```

---

# 63. Governance Mode

Certaines actions Channel Manager peuvent être refusées si GuestLucky fonctionne avec un mode de gouvernance nécessitant une validation propriétaire.

Notamment :

- modification de prix ;
- blocage de dates ;
- restrictions ;
- etc.

Roaming doit donc toujours gérer les erreurs GuestLucky proprement.

Ne jamais considérer qu’une modification demandée a forcément été appliquée.

---

# 64. Environnements de simulation

Certaines actions Channel Manager peuvent répondre :

```text
simulation = true
```

Dans ce cas :

**aucune modification réelle n’a été envoyée au Channel Manager.**

Roaming doit distinguer :

```text
SUCCESS_REAL
SUCCESS_SIMULATION
FAILED
```

---

# 65. Comptes équipe

GuestLucky expose les comptes liés à l’équipe.

Rôles :

```text
owner
cleaning
technician
manager
```

Il est possible de :

- lister ;
- créer ;
- modifier ;
- supprimer.

Un compte peut avoir plusieurs rôles.

Exemple :

```text
cleaning + technician
```

---

# 66. Création de compte équipe

Champs possibles :

```text
first_name
last_name
email
password
phone
address
roles
```

## Règle importante

Le mot de passe doit toujours être fourni explicitement par un humain.

Il ne faut jamais générer automatiquement un mot de passe puis appeler GuestLucky avec celui-ci sans validation.

---

# 67. Propriétaires

Le rôle :

```text
owner
```

peut être utilisé pour rattacher un logement à son propriétaire.

Cela permet éventuellement à Roaming de construire une vue :

```text
Propriétaire
    ↓
Logements
    ↓
Réservations
    ↓
Revenus
    ↓
Factures
```

---

# 68. Prospection propriétaires

GuestLucky expose également un mini CRM de prospects.

Informations possibles :

```text
first_name
last_name
email
phone
company
address
city
zipcode
properties_count
description
status
```

Statuts :

```text
nouveau
contacte
a_rappeler
sans_suite
converti
```

Roaming peut :

- lister ;
- rechercher ;
- créer ;
- modifier ;
- supprimer.

---

# 69. CRM Roaming potentiel

Il serait possible d’utiliser ces données pour créer :

```text
Prospects propriétaires
        ↓
Nouveau
        ↓
Contacté
        ↓
À rappeler
        ↓
Converti
        ↓
Création Owner
        ↓
Création logement
```

---

# 70. Aide officielle GuestLucky

Le MCP permet également d’interroger le guide utilisateur officiel GuestLucky.

Cette source doit être utilisée lorsque la question concerne :

```text
"Comment faire X dans GuestLucky ?"
```

Exemples :

```text
Comment connecter Airbnb ?
Comment gérer la caution ?
Comment modifier le prix du ménage ?
```

Il ne faut pas inventer une procédure UI à partir des fonctions MCP.

---

# 71. Ce que Roaming peut construire au-dessus de GuestLucky

## Module 1 — Dashboard exploitation

Page :

```text
/dashboard
```

Widgets possibles :

```text
Arrivées aujourd’hui
Départs aujourd’hui
Logements occupés
Ménages aujourd’hui
Missions en retard
Incidents ouverts
Réclamations urgentes
Stocks faibles
Avis négatifs
```

---

# 72. Module 2 — Planning

Vue calendrier regroupant :

```text
Réservations
Arrivées
Départs
Ménages
Maintenances
Incidents
Périodes bloquées
```

---

# 73. Module 3 — Operations Center

Exemple :

```text
Aujourd’hui

Lambersart
11:00 Checkout
12:00 Ménage
16:00 Check-in

Roubaix
Pas de mouvement

Croix
Maintenance 14:00
Check-in 17:00
```

---

# 74. Module 4 — Revenue Management

Fonctions possibles :

```text
Occupation 7 jours
Occupation 30 jours
Occupation 60 jours
Occupation 90 jours

Détection de trous
Détection faible occupation
Détection forte occupation

Suggestions tarifaires
```

Exemple :

```text
Roubaix

12-14 octobre
Trou de 2 nuits

Prix actuel : 150 €
Suggestion : 125 €

Floor : 110 €
```

Puis :

```text
[Appliquer]
```

qui utilise le Channel Manager GuestLucky.

---

# 75. Module 5 — Dynamic Pricing Roaming

Roaming pourrait générer automatiquement des suggestions :

```text
IF occupancy < 35 %
AND checkin < 7 days
THEN discount 12 %
```

Mais une bonne architecture est :

```text
Roaming analyse
        ↓
Roaming propose
        ↓
Humain valide
        ↓
GuestLucky applique
```

Au moins pour les premières versions.

---

# 76. Module 6 — Qualité

Dashboard :

```text
Note Airbnb / Booking
Note ménage
Incidents
Réclamations
Retakes ménage
```

Par logement.

Exemple :

```text
Croix

Avis : 4.8 / 5
Ménage : 4.4 / 5
Incidents ce mois : 2
Retakes : 1
```

---

# 77. Module 7 — Prestataires

Vue cleaner / technicien :

```text
Missions terminées
Missions futures
Montants dus
Montants payés
Qualité ménage
Retakes
```

---

# 78. Module 8 — Stocks

Dashboard :

```text
Stock total
Stock par emplacement
Articles faibles
Derniers mouvements
```

Automatisation possible :

```text
stock <= minimum
→ alerte Roaming
```

---

# 79. Module 9 — CRM propriétaires

Pipeline :

```text
Prospect
→ Contacté
→ À rappeler
→ Converti
→ Owner GuestLucky
→ Logement GuestLucky
```

---

# 80. Module 10 — Assistant IA Roaming

Un assistant pourrait utiliser les données GuestLucky pour répondre :

```text
"Qu’est-ce qu’on a demain ?"

"Quels ménages ne sont pas assignés ?"

"Quels logements ont le plus d’incidents ?"

"Où avons-nous des trous dans les 30 prochains jours ?"

"Quels avis négatifs n’ont pas encore de réponse ?"

"Quels produits sont bientôt en rupture ?"

"Combien doit-on encore payer aux cleaners ?"
```

---

# 81. Briefing automatique quotidien

Exemple de génération :

```text
ROAMING — BRIEFING 28/09

ARRIVÉES
- Roubaix — 16h — 6 voyageurs

DÉPARTS
- Croix — 11h

MÉNAGES
- Croix — 12h — assigné
- Roubaix — 11h — non assigné

INCIDENTS
- Lambersart — fuite lavabo — URGENT

STOCK
- Papier toilette — faible

AVIS
- 1 avis <= 3/5 sans réponse
```

---

# 82. Webhook + Queue recommandés

Pour une intégration robuste :

```text
GuestLucky
   ↓
Webhook
   ↓
Roaming API
   ↓
Queue
   ↓
Worker
   ↓
Synchronisation DB
```

Éviter :

```text
Webhook
→ traitement lourd synchrone
```

---

# 83. Modèle de données Roaming recommandé

Roaming ne devrait pas dépendre directement des objets GuestLucky dans tout le code.

Créer une abstraction locale.

Exemple :

```text
Property
Reservation
Mission
Incident
Claim
StockItem
Provider
Owner
Review
PricingRule
```

Chaque entité synchronisée peut conserver :

```text
id
guestlucky_id
last_synced_at
sync_status
raw_external_data
```

---

# 84. External ID

Exemple :

```php
class Property
{
    private int $id;

    private ?int $guestLuckyId;

    private string $name;
}
```

Ne jamais utiliser directement :

```php
$id = 2474;
```

dans un service métier.

---

# 85. Client GuestLucky recommandé

Créer une couche dédiée.

Exemple :

```text
src/
└── Integration/
    └── GuestLucky/
        ├── GuestLuckyClient
        ├── GuestLuckyPropertyService
        ├── GuestLuckyReservationService
        ├── GuestLuckyMissionService
        ├── GuestLuckyPricingService
        ├── GuestLuckyStockService
        └── GuestLuckyWebhookHandler
```

---

# 86. Services métier Roaming

Séparer les appels GuestLucky de la logique métier.

Exemple :

```text
src/
└── Domain/
    ├── Pricing/
    │   └── RevenueManagementService
    │
    ├── Operations/
    │   └── DailyOperationsService
    │
    └── Stock/
        └── StockAlertService
```

Puis :

```text
RevenueManagementService
       ↓
GuestLuckyPricingService
       ↓
GuestLucky MCP/API
```

---

# 87. Lecture vs écriture

Toutes les actions doivent être classées en deux groupes.

## Read

Exemples :

```text
lister logements
lister réservations
occupation
missions
incidents
stocks
avis
factures
```

Ces actions peuvent généralement être exécutées automatiquement.

## Write

Exemples :

```text
modifier prix
bloquer dates
créer réservation
supprimer réservation
créer mission
modifier mission
créer incident
modifier stock
```

Ces actions peuvent avoir un impact métier réel.

---

# 88. Niveau de risque des actions

Classification recommandée côté Roaming.

## LOW

```text
READ
```

Exemple :

```text
charger réservations
calculer statistiques
```

## MEDIUM

```text
CREATE / UPDATE non critique
```

Exemple :

```text
créer incident
ajouter mouvement stock
modifier livret
```

## HIGH

```text
pricing
calendar
reservation
deletion
```

Exemple :

```text
modifier prix
bloquer dates
supprimer réservation
supprimer logement
```

---

# 89. Confirmation humaine

Pour toute action critique :

```text
IA / Roaming propose
      ↓
Preview
      ↓
Utilisateur confirme
      ↓
GuestLucky action
```

Exemple :

```text
Prix actuel : 150 €
Nouveau prix : 120 €
Dates : 03/10 → 05/10

[Confirmer]
[Annuler]
```

---

# 90. Suppressions

Les suppressions suivantes doivent toujours demander confirmation :

```text
mission
incident
season
reservation
pricing rule
property
claim
recommendation
stock item
stock category
store
template
recurrence
auto action
team account
prospect
```

Codex ne doit pas créer de comportement de suppression silencieuse.

---

# 91. Idempotence

Les webhooks peuvent théoriquement être reçus plusieurs fois.

Roaming doit être conçu pour éviter :

```text
1 booking webhook
→ 2 réservations locales
```

Prévoir un système du type :

```text
external_event_id
processed_at
event_type
payload_hash
```

ou une clé de déduplication appropriée.

---

# 92. Logs

Toutes les écritures GuestLucky devraient être journalisées.

Exemple :

```text
guestlucky_actions

id
user_id
action
resource_type
resource_id
payload
status
response
created_at
```

Particulièrement pour :

```text
pricing
calendar
reservation
stock
missions
```

---

# 93. Erreurs

Ne jamais masquer une erreur GuestLucky.

Exemple :

```text
try {
    updatePrice();
} catch (GuestLuckyException $e) {
    // log
    // afficher erreur
}
```

Ne jamais faire :

```text
updatePrice();

return "Prix modifié";
```

sans vérifier la réponse.

---

# 94. Source of Truth

Définir précisément quelle application est propriétaire de quelle donnée.

Proposition initiale :

| Donnée | Source principale |
|---|---|
| Réservations | GuestLucky |
| Disponibilités | GuestLucky / Channel Manager |
| Prix Channel Manager | GuestLucky |
| Missions | GuestLucky |
| Incidents | GuestLucky |
| Stocks | GuestLucky |
| Avis | GuestLucky |
| Analytics avancées | Roaming |
| Suggestions prix | Roaming |
| Alertes métier | Roaming |
| Logs intégration | Roaming |
| IA | Roaming |

Cela pourra évoluer.

---

# 95. Ce que le MCP ne doit pas faire supposer

La présence d’une donnée dans GuestLucky ne signifie pas qu’elle est modifiable.

Toujours distinguer :

```text
READ support
WRITE support
CHANNEL MANAGER support
LOCAL GuestLucky support
```

Exemple :

```text
Avis voyageurs :
READ = oui
Répondre à un avis = non exposé actuellement
```

---

# 96. Local vs Channel Manager

Très important.

## Local GuestLucky

Certaines actions sont locales.

Exemples :

```text
update base property price
create manual reservation
update manual reservation
pricing rules
```

Elles ne signifient pas automatiquement :

```text
modification Airbnb/Booking
```

## Channel Manager

Certaines commandes ciblent explicitement le calendrier synchronisé.

Exemples :

```text
block dates
unblock dates
calendar price
stay rules by period
date restrictions
```

---

# 97. Confidentialité

Les réservations peuvent contenir :

```text
nom voyageur
email
téléphone
dates de séjour
```

Ces données doivent être considérées comme personnelles.

Roaming doit limiter :

- les logs contenant ces données ;
- leur exposition aux utilisateurs non autorisés ;
- leur conservation inutile ;
- leur envoi à des services externes non nécessaires.

---

# 98. Permissions

Prévoir éventuellement dans Roaming :

```text
ROLE_ADMIN
ROLE_MANAGER
ROLE_OPERATIONS
ROLE_CLEANER
ROLE_TECHNICIAN
ROLE_OWNER
```

Exemple :

```text
Cleaner
→ voir ses missions
→ marquer mission terminée

Manager
→ modifier prix
→ gérer incidents

Owner
→ voir son logement
→ voir analytics
```

---

# 99. Premier MVP recommandé

Pour éviter de reconstruire tout GuestLucky, le premier MVP Roaming devrait se concentrer sur :

## A. Dashboard

```text
Arrivées
Départs
Ménages
Incidents
Occupation
CA
```

## B. Planning

```text
Réservations + missions
```

## C. Revenue Management

```text
occupation
trous
suggestions prix
application après confirmation
```

## D. Alertes

```text
incident urgent
ménage non assigné
avis négatif
stock faible
```

---

# 100. Roadmap potentielle

## V1

```text
GuestLucky connection
Property sync
Reservation sync
Dashboard
Arrivals / departures
Mission dashboard
Incident dashboard
```

## V2

```text
Occupancy analytics
Revenue analytics
Gap detection
Pricing suggestions
Calendar actions
```

## V3

```text
Stock management
Provider analytics
Cleaning quality
Reviews
```

## V4

```text
Auto Actions
Webhooks
Realtime sync
AI assistant
Daily briefing
```

## V5

```text
Owner portal
CRM
Advanced revenue management
Automatic pricing strategies
```

---

# 101. Exemple d’expérience utilisateur

```text
Dashboard Roaming

Occupation 30j
████████████████░░░░ 78 %

CA prévisionnel
12 420 €

Aujourd’hui
3 arrivées
2 départs
4 ménages

Alertes
⚠ 1 ménage non assigné
⚠ 1 incident urgent
⚠ stock café faible
```

---

# 102. Exemple Revenue Management

```text
ROUBAIX

Occupation 30 jours : 42 %

Trou détecté :
12 → 14 octobre

Prix :
150 € / nuit

Suggestion Roaming :
129 € / nuit

Impact :
-14 %

Floor configuré :
110 €

[Appliquer dans GuestLucky]
```

Après confirmation :

```text
Roaming
↓
GuestLucky
↓
Channel Manager calendar price
```

---

# 103. Exemple Assistant IA

Utilisateur :

```text
Qu’est-ce que je dois gérer aujourd’hui ?
```

Roaming :

```text
Tu as :

- 2 départs
- 3 arrivées
- 3 ménages
- 1 ménage encore non assigné
- 1 incident urgent à Lambersart
- le stock de capsules café sous le seuil minimum

Priorité :
1. assigner le ménage
2. traiter l’incident Lambersart
3. réapprovisionner le café
```

---

# 104. Exemple automatisation complète

```text
Booking confirmed
      ↓
GuestLucky
      ↓
Auto Action
      ├── send confirmation
      ├── add tag
      ├── create cleaning mission
      └── webhook
             ↓
          Roaming
             ↓
ReservationSynced event
             ↓
Update Dashboard
             ↓
Run Pricing Analysis
```

---

# 105. Règles pour Codex

Lorsqu’un développement concerne GuestLucky :

1. Ne jamais inventer une capability GuestLucky.
2. Vérifier qu’elle existe dans le MCP/API disponible.
3. Distinguer lecture et écriture.
4. Distinguer modification locale et Channel Manager.
5. Ne jamais coder les IDs GuestLucky en dur.
6. Encapsuler GuestLucky derrière un service d’intégration.
7. Ne pas mélanger logique métier Roaming et client GuestLucky.
8. Logger les écritures critiques.
9. Gérer les erreurs et timeouts.
10. Prévoir les doublons de webhooks.
11. Demander confirmation pour les actions destructives.
12. Demander confirmation pour les modifications tarifaires sensibles.
13. Vérifier les réponses `simulation`.
14. Protéger les données personnelles des voyageurs.
15. Garder Roaming utilisable même si GuestLucky est temporairement indisponible.

---

# 106. Principe fondamental

GuestLucky doit être vu comme :

```text
PMS + Operations Engine + Channel Manager
```

Roaming comme :

```text
Business Intelligence
+ Custom UX
+ Automation
+ Revenue Management
+ AI
+ Monitoring
```

L’objectif n’est donc pas :

```text
recréer GuestLucky
```

mais :

```text
GuestLucky
      +
Roaming
      =
outil métier adapté à SAS Roaming
```

---

# 107. Capacités MCP résumées

| Domaine | Lecture | Création | Modification | Suppression |
|---|:---:|:---:|:---:|:---:|
| Compte | ✅ | — | — | — |
| Logements | ✅ | ✅ | ✅ | ✅ |
| Réservations | ✅ | ✅ | ✅ | ✅ |
| Occupation | ✅ | — | — | — |
| Missions | ✅ | ✅ | ✅ | ✅ |
| Missions récurrentes | ✅ | ✅ | ✅ | ✅ |
| Incidents | ✅ | ✅ | ✅ | ✅ |
| Réclamations | ✅ | ✅ | ✅ | ✅ |
| Avis voyageurs | ✅ | ❌ | ❌ | ❌ |
| Notes ménage | ✅ | ❌ | ❌ | ❌ |
| Factures propriétaires | ✅ | ❌ | ❌ | ❌ |
| Factures prestataires | ✅ | ❌ | ❌ | ❌ |
| Stocks | ✅ | ✅ | ✅ | ✅ |
| Catégories stock | ✅ | ✅ | ✅ | ✅ |
| Lieux de stockage | ✅ | ✅ | ✅ | ✅ |
| Mouvements stock | ✅ | ✅ | — | — |
| Livret d’accueil | — | — | ✅ | — |
| Recommandations locales | ✅ | ✅ | ✅ | ✅ |
| Templates messages | ✅ | ✅ | ✅ | ✅ |
| Auto Actions | ✅ | ✅ | ✅ | ✅ |
| Pricing seasons | ✅ | ✅ | ✅ | ✅ |
| Pricing rules | ✅ | ✅ | ✅ | ✅ |
| Comptes équipe | ✅ | ✅ | ✅ | ✅ |
| Prospects | ✅ | ✅ | ✅ | ✅ |
| Guide GuestLucky | ✅ | — | — | — |

---

# 108. Capacités Channel Manager résumées

Pour les logements synchronisés :

| Action | Disponible |
|---|:---:|
| Bloquer dates | ✅ |
| Débloquer dates | ✅ |
| Modifier prix par période | ✅ |
| Minimum de nuits par période | ✅ |
| Maximum de nuits par période | ✅ |
| Interdire check-in | ✅ |
| Interdire checkout | ✅ |
| Interdire check-in + checkout | ✅ |

Certaines actions peuvent être refusées en fonction :

```text
governance mode
subscription
sync mode
permissions
environment
```

---

# 109. Conclusion

Le MCP GuestLucky donne à Roaming accès à une grande partie des données et opérations nécessaires pour construire un véritable **cockpit de gestion locative**.

La stratégie recommandée est :

```text
GuestLucky
=
source opérationnelle

Roaming
=
interface intelligente
+
analytics
+
automatisation
+
alertes
+
revenue management
+
assistant IA
```

Le développement doit commencer par la **lecture/synchronisation** des données avant d’activer progressivement les actions d’écriture à impact réel.

Priorité recommandée :

```text
1. Properties
2. Reservations
3. Missions
4. Incidents
5. Dashboard
6. Occupancy analytics
7. Revenue management
8. Channel Manager actions
9. Webhooks
10. Automatisations avancées
```

Le plus important pour Codex est surtout la partie **« Règles pour Codex » + « Source of Truth » + « Local vs Channel Manager »**, parce qu’elle l’empêchera de partir sur une architecture où Roaming duplique inutilement GuestLucky ou considère qu’une modification locale est automatiquement publiée sur Booking/Airbnb.
