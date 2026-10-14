<?php
declare(strict_types=1);
namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
class TestTicket
{
    public const CATEGORIES = ['bug', 'display', 'suggestion'];
    public const STATUSES = ['new', 'in_progress', 'retest', 'resolved', 'dismissed'];
    public const PRIORITIES = ['low', 'normal', 'high'];
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    private ?int $id = null;
    #[ORM\ManyToOne, ORM\JoinColumn(nullable: false)]
    public TeamUser $author;
    #[ORM\Column(length: 180)]
    public string $title;
    #[ORM\Column(length: 20)]
    public string $category;
    #[ORM\Column(type: 'text')]
    public string $description;
    #[ORM\Column(type: 'text')]
    public string $steps;
    #[ORM\Column(type: 'text')]
    public string $expected;
    #[ORM\Column(length: 2048)]
    public string $page = '/';
    #[ORM\Column(length: 500)]
    public string $browser = '';
    #[ORM\Column(length: 40)]
    public string $screen = '';
    #[ORM\Column(length: 20)]
    public string $status = 'new';
    #[ORM\Column(length: 20)]
    public string $priority = 'normal';
    #[ORM\Column(length: 64, nullable: true)]
    public ?string $attachment = null;
    #[ORM\Column(length: 30, nullable: true)]
    public ?string $attachmentMime = null;
    #[ORM\Column]
    public \DateTimeImmutable $createdAt;
    public function __construct() { $this->createdAt = new \DateTimeImmutable(); }
    public function getId(): ?int { return $this->id; }
}
