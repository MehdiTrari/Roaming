<?php
namespace App\Tests\GuestLucky;

use App\Booking\BookingDates;
use App\Entity\Property;
use App\Integration\GuestLucky\GuestLuckyClient;
use App\Service\AvailabilityService;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Symfony\Component\Cache\Adapter\ArrayAdapter;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class AvailabilityTest extends TestCase
{
    private function property(int $id = 1): Property
    {
        return (new Property())->setGuestLuckyId($id)->setSlug('property-'.$id)->setTitle('Property '.$id)->setCity('Lille')->setTravelers(8)->setActive(true);
    }
    private function service(MockHttpClient $http, bool $enabled = true): AvailabilityService
    {
        return new AvailabilityService(new GuestLuckyClient($http, 'https://example.test', 'public-key'), new ArrayAdapter(), new NullLogger(), $enabled);
    }
    public static function calendarData(int $id = 1): array
    {
        $today = BookingDates::today();
        $days = [];
        for ($i = 1; $i <= (int) $today->format('t'); ++$i) {
            $days[] = ['date' => $today->format('Y-m-').sprintf('%02d', $i), 'available' => $i % 2 === 0, 'price' => 110, 'min_stay' => 2];
        }
        return ['listing_id' => $id, 'year' => (int) $today->format('Y'), 'month' => (int) $today->format('n'), 'days' => $days];
    }
    public static function quoteData(string $arrival, string $departure, int $id = 1, int $guests = 2): array
    {
        return ['listing_id' => $id, 'checkin' => $arrival, 'checkout' => $departure, 'guests' => $guests, 'nights' => (new \DateTimeImmutable($arrival))->diff(new \DateTimeImmutable($departure))->days,
            'total_price' => 442, 'currency' => 'Euro', 'subtotal_nightly' => 352, 'cleaning_fee' => 90, 'linen_fee' => 0, 'extra_guest_fee' => 0, 'pet_fee' => 0, 'service_fee' => 0, 'discount_amount' => 0, 'tax_amount' => 0];
    }
    private function calendar(AvailabilityService $service, array $properties): array
    {
        return $service->calendars($properties, (int) BookingDates::today()->format('Y'), (int) BookingDates::today()->format('n'));
    }
    public function testDisabledGateNeverCallsGuestLuckyOrReturnsAvailability(): void
    {
        $http = new MockHttpClient([]);
        $service = $this->service($http, false);
        $rows = $this->calendar($service, [$this->property()])['properties'];
        self::assertSame('unverified', $rows[0]['status']);
        self::assertSame([], $rows[0]['days']);
        $date = BookingDates::today();
        $quotes = $service->quotes([$this->property()], $date->format('Y-m-d'), $date->modify('+2 days')->format('Y-m-d'), 2);
        self::assertFalse($quotes['availability'][0]['available']);
        self::assertNull($quotes['availability'][0]['price']);
        self::assertSame(0, $http->getRequestsCount());
    }
    public function testMonthIsCachedAndOnlyPublicFieldsAreReturned(): void
    {
        $data = self::calendarData();
        $data['guest_email'] = 'private@example.test';
        $http = new MockHttpClient([new MockResponse(json_encode($data))]);
        $service = $this->service($http);
        $first = $this->calendar($service, [$this->property()]);
        $second = $this->calendar($service, [$this->property()]);
        self::assertSame($first, $second);
        self::assertSame('fresh', $first['properties'][0]['status']);
        self::assertSame(1, $http->getRequestsCount());
        self::assertStringNotContainsString('private@example.test', json_encode($first));
    }

    public function testPreviewReadsQuotesWithoutOpeningPublicGate(): void
    {
        $arrival = BookingDates::today()->format('Y-m-d');
        $departure = BookingDates::today()->modify('+2 days')->format('Y-m-d');
        $http = new MockHttpClient([new MockResponse(json_encode(self::quoteData($arrival, $departure)))]);
        $service = $this->service($http, false);
        $preview = $service->quotesForTest([$this->property()], $arrival, $departure, 2);
        self::assertTrue($preview['availability'][0]['available']);
        self::assertSame(442, $preview['availability'][0]['price']);
        self::assertFalse($service->isEnabled());
        $public = $service->quotes([$this->property()], $arrival, $departure, 2);
        self::assertFalse($public['enabled']);
        self::assertFalse($public['availability'][0]['available']);
        self::assertSame(1, $http->getRequestsCount());
    }
    public function testPartialFailureDoesNotContaminateAnotherProperty(): void
    {
        $bad = self::calendarData(2); $bad['days'][0]['date'] = '2027-01-01';
        $http = new MockHttpClient([new MockResponse(json_encode(self::calendarData())), new MockResponse(json_encode($bad))]);
        $rows = $this->calendar($this->service($http), [$this->property(), $this->property(2)])['properties'];
        self::assertSame('fresh', $rows[0]['status']);
        self::assertSame('unverified', $rows[1]['status']);
        self::assertSame([], $rows[1]['days']);
    }

    public function testPartialCurrentMonthIsAcceptedAndMissingDatesStayUnknown(): void
    {
        $data = self::calendarData();
        $data['days'] = array_slice($data['days'], 10);
        $http = new MockHttpClient([new MockResponse(json_encode($data))]);
        $row = $this->calendar($this->service($http), [$this->property()])['properties'][0];
        self::assertSame('fresh', $row['status']);
        self::assertCount((int) BookingDates::today()->format('t') - 10, $row['days']);
    }
    public function testTimeoutIsUnverified(): void
    {
        $http = new MockHttpClient([new MockResponse((function () { yield ''; })())]);
        self::assertSame('unverified', $this->calendar($this->service($http), [$this->property()])['properties'][0]['status']);
    }
    public function testQuoteIsFreshAndRejectionDiffersFromProviderFailure(): void
    {
        $arrival = BookingDates::today()->modify('last day of this month')->format('Y-m-d');
        $departure = (new \DateTimeImmutable($arrival))->modify('+2 days')->format('Y-m-d');
        $http = new MockHttpClient([
            new MockResponse(json_encode(self::quoteData($arrival, $departure))),
            new MockResponse('{"error":"Dates not available or constraints not met"}', ['http_code' => 422]),
            new MockResponse('{}', ['http_code' => 503]),
        ]);
        $service = $this->service($http);
        $quote = $service->quotes([$this->property()], $arrival, $departure, 2)['availability'][0];
        self::assertSame(442, $quote['price']);
        self::assertSame(2, $quote['nights']);
        self::assertSame('EUR', $quote['currency']);
        self::assertSame('unavailable', $service->quotes([$this->property()], $arrival, $departure, 2)['availability'][0]['status']);
        self::assertSame('unverified', $service->quotes([$this->property()], $arrival, $departure, 2)['availability'][0]['status']);
        self::assertSame(3, $http->getRequestsCount());
    }
    public function testCapacityRejectedWithoutProviderRequest(): void
    {
        $http = new MockHttpClient([]);
        $date = BookingDates::today();
        $result = $this->service($http)->quotes([$this->property()], $date->format('Y-m-d'), $date->modify('+2 days')->format('Y-m-d'), 9);
        self::assertSame('unavailable', $result['availability'][0]['status']);
        self::assertSame(0, $http->getRequestsCount());
    }
    public function testInvalidDatesAndMonthHorizon(): void
    {
        foreach ([['2026-02-30','2026-03-03',2], ['not-a-date','2026-10-03',2], [BookingDates::today()->format('Y-m-d'),BookingDates::today()->format('Y-m-d'),2], [BookingDates::today()->format('Y-m-d'),BookingDates::today()->modify('+1 day')->format('Y-m-d'),0]] as $stay) {
            try { BookingDates::stay(...$stay); self::fail('Invalid stay accepted'); } catch (\InvalidArgumentException) { self::assertTrue(true); }
        }
        $end = BookingDates::today()->modify('first day of this month')->modify('+11 months');
        BookingDates::month((int) $end->format('Y'), (int) $end->format('n'));
        $this->expectException(\InvalidArgumentException::class);
        $end = $end->modify('+1 month');
        BookingDates::month((int) $end->format('Y'), (int) $end->format('n'));
    }
    public function testMalformedQuoteCannotEnableBooking(): void
    {
        $arrival = BookingDates::today()->format('Y-m-d'); $departure = BookingDates::today()->modify('+2 days')->format('Y-m-d');
        $data = self::quoteData($arrival, $departure); unset($data['cleaning_fee']);
        $http = new MockHttpClient([new MockResponse(json_encode($data))]);
        self::assertSame('unverified', $this->service($http)->quotes([$this->property()], $arrival, $departure, 2)['availability'][0]['status']);
    }
}
