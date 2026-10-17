<?php
declare(strict_types=1);
namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017220000 extends AbstractMigration
{
    public function getDescription(): string { return 'Store the minimum stay synchronized from GuestLucky for each property.'; }
    public function up(Schema $schema): void { $this->addSql('ALTER TABLE property ADD minimum_stay INT DEFAULT NULL'); }
    public function down(Schema $schema): void { $this->addSql('ALTER TABLE property DROP COLUMN minimum_stay'); }
}
