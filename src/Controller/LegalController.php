<?php

declare(strict_types=1);

namespace App\Controller;

use App\Repository\PropertyRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class LegalController extends AbstractController
{
    #[Route('/mentions-legales', name: 'app_legal_notice', defaults: ['document' => 'notice'], methods: ['GET'])]
    #[Route('/politique-de-confidentialite', name: 'app_privacy', defaults: ['document' => 'privacy'], methods: ['GET'])]
    #[Route('/cookies', name: 'app_cookies', defaults: ['document' => 'cookies'], methods: ['GET'])]
    public function page(string $document, PropertyRepository $properties,
        #[Autowire('%env(bool:SITE_MAINTENANCE)%')] bool $maintenance): Response
    {
        $legal = $this->getParameter('app.legal');
        $draft = !$legal['host_entity'] || !$legal['host_address'] || !$legal['host_phone'] || !$legal['privacy_reviewed'];
        foreach (['contact_retention', 'logs_retention', 'team_retention', 'providers_location'] as $field) {
            foreach (['fr', 'en'] as $locale) $draft = $draft || !trim($legal[$field][$locale]);
        }
        $privatePreview = $maintenance && !$this->isGranted('ROLE_TESTER');
        $response = $this->render('legal/page.html.twig', [
            'document' => $document,
            'draft' => $draft,
            'legalLayout' => $privatePreview ? 'team/layout.html.twig' : 'base.html.twig',
            'navProperties' => $privatePreview ? [] : $properties->findActive(),
        ]);
        if ($draft) $response->headers->set('X-Robots-Tag', 'noindex, follow');

        return $response;
    }
}
