<?php
namespace App\Tests\GuestLucky;
use App\Entity\Property;
use App\Integration\GuestLucky\McpClient;
use App\Integration\GuestLucky\ReviewSynchronizer;
use App\Repository\PropertyRepository;
use App\Service\GuestReviewFeed;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class ReviewSynchronizerTest extends TestCase
{
    private string $directory;
    private GuestReviewFeed $feed;
    private array $source = ['propertyId' => 2467, 'channel' => 'airbnb', 'url' => 'https://www.airbnb.fr/h/croixroaming'];
    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir().'/roaming-reviews-'.bin2hex(random_bytes(6)); mkdir($this->directory);
        file_put_contents($this->directory.'/sources.json', json_encode(['publicChannels' => ['airbnb'], 'sources' => [$this->source], 'excludedReviewIds' => []]));
        $properties = $this->createStub(PropertyRepository::class);
        $properties->method('findActive')->willReturn([(new Property())->setGuestLuckyId(2467)->setTitle('Croix')->setCity('Croix')->setSlug('croix')->setActive(true)]);
        $this->feed = new GuestReviewFeed($properties, $this->directory.'/sources.json', $this->directory.'/reviews.json');
    }
    protected function tearDown(): void { foreach (glob($this->directory.'/*') as $file) unlink($file); rmdir($this->directory); }
    private function row(int $id = 1, int $rating = 5): array
    {
        return ['id' => $id, 'property' => ['id' => 2467], 'channel' => 'airbnb', 'guest_name' => 'Voyageur Exemple', 'rating' => $rating, 'text' => '<b>Avis fictif pour les tests uniquement.</b>', 'negative_feedback' => 'PRIVATE FEEDBACK', 'reservation_reference' => 'PRIVATE BOOKING', 'submitted_at' => '2026-01-02T10:00:00Z'];
    }
    private function client(callable $response, int $account = 123): McpClient
    {
        return new McpClient(new MockHttpClient(static function ($method, $url, $options) use ($response, $account) {
            $payload = json_decode($options['body'], true);
            if ($payload['method'] === 'notifications/initialized') return new MockResponse('', ['http_code' => 202]);
            if ($payload['method'] === 'initialize') $result = ['protocolVersion' => '2025-11-25'];
            elseif ($payload['params']['name'] === 'gl-whoami') $result = ['structuredContent' => ['account_owner_id' => $account]];
            else {
                self::assertSame('gl-list-guest-reviews', $payload['params']['name']);
                self::assertSame(2467, $payload['params']['arguments']['property_id']);
                self::assertContains($payload['params']['arguments']['channel'], ['airbnb', 'booking']);
                $data = $response($payload['params']['arguments']);
                $result = ['structuredContent' => $data];
            }
            return new MockResponse(json_encode(['jsonrpc' => '2.0', 'id' => $payload['id'], 'result' => $result]));
        }), 'https://app.guestlucky.io/api/mcp', 'test-secret');
    }
    private function page(array $rows, int $total = -1, int $page = 1): array { return ['total' => $total < 0 ? count($rows) : $total, 'page' => $page, 'per_page' => 50, 'count' => count($rows), 'reviews' => $rows]; }
    public function testSnapshotIsIdempotentKeepsLowRatingsAndNeverStoresPrivateFeedback(): void
    {
        $client = $this->client(fn () => $this->page([$this->row(1, 2), $this->row(2, 5)]));
        $sync = new ReviewSynchronizer($client, $this->feed, 123);
        self::assertSame(2, $sync->synchronize(true)['count']); $sync->synchronize(true);
        $data = json_decode(file_get_contents($this->feed->snapshotPath()), true);
        self::assertCount(2, $data['reviews']); self::assertSame('Voyageur', $data['reviews'][0]['author']);
        self::assertSame(2.0, (float) $data['reviews'][0]['rating']);
        self::assertStringNotContainsString('PRIVATE', file_get_contents($this->feed->snapshotPath()));
        self::assertStringNotContainsString('<b>', file_get_contents($this->feed->snapshotPath()));
        self::assertCount(2, $this->feed->publicFeed()['reviews']);
    }
    public function testEmptyCompleteSnapshotRemovesWithdrawnReviewsAndPreviewNeverWrites(): void
    {
        (new ReviewSynchronizer($this->client(fn () => $this->page([$this->row()])), $this->feed, 123))->synchronize(true);
        $before = file_get_contents($this->feed->snapshotPath());
        $empty = new ReviewSynchronizer($this->client(fn () => $this->page([])), $this->feed, 123);
        self::assertSame(0, $empty->synchronize(false)['count']); self::assertSame($before, file_get_contents($this->feed->snapshotPath()));
        $empty->synchronize(true); self::assertSame([], $this->feed->publicFeed()['reviews']);
        self::assertCount(1, $this->feed->publicFeed()['sources']);
    }
    public function testIncompletePagesOrWrongAccountPreserveThePreviousSnapshot(): void
    {
        file_put_contents($this->feed->snapshotPath(), '{"version":2,"reviews":[]}');
        foreach ([$this->client(fn () => $this->page([$this->row()], 2)), $this->client(fn () => $this->page([]), 999)] as $client) {
            try { (new ReviewSynchronizer($client, $this->feed, 123))->synchronize(true); self::fail('Invalid input accepted.'); } catch (\RuntimeException) {}
            self::assertSame('{"version":2,"reviews":[]}', file_get_contents($this->feed->snapshotPath()));
        }
    }
    public function testPaginationAndDuplicateDetection(): void
    {
        $rows = array_map(fn ($id) => $this->row($id), range(1, 51));
        $client = $this->client(fn ($args) => $this->page(array_slice($rows, ($args['page'] - 1) * 50, 50), 51, $args['page']));
        self::assertCount(51, $client->guestReviews(2467, 'airbnb'));
        $duplicate = $this->client(fn ($args) => $this->page($args['page'] === 1 ? array_slice($rows, 0, 50) : [$rows[0]], 51, $args['page']));
        $this->expectException(\RuntimeException::class); $duplicate->guestReviews(2467, 'airbnb');
    }
    public function testInvalidRatingsAndMismatchedPropertiesAreRejected(): void
    {
        foreach ([$this->row() + [], array_replace($this->row(), ['rating' => 10]), array_replace($this->row(), ['property' => ['id' => 2474]]), array_replace($this->row(), ['submitted_at' => '2026-02-30'])] as $index => $row) {
            if ($index === 0) { self::assertNotNull(ReviewSynchronizer::normalize($row, $this->source)); continue; }
            try { ReviewSynchronizer::normalize($row, $this->source); self::fail('Invalid review accepted.'); } catch (\RuntimeException) {}
        }
    }

    public function testCurrentGuestLuckyResponseSupportsAnonymousAndRatingOnlyReviews(): void
    {
        $row = array_replace($this->row(), ['property' => 'L’Écrin Noir – Maison Moderne & Accueillante', 'guest_name' => null, 'text' => null, 'rating' => 2.5]);
        $sync = new ReviewSynchronizer($this->client(fn () => $this->page([$row])), $this->feed, 123);
        self::assertSame(1, $sync->synchronize(true)['count']);
        $review = $this->feed->publicFeed()['reviews'][0];
        self::assertSame('', $review['author']); self::assertSame('', $review['text']);
        self::assertSame(2.5, $review['rating']);
        unset($row['text']);
        $this->expectException(\RuntimeException::class);
        ReviewSynchronizer::normalize($row, $this->source);
    }

    public function testEveryActivePropertyIsReadEvenWithoutAnExternalSourceLink(): void
    {
        file_put_contents($this->directory.'/sources.json', json_encode(['publicChannels' => ['airbnb'], 'sources' => [], 'excludedReviewIds' => []]));
        self::assertSame([['propertyId' => 2467, 'channel' => 'airbnb']], $this->feed->synchronizationSources());
        (new ReviewSynchronizer($this->client(fn () => $this->page([$this->row()])), $this->feed, 123))->synchronize(true);
        self::assertCount(1, $this->feed->publicFeed()['reviews']);
        self::assertNull($this->feed->publicFeed()['reviews'][0]['sourceUrl']);
        file_put_contents($this->directory.'/sources.json', json_encode(['publicChannels' => [], 'sources' => [], 'excludedReviewIds' => []]));
        self::assertSame([], $this->feed->publicFeed()['reviews']);
    }

    public function testBookingIncludesBothPublicPartsAndRatingOnlyReviews(): void
    {
        file_put_contents($this->directory.'/sources.json', json_encode(['publicChannels' => ['airbnb', 'booking'], 'sources' => [], 'excludedReviewIds' => []]));
        $client = $this->client(fn ($args) => $this->page($args['channel'] === 'airbnb' ? [$this->row()] : [
            array_replace($this->row(2, 2), ['channel' => 'booking', 'text' => 'Public positive comment.', 'negative_feedback' => 'Public negative comment.']),
            array_replace($this->row(3, 3), ['channel' => 'booking', 'text' => null, 'negative_feedback' => null]),
            array_replace($this->row(4, 2), ['channel' => 'booking', 'text' => null, 'negative_feedback' => 'Only a negative comment.']),
        ]));
        self::assertSame(4, (new ReviewSynchronizer($client, $this->feed, 123))->synchronize(true)['count']);
        $reviews = array_column($this->feed->publicFeed()['reviews'], null, 'id');
        self::assertSame("Public positive comment.\n\nPublic negative comment.", $reviews['booking:2467:2']['text']);
        self::assertSame('', $reviews['booking:2467:3']['text']);
        self::assertSame('Only a negative comment.', $reviews['booking:2467:4']['text']);
        self::assertSame(2.0, (float) $reviews['booking:2467:2']['rating']);
        self::assertStringNotContainsString('PRIVATE', file_get_contents($this->feed->snapshotPath()));
    }

    public function testHomepageIsBoundedWhileSnapshotRetainsAllReviews(): void
    {
        $rows = array_map(fn ($id) => $this->row($id), range(1, 30));
        (new ReviewSynchronizer($this->client(fn () => $this->page($rows)), $this->feed, 123))->synchronize(true);
        self::assertCount(30, json_decode(file_get_contents($this->feed->snapshotPath()), true)['reviews']);
        self::assertCount(24, $this->feed->publicFeed()['reviews']);
    }
    public function testExclusionsPreventRepublishingAndSourceRemovalHidesCachedReviews(): void
    {
        (new ReviewSynchronizer($this->client(fn () => $this->page([$this->row()])), $this->feed, 123))->synchronize(true);
        file_put_contents($this->directory.'/sources.json', json_encode(['publicChannels' => ['airbnb'], 'sources' => [$this->source], 'excludedReviewIds' => ['airbnb:2467:1']]));
        self::assertSame([], $this->feed->publicFeed()['reviews']);
        (new ReviewSynchronizer($this->client(fn () => $this->page([$this->row()])), $this->feed, 123))->synchronize(true);
        self::assertSame([], json_decode(file_get_contents($this->feed->snapshotPath()), true)['reviews']);
        file_put_contents($this->directory.'/sources.json', json_encode(['publicChannels' => ['airbnb'], 'sources' => [array_replace($this->source, ['propertyId' => 2630])], 'excludedReviewIds' => []]));
        self::assertCount(1, $this->feed->publicFeed()['sources']);
        self::assertNull($this->feed->publicFeed()['sources'][0]['url'], 'Removing an external URL does not disconnect an active property.');
    }
}
