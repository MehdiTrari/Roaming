<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251219165009 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE amenity (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(120) NOT NULL, icon LONGTEXT DEFAULT NULL, UNIQUE INDEX UNIQ_AB6079635E237E06 (name), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE contact_message (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(120) NOT NULL, email VARCHAR(180) NOT NULL, subject VARCHAR(255) NOT NULL, phone VARCHAR(30) DEFAULT NULL, message LONGTEXT NOT NULL, created_at DATETIME NOT NULL, is_handled TINYINT NOT NULL, PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE property (id INT AUTO_INCREMENT NOT NULL, title VARCHAR(180) NOT NULL, slug VARCHAR(180) NOT NULL, type VARCHAR(50) DEFAULT NULL, short_description LONGTEXT DEFAULT NULL, description LONGTEXT DEFAULT NULL, about LONGTEXT DEFAULT NULL, accommodation LONGTEXT DEFAULT NULL, guest_access LONGTEXT DEFAULT NULL, other_remarks LONGTEXT DEFAULT NULL, short_description_en LONGTEXT DEFAULT NULL, about_en LONGTEXT DEFAULT NULL, accommodation_en LONGTEXT DEFAULT NULL, guest_access_en LONGTEXT DEFAULT NULL, other_remarks_en LONGTEXT DEFAULT NULL, travelers INT NOT NULL, bedrooms INT NOT NULL, beds INT NOT NULL, bathrooms DOUBLE PRECISION NOT NULL, area INT DEFAULT NULL, city VARCHAR(120) NOT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, UNIQUE INDEX UNIQ_8BF21CDE989D9B62 (slug), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE property_amenity (property_id INT NOT NULL, amenity_id INT NOT NULL, INDEX IDX_F2AD331B549213EC (property_id), INDEX IDX_F2AD331B9F9F1305 (amenity_id), PRIMARY KEY (property_id, amenity_id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE property_image (id INT AUTO_INCREMENT NOT NULL, filename VARCHAR(255) NOT NULL, alt VARCHAR(255) DEFAULT NULL, position INT NOT NULL, is_cover TINYINT NOT NULL, created_at DATETIME NOT NULL, property_id INT NOT NULL, INDEX IDX_32EC552549213EC (property_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE review (id INT AUTO_INCREMENT NOT NULL, author_name VARCHAR(150) NOT NULL, rating SMALLINT NOT NULL, comment LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL, property_id INT NOT NULL, INDEX IDX_794381C6549213EC (property_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE messenger_messages (id BIGINT AUTO_INCREMENT NOT NULL, body LONGTEXT NOT NULL, headers LONGTEXT NOT NULL, queue_name VARCHAR(190) NOT NULL, created_at DATETIME NOT NULL, available_at DATETIME NOT NULL, delivered_at DATETIME DEFAULT NULL, INDEX IDX_75EA56E0FB7336F0 (queue_name), INDEX IDX_75EA56E0E3BD61CE (available_at), INDEX IDX_75EA56E016BA31DB (delivered_at), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE property_amenity ADD CONSTRAINT FK_F2AD331B549213EC FOREIGN KEY (property_id) REFERENCES property (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE property_amenity ADD CONSTRAINT FK_F2AD331B9F9F1305 FOREIGN KEY (amenity_id) REFERENCES amenity (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE property_image ADD CONSTRAINT FK_32EC552549213EC FOREIGN KEY (property_id) REFERENCES property (id)');
        $this->addSql('ALTER TABLE review ADD CONSTRAINT FK_794381C6549213EC FOREIGN KEY (property_id) REFERENCES property (id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE property_amenity DROP FOREIGN KEY FK_F2AD331B549213EC');
        $this->addSql('ALTER TABLE property_amenity DROP FOREIGN KEY FK_F2AD331B9F9F1305');
        $this->addSql('ALTER TABLE property_image DROP FOREIGN KEY FK_32EC552549213EC');
        $this->addSql('ALTER TABLE review DROP FOREIGN KEY FK_794381C6549213EC');
        $this->addSql('DROP TABLE amenity');
        $this->addSql('DROP TABLE contact_message');
        $this->addSql('DROP TABLE property');
        $this->addSql('DROP TABLE property_amenity');
        $this->addSql('DROP TABLE property_image');
        $this->addSql('DROP TABLE review');
        $this->addSql('DROP TABLE messenger_messages');
    }
}
