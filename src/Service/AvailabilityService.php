<?php
namespace App\Service;
use App\Booking\BookingDates;
use App\Entity\Property;
use App\Integration\GuestLucky\GuestLuckyClient;
use App\Integration\GuestLucky\StayUnavailable;
use Psr\Cache\CacheItemPoolInterface;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\HttpClient\Exception\DecodingExceptionInterface;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;
use Symfony\Contracts\HttpClient\ResponseInterface;

final class AvailabilityService
{
    public function __construct(private GuestLuckyClient $client, private CacheItemPoolInterface $cache, private LoggerInterface $logger, private bool $enabled) {}
    public function isEnabled(): bool { return $this->enabled; }

    public function calendars(array $properties, int $year, int $month): array
    {
        return $this->readCalendars($properties, $year, $month, $this->enabled);
    }

    /** Read-only preview used exclusively by the local development test page. */
    public function calendarsForTest(array $properties, int $year, int $month): array
    {
        return $this->readCalendars($properties, $year, $month, true);
    }

    private function readCalendars(array $properties, int $year, int $month, bool $useProvider): array
    {
        BookingDates::month($year, $month);
        $rows = $pending = [];
        foreach ($properties as $property) {
            $slug = $property->getSlug();
            $rows[$slug] = $this->describe($property) + ['status' => 'unverified', 'days' => [], 'fetchedAt' => null];
            if (!$useProvider || !$property->isActive() || !$property->getGuestLuckyId()) { continue; }
            try {
                $item = $this->cache->getItem('guestlucky.'.$this->client->cacheNamespace().'.'.$property->getGuestLuckyId().'.'.$year.'.'.$month);
                if ($item->isHit()) {
                    $rows[$slug] = array_replace($rows[$slug], $item->get());
                    continue;
                }
                // Start every request before waiting for responses (HttpClient is lazy).
                $pending[$slug] = [$this->client->startCalendar($property->getGuestLuckyId(), $year, $month), $property, $item];
            } catch (\Throwable $error) { $this->logFailure($slug, 'calendar', $error); }
        }
        foreach ($pending as $slug => [$response, $property, $item]) {
            try {
                $result = ['status' => 'fresh', 'days' => $this->client->readCalendar($response, $property->getGuestLuckyId(), $year, $month), 'fetchedAt' => gmdate(DATE_ATOM)];
                $item->set($result)->expiresAfter(60);
                $this->cache->save($item);
                $rows[$slug] = array_replace($rows[$slug], $result);
            } catch (\Throwable $error) { $this->logFailure($slug, 'calendar', $error, $response); }
        }
        // The booking API can advertise one-night gaps despite the listing's
        // minimum. Apply the synchronized floor on every read, including cache hits.
        foreach ($properties as $property) {
            foreach ($rows[$property->getSlug()]['days'] as &$day) {
                $day['minStay'] = max($day['minStay'], $property->getMinimumStay() ?? 1);
            }
            unset($day);
        }
        return ['enabled' => $useProvider, 'year' => $year, 'month' => $month, 'properties' => array_values($rows)];
    }

    public function quotes(array $properties, string $arrival, string $departure, int $guests): array
    {
        return $this->readQuotes($properties, $arrival, $departure, $guests, $this->enabled);
    }

    /** Development preview: pricing is a GET and never creates a booking. */
    public function quotesForTest(array $properties, string $arrival, string $departure, int $guests): array
    {
        return $this->readQuotes($properties, $arrival, $departure, $guests, true);
    }

    private function readQuotes(array $properties, string $arrival, string $departure, int $guests, bool $useProvider): array
    {
        BookingDates::stay($arrival, $departure, $guests);
        $rows = $pending = [];
        foreach ($properties as $property) {
            $slug = $property->getSlug();
            $rows[$slug] = $this->describe($property) + ['status' => 'unverified', 'available' => false, 'price' => null, 'currency' => 'EUR', 'nights' => null, 'fees' => [], 'error' => null];
            if (!$useProvider || !$property->isActive() || !$property->getGuestLuckyId()) { continue; }
            $nights = (new \DateTimeImmutable($arrival))->diff(new \DateTimeImmutable($departure))->days;
            if ($guests > $property->getBookingCapacity() || $nights < ($property->getMinimumStay() ?? 1)) { $rows[$slug]['status'] = 'unavailable'; continue; }
            try { $pending[$slug] = [$this->client->startQuote($property->getGuestLuckyId(), $arrival, $departure, $guests), $property]; }
            catch (\Throwable $error) { $this->logFailure($slug, 'quote', $error); }
        }
        foreach ($pending as $slug => [$response, $property]) {
            try {
                $quote = $this->client->readQuote($response, $property->getGuestLuckyId(), $arrival, $departure, $guests);
                $rows[$slug] = array_replace($rows[$slug], $quote, ['status' => 'available', 'available' => true]);
            } catch (StayUnavailable) { $rows[$slug]['status'] = 'unavailable'; }
            catch (\Throwable $error) { $this->logFailure($slug, 'quote', $error, $response); }
        }
        return ['enabled' => $useProvider, 'arrivalDate' => $arrival, 'departureDate' => $departure, 'guests' => $guests, 'availability' => array_values($rows)];
    }

    private function describe(Property $property): array
    {
        $image = $property->getImages()->first();
        foreach ($property->getImages() as $candidate) { if ($candidate->isCover()) { $image = $candidate; break; } }
        return ['name' => $property->getTitle(), 'slug' => $property->getSlug(), 'city' => $property->getCity(), 'maxGuests' => $property->getBookingCapacity(), 'image' => $image ? \App\Media\PropertyImageUrl::resolve($image->getFilename()) : null];
    }

    private function logFailure(string $slug, string $operation, \Throwable $error, ?ResponseInterface $response = null): void
    {
        // Transport exceptions can contain the key; never log their message or URL.
        $reason = match (true) {
            $error instanceof TransportExceptionInterface => 'transport',
            $error instanceof DecodingExceptionInterface => 'invalid_json',
            $error instanceof \App\Integration\GuestLucky\GuestLuckyException => 'invalid_response',
            default => 'internal',
        };
        $context = ['property' => $slug, 'operation' => $operation, 'reason' => $reason];
        if ($response) {
            // Whitelist numeric diagnostics, never the full info array or URL.
            $context += ['retries' => (int) $response->getInfo('retry_count'),
                'connect_ms' => (int) round(1000 * (float) $response->getInfo('connect_time')),
                'transfer_start_ms' => (int) round(1000 * (float) $response->getInfo('starttransfer_time')),
                'last_attempt_ms' => (int) round(1000 * (float) $response->getInfo('total_time'))];
        }
        $this->logger->warning('GuestLucky read failed', $context);
    }
}
