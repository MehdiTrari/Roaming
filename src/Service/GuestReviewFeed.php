<?php
declare(strict_types=1);
namespace App\Service;

use App\Repository\PropertyRepository;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/** Public-only snapshot. Never read historical/demo rows from the Review entity. */
final class GuestReviewFeed
{
    public function __construct(private PropertyRepository $properties,
        #[Autowire('%kernel.project_dir%/config/review_sources.json')] private string $configuration,
        #[Autowire('%kernel.project_dir%/var/guestlucky/reviews.json')] private string $snapshot,
        private ?VerifiedReviewProfiles $profiles = null) {}

    public function configuration(): array
    {
        $config = json_decode(file_get_contents($this->configuration), true, flags: JSON_THROW_ON_ERROR);
        if (!is_array($config['publicChannels'] ?? null) || !array_is_list($config['publicChannels']) || array_diff($config['publicChannels'], ['airbnb', 'booking'])) throw new \RuntimeException('Canaux de publication invalides.');
        $seen = [];
        foreach ($config['sources'] ?? [] as $source) {
            if (!is_int($source['propertyId'] ?? null) || $source['propertyId'] < 1 || !in_array($source['channel'] ?? null, ['airbnb', 'booking'], true)) throw new \RuntimeException('Source d’avis invalide.');
            $host = parse_url($source['url'] ?? '', PHP_URL_HOST);
            $hosts = $source['channel'] === 'airbnb' ? ['www.airbnb.fr', 'www.airbnb.com'] : ['www.booking.com'];
            if (parse_url($source['url'], PHP_URL_SCHEME) !== 'https' || !in_array($host, $hosts, true) || isset($seen[$source['channel'].':'.$source['propertyId']])) throw new \RuntimeException('Lien ou source d’avis invalide.');
            $seen[$source['channel'].':'.$source['propertyId']] = true;
        }
        if (!is_array($config['sources'] ?? null) || !is_array($config['excludedReviewIds'] ?? null)) throw new \RuntimeException('Configuration des avis incomplète.');
        return $config;
    }

    public function snapshotPath(): string { return $this->snapshot; }

    /** Every active GuestLucky property is read, even without an external listing URL. */
    public function synchronizationSources(): array
    {
        $config = $this->configuration(); $sources = [];
        foreach ($this->properties->findActive() as $property) {
            if (!$property->getGuestLuckyId()) continue;
            foreach ($config['publicChannels'] as $channel) $sources[] = ['propertyId' => $property->getGuestLuckyId(), 'channel' => $channel];
        }
        return $sources;
    }

    public function publicFeed(): array
    {
        $config = $this->configuration(); $active = []; $sources = []; $links = [];
        foreach ($this->properties->findActive() as $property) $active[$property->getGuestLuckyId()] = $property;
        foreach ($config['sources'] as $source) $links[$source['channel'].':'.$source['propertyId']] = $source['url'];
        foreach ($this->synchronizationSources() as $source) {
            $key = $source['channel'].':'.$source['propertyId'];
            $sources[$key] = $source + ['property' => $active[$source['propertyId']], 'url' => $links[$key] ?? null];
        }
        $snapshot = [];
        if (is_file($this->snapshot)) {
            try { $snapshot = json_decode(file_get_contents($this->snapshot), true, flags: JSON_THROW_ON_ERROR); } catch (\JsonException) {}
        }
        $reviews = [];
        $rows = is_array($snapshot) && ($snapshot['version'] ?? null) === 2 && is_array($snapshot['reviews'] ?? null) ? $snapshot['reviews'] : [];
        foreach ($rows as $review) {
            if (!is_array($review)) continue;
            $source = $sources[($review['channel'] ?? '').':'.($review['propertyId'] ?? '')] ?? null;
            if (!$source || in_array($review['id'] ?? null, $config['excludedReviewIds'], true)) continue;
            if (!is_string($review['text'] ?? null) || !is_string($review['author'] ?? null) || !is_numeric($review['rating'] ?? null) || $review['rating'] < 1 || $review['rating'] > 5 || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $review['date'] ?? '')) continue;
            $reviews[] = $review + ['property' => $source['property'], 'sourceUrl' => $source['url'], 'sourceLabel' => $review['channel'] === 'airbnb' ? 'Airbnb' : 'Booking.com'];
        }
        usort($reviews, static fn ($a, $b) => [$b['date'], $b['id']] <=> [$a['date'], $a['id']]);
        // Keep the homepage bounded; the private snapshot retains the complete history.
        $reviews = array_slice($reviews, 0, 24);
        $reviews = $this->profiles ? $this->profiles->enrich($reviews) : array_map(static fn ($review) => $review + ['avatar' => null], $reviews);
        return ['reviews' => $reviews, 'sources' => array_values($sources)];
    }
}
