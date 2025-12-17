<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251212105922 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE property ADD type VARCHAR(50) DEFAULT NULL');
        $this->addSql('ALTER TABLE property ADD short_description TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE property ADD other_remarks TEXT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE property DROP type');
        $this->addSql('ALTER TABLE property DROP short_description');
        $this->addSql('ALTER TABLE property DROP other_remarks');
    }
}
