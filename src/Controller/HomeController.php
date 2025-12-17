<?php

namespace App\Controller;

use App\Entity\ContactMessage;
use App\Form\ContactMessageType;
use App\Repository\PropertyRepository;
use App\Service\ContactService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class HomeController extends AbstractController
{
    #[Route('/', name: 'app_home', methods: ['GET', 'POST'])]
    public function index(
        Request $request,
        PropertyRepository $propertyRepository,
        ContactService $contactService
    ): Response {
        $featured = $propertyRepository->findBy([], ['createdAt' => 'DESC'], 5);
        $navProperties = $propertyRepository->findBy([], ['title' => 'ASC']);

        $popularAmenities = [
            'amenities.fast_wifi',
            'amenities.self_checkin',
            'amenities.equipped_accommodation',
            'amenities.comfortable_bedding',
            'amenities.ideal_for_pros',
            'amenities.commission_free',
        ];

        $contact = new ContactMessage();
        $form = $this->createForm(ContactMessageType::class, $contact);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $contactService->handle($contact);
            $this->addFlash('success', 'Message sent. We will get back to you shortly.');

            return $this->redirectToRoute('app_home', ['_fragment' => 'contact']);
        }

        return $this->render('home/index.html.twig', [
            'featuredProperties' => $featured,
            'navProperties' => $navProperties,
            'popularAmenities' => $popularAmenities,
            'contactForm' => $form->createView(),
        ]);
    }
}
