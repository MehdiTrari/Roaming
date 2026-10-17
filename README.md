# 🏠 Roaming Lille

> **[roaminglille.com](https://roaminglille.com/)** — Plateforme de location de logements meublés à Lille et dans la métropole lilloise.

![Roaming Lille](https://roaminglille.com/images/og-default.png)

## 📖 À propos

**Roaming Lille** est une plateforme de réservation de locations saisonnières haut de gamme, spécialisée dans la région lilloise. Le site propose des logements soigneusement sélectionnés, pensés pour les professionnels et les groupes.

### ✨ Fonctionnalités principales

- 🔍 **Recherche avancée** — Filtrage par destination, dates et nombre de voyageurs
- 🏡 **Catalogue de propriétés** — 4 logements actifs : Lambersart, Roubaix, Douai et Croix
- 🗺️ **Emplacements** — Carrousel des disponibilités relié aux adresses exactes, carte interactive et itinéraires ; [documentation](docs/Property_locations_et_cartes.md)
- 📅 **Intégration Airbnb** — Notes et avis synchronisés depuis Airbnb
- 🌍 **Multilingue** — Disponible en français et anglais
- 📧 **Formulaire de contact** — Communication directe avec l'équipe
- 📱 **Responsive design** — Optimisé mobile et desktop

### 🎯 Points forts des logements

| Garantie | Description |
|----------|-------------|
| 📶 Wi-Fi rapide | Vérifié dans chaque logement |
| 🔑 Arrivée autonome | Check-in flexible |
| 🛋️ Logement équipé | Tout le nécessaire inclus |
| 🛏️ Literie de qualité | Confort garanti |
| 👥 Idéal pour groupes | Capacité jusqu'à 10 voyageurs |
| 💰 Sans commission | Réservation directe |

---

## 🛠️ Stack technique

### Backend

| Technologie | Version | Description |
|-------------|---------|-------------|
| **PHP** | >= 8.4 | Langage serveur |
| **Symfony** | 8.0 | Framework PHP |
| **Doctrine ORM** | 3.x | Mapping objet-relationnel |
| **MySQL** | 8.0 | Base de données |
| **Twig** | 3.x | Moteur de templates |

### Frontend

| Technologie | Version | Description |
|-------------|---------|-------------|
| **Webpack Encore** | 5.x | Bundler d'assets |
| **Bootstrap** | 5.3 | Framework CSS |
| **Hotwire Turbo** | 8.x | Navigation SPA-like |
| **Stimulus** | 3.x | Framework JS léger |
| **Flatpickr** | 4.6 | Sélecteur de dates |

### Infrastructure

- 🐳 **Docker** — Conteneurisation (MySQL)
- 📦 **Composer** — Gestion des dépendances PHP
- 📦 **npm** — Gestion des dépendances JS
- 🔒 **Symfony Security** — Authentification & autorisation
- 📧 **Symfony Mailer** — Envoi d'emails

---

## 🚀 Installation

### Lancer l'application en local

Ce guide permet de lancer l'application Symfony sur une machine de développement.

#### 1. Prérequis

Installez les outils suivants :

- PHP `>= 8.4`
- Composer
- Node.js et npm
- Docker Desktop
- Symfony CLI, recommandé pour lancer le serveur local

Vérifiez rapidement les versions :

```bash
php -v
composer -V
node -v
npm -v
docker --version
symfony version
```

#### 2. Installer les dépendances

Depuis la racine du projet :

```bash
composer install
npm install
```

#### 3. Configurer l'environnement

Le projet utilise `.env` comme configuration par défaut et `.env.local` pour votre configuration locale.

Si `.env.local` n'existe pas encore :

```bash
cp .env .env.local
```

Dans `.env.local`, vérifiez surtout `DATABASE_URL`. Avec Docker Compose, la base locale est une base MySQL. L'URL doit ressembler à ceci, en adaptant le port si Docker en expose un autre :

```dotenv
DATABASE_URL="mysql://smogii:smogii@127.0.0.1:PORT/smogii?serverVersion=8.0.32&charset=utf8mb4"
```

Pour trouver le port MySQL exposé par Docker :

```bash
docker compose ps
```

#### 4. Démarrer les services Docker

```bash
docker compose up -d
```

Cela lance notamment :

- MySQL
- Mailpit pour tester les emails en local

#### 5. Préparer la base de données

```bash
php bin/console doctrine:database:create --if-not-exists
php bin/console doctrine:migrations:migrate
```

Validez la migration quand Symfony le demande.

#### 6. Compiler les assets

Pour un lancement simple :

```bash
npm run dev
```

Pendant le développement, vous pouvez utiliser le mode watch :

```bash
npm run watch
```

#### 7. Lancer le serveur web

Avec Symfony CLI :

```bash
symfony server:start
```

L'application sera disponible sur l'URL affichée par la commande, en général :

```text
https://127.0.0.1:8000
```

Alternative sans Symfony CLI :

```bash
php -S 127.0.0.1:8000 -t public
```

#### Commandes utiles

```bash
# Voir les conteneurs Docker et les ports exposés
docker compose ps

# Arrêter les services Docker
docker compose down

# Nettoyer le cache Symfony
php bin/console cache:clear

# Lancer les tests
php bin/phpunit

# Générer les assets de production
npm run build
```

#### Problème fréquent : connexion à la base

Si Symfony n'arrive pas à se connecter à MySQL :

1. Vérifiez que Docker est lancé.
2. Lancez `docker compose ps`.
3. Recopiez le port MySQL exposé dans `DATABASE_URL` de `.env.local`.
4. Relancez les migrations :

```bash
php bin/console doctrine:migrations:migrate
```

---

## 📦 Scripts disponibles

### PHP / Symfony

```bash
# Lancer les tests
php bin/phpunit

# Vider le cache
php bin/console cache:clear

# Compiler les assets (AssetMapper)
php bin/console asset-map:compile
```

### npm / Webpack

```bash
# Mode développement
npm run dev

# Mode watch (recompilation automatique)
npm run watch

# Build de production
npm run build
```

---

## 📁 Structure du projet

```
├── assets/              # Sources JS/CSS (Stimulus, Bootstrap)
├── config/              # Configuration Symfony
├── migrations/          # Migrations Doctrine
├── public/              # Point d'entrée web
│   ├── build/           # Assets compilés (Webpack)
│   └── uploads/         # Fichiers uploadés
├── src/
│   ├── Controller/      # Contrôleurs
│   ├── Entity/          # Entités Doctrine
│   ├── Form/            # Formulaires
│   ├── Repository/      # Repositories
│   └── Service/         # Services métier
├── templates/           # Templates Twig
├── translations/        # Fichiers de traduction (FR/EN)
└── tests/               # Tests PHPUnit
```

---

## 📞 Contact

- 🌐 **Site web** : [roaminglille.com](https://roaminglille.com/)
- 📧 **Email** : [contact@roamingfr.com](mailto:contact@roamingfr.com)
- 📱 **Téléphone** : [+33 6 60 34 40 71](tel:+33660344071)

---

## 📄 Licence

Propriétaire — © 2025 Roaming Lille. Tous droits réservés.


## GuestLucky

La synchronisation automatique du catalogue par MCP est disponible depuis le 17 octobre 2026. Voir [le guide MCP et synchronisation](docs/GuestLucky_MCP_et_Synchronisation.md) : connexion privée, nouveaux logements, commande `app:guestlucky:sync`, tâche Windows toutes les cinq minutes et configuration du cron en production.

Le catalogue, les calendriers et la recherche utilisent GuestLucky. La mise en ligne des disponibilités est désactivée par défaut jusqu’à validation du calendrier fournisseur.

Voir [la documentation d’intégration](docs/GuestLucky_Integration.md) pour l’import du catalogue, les variables d’environnement, les tests et la bascule.

En local : `/test-disponibilites` permet de lire les calendriers et de tester les devis sans réserver, même si la publication est désactivée. `/disponibilites` explique le verrou et propose un accès au test en environnement `dev` uniquement.

Diagnostic en lecture seule : `php bin/console app:guestlucky:check lambersart 2026-10-01 2026-10-03 --guests=2` (adapter les dates).

## Maintenance et tests en équipe

`SITE_MAINTENANCE=1` affiche la maintenance publique ; les comptes invités accèdent au site via `/equipe/connexion`, avec tickets partagés et captures privées. Les comptes sont créés ou réinitialisés avec `app:team:user`. Pour développer sans maintenance, mettre `SITE_MAINTENANCE=0` dans `.env.local`.

Voir [le guide de déploiement, des comptes et des tickets](docs/MAINTENANCE_ET_TESTS.md), avec le bouclier FTP, les migrations, l'ouverture publique et le retour arrière. Le verrou GuestLucky reste indépendant.

Voir [le guide de style Roaming](docs/Style_Guide.md) avant de créer ou modifier une page : palette, thèmes, typographie, états du planning et contrôles visuels.
