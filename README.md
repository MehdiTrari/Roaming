# 🏠 Roaming Lille

> **[roaminglille.com](https://roaminglille.com/)** — Plateforme de location de logements meublés à Lille et dans la métropole lilloise.

![Roaming Lille](https://roaminglille.com/images/og-default.png)

## 📖 À propos

**Roaming Lille** est une plateforme de réservation de locations saisonnières haut de gamme, spécialisée dans la région lilloise. Le site propose des logements soigneusement sélectionnés, pensés pour les professionnels et les groupes.

### ✨ Fonctionnalités principales

- 🔍 **Recherche avancée** — Filtrage par destination, dates et nombre de voyageurs
- 🏡 **Catalogue de propriétés** — 5 logements uniques (maisons, appartements, duplex)
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
| **PostgreSQL** | 16 | Base de données |
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

- 🐳 **Docker** — Conteneurisation (PostgreSQL)
- 📦 **Composer** — Gestion des dépendances PHP
- 📦 **npm** — Gestion des dépendances JS
- 🔒 **Symfony Security** — Authentification & autorisation
- 📧 **Symfony Mailer** — Envoi d'emails

---

## 🚀 Installation

### Prérequis

- PHP `>= 8.4`
- Composer
- Node.js & npm
- Docker & Docker Compose (recommandé pour PostgreSQL)

### Installation locale

1️⃣ **Cloner le projet et installer les dépendances**

```bash
composer install
npm install
```

2️⃣ **Démarrer PostgreSQL avec Docker**

```bash
docker compose up -d
```

3️⃣ **Configurer l'environnement**

Copier `.env` vers `.env.local` et configurer :

```dotenv
DATABASE_URL="postgresql://app:!ChangeMe!@127.0.0.1:5432/app?serverVersion=16&charset=utf8"
APP_SECRET=your_random_secret_here
```

4️⃣ **Créer la base de données et exécuter les migrations**

```bash
php bin/console doctrine:migrations:migrate
```

5️⃣ **Compiler les assets**

```bash
npm run build
```

6️⃣ **Lancer le serveur**

```bash
symfony server:start
```

Ou avec le serveur PHP intégré :

```bash
php -S 127.0.0.1:8000 -t public
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

