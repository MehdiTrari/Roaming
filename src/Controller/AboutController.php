<?php

namespace App\Controller;

use App\Repository\PropertyRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class AboutController extends AbstractController
{
    #[Route('/about-us', name: 'app_about', methods: ['GET'])]
    public function __invoke(PropertyRepository $propertyRepository): Response
    {
        $navProperties = $propertyRepository->findActive();
        $popularAmenities = [
            'amenities.fast_wifi',
            'amenities.self_checkin',
            'amenities.equipped_accommodation',
            'amenities.comfortable_bedding',
            'amenities.ideal_for_pros',
            'amenities.commission_free',
        ];

        return $this->render('about/index.html.twig', [
            'navProperties' => $navProperties,
            'popularAmenities' => $popularAmenities,
        ]);
    }
}
