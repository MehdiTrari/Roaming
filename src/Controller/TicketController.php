<?php
declare(strict_types=1);
namespace App\Controller;
use App\Entity\TeamUser;
use App\Entity\TestTicket;
use App\Entity\TicketComment;
use App\Form\TestTicketType;
use App\Service\TicketContext;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[IsGranted('ROLE_TESTER')]
#[Route('/equipe/tickets')]
final class TicketController extends AbstractController
{
    public function __construct(private EntityManagerInterface $em, private TicketContext $context,
        #[Autowire('%kernel.project_dir%/var/private/ticket-captures')] private string $captureDirectory) {}
    #[Route('', name: 'team_tickets', methods: ['GET'])]
    public function index(Request $request): Response
    {
        $criteria = [];
        foreach (['status' => TestTicket::STATUSES, 'category' => TestTicket::CATEGORIES] as $key => $values) {
            $value = $request->query->getString($key);
            if (in_array($value, $values, true)) { $criteria[$key] = $value; }
        }
        $page = max(1, min(100000, $request->query->getInt('page', 1)));
        $repo = $this->em->getRepository(TestTicket::class);
        return $this->render('team/tickets.html.twig', ['tickets' => $repo->findBy($criteria, ['createdAt' => 'DESC', 'id' => 'DESC'], 30, ($page - 1) * 30),
            'total' => $repo->count($criteria), 'page' => $page, 'filters' => $criteria, 'statuses' => TestTicket::STATUSES, 'categories' => TestTicket::CATEGORIES]);
    }
    #[Route('/nouveau', name: 'team_ticket_new', methods: ['GET', 'POST'])]
    public function create(Request $request): Response
    {
        $form = $this->createForm(TestTicketType::class, ['page' => $this->context->page($request->query->getString('page', '/'))],
            ['action' => $this->generateUrl('team_ticket_new')]);
        $form->handleRequest($request);
        if ($form->isSubmitted() && $form->isValid()) {
            $data = $form->getData(); $ticket = new TestTicket();
            $user = $this->getUser(); assert($user instanceof TeamUser); $ticket->author = $user;
            foreach (['title', 'category', 'description', 'steps', 'expected'] as $field) { $ticket->$field = (string) $data[$field]; }
            $ticket->page = $this->context->page((string) $data['page']);
            $ticket->screen = (string) $data['screen'];
            $ticket->browser = mb_substr($request->headers->get('User-Agent', ''), 0, 500);
            $capture = $data['capture']; $savedPath = null;
            if ($capture) {
                $mime = $capture->getMimeType();
                $extension = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'][$mime] ?? null;
                if (!$extension) { throw $this->createAccessDeniedException(); }
                $ticket->attachment = bin2hex(random_bytes(24)).'.'.$extension; $ticket->attachmentMime = $mime;
                if (!is_dir($this->captureDirectory) && !mkdir($this->captureDirectory, 0700, true) && !is_dir($this->captureDirectory)) { throw new \RuntimeException('Cannot create private captures directory.'); }
                $capture->move($this->captureDirectory, $ticket->attachment);
                $savedPath = $this->captureDirectory.'/'.$ticket->attachment;
                chmod($savedPath, 0600);
            }
            try { $this->em->persist($ticket); $this->em->flush(); }
            catch (\Throwable $exception) { if ($savedPath && is_file($savedPath)) { unlink($savedPath); } throw $exception; }
            return $this->redirectToRoute('team_ticket_show', ['id' => $ticket->getId()], 303);
        }
        $embedded = $request->isMethod('GET') && $request->query->getBoolean('embed');
        return $this->render($embedded ? 'team/_ticket_form.html.twig' : 'team/new.html.twig', ['form' => $form->createView()],
            new Response('', $form->isSubmitted() ? 422 : 200));
    }
    #[Route('/{id}', name: 'team_ticket_show', requirements: ['id' => '\\d+'], methods: ['GET', 'POST'])]
    public function show(TestTicket $ticket, Request $request): Response
    {
        $error = null;
        if ($request->isMethod('POST')) {
            if (!$this->isCsrfTokenValid('ticket_'.$ticket->getId(), $request->request->getString('_token'))) { throw $this->createAccessDeniedException(); }
            if ($request->request->getString('action') === 'manage') {
                $this->denyAccessUnlessGranted('ROLE_ADMIN');
                $status = $request->request->getString('status'); $priority = $request->request->getString('priority');
                if (!in_array($status, TestTicket::STATUSES, true) || !in_array($priority, TestTicket::PRIORITIES, true)) { throw $this->createNotFoundException(); }
                $ticket->status = $status; $ticket->priority = $priority;
            } else {
                $body = trim($request->request->getString('comment'));
                if ($body === '' || mb_strlen($body) > 10000) { $error = 'team.comment_invalid'; }
                else { $user = $this->getUser(); assert($user instanceof TeamUser); $this->em->persist(new TicketComment($ticket, $user, $body)); }
            }
            if (!$error) { $this->em->flush(); return $this->redirectToRoute('team_ticket_show', ['id' => $ticket->getId()], 303); }
        }
        return $this->render('team/ticket.html.twig', ['ticket' => $ticket, 'comments' => $this->em->getRepository(TicketComment::class)->findBy(['ticket' => $ticket], ['createdAt' => 'ASC', 'id' => 'ASC']),
            'statuses' => TestTicket::STATUSES, 'priorities' => TestTicket::PRIORITIES, 'error' => $error], new Response('', $error ? 422 : 200));
    }
    #[Route('/{id}/capture', name: 'team_ticket_capture', requirements: ['id' => '\\d+'], methods: ['GET'])]
    public function capture(TestTicket $ticket): BinaryFileResponse
    {
        if (!$ticket->attachment || !preg_match('/^[a-f0-9]{48}\.(png|jpg|webp)$/D', $ticket->attachment)) { throw $this->createNotFoundException(); }
        $path = $this->captureDirectory.'/'.$ticket->attachment;
        if (!is_file($path)) { throw $this->createNotFoundException(); }
        $response = new BinaryFileResponse($path);
        $response->headers->set('Content-Type', $ticket->attachmentMime);
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->setContentDisposition('inline', 'capture-'.$ticket->getId().'.'.pathinfo($path, PATHINFO_EXTENSION));
        $response->headers->set('Cache-Control', 'private, no-store'); return $response;
    }
}
