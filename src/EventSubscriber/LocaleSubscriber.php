<?php

namespace App\EventSubscriber;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

class LocaleSubscriber implements EventSubscriberInterface
{
    private string $defaultLocale;

    public function __construct(string $defaultLocale = 'en')
    {
        $this->defaultLocale = $defaultLocale;
    }

    public static function getSubscribedEvents(): array
    {
        // Priority must be higher than LocaleListener (16) to run after session is available
        // but we need to run AFTER the session is started, so use priority 15
        return [
            KernelEvents::REQUEST => [['onKernelRequest', 15]],
        ];
    }

    public function onKernelRequest(RequestEvent $event): void
    {
        $request = $event->getRequest();

        // Only handle main request
        if (!$event->isMainRequest()) {
            return;
        }

        // Check if session exists and has locale
        if ($request->hasSession() && $request->getSession()->has('_locale')) {
            $locale = $request->getSession()->get('_locale');
            $request->setLocale($locale);
        }
    }
}
