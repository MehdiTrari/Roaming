<?php

declare(strict_types=1);

namespace App\Tests\GuestLucky;

use App\Booking\BookingDates;
use App\Command\PropertyEnrichmentCommand;
use App\Entity\Amenity;
use App\Entity\Property;
use App\Entity\PropertyImage;
use App\Entity\Review;
use App\Integration\GuestLucky\CatalogueImporter;
use App\Integration\GuestLucky\GuestLuckyClient;
use App\Repository\PropertyRepository;
use App\Service\AvailabilityService;
use App\Service\PropertyContentCatalogue;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Psr\Log\NullLogger;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Cache\Adapter\ArrayAdapter;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\HttpClient\MockHttpClient;

final class PropertyEnrichmentTest extends WebTestCase
{
    private EntityManagerInterface $em;
    private $browser;
    private array $saved = [];

    protected function setUp(): void
    {
        parent::setUp();
        if (!extension_loaded('pdo_sqlite')) self::markTestSkipped('Run with -d extension=pdo_sqlite for isolated database tests.');
        foreach (['DATABASE_URL' => 'sqlite:///:memory:', 'GUESTLUCKY_AVAILABILITY_ENABLED' => '0', 'SITE_MAINTENANCE' => '0'] as $name => $value) {
            $this->saved[$name] = [$_ENV[$name] ?? null, $_SERVER[$name] ?? null, getenv($name)];
            $_ENV[$name] = $_SERVER[$name] = $value; putenv($name.'='.$value);
        }
        $this->browser = self::createClient();
        $this->browser->disableReboot();
        $this->em = self::getContainer()->get(EntityManagerInterface::class);
        self::assertSame('pdo_sqlite', $this->em->getConnection()->getParams()['driver']);
        (new SchemaTool($this->em))->createSchema($this->em->getMetadataFactory()->getAllMetadata());
        foreach ([[2475, 'lambersart', 'Lambersart', 10], [2467, 'ecrin-noir-croix', 'Croix', 8], [2630, 'l-elegante-douaisienne-4-chambres-2630', 'Douai', 8], [2474, 'roubaix', 'Roubaix', 10]] as [$id, $slug, $city, $capacity]) {
            $property = (new Property())->setGuestLuckyId($id)->setSlug($slug)->setCity($city)->setTitle('Original '.$city)->setTravelers($capacity)->setActive(true)
                ->setAbout('Original description')->setAddress('Verified address '.$city)->setCoordinates(50.6, 3.1)->setMinimumStay(2)
                ->setCreatedAt(new \DateTimeImmutable('2026-01-01'))->setUpdatedAt(new \DateTimeImmutable('2026-01-01'));
            $this->em->persist($property);
            if (in_array($id, [2475, 2474], true)) {
                $image = (new PropertyImage())->setFilename($city.'/existing.jpg')->setIsCover(true);
                $property->addImage($image);
            }
            if ($id === 2475) {
                $property->setArea(140)->setAirbnbUrl('https://www.airbnb.fr/rooms/123')->setAirbnbRating(4.42)->setAirbnbReviewsCount(19);
                $amenity = (new Amenity())->setName('amenities.self_checkin')->setIcon('<svg></svg>');
                $this->em->persist($amenity); $property->addAmenity($amenity);
                $property->addReview((new Review())->setAuthorName('Existing guest')->setComment('Preserved review'));
            }
        }
        $this->em->flush();
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        foreach ($this->saved as $name => [$env, $server, $process]) {
            if ($env === null) unset($_ENV[$name]); else $_ENV[$name] = $env;
            if ($server === null) unset($_SERVER[$name]); else $_SERVER[$name] = $server;
            putenv($process === false ? $name : $name.'='.$process);
        }
    }

    private function property(int $id): Property { return self::getContainer()->get(PropertyRepository::class)->findOneBy(['guestLuckyId' => $id]); }
    private function command(bool $apply = false): CommandTester
    {
        $tester = new CommandTester(self::getContainer()->get(PropertyEnrichmentCommand::class));
        $tester->execute($apply ? ['--apply' => true] : []);
        return $tester;
    }
    private function lambersartSnapshot(): array
    {
        $db = $this->em->getConnection();
        return [$db->fetchAssociative('SELECT * FROM property WHERE guest_lucky_id = 2475'), $db->fetchAllAssociative('SELECT * FROM property_image ORDER BY id'), $db->fetchAllAssociative('SELECT * FROM review ORDER BY id')];
    }

