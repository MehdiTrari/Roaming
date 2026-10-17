<?php
declare(strict_types=1);
namespace DoctrineMigrations;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017000000 extends AbstractMigration
{
    public function getDescription(): string { return 'Add custom labels to private team tickets, preserving existing tickets.'; }
    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE test_ticket ADD labels JSON DEFAULT NULL');
        $this->addSql("UPDATE test_ticket SET labels = '[]' WHERE labels IS NULL");
        if ($this->connection->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\AbstractMySQLPlatform) {
            $this->addSql('ALTER TABLE test_ticket MODIFY labels JSON NOT NULL');
        }
    }
    public function down(Schema $schema): void { $this->addSql('ALTER TABLE test_ticket DROP COLUMN labels'); }
}
