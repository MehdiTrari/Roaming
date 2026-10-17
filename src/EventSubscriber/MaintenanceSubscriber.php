<?php
declare(strict_types=1);
namespace App\EventSubscriber;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\KernelEvents;
use Twig\Environment;

final class MaintenanceSubscriber implements EventSubscriberInterface
{
    public function __construct(private Security $security, private Environment $twig,
        #[Autowire('%env(bool:SITE_MAINTENANCE)%')] private bool $enabled,
        #[Autowire('%kernel.environment%')] private string $environment) {}
    public static function getSubscribedEvents(): array
    { return [KernelEvents::REQUEST => ['request', -16], KernelEvents::EXCEPTION => ['exception', 128], KernelEvents::RESPONSE => ['response', -128]]; }
    private function isPublic(Request $request): bool
    {
        return in_array($request->getPathInfo(), ['/equipe/connexion', '/equipe/deconnexion', '/robots.txt', '/mentions-legales', '/politique-de-confidentialite', '/cookies'], true)
            || ($this->environment === 'dev' && preg_match('#^/(_profiler|_wdt)/#', $request->getPathInfo()));
    }
    private function blocked(Request $request): Response
    {
        if (str_starts_with($request->getPathInfo(), '/api/')) {
            return new JsonResponse(['error' => 'site_maintenance'], 503, ['Retry-After' => '3600']);
        }
        if ($request->getPathInfo() === '/' && in_array($request->getMethod(), ['GET', 'HEAD'], true)) {
            return new Response($this->twig->render('team/maintenance.html.twig'));
        }
        return new RedirectResponse('/'.($request->getLocale() === 'en' ? '?_locale=en' : ''), 302);
    }
    public function request(RequestEvent $event): void
    {
        if (!$event->isMainRequest() || !$this->enabled || $this->isPublic($event->getRequest())) { return; }
        if (!$this->security->isGranted('ROLE_TESTER')) { $event->setResponse($this->blocked($event->getRequest())); }
    }
    public function exception(ExceptionEvent $event): void
    {
        // Unmatched routes fail before the firewall: keep legacy 404 suggestions private too.
        if ($event->isMainRequest() && $this->enabled && !$this->isPublic($event->getRequest()) && $event->getThrowable() instanceof HttpExceptionInterface
            && in_array($event->getThrowable()->getStatusCode(), [404, 405], true) && !$this->security->isGranted('ROLE_TESTER')) {
            $event->setResponse($this->blocked($event->getRequest()));
        }
    }
    public function response(ResponseEvent $event): void
    {
        if (!$event->isMainRequest()) { return; }
        $request = $event->getRequest(); $response = $event->getResponse();
        $team = str_starts_with($request->getPathInfo(), '/equipe');
        if ($this->enabled || $team || $this->security->getUser()) {
            $response->headers->set('Cache-Control', 'private, no-store'); $response->setVary('Cookie', false);
        }
        if ($team || $this->security->isGranted('ROLE_TESTER')) {
            $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
        }
        if ($this->enabled && $request->getPathInfo() === '/sitemap.xml' && !$this->security->isGranted('ROLE_TESTER')) {
            $response->setStatusCode(503); $response->headers->remove('Location'); $response->headers->set('Retry-After', '3600'); $response->setContent('Site maintenance');
        }
    }
}
