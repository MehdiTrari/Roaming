<?php

namespace App\Tests\Legal;

use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class LegalPagesTest extends WebTestCase
{
    private array $saved = [];

    private function site(bool $maintenance): void
    {
        if (!extension_loaded('pdo_sqlite')) self::markTestSkipped('Requires pdo_sqlite.');
        foreach (['DATABASE_URL' => 'sqlite:///:memory:', 'SITE_MAINTENANCE' => $maintenance ? '1' : '0', 'GUESTLUCKY_AVAILABILITY_ENABLED' => '0'] as $key => $value) {
            $this->saved[$key] = [$_ENV[$key] ?? null, $_SERVER[$key] ?? null, getenv($key)];
            $_ENV[$key] = $_SERVER[$key] = $value; putenv($key.'='.$value);
        }
        $this->client = self::createClient();
        $this->client->disableReboot();
        $em = self::getContainer()->get(EntityManagerInterface::class);
        self::assertSame('pdo_sqlite', $em->getConnection()->getParams()['driver']);
        (new SchemaTool($em))->createSchema($em->getMetadataFactory()->getAllMetadata());
    }

    private $client;

    protected function tearDown(): void
    {
        parent::tearDown();
        foreach ($this->saved as $key => [$env, $server, $process]) {
            if ($env === null) unset($_ENV[$key]); else $_ENV[$key] = $env;
            if ($server === null) unset($_SERVER[$key]); else $_SERVER[$key] = $server;
            putenv($process === false ? $key : $key.'='.$process);
        }
    }

    public function testLegalDocumentsRemainPublicDuringMaintenanceWithoutExposingTheCatalogue(): void
    {
        $this->site(true);
        foreach (['fr', 'en'] as $locale) foreach (['mentions-legales', 'politique-de-confidentialite', 'cookies'] as $path) {
            $crawler = $this->client->request('GET', '/'.$path.'?_locale='.$locale);
            self::assertResponseIsSuccessful();
            self::assertSelectorExists('h1');
            self::assertSelectorCount(1, '.legal-draft');
            self::assertSelectorNotExists('.property-nav-menu, .booking-bar, .availability-property-card');
            self::assertSelectorCount(0, 'iframe');
            self::assertSelectorCount(1, '#privacy-preferences');
            self::assertResponseHeaderSame('X-Robots-Tag', 'noindex, follow');
            self::assertStringNotContainsString('legal.', $crawler->filter('.legal-page')->text());
        }
        $this->client->request('GET', '/');
        self::assertSelectorExists('.team-maintenance');
        self::assertSelectorCount(3, '.legal-footer-links a');
    }

    public function testPublicFooterAndContactInformationMatchTheActualForm(): void
    {
        $this->site(false);
        foreach (['fr', 'en'] as $locale) {
            $this->client->request('GET', '/contact-us?_locale='.$locale);
            self::assertResponseIsSuccessful();
            self::assertSelectorExists('.contact-privacy-note a[href^="/politique-de-confidentialite"]');
            self::assertSelectorCount(3, '.legal-footer-links a');
            self::assertSelectorCount(0, '.contact-form input[type="checkbox"]');
            self::assertSelectorCount(1, '#privacy-preferences [data-privacy-refuse]');
            self::assertSelectorCount(1, '#privacy-preferences [data-privacy-allow]');
        }
        $this->client->request('GET', '/mentions-legales');
        self::assertSelectorTextContains('.legal-facts', 'ROAMING');
        self::assertSelectorTextContains('.legal-facts', '951 207 166');
        self::assertSelectorTextContains('.legal-facts', 'Nizar Trabelsi');
    }
}
