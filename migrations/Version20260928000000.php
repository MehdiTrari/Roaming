<?php
declare(strict_types=1);
namespace DoctrineMigrations;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;
final class Version20260928000000 extends AbstractMigration
{
    public function getDescription(): string { return 'GuestLucky mapping and reversible archival; publish through catalogue import.'; }
    public function up(Schema $schema): void
    {
        $table = $schema->getTable('property');
        $table->addColumn('guest_lucky_id', 'integer', ['notnull' => false]);
        $table->addColumn('active', 'boolean', ['default' => false]);
        $table->addUniqueIndex(['guest_lucky_id'], 'uniq_property_guest_lucky');
    }
    public function down(Schema $schema): void
    {
        $table = $schema->getTable('property');
        $table->dropIndex('uniq_property_guest_lucky');
        $table->dropColumn('guest_lucky_id');
        $table->dropColumn('active');
    }
}
