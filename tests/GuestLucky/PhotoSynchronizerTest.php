<?php
declare(strict_types=1);
namespace App\Tests\GuestLucky;

use App\Entity\Property;
use App\Entity\PropertyImage;
use App\Integration\GuestLucky\PhotoClient;
use App\Integration\GuestLucky\PhotoSynchronizer;
use App\Repository\PropertyRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;
use Symfony\Component\Filesystem\Filesystem;

final class PhotoSynchronizerTest extends KernelTestCase
{
    private EntityManagerInterface $em;
    private array $saved = [];
    private string $directory;
    private array $galleries = [2474 => ['a.jpg', 'b.jpg'], 2467 => ['c.jpg']];
    private const BASE = 'https://s3.eu-west-3.amazonaws.com/guestluckybucket/listings/';

    protected function setUp(): void
    {
        if (!extension_loaded('pdo_sqlite')) self::markTestSkipped('Requires isolated SQLite.');
        foreach (['DATABASE_URL' => 'sqlite:///:memory:', 'SITE_MAINTENANCE' => '0'] as $key => $value) {
            $this->saved[$key] = [$_ENV[$key] ?? null, $_SERVER[$key] ?? null, getenv($key)];
            $_ENV[$key] = $_SERVER[$key] = $value; putenv($key.'='.$value);
        }
        self::bootKernel();
        $this->em = self::getContainer()->get(EntityManagerInterface::class);
        self::assertSame('pdo_sqlite', $this->em->getConnection()->getParams()['driver']);
        (new SchemaTool($this->em))->createSchema($this->em->getMetadataFactory()->getAllMetadata());
        $this->directory = self::getContainer()->getParameter('kernel.project_dir').'/var/guestlucky/test-photos-'.bin2hex(random_bytes(6));
        foreach ([2475 => 'lambersart', 2474 => 'roubaix', 2467 => 'croix', 100 => 'archived'] as $id => $slug) {
            $property = (new Property())->setGuestLuckyId($id)->setSlug($slug)->setTitle($slug)->setCity($slug)->setTravelers(4)->setActive($id !== 100);
            $property->addImage((new PropertyImage())->setFilename($slug.'/old.jpg')->setAlt('Existing caption')->setIsCover(true));
            $this->em->persist($property);
        }
        $this->em->flush();
    }

    protected function tearDown(): void
    {
        if (isset($this->directory)) (new Filesystem())->remove($this->directory);
        parent::tearDown();
        foreach ($this->saved as $key => [$env, $server, $process]) {
            if ($env === null) unset($_ENV[$key]); else $_ENV[$key] = $env;
            if ($server === null) unset($_SERVER[$key]); else $_SERVER[$key] = $server;
            putenv($process === false ? $key : $key.'='.$process);
        }
    }

    private function sync(bool $apply): array
    {
        $http = new MockHttpClient(function ($method, $url) {
            self::assertSame('GET', $method);
            $id = (int) basename(parse_url($url, PHP_URL_PATH));
            self::assertArrayHasKey($id, $this->galleries, 'Preserved and archived properties must never be requested.');
            $images = $this->galleries[$id];
            return new MockResponse($images === null ? '<h1>Unavailable</h1>' : '<div id="gl-gallery">'.implode('', array_map(static fn ($image) => '<img src="'.self::BASE.$image.'">', $images)).'</div>');
        });
        return (new PhotoSynchronizer(new PhotoClient($http, 'https://app.guestlucky.io', 'test-private-key'), self::getContainer()->get(PropertyRepository::class), $this->em, [2475], $this->directory))->synchronize($apply);
    }

    private function rows(): array { return $this->em->getConnection()->fetchAllAssociative('SELECT * FROM property_image ORDER BY id'); }
    private function preserved(): array { return $this->em->getConnection()->fetchAllAssociative('SELECT i.* FROM property_image i JOIN property p ON p.id=i.property_id WHERE p.guest_lucky_id IN (2475, 100) ORDER BY i.id'); }

    public function testPreviewReplacementPreservationIdempotenceReorderAndDeletion(): void
    {
        $before = $this->rows(); $preserved = $this->preserved();
        $this->sync(false); self::assertSame($before, $this->rows());
        $this->sync(true); self::assertSame($preserved, $this->preserved());
        $rows = $this->rows();
        self::assertCount(5, $rows);
        $properties = $this->em->getConnection()->fetchAllAssociative('SELECT * FROM property ORDER BY id');
        $this->sync(true);
        self::assertSame($rows, $this->rows(), 'Repeated synchronization must preserve image IDs and dates.');
        self::assertSame($properties, $this->em->getConnection()->fetchAllAssociative('SELECT * FROM property ORDER BY id'));
        $this->galleries[2474] = ['b.jpg', 'a.jpg', 'd.jpg'];
        $this->sync(true);
        $this->em->clear();
        $property = self::getContainer()->get(PropertyRepository::class)->findOneBy(['guestLuckyId' => 2474]);
        self::assertSame([self::BASE.'b.jpg', self::BASE.'a.jpg', self::BASE.'d.jpg'], $property->getImages()->map(fn ($i) => $i->getFilename())->toArray());
        self::assertSame([true, false, false], $property->getImages()->map(fn ($i) => $i->isCover())->toArray());
        $this->galleries[2474] = [];
        $this->sync(true); $this->em->clear();
        self::assertCount(0, self::getContainer()->get(PropertyRepository::class)->findOneBy(['guestLuckyId' => 2474])->getImages());
        self::assertSame($preserved, $this->preserved());
        $status = file_get_contents($this->directory.'/photos-status.json');
        self::assertStringNotContainsString('test-private-key', $status);
        self::assertSame('ok', json_decode($status, true)['status']);
        self::assertNotEmpty(glob($this->directory.'/photos-backup-*.json'));
    }

    public function testOneInvalidGalleryPreservesEveryExistingGallery(): void
    {
        $before = $this->rows(); $this->galleries[2467] = null;
        try { $this->sync(true); self::fail('Invalid source must fail.'); } catch (\RuntimeException $error) {
            self::assertStringNotContainsString('test-private-key', $error->getMessage());
        }
        self::assertSame($before, $this->rows());
        self::assertSame('error', json_decode(file_get_contents($this->directory.'/photos-status.json'), true)['status']);
        self::assertSame([], glob($this->directory.'/photos-backup-*.json'));
    }
}
