<?php
namespace App\Tests\GuestLucky;

use App\Service\VerifiedReviewProfiles;
use PHPUnit\Framework\TestCase;

final class VerifiedReviewProfilesTest extends TestCase
{
    private string $directory;
    private array $review = ['id' => 'airbnb:2467:123', 'propertyId' => 2467, 'channel' => 'airbnb', 'author' => '', 'text' => "Commentaire public\navec son texte original."];

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir().'/roaming-profiles-'.bin2hex(random_bytes(6));
        mkdir($this->directory.'/config', 0700, true);
        mkdir($this->directory.'/public/images/reviewers', 0700, true);
        file_put_contents($this->directory.'/public/images/reviewers/test.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg=='));
    }

    protected function tearDown(): void
    {
        foreach ([$this->directory.'/config/review_profiles.json', $this->directory.'/public/images/reviewers/test.png'] as $path) if (is_file($path)) unlink($path);
        foreach (['/public/images/reviewers', '/public/images', '/public', '/config', ''] as $part) rmdir($this->directory.$part);
    }

    private function profile(): array
    {
        return ['reviewId' => $this->review['id'], 'propertyId' => 2467, 'channel' => 'airbnb', 'textHash' => VerifiedReviewProfiles::textHash($this->review['text']), 'author' => 'Prénom public', 'avatar' => 'images/reviewers/test.png'];
    }

    private function feed(array $profiles): VerifiedReviewProfiles
    {
        file_put_contents($this->directory.'/config/review_profiles.json', json_encode(['version' => 1, 'profiles' => $profiles]));
        return new VerifiedReviewProfiles($this->directory.'/config/review_profiles.json');
    }

    public function testVerifiedIdentityRequiresExactReviewAndTextAndUsesOnlyLocalAvatar(): void
    {
        $feed = $this->feed([$this->profile()]);
        $rows = $feed->enrich([$this->review, array_replace($this->review, ['id' => 'airbnb:2467:456']), array_replace($this->review, ['text' => 'Un autre commentaire.']), array_replace($this->review, ['propertyId' => 999])]);
        self::assertSame('Prénom public', $rows[0]['author']);
        self::assertSame('images/reviewers/test.png', $rows[0]['avatar']);
        foreach (array_slice($rows, 1) as $row) { self::assertSame('', $row['author']); self::assertNull($row['avatar']); }
        self::assertSame('Prénom public', $feed->enrich([array_replace($this->review, ['text' => 'Commentaire public  avec son texte original.'])])[0]['author']);
    }

    public function testConflictingIdentityAndDuplicateVerificationCannotAssignAPhoto(): void
    {
        $row = $this->feed([$this->profile()])->enrich([array_replace($this->review, ['author' => 'Autre auteur'])])[0];
        self::assertSame('Autre auteur', $row['author']); self::assertNull($row['avatar']);
        $row = $this->feed([$this->profile(), array_replace($this->profile(), ['author' => 'Autre auteur'])])->enrich([$this->review])[0];
        self::assertSame('', $row['author']); self::assertNull($row['avatar']);
    }

    public function testRemoteOrMissingPhotosNeverLeakIntoThePage(): void
    {
        foreach (['https://example.test/photo.jpg', '../photo.jpg', 'images/reviewers/missing.jpg'] as $avatar) {
            $row = $this->feed([array_replace($this->profile(), ['avatar' => $avatar])])->enrich([$this->review])[0];
            self::assertSame('Prénom public', $row['author']); self::assertNull($row['avatar']);
        }
    }

    public function testMalformedOrMissingCatalogueKeepsExistingNamesWithoutInventingProfiles(): void
    {
        $feed = new VerifiedReviewProfiles($this->directory.'/config/review_profiles.json');
        self::assertSame('', $feed->enrich([$this->review])[0]['author']);
        file_put_contents($this->directory.'/config/review_profiles.json', '{broken');
        self::assertNull($feed->enrich([$this->review])[0]['avatar']);
    }
}
