<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20251221AddAirbnbFields extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add Airbnb URL, rating and reviews count fields to Property entity';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE property ADD airbnb_url VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE property ADD airbnb_rating DOUBLE PRECISION DEFAULT NULL');
        $this->addSql('ALTER TABLE property ADD airbnb_reviews_count INT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE property DROP airbnb_url');
        $this->addSql('ALTER TABLE property DROP airbnb_rating');
        $this->addSql('ALTER TABLE property DROP airbnb_reviews_count');
    }
}
