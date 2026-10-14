<?php
declare(strict_types=1);
namespace DoctrineMigrations;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261014000000 extends AbstractMigration
{
    public function getDescription(): string { return 'Private team accounts, test tickets and comments.'; }
    public function up(Schema $schema): void
    {
        $users = $schema->createTable('team_user');
        $users->addColumn('id', 'integer', ['autoincrement' => true]); $users->setPrimaryKey(['id']);
        $users->addColumn('email', 'string', ['length' => 180]); $users->addUniqueIndex(['email']);
        $users->addColumn('name', 'string', ['length' => 120]); $users->addColumn('password', 'string', ['length' => 255]); $users->addColumn('roles', 'json');
        $tickets = $schema->createTable('test_ticket');
        $tickets->addColumn('id', 'integer', ['autoincrement' => true]); $tickets->setPrimaryKey(['id']);
        $tickets->addColumn('author_id', 'integer'); $tickets->addIndex(['author_id']); $tickets->addForeignKeyConstraint('team_user', ['author_id'], ['id']);
        foreach (['title' => 180, 'category' => 20, 'page' => 2048, 'browser' => 500, 'screen' => 40, 'status' => 20, 'priority' => 20] as $name => $length) { $tickets->addColumn($name, 'string', ['length' => $length]); }
        foreach (['description', 'steps', 'expected'] as $name) { $tickets->addColumn($name, 'text'); }
        $tickets->addColumn('attachment', 'string', ['length' => 64, 'notnull' => false]);
        $tickets->addColumn('attachment_mime', 'string', ['length' => 30, 'notnull' => false]);
        $tickets->addColumn('created_at', 'datetime_immutable');
        $comments = $schema->createTable('ticket_comment');
        $comments->addColumn('id', 'integer', ['autoincrement' => true]); $comments->setPrimaryKey(['id']);
        foreach (['ticket_id' => 'test_ticket', 'author_id' => 'team_user'] as $name => $table) {
            $comments->addColumn($name, 'integer'); $comments->addIndex([$name]); $comments->addForeignKeyConstraint($table, [$name], ['id']);
        }
        $comments->addColumn('body', 'text'); $comments->addColumn('created_at', 'datetime_immutable');
    }
    public function down(Schema $schema): void
    { $schema->dropTable('ticket_comment'); $schema->dropTable('test_ticket'); $schema->dropTable('team_user'); }
}
