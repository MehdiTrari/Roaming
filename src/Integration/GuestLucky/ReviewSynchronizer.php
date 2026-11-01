<?php
declare(strict_types=1);
namespace App\Integration\GuestLucky;

use App\Service\GuestReviewFeed;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

final class ReviewSynchronizer
{
    public function __construct(private McpClient $mcp, private GuestReviewFeed $feed,
        #[Autowire('%env(int:GUESTLUCKY_MCP_ACCOUNT_ID)%')] private int $expectedAccountId) {}

    /** GuestLucky's current contract uses text, including null for rating-only reviews. */
    public static function normalize(array $row, array $source): ?array
    {
        $propertyId = $row['property_id'] ?? (is_array($row['property'] ?? null) ? ($row['property']['id'] ?? null) : null);
        if ($propertyId !== null && (string) $propertyId !== (string) $source['propertyId']) throw new \RuntimeException('Avis associé à un autre logement.');
        if (strtolower((string) ($row['channel'] ?? '')) !== $source['channel']) throw new \RuntimeException('Plateforme d’avis incohérente.');
        $id = $row['id'] ?? null; $rating = $row['rating'] ?? null; $text = $row['text'] ?? null; $date = $row['submitted_at'] ?? null;
        if ((!is_int($id) && !is_string($id)) || trim((string) $id) === '' || strlen((string) $id) > 100 || !is_numeric($rating) || $rating < 1 || $rating > 5 || !array_key_exists('text', $row) || ($text !== null && !is_string($text)) || mb_strlen($text ?? '') > 20000 || !is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}(?:T| |$)/', $date)) throw new \RuntimeException('Avis incomplet ou note non prise en charge.');
        try { $published = new \DateTimeImmutable($date); } catch (\Exception) { throw new \RuntimeException('Date d’avis invalide.'); }
        if ($published->format('Y-m-d') !== substr($date, 0, 10) || $published > new \DateTimeImmutable('+1 day')) throw new \RuntimeException('Date d’avis invalide.');
        $text = trim(strip_tags($text ?? ''));
        // Booking splits the public comment into positive and negative portions.
        // Keep both; Airbnb's private feedback is never imported.
        if ($source['channel'] === 'booking') {
            $negative = $row['negative_feedback'] ?? null;
            if (!array_key_exists('negative_feedback', $row) || ($negative !== null && (!is_string($negative) || mb_strlen($negative) > 20000))) throw new \RuntimeException('Commentaire Booking invalide.');
            $negative = trim(strip_tags($negative ?? ''));
            if ($negative !== '') $text = $text !== '' ? $text."\n\n".$negative : $negative;
        }
        $name = trim(strip_tags(is_string($row['guest_name'] ?? null) ? $row['guest_name'] : ''));
        // Only the public first name, no full name, avatar, booking reference or host reply.
        $author = $name !== '' ? mb_substr(preg_split('/\s+/u', $name)[0], 0, 80) : '';
        return ['id' => $source['channel'].':'.$source['propertyId'].':'.$id, 'propertyId' => $source['propertyId'], 'channel' => $source['channel'], 'author' => $author, 'rating' => (float) $rating, 'text' => $text, 'date' => $published->format('Y-m-d')];
    }

    public function synchronize(bool $apply): array
    {
        $path = $this->feed->snapshotPath(); $directory = dirname($path);
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) throw new \RuntimeException('Répertoire des avis inaccessible.');
        $lock = fopen($path.'.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) { if ($lock) fclose($lock); return ['busy' => true, 'count' => 0]; }
        try {
            $identity = $this->mcp->identity();
            if ($this->expectedAccountId < 1 || ($identity['account_owner_id'] ?? null) !== $this->expectedAccountId) throw new \RuntimeException('Compte GuestLucky non autorisé.');
            $config = $this->feed->configuration(); $reviews = []; $seen = [];
            foreach ($this->feed->synchronizationSources() as $source) foreach ($this->mcp->guestReviews($source['propertyId'], $source['channel']) as $row) {
                $review = self::normalize($row, $source);
                if ($review === null || in_array($review['id'], $config['excludedReviewIds'], true)) continue;
                if (isset($seen[$review['id']])) throw new \RuntimeException('Avis dupliqué.');
                $seen[$review['id']] = true; $reviews[] = $review;
            }
            if ($apply) {
                $data = ['version' => 2, 'synchronizedAt' => date(DATE_ATOM), 'reviews' => $reviews];
                $temporary = $path.'.'.bin2hex(random_bytes(6)).'.tmp';
                try {
                    if (file_put_contents($temporary, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR), LOCK_EX) === false) throw new \RuntimeException('Écriture des avis impossible.');
                    chmod($temporary, 0600);
                    if (!rename($temporary, $path)) throw new \RuntimeException('Remplacement des avis impossible.');
                } finally { if (is_file($temporary)) unlink($temporary); }
            }
            return ['busy' => false, 'count' => count($reviews)];
        } finally { flock($lock, LOCK_UN); fclose($lock); }
    }
}
