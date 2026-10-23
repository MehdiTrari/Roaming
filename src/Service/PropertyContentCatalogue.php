<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Property;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/** Reviewed editorial data, separate from the reservation provider's operational fields. */
final class PropertyContentCatalogue
{
    private ?array $entries = null;
    private const TEXT_FIELDS = ['title', 'type', 'shortDescription', 'description', 'about', 'accommodation', 'guestAccess', 'otherRemarks', 'shortDescriptionEn', 'aboutEn', 'accommodationEn', 'guestAccessEn', 'otherRemarksEn', 'airbnbUrl'];
    private const INTEGER_FIELDS = ['travelers', 'bedrooms', 'beds', 'area'];

    public function __construct(#[Autowire('%kernel.project_dir%/config/property_content.json')] private string $file) {}

    public function entries(): array
    {
        if ($this->entries !== null) return $this->entries;
        $data = json_decode(file_get_contents($this->file), true, flags: JSON_THROW_ON_ERROR);
        $rows = $data['properties'] ?? null;
        if (!is_array($rows) || !$rows || !array_is_list($rows) || empty($data['source']) || empty($data['confirmedAt'])) {
            throw new \InvalidArgumentException('A non-empty reviewed property content catalogue is required.');
        }
        $ids = $slugs = [];
        foreach ($rows as &$row) {
            if (!is_int($row['guestLuckyId'] ?? null) || $row['guestLuckyId'] < 1 || !is_string($row['slug'] ?? null) || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $row['slug']) || !is_string($row['city'] ?? null) || trim($row['city']) === '' || !is_array($row['fields'] ?? null) || !is_array($row['amenities'] ?? null) || !array_is_list($row['amenities'])) {
                throw new \InvalidArgumentException('Invalid property content identity.');
            }
            if (isset($ids[$row['guestLuckyId']]) || isset($slugs[$row['slug']])) throw new \InvalidArgumentException('Duplicate editorial property mapping.');
            $ids[$row['guestLuckyId']] = $slugs[$row['slug']] = true;
            foreach ($row['fields'] as $field => $value) {
                $valid = in_array($field, self::TEXT_FIELDS, true) ? is_string($value) && trim($value) !== '' : (in_array($field, self::INTEGER_FIELDS, true) ? is_int($value) && $value > 0 : ($field === 'bathrooms' && is_numeric($value) && $value > 0));
                if (!$valid) throw new \InvalidArgumentException('Invalid or unsupported editorial field: '.$field);
            }
            foreach (['title', 'travelers', 'airbnbUrl', 'shortDescription', 'about', 'shortDescriptionEn', 'aboutEn'] as $required) {
                if (!array_key_exists($required, $row['fields'])) throw new \InvalidArgumentException('Missing bilingual editorial field: '.$required);
            }
            if (!preg_match('~^https://www\.airbnb\.fr/rooms/[0-9]+$~D', $row['fields']['airbnbUrl']) || mb_strlen($row['fields']['title']) > 180) throw new \InvalidArgumentException('Invalid official Airbnb URL or title.');
            foreach ($row['amenities'] as $name) {
                if (!is_string($name) || !preg_match('/^amenities\.[a-z_]+$/D', $name)) throw new \InvalidArgumentException('Invalid amenity translation key.');
            }
            $row['amenities'] = array_values(array_unique($row['amenities']));
            if (isset($row['fields']['bathrooms'])) $row['fields']['bathrooms'] = (float) $row['fields']['bathrooms'];
        }
        unset($row);
        return $this->entries = $rows;
    }

    public function forProviderId(int $id): ?array
    {
        foreach ($this->entries() as $entry) if ($entry['guestLuckyId'] === $id) return $entry;
        return null;
    }

    public function assertMatches(Property $property, array $entry): void
    {
        if ($property->getGuestLuckyId() !== $entry['guestLuckyId'] || $property->getSlug() !== $entry['slug'] || mb_strtolower(trim($property->getCity() ?? '')) !== mb_strtolower(trim($entry['city']))) {
            throw new \InvalidArgumentException('Editorial identity mismatch for '.$entry['slug'].'. No property was updated.');
        }
    }

    /** @return array<string, array{before: mixed, after: mixed}> */
    public function changes(Property $property, array $entry): array
    {
        $this->assertMatches($property, $entry);
        $changes = [];
        foreach ($entry['fields'] as $field => $value) {
            $before = $property->{'get'.ucfirst($field)}();
            if ($before !== $value) $changes[$field] = ['before' => $before, 'after' => $value];
        }
        // Ratings from a different listing must not follow an editorial URL correction.
        if ($property->getAirbnbUrl() !== $entry['fields']['airbnbUrl']) {
            foreach (['airbnbRating', 'airbnbReviewsCount'] as $field) {
                $before = $property->{'get'.ucfirst($field)}();
                if ($before !== null) $changes[$field] = ['before' => $before, 'after' => null];
            }
        }
        return $changes;
    }

    public function apply(Property $property, array $entry): bool
    {
        $changes = $this->changes($property, $entry);
        foreach ($changes as $field => $change) $property->{'set'.ucfirst($field)}($change['after']);
        return $changes !== [];
    }
}
