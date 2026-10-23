<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261023010000 extends AbstractMigration
{
    public function getDescription(): string { return 'Distinguish the online provider guest limit from the public property capacity without rewriting existing rows.'; }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE property ADD provider_capacity INT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE property DROP provider_capacity');
    }
}
