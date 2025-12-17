# smogii

Symfony 8 (PHP) web application using Doctrine ORM + PostgreSQL, Twig, and Symfony AssetMapper/Importmap.

## Requirements

- PHP `>= 8.4`
- Composer
- Optional: Docker + Docker Compose (recommended for PostgreSQL)

## Quick start (local)

1) Install PHP dependencies:

```bash
composer install
```

2) Start PostgreSQL (Docker):

```bash
docker compose up -d
```

The default connection string is defined in `.env`:

```dotenv
DATABASE_URL="postgresql://app:!ChangeMe!@127.0.0.1:5432/app?serverVersion=16&charset=utf8"
```

3) Create/update the database schema:

```bash
php bin/console doctrine:migrations:migrate
```

4) Run the app:

- With Symfony CLI:

```bash
symfony server:start
```

- Or with PHP built-in server:

```bash
php -S 127.0.0.1:8000 -t public
```

## Configuration

- Copy local overrides into `.env.local` (never commit it):
  - `APP_SECRET` should be set to a random value for dev/prod.
  - Override `DATABASE_URL` if your Postgres is not on `127.0.0.1:5432`.

## Frontend assets

This project uses Symfony AssetMapper + Importmap (see `importmap.php`).

- Compile mapped assets (useful for production builds):

```bash
php bin/console asset-map:compile
```

- Add a new JS dependency:

```bash
php bin/console importmap:require <package>
```

## Tests

```bash
php bin/phpunit
```

