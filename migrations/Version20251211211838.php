<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251211211838 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE property_amenity (property_id INT NOT NULL, amenity_id INT NOT NULL, PRIMARY KEY (property_id, amenity_id))');
        $this->addSql('CREATE INDEX IDX_F2AD331B549213EC ON property_amenity (property_id)');
        $this->addSql('CREATE INDEX IDX_F2AD331B9F9F1305 ON property_amenity (amenity_id)');
        $this->addSql('ALTER TABLE property_amenity ADD CONSTRAINT FK_F2AD331B549213EC FOREIGN KEY (property_id) REFERENCES property (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE property_amenity ADD CONSTRAINT FK_F2AD331B9F9F1305 FOREIGN KEY (amenity_id) REFERENCES amenity (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE amenity ADD name VARCHAR(120) NOT NULL');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_AB6079635E237E06 ON amenity (name)');
        $this->addSql('ALTER TABLE contact_message ADD name VARCHAR(120) NOT NULL');
        $this->addSql('ALTER TABLE contact_message ADD email VARCHAR(180) NOT NULL');
        $this->addSql('ALTER TABLE contact_message ADD subject VARCHAR(255) NOT NULL');
        $this->addSql('ALTER TABLE contact_message ADD phone VARCHAR(30) DEFAULT NULL');
        $this->addSql('ALTER TABLE contact_message ADD message TEXT NOT NULL');
        $this->addSql('ALTER TABLE contact_message ADD created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL');
        $this->addSql('ALTER TABLE contact_message ADD is_handled BOOLEAN NOT NULL DEFAULT FALSE');
        $this->addSql('ALTER TABLE property ADD title VARCHAR(180) NOT NULL');
        $this->addSql('ALTER TABLE property ADD slug VARCHAR(180) NOT NULL');
        $this->addSql('ALTER TABLE property ADD description TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE property ADD about TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE property ADD accommodation TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE property ADD guest_access TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE property ADD travelers INT NOT NULL');
        $this->addSql('ALTER TABLE property ADD bedrooms INT NOT NULL');
        $this->addSql('ALTER TABLE property ADD beds INT NOT NULL');
        $this->addSql('ALTER TABLE property ADD bathrooms DOUBLE PRECISION NOT NULL');
        $this->addSql('ALTER TABLE property ADD area INT DEFAULT NULL');
        $this->addSql('ALTER TABLE property ADD city VARCHAR(120) NOT NULL');
        $this->addSql('ALTER TABLE property ADD created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL');
        $this->addSql('ALTER TABLE property ADD updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_8BF21CDE989D9B62 ON property (slug)');
        $this->addSql('ALTER TABLE property_image ADD filename VARCHAR(255) NOT NULL');
        $this->addSql('ALTER TABLE property_image ADD alt VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE property_image ADD position INT NOT NULL');
        $this->addSql('ALTER TABLE property_image ADD is_cover BOOLEAN NOT NULL');
        $this->addSql('ALTER TABLE property_image ADD created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL');
        $this->addSql('ALTER TABLE property_image ADD property_id INT NOT NULL');
        $this->addSql('ALTER TABLE property_image ADD CONSTRAINT FK_32EC552549213EC FOREIGN KEY (property_id) REFERENCES property (id) NOT DEFERRABLE');
        $this->addSql('CREATE INDEX IDX_32EC552549213EC ON property_image (property_id)');
        $this->addSql('ALTER TABLE review ADD author_name VARCHAR(150) NOT NULL');
        $this->addSql('ALTER TABLE review ADD rating SMALLINT NOT NULL');
        $this->addSql('ALTER TABLE review ADD comment TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE review ADD created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL');
        $this->addSql('ALTER TABLE review ADD property_id INT NOT NULL');
        $this->addSql('ALTER TABLE review ADD CONSTRAINT FK_794381C6549213EC FOREIGN KEY (property_id) REFERENCES property (id) NOT DEFERRABLE');
        $this->addSql('CREATE INDEX IDX_794381C6549213EC ON review (property_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE property_amenity DROP CONSTRAINT FK_F2AD331B549213EC');
        $this->addSql('ALTER TABLE property_amenity DROP CONSTRAINT FK_F2AD331B9F9F1305');
        $this->addSql('DROP TABLE property_amenity');
        $this->addSql('DROP INDEX UNIQ_AB6079635E237E06');
        $this->addSql('ALTER TABLE amenity DROP name');
        $this->addSql('ALTER TABLE contact_message DROP name');
        $this->addSql('ALTER TABLE contact_message DROP email');
        $this->addSql('ALTER TABLE contact_message DROP subject');
        $this->addSql('ALTER TABLE contact_message DROP phone');
        $this->addSql('ALTER TABLE contact_message DROP message');
        $this->addSql('ALTER TABLE contact_message DROP created_at');
        $this->addSql('ALTER TABLE contact_message DROP is_handled');
        $this->addSql('DROP INDEX UNIQ_8BF21CDE989D9B62');
        $this->addSql('ALTER TABLE property DROP title');
        $this->addSql('ALTER TABLE property DROP slug');
        $this->addSql('ALTER TABLE property DROP description');
        $this->addSql('ALTER TABLE property DROP about');
        $this->addSql('ALTER TABLE property DROP accommodation');
        $this->addSql('ALTER TABLE property DROP guest_access');
        $this->addSql('ALTER TABLE property DROP travelers');
        $this->addSql('ALTER TABLE property DROP bedrooms');
        $this->addSql('ALTER TABLE property DROP beds');
        $this->addSql('ALTER TABLE property DROP bathrooms');
        $this->addSql('ALTER TABLE property DROP area');
        $this->addSql('ALTER TABLE property DROP city');
        $this->addSql('ALTER TABLE property DROP created_at');
        $this->addSql('ALTER TABLE property DROP updated_at');
        $this->addSql('ALTER TABLE property_image DROP CONSTRAINT FK_32EC552549213EC');
        $this->addSql('DROP INDEX IDX_32EC552549213EC');
        $this->addSql('ALTER TABLE property_image DROP filename');
        $this->addSql('ALTER TABLE property_image DROP alt');
        $this->addSql('ALTER TABLE property_image DROP position');
        $this->addSql('ALTER TABLE property_image DROP is_cover');
        $this->addSql('ALTER TABLE property_image DROP created_at');
        $this->addSql('ALTER TABLE property_image DROP property_id');
        $this->addSql('ALTER TABLE review DROP CONSTRAINT FK_794381C6549213EC');
        $this->addSql('DROP INDEX IDX_794381C6549213EC');
        $this->addSql('ALTER TABLE review DROP author_name');
        $this->addSql('ALTER TABLE review DROP rating');
        $this->addSql('ALTER TABLE review DROP comment');
        $this->addSql('ALTER TABLE review DROP created_at');
        $this->addSql('ALTER TABLE review DROP property_id');
    }
}
