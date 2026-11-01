<?php

namespace App\Controller;

use App\Repository\PropertyRepository;
use App\Service\SeoUrlGenerator;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class SitemapController extends AbstractController
{
    #[Route('/sitemap.xml', name: 'app_sitemap', defaults: ['_format' => 'xml'])]
    public function index(PropertyRepository $propertyRepository, SeoUrlGenerator $seo): Response
    {
        $urls = [];

        // Static pages with both locales
        $staticRoutes = [
            ['route' => 'app_home', 'priority' => '1.0', 'changefreq' => 'weekly'],
            ['route' => 'app_calendar', 'priority' => '0.9', 'changefreq' => 'daily'],
            ['route' => 'app_about', 'priority' => '0.8', 'changefreq' => 'monthly'],
            ['route' => 'app_contact', 'priority' => '0.8', 'changefreq' => 'monthly'],
        ];

        foreach (['fr', 'en'] as $locale) {
            foreach ($staticRoutes as $staticRoute) {
                $urls[] = [
                    'loc' => $seo->url($staticRoute['route'], ['_locale' => $locale]),
                    'alternates' => array_combine(['fr', 'en'], array_map(fn ($language) => $seo->url($staticRoute['route'], ['_locale' => $language]), ['fr', 'en'])),
                    'changefreq' => $staticRoute['changefreq'],
                    'priority' => $staticRoute['priority'],
                ];
            }
        }

        // Property pages
        $properties = $propertyRepository->findActive();
        foreach ($properties as $property) {
            foreach (['fr', 'en'] as $locale) {
                $urls[] = [
                    'loc' => $seo->url('app_property_show', [
                        'slug' => $property->getSlug(),
                        '_locale' => $locale,
                    ]),
                    'lastmod' => $property->getUpdatedAt()?->format('Y-m-d') ?? $property->getCreatedAt()?->format('Y-m-d'),
                    'alternates' => array_combine(['fr', 'en'], array_map(fn ($language) => $seo->url('app_property_show', ['slug' => $property->getSlug(), '_locale' => $language]), ['fr', 'en'])),
                    'changefreq' => 'weekly',
                    'priority' => '0.9',
                ];
            }
        }

        $response = new Response(
            $this->renderView('sitemap/index.xml.twig', ['urls' => $urls]),
            Response::HTTP_OK
        );
        $response->headers->set('Content-Type', 'application/xml');

        return $response;
    }
}
