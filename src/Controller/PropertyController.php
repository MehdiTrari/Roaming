<?php
namespace App\Controller;
use App\Repository\PropertyRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class PropertyController extends AbstractController
{
    #[Route('/property/{slug}', name: 'app_property_show', methods: ['GET'])]
    public function show(string $slug, PropertyRepository $properties): Response
    {
        $property = $properties->findActiveSlug($slug);
        if (!$property) { throw $this->createNotFoundException(); }
        return $this->render('property/show.html.twig', ['property' => $property, 'navProperties' => $properties->findActiveWithImages()]);
    }
}
