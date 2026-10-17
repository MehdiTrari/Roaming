<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261018010000 extends AbstractMigration
{
    public function getDescription(): string { return 'Store exact public property addresses and verified map coordinates.'; }
    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE property ADD address VARCHAR(255) DEFAULT NULL, ADD latitude DOUBLE PRECISION DEFAULT NULL, ADD longitude DOUBLE PRECISION DEFAULT NULL');
    }
    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE property DROP address, DROP latitude, DROP longitude');
    }
}
