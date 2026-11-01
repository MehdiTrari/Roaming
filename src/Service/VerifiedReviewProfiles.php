<?php
declare(strict_types=1);
namespace App\Service;

use Symfony\Component\DependencyInjection\Attribute\Autowire;

/** Public profiles verified on the original review, never inferred from bookings. */
final class VerifiedReviewProfiles
{
    public function __construct(
        #[Autowire('%kernel.project_dir%/config/review_profiles.json')] private string $path,
    ) {}

    public static function textHash(string $text): string
    {
        return hash('sha256', preg_replace('/\s+/u', ' ', trim($text)) ?? $text);
    }

    public function enrich(array $reviews): array
    {
        $profiles = [];
        try {
            $data = is_file($this->path) ? json_decode(file_get_contents($this->path), true, flags: JSON_THROW_ON_ERROR) : [];
        } catch (\JsonException) { $data = []; }
        foreach (($data['version'] ?? null) === 1 ? ($data['profiles'] ?? []) : [] as $profile) {
            if (!is_array($profile) || !is_int($profile['propertyId'] ?? null) || !in_array($profile['channel'] ?? null, ['airbnb', 'booking'], true)
                || !is_string($profile['textHash'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $profile['textHash'])
                || !is_string($profile['reviewId'] ?? null) || !str_starts_with($profile['reviewId'], $profile['channel'].':'.$profile['propertyId'].':')
                || !is_string($profile['author'] ?? null) || trim($profile['author']) === '' || mb_strlen($profile['author']) > 80 || strip_tags($profile['author']) !== $profile['author']) continue;
            $key = $profile['reviewId'].':'.$profile['textHash'];
            // Conflicting/duplicate records never assign a potentially wrong identity.
            $profiles[$key] = array_key_exists($key, $profiles) ? null : $profile;
        }
        foreach ($reviews as &$review) {
            $profile = trim($review['text']) !== '' ? ($profiles[$review['id'].':'.self::textHash($review['text'])] ?? null) : null;
            $review['avatar'] = null;
            if (!$profile || $profile['propertyId'] !== $review['propertyId'] || $profile['channel'] !== $review['channel']) continue;
            if ($review['author'] !== '' && mb_strtolower($review['author']) !== mb_strtolower(trim($profile['author']))) continue;
            if ($review['author'] === '') $review['author'] = trim($profile['author']);
            // Only reviewed local image assets may be served, never arbitrary remote URLs.
            $avatar = $profile['avatar'] ?? null;
            if (is_string($avatar) && preg_match('~^images/reviewers/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$~D', $avatar)
                && is_file(dirname($this->path, 2).'/public/'.$avatar)) $review['avatar'] = $avatar;
        }
        return $reviews;
    }
}
