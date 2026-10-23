<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\Amenity;
use App\Repository\PropertyRepository;
use App\Service\PropertyContentCatalogue;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:properties:enrich', description: 'Preview or apply reviewed bilingual content to existing properties, preserving their identity and media.')]
final class PropertyEnrichmentCommand extends Command
{
    public function __construct(private PropertyRepository $properties, private EntityManagerInterface $em, private PropertyContentCatalogue $content) { parent::__construct(); }

    protected function configure(): void { $this->addOption('apply', null, InputOption::VALUE_NONE, 'Save the reviewed content in one transaction.'); }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $plans = $rows = [];
        try {
            // Resolve every mapping before mutating anything; never create a Property.
            foreach ($this->content->entries() as $entry) {
                $property = $this->properties->findOneBy(['guestLuckyId' => $entry['guestLuckyId']]);
                if (!$property || !$property->isActive()) throw new \InvalidArgumentException('Active existing property missing: '.$entry['slug']);
                $changes = $this->content->changes($property, $entry);
                $missing = array_values(array_diff($entry['amenities'], $property->getAmenities()->map(static fn (Amenity $amenity) => $amenity->getName())->toArray()));
                $providerCapacity = $property->getProviderCapacity() ?? $property->getTravelers();
                $changed = $changes !== [] || $missing !== [] || $property->getProviderCapacity() === null;
                $plans[] = [$property, $entry, $missing, $providerCapacity, $changed];
                $rows[] = [$property->getId(), $property->getSlug(), $entry['fields']['title'], $entry['fields']['travelers'], $providerCapacity, min($entry['fields']['travelers'], $providerCapacity), count($property->getImages()), $changed ? implode(', ', array_keys($changes)).($missing ? ' ; +'.count($missing).' équipements' : '').($property->getProviderCapacity() === null ? ' ; limite fournisseur conservée' : '') : 'inchangé'];
            }
        } catch (\Throwable $error) {
            $io->error($error->getMessage());
            return Command::FAILURE;
        }
        $io->table(['ID', 'Slug conservé', 'Nom', 'Capacité annoncée', 'Limite fournisseur', 'Réservation en ligne', 'Photos conservées', 'Changements'], $rows);
        foreach ($plans as [$property, $entry]) $io->writeln($property->getSlug().' : '.$entry['fields']['airbnbUrl']);
        if ($input->getOption('apply')) {
            $this->em->wrapInTransaction(function () use ($plans): void {
                $amenities = [];
                foreach ($plans as [$property, $entry, $missing, $providerCapacity, $changed]) {
                    if (!$changed) continue;
                    $property->setProviderCapacity($providerCapacity);
                    $this->content->apply($property, $entry);
                    foreach ($missing as $name) {
                        $amenity = $amenities[$name] ?? $this->em->getRepository(Amenity::class)->findOneBy(['name' => $name]);
                        if (!$amenity) { $amenity = (new Amenity())->setName($name); $this->em->persist($amenity); }
                        $amenities[$name] = $amenity;
                        $property->addAmenity($amenity);
                    }
                    $property->setUpdatedAt(new \DateTimeImmutable());
                }
            });
        }
        $io->success($input->getOption('apply') ? 'Contenus enregistrés. Identifiants, slugs, médias, emplacements et logements hors sélection préservés.' : 'Simulation : aucune écriture. Ajoutez --apply pour enregistrer.');
        return Command::SUCCESS;
    }
}
