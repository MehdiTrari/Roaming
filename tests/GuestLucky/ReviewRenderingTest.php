<?php
namespace App\Tests\GuestLucky;
use App\Entity\Property;
use App\Service\GuestReviewFeed;
use App\Repository\PropertyRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class ReviewRenderingTest extends WebTestCase
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
        foreach ([2467 => 'ecrin-noir-croix', 2630 => 'l-elegante-douaisienne-4-chambres-2630', 2474 => 'roubaix'] as $id => $slug) {
            $property = (new Property())->setGuestLuckyId($id)->setSlug($slug)->setTitle('Logement test '.$slug)->setCity('Lille')->setTravelers(4)->setActive(true);
            $this->em->persist($property);
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

    public function testReviewCarouselRendersPublicSnapshotsEscapedAndNeverMakesProviderCalls(): void
    {
        $directory = sys_get_temp_dir().'/roaming-review-render-'.bin2hex(random_bytes(6)); mkdir($directory);
        try {
            $reviews = [];
            for ($i = 1; $i <= 7; $i++) $reviews[] = ['id' => 'airbnb:2467:qa'.$i, 'propertyId' => 2467, 'channel' => 'airbnb', 'author' => 'Voyageur test '.$i, 'rating' => $i === 1 ? 2 : 5, 'date' => '2026-01-0'.$i, 'text' => 'Avis fictif pour contrôle visuel uniquement — jamais publié sur l’accueil réel. '.str_repeat('Exemple de commentaire réservé aux tests. ', $i === 1 ? 12 : 1).($i === 2 ? '<script>alert(1)</script>' : '')];
            $reviews[6]['text'] = ''; $reviews[6]['author'] = '';
            $reviews[6]['channel'] = 'booking'; $reviews[6]['id'] = 'booking:2467:qa7';
            file_put_contents($directory.'/reviews.json', json_encode(['version' => 2, 'reviews' => $reviews]));
            $feed = new GuestReviewFeed(self::getContainer()->get(PropertyRepository::class), dirname(__DIR__, 2).'/config/review_sources.json', $directory.'/reviews.json');
            self::getContainer()->set(GuestReviewFeed::class, $feed);
            foreach (['fr', 'en'] as $locale) {
                $crawler = $this->browser->request('GET', '/?_locale='.$locale); self::assertResponseIsSuccessful();
                self::assertSelectorCount(7, '.guest-review-card');
                self::assertStringContainsString($locale === 'fr' ? 'Ce voyageur a laissé une note sans commentaire.' : 'This guest left a rating without a comment.', $crawler->filter('#guest-reviews')->text());
                self::assertSelectorCount(0, '#guest-reviews script, #guest-reviews iframe');
                self::assertStringContainsString('&lt;script&gt;', $this->browser->getResponse()->getContent());
                self::assertSelectorCount(6, '.guest-review-source[href="https://www.airbnb.fr/h/croixroaming"]');
                self::assertSelectorCount(6, '.guest-review-brand[alt="Airbnb"]');
                self::assertSelectorCount(1, '.guest-review-brand[alt="Booking.com"]');
                $html = $this->browser->getResponse()->getContent();
                self::assertLessThan(strpos($html, 'id="guest-reviews"'), strpos($html, 'id="amenities"'));
                self::assertLessThan(strpos($html, 'id="contact"'), strpos($html, 'id="guest-reviews"'));
                if ($locale === 'fr') {
                    // Private test artifact for browser interaction checks, never a public route or the real snapshot.
                    $artifact = dirname(__DIR__, 2).'/var/review-carousel-qa.html';
                    file_put_contents($artifact, str_replace('Leurs séjours, leurs mots', 'APERÇU TEST — AVIS FICTIFS', $html));
                }
            }
            file_put_contents($directory.'/reviews.json', '{"version":2,"reviews":[]}');
            $this->browser->request('GET', '/'); self::assertResponseIsSuccessful();
            self::assertSelectorCount(0, '.guest-review-card'); self::assertSelectorCount(0, '#guest-reviews, .guest-review-source-card');
        } finally { foreach (glob($directory.'/*') as $file) unlink($file); rmdir($directory); }
    }

    public function testMissingSnapshotDoesNotRenderFakeReviewsOrSourcePlaceholders(): void
    {
        $feed = new GuestReviewFeed(self::getContainer()->get(PropertyRepository::class), dirname(__DIR__, 2).'/config/review_sources.json', sys_get_temp_dir().'/absent-reviews-'.bin2hex(random_bytes(6)).'.json');
        self::getContainer()->set(GuestReviewFeed::class, $feed);
        foreach (['fr', 'en'] as $locale) {
            $this->browser->request('GET', '/?_locale='.$locale);
            self::assertResponseIsSuccessful();
            self::assertSelectorCount(0, '#guest-reviews, .guest-review-card, .guest-review-source-card');
            self::assertSelectorExists('#amenities');
            self::assertSelectorExists('#contact');
        }
    }
}
