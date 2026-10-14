<?php
declare(strict_types=1);
// PHP's Windows built-in server does not consistently expose process env to $_SERVER.
// Explicitly isolate this test server before booting the normal production kernel.
if (PHP_SAPI !== 'cli-server' || getenv('DATABASE_URL') !== 'sqlite:///%kernel.project_dir%/var/team-browser.sqlite') {
    throw new RuntimeException('Browser test server requires the dedicated SQLite fixture.');
}
foreach (['APP_ENV', 'APP_DEBUG', 'SITE_MAINTENANCE', 'DATABASE_URL', 'GUESTLUCKY_AVAILABILITY_ENABLED'] as $key) {
    $_SERVER[$key] = $_ENV[$key] = getenv($key);
}
return require dirname(__DIR__, 2).'/public/index.php';
