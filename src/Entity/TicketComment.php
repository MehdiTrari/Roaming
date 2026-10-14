<?php
declare(strict_types=1);
namespace App\Entity;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
class TicketComment
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    private ?int $id = null;
    #[ORM\ManyToOne, ORM\JoinColumn(nullable: false)]
    public TestTicket $ticket;
    #[ORM\ManyToOne, ORM\JoinColumn(nullable: false)]
    public TeamUser $author;
    #[ORM\Column(type: 'text')]
    public string $body;
    #[ORM\Column]
    public \DateTimeImmutable $createdAt;
    public function __construct(TestTicket $ticket, TeamUser $author, string $body)
    { $this->ticket = $ticket; $this->author = $author; $this->body = $body; $this->createdAt = new \DateTimeImmutable(); }
    public function getId(): ?int { return $this->id; }
}
