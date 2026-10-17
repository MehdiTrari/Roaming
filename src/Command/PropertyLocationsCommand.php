<?php

declare(strict_types=1);

namespace App\Command;

use App\Repository\PropertyRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

#[AsCommand(name: 'app:properties:locations', description: 'Preview or apply verified public addresses and coordinates to existing GuestLucky properties.')]
final class PropertyLocationsCommand extends Command
{
    public function __construct(private PropertyRepository $properties, private EntityManagerInterface $em,
        #[Autowire('%kernel.project_dir%/config/property_locations.json')] private string $file) { parent::__construct(); }
    protected function configure(): void { $this->addOption('apply', null, InputOption::VALUE_NONE, 'Save verified locations.'); }
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $rows = json_decode(file_get_contents($this->file), true, flags: JSON_THROW_ON_ERROR)['properties'];
        $changes = [];
        foreach ($rows as $row) {
            $property = $this->properties->findOneBy(['guestLuckyId' => $row['guestLuckyId']]);
            if (!$property) { $io->error('Logement GuestLucky absent : '.$row['guestLuckyId'].'. Importez d’abord le catalogue.'); return Command::FAILURE; }
            $changes[] = [$property, $row];
        }
        $io->table(['Logement', 'Adresse', 'Latitude', 'Longitude'], array_map(static fn ($change) => [$change[0]->getSlug(), $change[1]['address'], $change[1]['latitude'], $change[1]['longitude']], $changes));
        if ($input->getOption('apply')) {
            $this->em->wrapInTransaction(static function () use ($changes): void {
                foreach ($changes as [$property, $row]) $property->setAddress($row['address'])->setCoordinates($row['latitude'], $row['longitude']);
            });
        }
        $io->success($input->getOption('apply') ? 'Adresses et emplacements enregistrés.' : 'Simulation : ajoutez --apply pour enregistrer.');
        return Command::SUCCESS;
    }
}