    public function testPreviewAndRepeatedApplicationPreserveIdentityMediaAndLambersart(): void
    {
        $snapshot = $this->lambersartSnapshot();
        $identities = $this->em->getConnection()->fetchAllAssociative('SELECT id, guest_lucky_id, slug, address, latitude, longitude, minimum_stay FROM property ORDER BY id');
        $preview = $this->command();
        self::assertSame(0, $preview->getStatusCode());
        self::assertSame('Original Roubaix', $this->property(2474)->getTitle());
        self::assertNull($this->property(2467)->getProviderCapacity());
        self::assertSame($snapshot, $this->lambersartSnapshot());
        self::assertSame(0, $this->command(true)->getStatusCode());
        self::assertSame('La Maison du Patio – Terrasse & Jeux', $this->property(2474)->getTitle());
        self::assertSame([9, 10, 9, 5], [$this->property(2474)->getTravelers(), $this->property(2474)->getProviderCapacity(), $this->property(2474)->getBookingCapacity(), $this->property(2474)->getBeds()]);
        self::assertSame([9, 8, 8, 140], [$this->property(2467)->getTravelers(), $this->property(2467)->getProviderCapacity(), $this->property(2467)->getBookingCapacity(), $this->property(2467)->getArea()]);
        self::assertSame([8, 4, 4, 2.0], [$this->property(2630)->getTravelers(), $this->property(2630)->getBedrooms(), $this->property(2630)->getBeds(), $this->property(2630)->getBathrooms()]);
        self::assertNull($this->property(2630)->getArea()); self::assertNull($this->property(2474)->getArea());
        self::assertNull($this->property(2474)->getAirbnbRating()); self::assertNull($this->property(2474)->getAirbnbReviewsCount());
        self::assertSame($snapshot, $this->lambersartSnapshot(), 'Every Lambersart column and all existing images/reviews must remain byte-for-byte unchanged.');
        self::assertSame($identities, $this->em->getConnection()->fetchAllAssociative('SELECT id, guest_lucky_id, slug, address, latitude, longitude, minimum_stay FROM property ORDER BY id'));
        $rows = $this->em->getConnection()->fetchAllAssociative('SELECT * FROM property ORDER BY id');
        $amenityLinks = $this->em->getConnection()->fetchAllAssociative('SELECT * FROM property_amenity ORDER BY property_id, amenity_id');
        $amenityCount = $this->em->getRepository(Amenity::class)->count([]);
        self::assertSame(0, $this->command(true)->getStatusCode());
        self::assertSame($rows, $this->em->getConnection()->fetchAllAssociative('SELECT * FROM property ORDER BY id'), 'Repeated application must not rewrite updatedAt.');
        self::assertSame($amenityLinks, $this->em->getConnection()->fetchAllAssociative('SELECT * FROM property_amenity ORDER BY property_id, amenity_id'));
        self::assertSame($amenityCount, $this->em->getRepository(Amenity::class)->count([]));
        self::assertSame(4, $this->em->getRepository(Property::class)->count([]));
    }

    public function testMissingMappingFailsBeforeAnyPropertyIsEnriched(): void
    {
        $this->em->remove($this->property(2630)); $this->em->flush();
        $before = $this->em->getConnection()->fetchAllAssociative('SELECT * FROM property ORDER BY id');
        self::assertSame(1, $this->command(true)->getStatusCode());
        self::assertSame($before, $this->em->getConnection()->fetchAllAssociative('SELECT * FROM property ORDER BY id'));
        self::assertSame(1, $this->em->getRepository(Amenity::class)->count([]));
    }

    public function testProviderSyncKeepsReviewedTitleAndCapacityButUpdatesItsOwnLimit(): void
    {
        $this->command(true);
        $entries = self::getContainer()->get(PropertyContentCatalogue::class)->entries();
        $catalogue = ['source' => 'GuestLucky MCP', 'account' => 'Test', 'verifiedAt' => '2026-10-23', 'complete' => true, 'total' => count($entries), 'properties' => []];
        foreach ($entries as $entry) $catalogue['properties'][] = ['id' => $entry['guestLuckyId'], 'slug' => $entry['slug'], 'city' => $entry['city'], 'name' => 'Stale provider title', 'capacity' => $entry['guestLuckyId'] === 2467 ? 7 : 12];
        $importer = self::getContainer()->get(CatalogueImporter::class);
        $importer->import($catalogue, true, archiveMissing: false);
        $importer->import($catalogue, true, archiveMissing: false);
        foreach ($entries as $entry) {
            $property = $this->property($entry['guestLuckyId']);
            self::assertSame($entry['fields']['title'], $property->getTitle());
            self::assertSame($entry['fields']['travelers'], $property->getTravelers());
            self::assertSame($entry['fields']['aboutEn'], $property->getAboutEn());
        }
        self::assertSame(7, $this->property(2467)->getBookingCapacity());
        self::assertSame(9, $this->property(2474)->getBookingCapacity());
        self::assertSame(4, $this->em->getRepository(Property::class)->count([]));
    }

