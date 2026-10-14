<?php
declare(strict_types=1);
namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[ORM\Entity]
#[ORM\Table(name: 'team_user')]
class TeamUser implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    private ?int $id = null;
    #[ORM\Column(length: 180, unique: true)]
    private string $email;
    #[ORM\Column(length: 120)]
    private string $name;
    #[ORM\Column]
    private string $password = '';
    #[ORM\Column(type: 'json')]
    private array $roles = [];

    public function __construct(string $email, string $name) { $this->email = strtolower(trim($email)); $this->name = $name; }
    public function getId(): ?int { return $this->id; }
    public function getEmail(): string { return $this->email; }
    public function getName(): string { return $this->name; }
    public function getUserIdentifier(): string { return $this->email; }
    public function getPassword(): string { return $this->password; }
    public function setPassword(string $password): void { $this->password = $password; }
    public function getRoles(): array { return array_values(array_unique([...$this->roles, 'ROLE_TESTER'])); }
    public function setAdmin(bool $admin): void { $this->roles = $admin ? ['ROLE_ADMIN'] : []; }
    public function eraseCredentials(): void {}
    public function __serialize(): array
    {
        $data = (array) $this;
        $data["\0".self::class."\0password"] = hash('crc32c', $this->password);
        return $data;
    }
}
