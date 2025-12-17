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

class ContactController extends AbstractController
{
    #[Route('/contact-us', name: 'app_contact', methods: ['GET', 'POST'])]
    public function __invoke(
        Request $request,
        PropertyRepository $propertyRepository,
        ContactService $contactService
    ): Response {
        $navProperties = $propertyRepository->findBy([], ['title' => 'ASC']);

        $contact = new ContactMessage();
        $form = $this->createForm(ContactMessageType::class, $contact);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $contactService->handle($contact);
            $this->addFlash('success', 'Message sent. We will get back to you shortly.');

            return $this->redirectToRoute('app_contact', ['_fragment' => 'contact']);
        }

        return $this->render('contact/index.html.twig', [
            'navProperties' => $navProperties,
            'contactForm' => $form->createView(),
        ]);
    }
}
