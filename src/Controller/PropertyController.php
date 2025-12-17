<?php

namespace App\Controller;

use App\Repository\PropertyRepository;
use App\Service\AvailabilityService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class PropertyController extends AbstractController
{
    #[Route('/property/{slug}', name: 'app_property_show', methods: ['GET'])]
    public function show(string $slug, PropertyRepository $propertyRepository, AvailabilityService $availabilityService): Response
    {
        $property = $propertyRepository->findOneBy(['slug' => $slug]);
        if (!$property) {
            throw new NotFoundHttpException('Property not found.');
        }

        $navProperties = $propertyRepository->findBy([], ['title' => 'ASC']);
        $availability = $availabilityService->getAvailability($property);

        return $this->render('property/show.html.twig', [
            'property' => $property,
            'navProperties' => $navProperties,
            'availability' => $availability,
        ]);
    }

    #[Route('/api/properties/{slug}/availability', name: 'api_property_availability', methods: ['GET'])]
    public function availability(string $slug, PropertyRepository $propertyRepository, AvailabilityService $availabilityService): JsonResponse
    {
        $property = $propertyRepository->findOneBy(['slug' => $slug]);
        if (!$property) {
            return new JsonResponse(['error' => 'Property not found'], Response::HTTP_NOT_FOUND);
        }

        return new JsonResponse($availabilityService->getAvailability($property));
    }
}
