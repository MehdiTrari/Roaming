<?php

declare(strict_types=1);

namespace App\Service;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

/** One origin for production metadata; local previews retain their local host. */
final class SeoUrlGenerator
{
    public const PUBLIC_ORIGIN = 'https://roaminglille.com';

    public function __construct(
        private UrlGeneratorInterface $router,
        private RequestStack $requests,
        #[Autowire('%kernel.environment%')] private string $environment,
    ) {}

    public function url(string $route, array $parameters = []): string
    {
        $locale = $parameters['_locale'] ?? $this->requests->getCurrentRequest()?->getLocale() ?? 'fr';
        $parameters['_locale'] = in_array($locale, ['fr', 'en'], true) ? $locale : 'fr';
        return $this->absolute($this->router->generate($route, $parameters, UrlGeneratorInterface::ABSOLUTE_PATH));
    }

    public function absolute(string $path): string
    {
        if (preg_match('~^https?://~i', $path)) return $path;
        $origin = $this->environment === 'prod' ? self::PUBLIC_ORIGIN : ($this->requests->getCurrentRequest()?->getSchemeAndHttpHost() ?? $this->router->getContext()->getScheme().'://'.$this->router->getContext()->getHost());
        return $origin.'/'.ltrim($path, '/');
    }
}
