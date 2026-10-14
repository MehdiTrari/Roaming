<?php
declare(strict_types=1);
namespace App\Controller;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Authentication\AuthenticationUtils;

final class TeamSecurityController extends AbstractController
{
    #[Route('/equipe/connexion', name: 'team_login', methods: ['GET', 'POST'])]
    public function login(AuthenticationUtils $auth): Response
    {
        if ($this->isGranted('ROLE_TESTER')) { return $this->redirectToRoute('app_home'); }
        return $this->render('team/login.html.twig', ['error' => $auth->getLastAuthenticationError(), 'last_username' => $auth->getLastUsername()]);
    }
    #[Route('/equipe/deconnexion', name: 'team_logout', methods: ['POST'])]
    public function logout(): never { throw new \LogicException('Handled by the firewall.'); }
}
