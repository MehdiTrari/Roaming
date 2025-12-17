<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251212112221 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE property ADD short_description_en TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE property ADD about_en TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE property ADD accommodation_en TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE property ADD guest_access_en TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE property ADD other_remarks_en TEXT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE property DROP short_description_en');
        $this->addSql('ALTER TABLE property DROP about_en');
        $this->addSql('ALTER TABLE property DROP accommodation_en');
        $this->addSql('ALTER TABLE property DROP guest_access_en');
        $this->addSql('ALTER TABLE property DROP other_remarks_en');
    }
}