    public function testCapacityMismatchIsBoundedInApiAndFormAndBilingualContentIsRendered(): void
    {
        $this->command(true);
        $http = new MockHttpClient([]);
        $service = new AvailabilityService(new GuestLuckyClient($http, 'https://example.test', 'test'), new ArrayAdapter(), new NullLogger(), true);
        $date = BookingDates::today();
        foreach ([[2467, 9, 8], [2474, 10, 9]] as [$id, $guests, $limit]) {
            $row = $service->quotes([$this->property($id)], $date->format('Y-m-d'), $date->modify('+2 days')->format('Y-m-d'), $guests)['availability'][0];
            self::assertFalse($row['available']); self::assertSame('unavailable', $row['status']); self::assertSame($limit, $row['maxGuests']);
        }
        self::assertSame(0, $http->getRequestsCount(), 'Invalid group sizes must never be sent to the provider.');
        foreach (['fr', 'en'] as $locale) {
            $this->browser->request('GET', '/property/ecrin-noir-croix?_locale='.$locale);
            self::assertResponseIsSuccessful();
            self::assertSelectorCount(8, 'select[data-calendar-target="guests"] option');
            $html = $this->browser->getResponse()->getContent();
            self::assertStringContainsString($locale === 'fr' ? 'Baignoire balnéo' : 'Whirlpool bath', $html);
            self::assertStringContainsString($locale === 'fr' ? 'plus de 8 voyageurs' : 'more than 8 guests', $html);
            self::assertStringContainsString('https://www.airbnb.fr/rooms/1765420065815429494', $html);
            $this->browser->request('GET', '/?_locale='.$locale);
            self::assertResponseIsSuccessful();
            self::assertSelectorExists('option[value="ecrin-noir-croix"][data-capacity="8"]');
            self::assertSelectorExists('option[value="roubaix"][data-capacity="9"]');
        }
    }

    public function testChangingOfficialListingDoesNotCarryOverUnverifiedRatings(): void
    {
        $property = $this->property(2474)->setAirbnbUrl('https://www.airbnb.fr/rooms/999')->setAirbnbRating(4.9)->setAirbnbReviewsCount(50);
        $this->em->flush(); $this->command(true);
        self::assertNull($property->getAirbnbRating()); self::assertNull($property->getAirbnbReviewsCount());
    }

    public function testLegacyAndReviewedAmenitiesRenderOnceInBothLanguagesWithoutChangingSharedRows(): void
    {
        foreach (['Wi-Fi', 'Télévision', 'Cuisine', 'Espace de travail', 'Serviettes, draps de lit', 'Terrasse'] as $name) {
            $amenity = (new Amenity())->setName($name)->setIcon('<svg></svg>');
            $this->em->persist($amenity);
            $this->property(2474)->addAmenity($amenity); $this->property(2475)->addAmenity($amenity);
        }
        $this->em->flush(); $this->command(true);
        $before = $this->em->getConnection()->fetchAllAssociative('SELECT * FROM amenity ORDER BY id');
        foreach (['fr', 'en'] as $locale) {
            $crawler = $this->browser->request('GET', '/property/roubaix?_locale='.$locale);
            self::assertResponseIsSuccessful();
            $labels = $crawler->filter('.property-amenities li')->each(static fn ($node) => trim($node->text()));
            foreach ($locale === 'fr' ? ['Wi-Fi', 'Télévision', 'Cuisine équipée', 'Espace de travail', 'Linge de lit fourni', 'Serviettes fournies', 'Terrasse', 'Patio intérieur abrité'] : ['Wi-Fi', 'TV', 'Equipped kitchen', 'Workspace', 'Bed linen provided', 'Towels provided', 'Terrace', 'Sheltered courtyard patio'] as $label) {
                self::assertSame(1, count(array_filter($labels, static fn ($value) => $value === $label)), 'Expected one translated label for '.$label);
            }
        }
        self::assertSame($before, $this->em->getConnection()->fetchAllAssociative('SELECT * FROM amenity ORDER BY id'));
    }
}
