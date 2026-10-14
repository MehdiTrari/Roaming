<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class LocaleController extends AbstractController
{
    #[Route('/change-locale/{locale}', name: 'app_switch_locale')]
    public function switchLocale(string $locale, Request $request): Response
    {
        if (!in_array($locale, ['fr', 'en'], true)) { throw $this->createNotFoundException(); }
        // Store the locale in the session
        $request->getSession()->set('_locale', $locale);

        // Redirect back to the previous page or home
        $parts = parse_url($request->headers->get('referer', '/'));
        if (!$parts || (isset($parts['host']) && strtolower($parts['host']) !== strtolower($request->getHost()))
            || (isset($parts['scheme']) && !in_array($parts['scheme'], ['http', 'https'], true))) { $parts = []; }
        $path = $parts['path'] ?? '/';
        // Browsers normalize backslashes to slashes, potentially turning a path into a foreign host.
        if (!str_starts_with($path, '/') || str_starts_with($path, '//') || str_contains($path, '\\')) { $path = '/'; }
        parse_str($parts['query'] ?? '', $query);
        // Turbo requests may supply only an origin referrer; keep explicit stay criteria.
        foreach (['arrivalDate', 'departureDate', 'guests', 'slug'] as $key) {
            $value = $request->query->get($key);
            if (is_string($value) && $value !== '') { $query[$key] = $value; }
        }
        $query['_locale'] = $locale;
        return $this->redirect($path.'?'.http_build_query($query).(isset($parts['fragment']) ? '#'.$parts['fragment'] : ''));
    }
}
