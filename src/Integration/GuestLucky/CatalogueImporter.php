<?php
namespace App\Integration\GuestLucky;
use App\Entity\Property;
use App\Repository\PropertyRepository;
use Doctrine\ORM\EntityManagerInterface;

final class CatalogueImporter
{
    public function __construct(private EntityManagerInterface $em, private PropertyRepository $properties) {}

    public static function validate(array $catalogue): array
    {
        $rows = $catalogue['properties'] ?? null;
        if (($catalogue['complete'] ?? false) !== true || ($catalogue['source'] ?? '') !== 'GuestLucky MCP' || empty($catalogue['account']) || empty($catalogue['verifiedAt']) || !is_array($rows) || !$rows || !array_is_list($rows) || ($catalogue['total'] ?? null) !== count($rows)) {
            throw new \InvalidArgumentException('A complete, non-empty, verified MCP catalogue is required.');
        }
        $ids = $slugs = [];
        foreach ($rows as $row) {
            if (!is_array($row) || !is_int($row['id'] ?? null) || $row['id'] < 1 || !is_int($row['capacity'] ?? null) || $row['capacity'] < 1 || !is_string($row['slug'] ?? null) || !preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/D', $row['slug']) || strlen($row['slug']) > 180 || !is_string($row['name'] ?? null) || trim($row['name']) === '' || mb_strlen($row['name']) > 180 || !is_string($row['city'] ?? null) || trim($row['city']) === '' || mb_strlen($row['city']) > 120) {
                throw new \InvalidArgumentException('Invalid catalogue property.');
            }
            if (isset($ids[$row['id']]) || isset($slugs[$row['slug']])) { throw new \InvalidArgumentException('Duplicate mapping.'); }
            $ids[$row['id']] = $slugs[$row['slug']] = true;
        }
        return $rows;
    }

    public function import(array $catalogue, bool $apply = false): array
    {
        $rows = self::validate($catalogue);
        if ($apply) {
            return $this->em->wrapInTransaction(fn () => $this->run($rows, true));
        }
        return $this->run($rows, false);
    }

    private function run(array $rows, bool $apply): array
    {
        $existing = $this->properties->findAll();
        $byId = $bySlug = [];
        foreach ($existing as $property) {
            if ($property->getGuestLuckyId() !== null) { $byId[$property->getGuestLuckyId()] = $property; }
            $bySlug[$property->getSlug()] = $property;
        }
        $changes = $keep = [];
        // Resolve and validate ALL mappings before making any changes.
        foreach ($rows as $row) {
            $idMatch = $byId[$row['id']] ?? null;
            $slugMatch = $bySlug[$row['slug']] ?? null;
            if (($idMatch && $slugMatch && $idMatch !== $slugMatch) || ($slugMatch && $slugMatch->getGuestLuckyId() !== null && $slugMatch->getGuestLuckyId() !== $row['id'])) {
                throw new \InvalidArgumentException('Conflicting mapping for '.$row['slug']);
            }
            $property = $idMatch ?? $slugMatch;
            if ($property) { $keep[spl_object_id($property)] = true; }
            $changes[] = [$property ? 'update' : 'create', $property, $row];
        }
        foreach ($existing as $property) {
            if (!isset($keep[spl_object_id($property)]) && $property->isActive()) { $changes[] = ['archive', $property, null]; }
        }
        $report = [];
        foreach ($changes as [$action, $property, $row]) {
            $report[] = ['action' => $action, 'slug' => $property?->getSlug() ?? $row['slug']];
            if (!$apply) { continue; }
            if ($action === 'archive') { $property->setActive(false); continue; }
            if (!$property) { $property = (new Property())->setSlug($row['slug']); $this->em->persist($property); }
            $property->setGuestLuckyId($row['id'])->setActive(true)->setTitle($row['name'])->setCity($row['city'])->setTravelers($row['capacity']);
        }
        return $report;
    }
}
