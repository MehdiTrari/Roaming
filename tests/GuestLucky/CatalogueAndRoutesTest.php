<?php
namespace App\Tests\GuestLucky;

use App\Booking\BookingDates;
use App\Entity\Property;
use App\Entity\PropertyImage;
use App\Integration\GuestLucky\CatalogueImporter;
use App\Integration\GuestLucky\GuestLuckyClient;
use App\Integration\GuestLucky\McpClient;
use App\Integration\GuestLucky\CatalogueSynchronizer;
use Symfony\Component\String\Slugger\AsciiSlugger;
use App\Repository\PropertyRepository;
use App\Service\AvailabilityService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Psr\Log\NullLogger;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Cache\Adapter\ArrayAdapter;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class CatalogueAndRoutesTest extends WebTestCase
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
        foreach (['lambersart','roubaix','wazemmes','maison-marcq-en-baroeul','appartement-marcq-en-baroeul'] as $slug) {
            $p = (new Property())->setSlug($slug)->setTitle($slug)->setCity('Lille')->setTravelers(10)->setActive(true)->setAbout('Existing content');
            $this->em->persist($p);
            if ($slug === 'lambersart') {
                $image = (new PropertyImage())->setFilename('existing.jpg')->setProperty($p)->setIsCover(true);
                $p->addImage($image); $this->em->persist($image);
            }
        }
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
    private function catalogue(): array { return json_decode(file_get_contents(dirname(__DIR__, 2).'/config/guestlucky/catalogue.json'), true); }
    private function importer(): CatalogueImporter { return self::getContainer()->get(CatalogueImporter::class); }
    private function synchronizer(array $rows, int $account = 123): CatalogueSynchronizer
    {
        $mcp = new McpClient(new MockHttpClient(static function ($method, $url, $options) use ($rows, $account) {
            $payload = json_decode($options['body'], true);
            if ($payload['method'] === 'notifications/initialized') { return new MockResponse('', ['http_code' => 202]); }
            if ($payload['method'] === 'initialize') { $result = ['protocolVersion' => '2025-11-25']; }
            else {
                $data = $payload['params']['name'] === 'gl-whoami' ? ['account_owner_id' => $account, 'company' => 'Test account'] : ['total' => count($rows), 'page' => 1, 'per_page' => 50, 'count' => count($rows), 'properties' => $rows];
                $result = ['structuredContent' => $data];
            }
            return new MockResponse(json_encode(['jsonrpc' => '2.0', 'id' => $payload['id'], 'result' => $result]));
        }), 'https://app.guestlucky.io/api/mcp', 'test-secret');
        return new CatalogueSynchronizer($mcp, $this->importer(), self::getContainer()->get(PropertyRepository::class), new AsciiSlugger(), 123);
    }
    public function testLiveSyncAddsAPropertyIdempotentlyWithoutLosingExistingContent(): void
    {
        $this->importer()->import($this->catalogue(), true);
        $rows = array_map(static fn ($row) => $row + ['address' => '1 rue du Test 59000 Lille'], $this->catalogue()['properties']);
        $rows[0]['min_stay'] = 2;
        $rows[] = ['id' => 9999, 'name' => "L’Élégante • 4 chambres", 'address' => '118 rue du Test 59500 Douai', 'capacity' => 8, 'min_stay' => 3];
        $repo = self::getContainer()->get(PropertyRepository::class);
        $this->synchronizer($rows)->synchronize(); self::assertCount(3, $repo->findActive());
        $this->synchronizer($rows)->synchronize(true);
        $this->synchronizer($rows)->synchronize(true);
        self::assertCount(4, $repo->findActive());
        self::assertSame('l-elegante-4-chambres-9999', $repo->findOneBy(['guestLuckyId' => 9999])->getSlug());
        self::assertSame('Douai', $repo->findOneBy(['guestLuckyId' => 9999])->getCity());
        self::assertSame('Existing content', $repo->findActiveSlug('lambersart')->getAbout());
        self::assertSame('existing.jpg', $repo->findActiveSlug('lambersart')->getImages()->first()->getFilename());
        self::assertSame(2, $repo->findActiveSlug('lambersart')->getMinimumStay());
        self::assertSame(3, $repo->findOneBy(['guestLuckyId' => 9999])->getMinimumStay());
        $this->importer()->import($this->catalogue(), true, archiveMissing: false);
        self::assertSame(2, $repo->findActiveSlug('lambersart')->getMinimumStay(), 'Historical snapshots omit the minimum and must preserve it.');
        $rows[0]['min_stay'] = null;
        $this->synchronizer([$rows[0]])->synchronize(true);
        self::assertNull($repo->findActiveSlug('lambersart')->getMinimumStay(), 'Explicit live null clears the old restriction.');
        self::assertCount(4, $repo->findActive(), 'Scheduled sync must not archive an absent property.');
    }
    public function testWrongAccountAndMissingCityNeverChangeTheCatalogue(): void
    {
        $rows = [['id' => 9999, 'name' => 'New home', 'address' => null, 'capacity' => 8]];
        try { $this->synchronizer($rows, 456)->synchronize(true); self::fail(); } catch (\RuntimeException $e) { self::assertStringContainsString('compte', $e->getMessage()); }
        try { $this->synchronizer($rows)->synchronize(true); self::fail(); } catch (\RuntimeException $e) { self::assertStringContainsString('Ville', $e->getMessage()); }
        self::assertCount(5, self::getContainer()->get(PropertyRepository::class)->findActive());
    }
    public function testLiveAddressChangesInvalidateCoordinatesAndSnapshotsPreserveTheAddress(): void
    {
        $this->importer()->import($this->catalogue(), true);
        $row = ['id' => 2475, 'name' => 'Lambersart', 'capacity' => 10, 'city' => 'Lambersart', 'address' => '256 Avenue de Dunkerque, 59130 Lambersart'];
        $this->synchronizer([$row])->synchronize(true);
        $property = self::getContainer()->get(PropertyRepository::class)->findOneBy(['guestLuckyId' => 2475]);
        self::assertSame($row['address'], $property->getAddress());
        $property->setCoordinates(50.637488, 3.024341); $this->em->flush();
        $row['address'] = '256 Avenue de Dunkerque 59130 Lambersart, France';
        $this->synchronizer([$row])->synchronize(true);
        self::assertSame(50.637488, $property->getLatitude());
        $row['address'] = '1 Rue du Test, 59130 Lambersart';
        $this->synchronizer([$row])->synchronize(true);
        self::assertSame($row['address'], $property->getAddress()); self::assertNull($property->getLatitude()); self::assertNull($property->getLongitude());
        $row['address'] = null;
        $this->synchronizer([$row])->synchronize(true);
        self::assertSame('1 Rue du Test, 59130 Lambersart', $property->getAddress());
        $this->importer()->import($this->catalogue(), true, archiveMissing: false);
        self::assertSame('1 Rue du Test, 59130 Lambersart', $property->getAddress());
    }
    public function testDryRunThenRepeatedImportPreservesContentAndArchives(): void
    {
        $repo = self::getContainer()->get(PropertyRepository::class);
        $this->importer()->import($this->catalogue());
        self::assertCount(5, $repo->findActive());
        self::assertNull($repo->findOneBy(['slug' => 'ecrin-noir-croix']));
        $this->importer()->import($this->catalogue(), true);
        $this->importer()->import($this->catalogue(), true);
        $this->em->clear();
        self::assertCount(3, $repo->findActive());
        self::assertCount(6, $repo->findAll());
        self::assertSame('Existing content', $repo->findActiveSlug('lambersart')->getAbout());
        self::assertSame('existing.jpg', $repo->findActiveSlug('lambersart')->getImages()->first()->getFilename());
        self::assertFalse($repo->findOneBy(['slug' => 'wazemmes'])->isActive());
    }
    public function testIncompleteAndConflictingImportsNeverArchive(): void
    {
        $catalogue = $this->catalogue(); array_pop($catalogue['properties']);
        try { $this->importer()->import($catalogue, true); self::fail(); } catch (\InvalidArgumentException) {}
        self::assertCount(5, self::getContainer()->get(PropertyRepository::class)->findActive());
        $catalogue = $this->catalogue(); $catalogue['properties'][1]['slug'] = $catalogue['properties'][0]['slug'];
        try { $this->importer()->import($catalogue, true); self::fail(); } catch (\InvalidArgumentException) {}
        self::assertCount(5, self::getContainer()->get(PropertyRepository::class)->findActive());
    }
    public function testArchivedPropertiesDisappearAndNeverRedirect(): void
    {
        $this->importer()->import($this->catalogue(), true);
        foreach (['/','/about-us','/contact-us','/sitemap.xml','/disponibilites','/property/roubaix'] as $url) {
            $this->browser->request('GET', $url);
            self::assertResponseIsSuccessful();
            self::assertStringNotContainsString('/property/wazemmes', $this->browser->getResponse()->getContent());
            self::assertStringNotContainsString('/property/maison-marcq-en-baroeul', $this->browser->getResponse()->getContent());
        }
        foreach (['/property/wazemmes','/wazemmes','/api/properties/wazemmes/availability','/reservation/wazemmes'] as $url) {
            $this->browser->request('GET', $url); self::assertResponseStatusCodeSame(404);
            self::assertFalse($this->browser->getResponse()->headers->has('Location'));
        }
    }
    public function testGateProtectsApiAndDirectBookingUrl(): void
    {
        $this->importer()->import($this->catalogue(), true);
        $query = http_build_query(['arrivalDate' => BookingDates::today()->format('Y-m-d'), 'departureDate' => BookingDates::today()->modify('+2 days')->format('Y-m-d'), 'guests' => 2]);
        $this->browser->request('GET', '/api/calendar'); self::assertResponseIsSuccessful();
        $data = json_decode($this->browser->getResponse()->getContent(), true);
        self::assertFalse($data['enabled']); self::assertCount(3, $data['properties']);
        foreach ($data['properties'] as $property) self::assertSame([], $property['days']);
        $this->browser->request('GET', '/api/availability?'.$query); self::assertResponseIsSuccessful();
        $data = json_decode($this->browser->getResponse()->getContent(), true);
        foreach ($data['availability'] as $property) self::assertNull($property['bookingUrl']);
        $this->browser->request('GET', '/reservation/roubaix?'.$query); self::assertResponseStatusCodeSame(503);
        self::assertFalse($this->browser->getResponse()->headers->has('Location'));
    }

    public function testPreviewEndpointsAreUnavailableOutsideDevelopment(): void
    {
        foreach (['/test-disponibilites', '/api/test/calendar', '/api/test/availability'] as $url) {
            $this->browser->request('GET', $url);
            self::assertResponseStatusCodeSame(404);
        }
    }
    public function testSearchSuccessDoesNotBypassFreshQuoteAtRedirect(): void
    {
        $this->importer()->import($this->catalogue(), true);
        $a = BookingDates::today()->format('Y-m-d'); $d = BookingDates::today()->modify('+2 days')->format('Y-m-d');
        $http = new MockHttpClient([new MockResponse(json_encode(AvailabilityTest::quoteData($a, $d, 2474))), new MockResponse('{"error":"Dates not available or constraints not met"}', ['http_code' => 422])]);
        $service = new AvailabilityService(new GuestLuckyClient($http, 'https://example.test', 'public-key'), new ArrayAdapter(), new NullLogger(), true);
        self::getContainer()->set(AvailabilityService::class, $service);
        $query = http_build_query(['arrivalDate' => $a, 'departureDate' => $d, 'guests' => 2, 'slug' => 'roubaix']);
        $this->browser->request('GET', '/api/availability?'.$query); self::assertResponseIsSuccessful();
        $data = json_decode($this->browser->getResponse()->getContent(), true);
        self::assertTrue($data['availability'][0]['available']);
        $this->browser->request('GET', $data['availability'][0]['bookingUrl']);
        self::assertResponseStatusCodeSame(409);
        self::assertSame(2, $http->getRequestsCount());
    }
    public function testMigrationPreservesRowsAndSupportsRollback(): void
    {
        require_once dirname(__DIR__, 2).'/migrations/Version20260928000000.php';
        $connection = $this->em->getConnection();
        $manager = $connection->createSchemaManager();
        $current = $manager->introspectSchema();
        $old = clone $current;
        $migration = new \DoctrineMigrations\Version20260928000000($connection, new NullLogger());
        // ORM-generated unique index has a generated name; migration owns its own stable name.
        foreach ($old->getTable('property')->getIndexes() as $index) {
            if ($index->getColumns() === ['guest_lucky_id']) $old->getTable('property')->dropIndex($index->getName());
        }
        $old->getTable('property')->dropColumn('guest_lucky_id');
        $old->getTable('property')->dropColumn('active');
        $platform = $connection->getDatabasePlatform();
        foreach ($platform->getAlterSchemaSQL($manager->createComparator()->compareSchemas($current, $old)) as $sql) $connection->executeStatement($sql);
        $next = clone $old; $migration->up($next);
        foreach ($platform->getAlterSchemaSQL($manager->createComparator()->compareSchemas($old, $next)) as $sql) $connection->executeStatement($sql);
        self::assertSame(5, (int) $connection->fetchOne('SELECT COUNT(*) FROM property'));
        self::assertSame(0, (int) $connection->fetchOne('SELECT COUNT(*) FROM property WHERE active = 1'));
        $rollback = clone $next; $migration->down($rollback);
        foreach ($platform->getAlterSchemaSQL($manager->createComparator()->compareSchemas($next, $rollback)) as $sql) $connection->executeStatement($sql);
        self::assertSame(5, (int) $connection->fetchOne('SELECT COUNT(*) FROM property'));
    }

    public function testSuccessfulRedirectPreservesParameters(): void
    {
        $this->importer()->import($this->catalogue(), true);
        $a = BookingDates::today()->format('Y-m-d'); $d = BookingDates::today()->modify('+2 days')->format('Y-m-d');
        $http = new MockHttpClient([new MockResponse(json_encode(AvailabilityTest::quoteData($a, $d, 2474, 3)))]);
        $client = new GuestLuckyClient($http, 'https://example.test', 'public-key');
        self::getContainer()->set(GuestLuckyClient::class, $client);
        self::getContainer()->set(AvailabilityService::class, new AvailabilityService($client, new ArrayAdapter(), new NullLogger(), true));
        $this->browser->request('GET', '/reservation/roubaix?'.http_build_query(['arrivalDate' => $a, 'departureDate' => $d, 'guests' => 3]));
        self::assertResponseRedirects('https://example.test/book/public-key/2474?'.http_build_query(['checkin' => $a, 'checkout' => $d, 'guests' => 3]));
        self::assertStringContainsString('no-store', $this->browser->getResponse()->headers->get('Cache-Control'));
    }

    public function testEnglishPlanningAndInputValidation(): void
    {
        $this->importer()->import($this->catalogue(), true);
        $this->browser->request('GET', '/change-locale/en');
        $this->browser->request('GET', '/disponibilites');
        self::assertResponseIsSuccessful();
        self::assertSelectorTextContains('h1', 'Availability');
        $this->browser->request('GET', '/api/calendar?month=13');
        self::assertResponseStatusCodeSame(400);
        $this->browser->request('GET', '/api/availability?arrivalDate=2026-02-30&departureDate=2026-03-03&guests=2');
        self::assertResponseStatusCodeSame(400);
    }

    public function testPublicLocaleUrlsCanonicalAndSafeSwitch(): void
    {
        $this->browser->request('GET', '/?_locale=en&guests=2&arrivalDate=2026-11-05');
        self::assertSelectorExists('html[lang="en"]');
        self::assertStringEndsWith('/?_locale=en', $this->browser->getCrawler()->filter('link[rel="canonical"]')->attr('href'));
        self::assertStringNotContainsString('guests=', $this->browser->getCrawler()->filter('link[rel="canonical"]')->attr('href'));
        $this->browser->request('GET', '/change-locale/fr', server: ['HTTP_REFERER' => 'http://localhost/property/lambersart?_locale=en&guests=3']);
        self::assertResponseRedirects('/property/lambersart?_locale=fr&guests=3');
        $this->browser->request('GET', '/change-locale/en', server: ['HTTP_REFERER' => 'https://example.test/secret']);
        self::assertResponseRedirects('/?_locale=en');
        $this->browser->request('GET', '/change-locale/fr', server: ['HTTP_REFERER' => 'http://localhost/\\example.test']);
        self::assertResponseRedirects('/?_locale=fr');
        $this->browser->request('GET', '/change-locale/fr?guests=3&slug=lambersart', server: ['HTTP_REFERER' => 'http://localhost/']);
        self::assertResponseRedirects('/?guests=3&slug=lambersart&_locale=fr');
    }

    public function testContactErrorsAreAccessibleAndDoNotPersistMessages(): void
    {
        foreach (['/', '/contact-us'] as $url) {
            $this->browser->request('POST', $url.'?_locale=en', ['contact_message' => ['name' => '', 'email' => 'invalid', 'phone' => '', 'subject' => '', 'message' => '', '_token' => 'invalid']]);
            self::assertResponseStatusCodeSame(422);
            self::assertSelectorExists('#contact_message_name[aria-invalid="true"][aria-describedby="contact_message_name_errors"]');
            self::assertSelectorTextContains('#contact_message_name_errors', 'Please enter your name');
            self::assertSame(0, (int) $this->em->getConnection()->fetchOne('SELECT COUNT(*) FROM contact_message'));
        }
    }

    public function testMissingPageRendersRealSuggestionsWithoutIndexing(): void
    {
        $this->browser->request('GET', '/definitely-missing?_locale=fr');
        self::assertResponseStatusCodeSame(404);
        self::assertSelectorExists('h1');
        self::assertSelectorExists('meta[name="robots"][content="noindex, follow"]');
        self::assertSelectorExists('.catalogue-card');
    }

    public function testImagePreloadingPreservesRootLimitAndAllImages(): void
    {
        $property = $this->em->getRepository(Property::class)->findOneBy(['slug' => 'lambersart']);
        $image = (new PropertyImage())->setFilename('another.jpg')->setProperty($property);
        $property->addImage($image); $this->em->persist($image); $this->em->flush(); $this->em->clear();
        $rows = self::getContainer()->get(PropertyRepository::class)->findActiveWithImages(['id' => 'ASC'], 1);
        self::assertCount(1, $rows);
        self::assertSame('lambersart', $rows[0]->getSlug());
        self::assertTrue($rows[0]->getImages()->isInitialized());
        self::assertCount(2, $rows[0]->getImages());
    }

    public function testStructuredDataIsValidJsonAndPreservesRealText(): void
    {
        $property = $this->em->getRepository(Property::class)->findOneBy(['slug' => 'lambersart']);
        $title = 'A & B "quoted" </script>';
        $property->setTitle($title); $this->em->flush();
        foreach (['/', '/about-us', '/contact-us', '/property/lambersart', '/disponibilites'] as $path) {
            $crawler = $this->browser->request('GET', $path.'?_locale=en');
            self::assertResponseIsSuccessful();
            foreach ($crawler->filter('script[type="application/ld+json"]') as $script) {
                $data = json_decode($script->textContent, true, flags: JSON_THROW_ON_ERROR);
                self::assertArrayHasKey('@type', $data);
                if ($data['@type'] === 'LodgingBusiness') { self::assertSame($title, $data['name']); }
            }
        }
    }
}
