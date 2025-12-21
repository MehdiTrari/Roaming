<?php

namespace App\Controller;

use App\Repository\PropertyRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

class SitemapController extends AbstractController
{
    #[Route('/sitemap.xml', name: 'app_sitemap', defaults: ['_format' => 'xml'])]
    public function index(PropertyRepository $propertyRepository): Response
    {
        $urls = [];

        // Static pages with both locales
        $staticRoutes = [
            ['route' => 'app_home', 'priority' => '1.0', 'changefreq' => 'weekly'],
            ['route' => 'app_about', 'priority' => '0.8', 'changefreq' => 'monthly'],
            ['route' => 'app_contact', 'priority' => '0.8', 'changefreq' => 'monthly'],
        ];

        foreach (['fr', 'en'] as $locale) {
            foreach ($staticRoutes as $staticRoute) {
                $urls[] = [
                    'loc' => $this->generateUrl($staticRoute['route'], ['_locale' => $locale], UrlGeneratorInterface::ABSOLUTE_URL),
                    'lastmod' => (new \DateTime())->format('Y-m-d'),
                    'changefreq' => $staticRoute['changefreq'],
                    'priority' => $staticRoute['priority'],
                ];
            }
        }

        // Property pages
        $properties = $propertyRepository->findAll();
        foreach ($properties as $property) {
            foreach (['fr', 'en'] as $locale) {
                $urls[] = [
                    'loc' => $this->generateUrl('app_property_show', [
                        'slug' => $property->getSlug(),
                        '_locale' => $locale,
                    ], UrlGeneratorInterface::ABSOLUTE_URL),
                    'lastmod' => $property->getUpdatedAt()?->format('Y-m-d') ?? $property->getCreatedAt()?->format('Y-m-d') ?? (new \DateTime())->format('Y-m-d'),
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
