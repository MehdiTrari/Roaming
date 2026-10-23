<?php
namespace App\Tests\GuestLucky;

use App\Integration\GuestLucky\GuestLuckyClient;
use App\Integration\GuestLucky\StayUnavailable;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

final class TransportTest extends TestCase
{
    private function client(MockHttpClient $http): GuestLuckyClient
    {
        return new GuestLuckyClient($http, 'https://example.test', 'test-key');
    }

    public function testConnectionFailureRecoversWithOneFreshReadAndTheSameCriteria(): void
    {
        $arrival = '2026-11-15'; $departure = '2026-11-18'; $options = [];
        $http = new MockHttpClient(function ($method, $url, $requestOptions) use (&$options, $arrival, $departure) {
            self::assertSame('GET', $method);
            self::assertStringContainsString('checkin='.$arrival, $url);
            self::assertStringContainsString('checkout='.$departure, $url);
            self::assertStringContainsString('guests=2', $url);
            $options[] = $requestOptions;
            if (count($options) === 1) return new MockResponse('', ['error' => 'Connection reset', 'total_time' => .2]);
            return new MockResponse(json_encode(AvailabilityTest::quoteData($arrival, $departure, 2630)));
        });
        $client = $this->client($http);
        $response = $client->startQuote(2630, $arrival, $departure, 2);
        $quote = $client->readQuote($response, 2630, $arrival, $departure, 2);
        self::assertSame(3, $quote['nights']);
        self::assertSame(442, $quote['price']);
        self::assertCount(2, $options);
        self::assertLessThan(12, $options[1]['max_duration'], 'retry uses the remaining total time budget');
    }

    public function testPersistentNetworkFailureStopsAfterTwoRetries(): void
    {
        $http = new MockHttpClient([
            new MockResponse('', ['error' => 'Connection reset']),
            new MockResponse('', ['error' => 'Connection reset']),
            new MockResponse('', ['error' => 'Connection reset']),
            new MockResponse('{}'),
        ]);
        $client = $this->client($http);
        try {
            $client->readQuote($client->startQuote(2630, '2026-11-15', '2026-11-18', 2), 2630, '2026-11-15', '2026-11-18', 2);
            self::fail('Network failure must not turn into availability.');
        } catch (TransportExceptionInterface) {
            self::assertSame(3, $http->getRequestsCount());
        }
    }

    public function testTwoConnectionFailuresCanRecoverWithinTheOriginalBudget(): void
    {
        $arrival = '2026-11-15'; $departure = '2026-11-18'; $budgets = [];
        $http = new MockHttpClient(function ($method, $url, $options) use (&$budgets, $arrival, $departure) {
            $budgets[] = $options['max_duration'];
            if (count($budgets) < 3) return new MockResponse('', ['error' => 'Connection reset', 'total_time' => .4]);
            return new MockResponse(json_encode(AvailabilityTest::quoteData($arrival, $departure, 2630)));
        });
        $client = $this->client($http);
        $quote = $client->readQuote($client->startQuote(2630, $arrival, $departure, 2), 2630, $arrival, $departure, 2);
        self::assertSame(3, $quote['nights']);
        self::assertCount(3, $budgets);
        self::assertLessThan($budgets[0], $budgets[1]);
        self::assertLessThan($budgets[1], $budgets[2]);
    }

    public function testProviderRefusalIsNeverRetried(): void
    {
        $http = new MockHttpClient([new MockResponse('{"error":"Dates not available or constraints not met"}', ['http_code' => 422])]);
        $client = $this->client($http);
        try {
            $client->readQuote($client->startQuote(2630, '2026-11-15', '2026-11-18', 2), 2630, '2026-11-15', '2026-11-18', 2);
            self::fail('A refusal must remain unavailable.');
        } catch (StayUnavailable) {
            self::assertSame(1, $http->getRequestsCount());
        }
    }

    public function testOnlyTheConnectionPhaseHasTheShortDeadline(): void
    {
        $options = [];
        $http = new MockHttpClient(function ($method, $url, $requestOptions) use (&$options) {
            $options = $requestOptions;
            return new MockResponse('{}');
        });
        $response = $this->client($http)->startCalendar(2630, 2026, 11);
        $response->cancel();
        $progress = $options['on_progress'];
        $progress(0, 0, ['total_time' => 6, 'pretransfer_time' => .2, 'connect_time' => .1]);
        $progress(0, 0, ['total_time' => 6, 'connect_time' => .2]);
        $this->expectException(TransportExceptionInterface::class);
        $progress(0, 0, ['total_time' => 2.6, 'pretransfer_time' => 0, 'connect_time' => 0]);
    }
}
