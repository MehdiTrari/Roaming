<?php
declare(strict_types=1);
namespace App\Integration\GuestLucky;

use App\Repository\PropertyRepository;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\String\Slugger\SluggerInterface;

final class CatalogueSynchronizer
{
    public function __construct(private McpClient $mcp, private CatalogueImporter $importer, private PropertyRepository $properties,
        private SluggerInterface $slugger, #[Autowire('%env(int:GUESTLUCKY_MCP_ACCOUNT_ID)%')] private int $expectedAccountId) {}

    public function synchronize(bool $apply = false): array
    {
        $identity = $this->mcp->identity();
        if ($this->expectedAccountId < 1 || ($identity['account_owner_id'] ?? null) !== $this->expectedAccountId || !is_string($identity['company'] ?? null) || trim($identity['company']) === '') {
            throw new \RuntimeException('Le compte MCP ne correspond pas au compte GuestLucky autorisé.');
        }
        $rows = $this->mcp->properties();
        $existing = $taken = [];
        foreach ($this->properties->findAll() as $property) {
            if ($property->getGuestLuckyId() !== null) { $existing[$property->getGuestLuckyId()] = $property; }
            $taken[$property->getSlug()] = $property->getGuestLuckyId();
        }
        $mapped = [];
        foreach ($rows as $row) {
            $id = $row['id']; $property = $existing[$id] ?? null;
            $name = $row['name'] ?? null; $capacity = $row['capacity'] ?? null;
            if (!is_string($name) || trim($name) === '' || !is_int($capacity) || $capacity < 1) { throw new \RuntimeException('Nom ou capacité manquante pour le logement '.$id.'. Aucun import effectué.'); }
            $city = is_string($row['city'] ?? null) ? trim($row['city']) : '';
            if ($city === '' && is_string($row['address'] ?? null) && preg_match('/\b\d{5}\s+([^,\r\n]+)(?:,.*)?$/u', $row['address'], $match)) {
                $city = trim(preg_replace('/\s+France$/iu', '', $match[1]));
            }
            if ($city === '') { $city = $property?->getCity() ?? ''; }
            if ($city === '') { throw new \RuntimeException('Ville non identifiable pour le logement '.$id.'. Complétez son adresse GuestLucky avant de synchroniser.'); }
            $slug = $property?->getSlug();
            if (!$slug) {
                $slugName = preg_replace('/[^\p{L}\p{N}\s-]/u', ' ', $name);
                $base = trim(substr(strtolower((string) $this->slugger->slug($slugName)), 0, 160), '-');
                $slug = ($base ?: 'logement').'-'.$id;
                if (array_key_exists($slug, $taken)) { throw new \RuntimeException('Un slug local entre en conflit avec le logement '.$id.'.'); }
            }
            $taken[$slug] = $id;
            $minimum = $row['min_stay'] ?? null;
            if ($minimum !== null && (!is_int($minimum) || $minimum < 1)) { throw new \RuntimeException('Minimum de nuits invalide pour le logement '.$id.'. Aucun import effectué.'); }
            $mappedRow = ['id' => $id, 'slug' => $slug, 'name' => trim($name), 'city' => $city, 'capacity' => $capacity, 'minStay' => $minimum];
            if (is_string($row['address'] ?? null) && trim($row['address']) !== '') $mappedRow['address'] = trim($row['address']);
            $mapped[] = $mappedRow;
        }
        $catalogue = ['source' => 'GuestLucky MCP', 'account' => $identity['company'], 'accountId' => $this->expectedAccountId,
            'verifiedAt' => (new \DateTimeImmutable('now', new \DateTimeZone('Europe/Paris')))->format(DATE_ATOM), 'complete' => true, 'total' => count($mapped), 'properties' => $mapped];
        // Automated synchronizations only add/update. Removal is an explicit editorial decision.
        return ['catalogue' => $catalogue, 'report' => $this->importer->import($catalogue, $apply, archiveMissing: false)];
    }
}
