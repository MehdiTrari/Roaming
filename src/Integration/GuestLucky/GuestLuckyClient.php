<?php
namespace App\Integration\GuestLucky;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\ResponseInterface;
use Symfony\Component\HttpClient\Exception\TransportException;
use Symfony\Component\HttpClient\Retry\GenericRetryStrategy;
use Symfony\Component\HttpClient\RetryableHttpClient;

final class GuestLuckyClient
{
    public function __construct(private HttpClientInterface $http, private string $baseUrl, private string $bookingKey)
    {
        // Only these read-only GETs are retried, at most twice, for network failures.
        // A refusal, rate limit or invalid quote must keep its original meaning.
        // No logger here: transport exception messages can contain the key.
        $this->http = new RetryableHttpClient($http, new GenericRetryStrategy([0 => ['GET']], 150, 1, 150, 0), 2);
    }

    private function request(int $id, string $operation, array $query): ResponseInterface
    {
        if ($id < 1 || $this->bookingKey === '' || !str_starts_with($this->baseUrl, 'https://')) {
            throw new GuestLuckyException('GuestLucky is not configured.');
        }
        return $this->http->request('GET', rtrim($this->baseUrl, '/').'/api/v1/booking/listings/'.$id.'/'.$operation, [
            'query' => ['key' => $this->bookingKey] + $query,
            'timeout' => 8, 'max_duration' => 12, 'max_redirects' => 0,
            'headers' => ['Accept' => 'application/json'],
            'on_progress' => static function (int $downloaded, int $size, array $info): void {
                // A stalled connection used to consume the full idle timeout
                // before returning "unverified". Release it early and let the
                // bounded retry establish a fresh connection instead. Once TLS
                // is ready, retain the normal timeout for the provider's work.
                $ready = (float) ($info['pretransfer_time'] ?? $info['connect_time'] ?? 0) > 0;
                if (!$ready && (float) ($info['total_time'] ?? 0) >= 2.5) {
                    throw new TransportException('GuestLucky connection could not be established in time.');
                }
            },
        ]);
    }

    public function startCalendar(int $id, int $year, int $month): ResponseInterface
    {
        return $this->request($id, 'availability', ['year' => $year, 'month' => $month]);
    }

    public function readCalendar(ResponseInterface $response, int $id, int $year, int $month): array
    {
        $data = $this->read($response);
        if (($data['listing_id'] ?? null) !== $id || ($data['year'] ?? null) !== $year || ($data['month'] ?? null) !== $month || !is_array($data['days'] ?? null) || $data['days'] === []) {
            throw new GuestLuckyException('Incomplete calendar.');
        }
        $days = [];
        foreach ($data['days'] as $day) {
            if (!is_array($day) || !is_string($day['date'] ?? null) || !preg_match(sprintf('/^%04d-%02d-(?:0[1-9]|[12][0-9]|3[01])$/D', $year, $month), $day['date']) || !is_bool($day['available'] ?? null) || !$this->amount($day['price'] ?? null) || !is_int($day['min_stay'] ?? null) || $day['min_stay'] < 1 || isset($days[$day['date']])) {
                throw new GuestLuckyException('Invalid calendar.');
            }
            $days[$day['date']] = ['date' => $day['date'], 'available' => $day['available'], 'price' => $day['price'], 'minStay' => $day['min_stay']];
        }
        ksort($days);
        return array_values($days);
    }

    public function startQuote(int $id, string $arrival, string $departure, int $guests): ResponseInterface
    {
        return $this->request($id, 'pricing', ['checkin' => $arrival, 'checkout' => $departure, 'guests' => $guests, 'pets' => 0]);
    }

    public function readQuote(ResponseInterface $response, int $id, string $arrival, string $departure, int $guests): array
    {
        if ($response->getStatusCode() === 422) {
            $error = $response->toArray(false);
            if (($error['error'] ?? null) === 'Dates not available or constraints not met') { throw new StayUnavailable('Stay unavailable.'); }
            throw new GuestLuckyException('Unexpected quote rejection.');
        }
        $data = $this->read($response);
        $nights = (new \DateTimeImmutable($arrival))->diff(new \DateTimeImmutable($departure))->days;
        if (($data['listing_id'] ?? null) !== $id || ($data['checkin'] ?? null) !== $arrival || ($data['checkout'] ?? null) !== $departure || ($data['guests'] ?? null) !== $guests || ($data['nights'] ?? null) !== $nights || !$this->amount($data['total_price'] ?? null) || !in_array($data['currency'] ?? null, ['Euro', 'EUR'], true)) {
            throw new GuestLuckyException('Invalid quote.');
        }
        $fees = [];
        foreach (['subtotal_nightly', 'cleaning_fee', 'linen_fee', 'extra_guest_fee', 'pet_fee', 'service_fee', 'discount_amount', 'tax_amount'] as $field) {
            if (!$this->amount($data[$field] ?? null)) { throw new GuestLuckyException('Incomplete quote.'); }
            $fees[$field] = $data[$field];
        }
        return ['price' => $data['total_price'], 'currency' => 'EUR', 'nights' => $nights, 'fees' => $fees];
    }

    private function amount(mixed $value): bool
    {
        return (is_int($value) || is_float($value)) && is_finite((float) $value) && $value >= 0;
    }

    private function read(ResponseInterface $response): array
    {
        if ($response->getStatusCode() !== 200) { throw new GuestLuckyException('GuestLucky request failed.'); }
        $data = $response->toArray(false);
        if (isset($data['error'])) { throw new GuestLuckyException('GuestLucky returned an error.'); }
        return $data;
    }

    public function cacheNamespace(): string { return hash('sha256', $this->baseUrl.'|'.$this->bookingKey); }

    public function bookingUrl(int $id, string $arrival, string $departure, int $guests): string
    {
        return rtrim($this->baseUrl, '/').'/book/'.rawurlencode($this->bookingKey).'/'.$id.'?'.http_build_query(['checkin' => $arrival, 'checkout' => $departure, 'guests' => $guests]);
    }
}
