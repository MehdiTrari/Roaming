<?php
declare(strict_types=1);
namespace App\Integration\GuestLucky;

use App\Entity\PropertyImage;
use App\Repository\PropertyRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

final class PhotoSynchronizer
{
    public function __construct(private PhotoClient $client, private PropertyRepository $properties, private EntityManagerInterface $em,
        #[Autowire('%app.guestlucky_photo_preserved_ids%')] private array $preservedIds,
        #[Autowire('%kernel.project_dir%/var/guestlucky')] private string $directory) {}

    public function synchronize(bool $apply = false): array
    {
        if (!is_dir($this->directory) && !mkdir($this->directory, 0700, true) && !is_dir($this->directory)) throw new \RuntimeException('Photo sync directory unavailable.');
        $lock = fopen($this->directory.'/photos.lock', 'c');
        if (!$lock) throw new \RuntimeException('Photo sync lock unavailable.');
        if (!flock($lock, LOCK_EX | LOCK_NB)) { fclose($lock); return ['busy' => true, 'report' => []]; }
        $state = json_decode(@file_get_contents($this->directory.'/photos-status.json') ?: '{}', true) ?: [];
        $attempt = date(DATE_ATOM);
        try {
            $plans = $report = $backup = [];
            foreach ($this->properties->findActive() as $property) {
                $id = $property->getGuestLuckyId(); $before = array_values($property->getImages()->toArray());
                usort($before, static fn (PropertyImage $a, PropertyImage $b) => [$a->getPosition(), $a->getId()] <=> [$b->getPosition(), $b->getId()]);
                if (!$id || in_array($id, $this->preservedIds, true)) {
                    $report[] = ['slug' => $property->getSlug(), 'action' => 'preserved', 'before' => count($before), 'after' => count($before)]; continue;
                }
                // Validate all galleries before changing any association.
                $urls = $this->client->photos($id); $changed = count($urls) !== count($before);
                foreach ($before as $index => $image) {
                    if (($urls[$index] ?? null) !== $image->getFilename() || $image->getPosition() !== $index || $image->isCover() !== ($index === 0)) $changed = true;
                }
                $report[] = ['slug' => $property->getSlug(), 'action' => $changed ? 'replace' : 'unchanged', 'before' => count($before), 'after' => count($urls)];
                if (!$changed) continue;
                $plans[] = [$property, $urls, $before];
                $backup[] = ['propertyId' => $property->getId(), 'providerId' => $id, 'slug' => $property->getSlug(), 'images' => array_map(static fn (PropertyImage $image) => [
                    'id' => $image->getId(), 'filename' => $image->getFilename(), 'alt' => $image->getAlt(), 'position' => $image->getPosition(), 'isCover' => $image->isCover(), 'createdAt' => $image->getCreatedAt()->format(DATE_ATOM),
                ], $before)];
            }
            if ($apply) {
                if ($plans) $this->save('photos-backup-'.date('Ymd-His').'-'.bin2hex(random_bytes(4)).'.json', ['at' => $attempt, 'properties' => $backup]);
                $this->em->wrapInTransaction(function () use ($plans): void {
                    foreach ($plans as [$property, $urls, $before]) {
                        $byUrl = [];
                        foreach ($before as $image) {
                            $url = $image->getFilename();
                            if (!in_array($url, $urls, true) || isset($byUrl[$url])) { $property->removeImage($image); $this->em->remove($image); }
                            else $byUrl[$url] = $image;
                        }
                        foreach ($urls as $position => $url) {
                            $image = $byUrl[$url] ?? new PropertyImage();
                            $image->setFilename($url)->setPosition($position)->setIsCover($position === 0);
                            $property->addImage($image); $this->em->persist($image);
                        }
                        $property->setUpdatedAt(new \DateTimeImmutable());
                    }
                });
                $this->save('photos-status.json', ['lastAttemptAt' => $attempt, 'lastSuccessAt' => date(DATE_ATOM), 'status' => 'ok', 'error' => null, 'report' => $report]);
            }
            return ['busy' => false, 'report' => $report];
        } catch (\Throwable) {
            if ($apply) {
                $state['lastAttemptAt'] = $attempt; $state['status'] = 'error'; $state['error'] = 'Photo sync failed; last valid galleries retained.';
                try { $this->save('photos-status.json', $state); } catch (\Throwable) {}
            }
            throw new \RuntimeException('Synchronisation des photos impossible. Les dernières galeries valides sont conservées.');
        } finally { flock($lock, LOCK_UN); fclose($lock); }
    }

    private function save(string $filename, array $data): void
    {
        $path = $this->directory.'/'.$filename; $temporary = $path.'.'.bin2hex(random_bytes(4)).'.tmp';
        if (file_put_contents($temporary, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), LOCK_EX) === false) throw new \RuntimeException('Photo sync journal unavailable.');
        chmod($temporary, 0600);
        if (!rename($temporary, $path)) { @unlink($temporary); throw new \RuntimeException('Photo sync journal update failed.'); }
    }
}
