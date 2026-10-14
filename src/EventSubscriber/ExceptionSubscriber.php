<?php

namespace App\EventSubscriber;

use App\Repository\PropertyRepository;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Twig\Environment;

class ExceptionSubscriber implements EventSubscriberInterface
{
    // Mapping des anciennes URLs vers les nouvelles
    private const LEGACY_REDIRECTS = [
        // Anciennes URLs de propriétés (format: /slug/)
        'wazemmes' => 'wazemmes',
        'lambersart' => 'lambersart',
        'calmette' => 'calmette',
        'roubaix' => 'roubaix',
        'hericourt' => 'hericourt',
        'marcq-hericourt' => 'hericourt',
        'marcq-calmette' => 'calmette',
        'house-wazemmes' => 'wazemmes',
        'appartement-wazemmes' => 'wazemmes',
        
        // Anciennes pages
        'home' => 'home',
        'accueil' => 'home',
        'contact' => 'contact',
        'contactez-nous' => 'contact',
        'about' => 'about',
        'a-propos' => 'about',
        'properties' => 'property',
        'property' => 'property',
        'nos-biens' => 'property',
    ];

    public function __construct(
        private PropertyRepository $propertyRepository,
        private UrlGeneratorInterface $urlGenerator,
        private Environment $twig,
        private string $kernelEnvironment
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            KernelEvents::EXCEPTION => ['onKernelException', 0],
        ];
    }

    public function onKernelException(ExceptionEvent $event): void
    {
        $exception = $event->getThrowable();

        // On ne gère que les 404
        if (!$exception instanceof NotFoundHttpException) {
            return;
        }

        $request = $event->getRequest();
        $path = trim($request->getPathInfo(), '/');
        if (str_starts_with($path, 'api/')) { return; }
        
        // Supprimer le préfixe de locale si présent (fr/, en/)
        $pathWithoutLocale = preg_replace('#^(fr|en)/#', '', $path);
        
        // Essayer de trouver une redirection
        $redirectUrl = $this->findRedirectUrl($pathWithoutLocale, $request->getLocale());

        if ($redirectUrl) {
            $event->setResponse(new RedirectResponse($redirectUrl, Response::HTTP_MOVED_PERMANENTLY));
            return;
        }

        // Si pas de redirection trouvée, afficher une belle page 404
        $this->render404Page($event);
    }

    private function findRedirectUrl(string $path, string $locale): ?string
    {
        // 1. Vérifier les redirections legacy statiques
        $pathLower = strtolower($path);
        // Canonical missing/archived property URLs must remain 404.
        if (str_starts_with($pathLower, 'property/')) { return null; }
        
        foreach (self::LEGACY_REDIRECTS as $oldPath => $target) {
            if ($pathLower === $oldPath || str_starts_with($pathLower, $oldPath . '/')) {
                // Déterminer si c'est une page statique
                if (in_array($target, ['home', 'contact', 'about', 'property'])) {
                    return $this->urlGenerator->generate($target === 'property' ? 'app_calendar' : 'app_' . $target, ['_locale' => $locale]);
                }
                
                // C'est une propriété
                $property = $this->propertyRepository->findActiveSlug($target);
                if ($property) {
                    return $this->urlGenerator->generate('app_property_show', [
                        'slug' => $property->getSlug(),
                        '_locale' => $locale
                    ]);
                }
                return null;
            }
        }

        return null;
    }

    private function render404Page(ExceptionEvent $event): void
    {
        $request = $event->getRequest();
        
        // En mode dev, laisser Symfony gérer l'erreur pour le debug
        if ($this->kernelEnvironment === 'dev') {
            return;
        }

        try {
            // Récupérer quelques propriétés pour les suggestions
            $suggestedProperties = $this->propertyRepository->findActiveWithImages(['title' => 'ASC'], 3);

            $content = $this->twig->render('bundles/TwigBundle/Exception/error404.html.twig', [
                'suggestedProperties' => $suggestedProperties,
                'navProperties' => $suggestedProperties,
                'requestedPath' => $request->getPathInfo(),
            ]);

            $response = new Response($content, Response::HTTP_NOT_FOUND);
            $event->setResponse($response);
        } catch (\Exception $e) {
            // En cas d'erreur de rendu, laisser Symfony gérer
        }
    }
}
