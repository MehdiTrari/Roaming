<?php
declare(strict_types=1);
namespace App\Tests\Team;
use Doctrine\DBAL\DriverManager;
use Doctrine\DBAL\Schema\Schema;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
final class TicketMigrationTest extends TestCase
{
    public function testMigrationCreatesAndReversesTheThreeTables(): void
    {
        if (!extension_loaded('pdo_sqlite')) { self::markTestSkipped('Requires pdo_sqlite.'); }
        require_once dirname(__DIR__, 2).'/migrations/Version20261014000000.php';
        $connection = DriverManager::getConnection(['driver' => 'pdo_sqlite', 'memory' => true]);
        $migration = new \DoctrineMigrations\Version20261014000000($connection, new NullLogger());
        $schema = new Schema(); $migration->up($schema);
        foreach ($schema->toSql($connection->getDatabasePlatform()) as $sql) { $connection->executeStatement($sql); }
        self::assertCount(3, $connection->createSchemaManager()->listTableNames());
        self::assertTrue($schema->getTable('test_ticket')->hasColumn('attachment_mime'));
        $migration->down($schema); self::assertCount(0, $schema->getTables());
    }
}
