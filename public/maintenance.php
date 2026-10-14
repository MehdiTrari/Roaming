<?php
declare(strict_types=1);
if (!is_file(__DIR__.'/.maintenance')) { header('Location: /', true, 302); exit; }
http_response_code(503);
header('Retry-After: 3600');
header('Cache-Control: no-store, private');
header('Content-Type: text/html; charset=utf-8');
$english = ($_GET['_locale'] ?? '') === 'en';
?>
<!doctype html>
<html lang="<?= $english ? 'en' : 'fr' ?>"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Roaming Lille</title>
<style>body{margin:0;background:#f8f9fa;color:#212529;font:18px/1.6 system-ui,sans-serif}main{max-width:680px;margin:12vh auto;padding:24px;text-align:center}h1{line-height:1.2}a{color:#0f766e}small{font-size:14px}</style></head>
<body><main><p>ROAMING LILLE</p><h1><?= $english ? 'We are preparing our new website' : 'Nous préparons notre nouveau site' ?></h1><p><?= $english ? 'Our website is being updated. Our team remains available to help you plan your stay.' : 'Notre site est en cours de mise à jour. Notre équipe reste disponible pour organiser votre séjour.' ?></p><p><a href="mailto:contact@roamingfr.com">contact@roamingfr.com</a><br><a href="tel:+33660344071">+33 6 60 34 40 71</a></p><small><a href="?_locale=fr">FR</a> · <a href="?_locale=en">EN</a></small></main></body></html>
