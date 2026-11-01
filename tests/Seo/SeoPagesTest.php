<?php
namespace App\Tests\Seo;

use App\Entity\Property;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class SeoPagesTest extends WebTestCase
{
    private $browser;
    private EntityManagerInterface $em;
    private array $saved = [];
    protected function setUp(): void
    {
        parent::setUp();
        if (!extension_loaded('pdo_sqlite')) { self::markTestSkipped('Run PHP with -d extension=pdo_sqlite for isolated database tests.'); }
        foreach (['DATABASE_URL' => 'sqlite:///:memory:', 'GUESTLUCKY_AVAILABILITY_ENABLED' => '0', 'SITE_MAINTENANCE' => '0'] as $key => $value) {
            $this->saved[$key] = [$_ENV[$key] ?? null, $_SERVER[$key] ?? null, getenv($key)];
            $_ENV[$key] = $_SERVER[$key] = $value; putenv($key.'='.$value);
        }
        $this->browser = self::createClient();
        $this->browser->disableReboot();
        $this->em = self::getContainer()->get(EntityManagerInterface::class);
        self::assertSame('pdo_sqlite', $this->em->getConnection()->getParams()['driver']);
        (new SchemaTool($this->em))->createSchema($this->em->getMetadataFactory()->getAllMetadata());
        foreach (['lambersart', 'roubaix', 'croix', 'douai', 'lille'] as $index => $slug) {
            $property = (new Property())->setSlug($slug)->setTitle('Maison '.$slug)->setCity(ucfirst($slug))->setTravelers(4)->setActive(true)
                ->setShortDescription('Un logement meublé confortable pour votre séjour.')->setShortDescriptionEn('A comfortable furnished home for your stay.')
                ->setAbout('Une maison accueillante.')->setAboutEn('A welcoming home.');
            $this->em->persist($property);
        }
        $this->em->persist((new Property())->setSlug('archived')->setTitle('Archived')->setCity('Lille')->setActive(false));
        $this->em->flush();
    }
    protected function tearDown(): void
    {
        parent::tearDown();
        foreach ($this->saved as $key => [$env, $server, $process]) {
            if ($env === null) unset($_ENV[$key]); else $_ENV[$key] = $env;
            if ($server === null) unset($_SERVER[$key]); else $_SERVER[$key] = $server;
            putenv($process === false ? $key : $key.'='.$process);
        }
    }

    public function testMetadataAndStructuredDataAgreeAcrossLocales(): void
    {
        foreach (['fr', 'en'] as $locale) foreach (['/', '/disponibilites', '/about-us', '/contact-us', '/property/lambersart', '/property/roubaix', '/property/croix', '/property/douai', '/property/lille'] as $path) {
            $crawler = $this->browser->request('GET', $path.'?_locale='.$locale.'&arrivalDate=2026-11-01&departureDate=2026-11-06&guests=2&utm_source=test');
            self::assertResponseIsSuccessful();
            $canonical = $crawler->filter('link[rel="canonical"]')->attr('href');
            self::assertSame('http://localhost'.$path.'?_locale='.$locale, $canonical);
            self::assertSame($canonical, $crawler->filter('meta[property="og:url"]')->attr('content'));
            self::assertCount(1, $crawler->filter('h1'));
            foreach (['fr', 'en'] as $language) self::assertSame('http://localhost'.$path.'?_locale='.$language, $crawler->filter('link[hreflang="'.$language.'"]')->attr('href'));
            $description = $crawler->filter('meta[name="description"]')->attr('content');
            self::assertNotEmpty($description); self::assertLessThanOrEqual(170, mb_strlen($description));
            foreach ($crawler->filter('script[type="application/ld+json"]') as $script) {
                $data = json_decode($script->textContent, true, flags: JSON_THROW_ON_ERROR);
                self::assertArrayHasKey('@type', $data);
                if (isset($data['url'])) self::assertSame($data['@type'] === 'Organization' ? 'http://localhost/?_locale='.$locale : $canonical, $data['url']);
                if ($data['@type'] === 'LodgingBusiness' && $locale === 'en') self::assertSame('A welcoming home.', $data['description']);
                if (isset($data['inLanguage'])) self::assertSame($locale, $data['inLanguage']);
            }
        }
    }
    public function testSitemapListsOnlyPublicPagesAndActiveProperties(): void
    {
        $this->browser->request('GET', '/sitemap.xml'); self::assertResponseIsSuccessful();
        $xml = simplexml_load_string($this->browser->getResponse()->getContent());
        self::assertCount(18, $xml->url);
        foreach ($xml->url as $url) {
            self::assertMatchesRegularExpression('~^http://localhost/(?:\?_locale=|(?:disponibilites|about-us|contact-us|property/[a-z]+)\?_locale=)(?:fr|en)$~', (string) $url->loc);
            self::assertCount(3, $url->children('http://www.w3.org/1999/xhtml')->link);
            if (str_contains((string) $url->loc, '/property/')) self::assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', (string) $url->lastmod);
        }
        self::assertStringNotContainsString('archived', $xml->asXML());
    }
    public function testDraftAndErrorPagesRemainNonIndexable(): void
    {
        foreach (['/mentions-legales', '/politique-de-confidentialite', '/cookies', '/missing-page'] as $path) {
            $crawler = $this->browser->request('GET', $path);
            self::assertStringStartsWith('noindex', $crawler->filter('meta[name="robots"]')->attr('content'));
        }
    }
}
