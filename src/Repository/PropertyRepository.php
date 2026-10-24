<?php
namespace App\Repository;
use App\Entity\Property;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<Property> */
class PropertyRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry) { parent::__construct($registry, Property::class); }
    /** @return Property[] */
    public function findActive(array $orderBy = ['title' => 'ASC'], ?int $limit = null): array
    {
        return $this->findBy(['active' => true], $orderBy, $limit);
    }
    public function findActiveSlug(string $slug): ?Property
    {
        return $this->findOneBy(['slug' => $slug, 'active' => true]);
    }
    /** Load card images in one query, without truncating fetch-joined collections. @return Property[] */
    public function findActiveWithImages(array $orderBy = ['title' => 'ASC'], ?int $limit = null): array
    {
        $properties = $this->findActive($orderBy, $limit);
        if ($properties !== []) {
            $this->createQueryBuilder('p')->addSelect('image')->leftJoin('p.images', 'image')
                ->where('p IN (:properties)')->setParameter('properties', $properties)
                ->orderBy('image.position', 'ASC')->addOrderBy('image.id', 'ASC')->getQuery()->getResult();
        }
        return $properties;
    }
}
