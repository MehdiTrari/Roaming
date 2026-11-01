<?php
namespace App\Tests\Seo;

use App\Service\SeoUrlGenerator;
use App\Twig\SeoExtension;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\Routing\Generator\UrlGenerator;
use Symfony\Component\Routing\RequestContext;
use Symfony\Component\Routing\Route;
use Symfony\Component\Routing\RouteCollection;

final class SeoUrlGeneratorTest extends TestCase
{
    public function testProductionOriginAndLocalPreviewRemainSeparate(): void
    {
        $routes = new RouteCollection(); $routes->add('property', new Route('/property/{slug}'));
        $stack = new RequestStack(); $request = Request::create('http://127.0.0.1:8000/?arrivalDate=2026-11-01&utm_source=test'); $request->setLocale('en'); $stack->push($request);
        $router = new UrlGenerator($routes, new RequestContext());
        $production = new SeoUrlGenerator($router, $stack, 'prod');
        self::assertSame('https://roaminglille.com/property/example?_locale=en', $production->url('property', ['slug' => 'example']));
        self::assertSame('https://roaminglille.com/images/logo.png', $production->absolute('/images/logo.png'));
        self::assertSame('https://cdn.example/photo.jpg', $production->absolute('https://cdn.example/photo.jpg'));
        $local = new SeoUrlGenerator($router, $stack, 'dev');
        self::assertSame('http://127.0.0.1:8000/property/example?_locale=fr', $local->url('property', ['slug' => 'example', '_locale' => 'fr']));
        self::assertSame('https://roaminglille.com/property/example?_locale=fr', $production->url('property', ['slug' => 'example', '_locale' => 'unsupported']));
    }
    public function testDescriptionsArePlainTextAndTruncatedAtAWordBoundary(): void
    {
        $extension = new SeoExtension(new SeoUrlGenerator(new UrlGenerator(new RouteCollection(), new RequestContext()), new RequestStack(), 'test'));
        self::assertSame('Un logement agréable', $extension->summary('<p>Un logement   agréable</p>'));
        self::assertSame('Une maison…', $extension->summary('Une maison agréable au calme', 15));
    }
}
