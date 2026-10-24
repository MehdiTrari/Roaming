<?php
declare(strict_types=1);
namespace App\Command;

use App\Integration\GuestLucky\PhotoSynchronizer;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:guestlucky:photos', description: 'Preview or synchronize public GuestLucky galleries, preserving configured properties.')]
final class GuestLuckyPhotosCommand extends Command
{
    public function __construct(private PhotoSynchronizer $synchronizer) { parent::__construct(); }
    protected function configure(): void { $this->addOption('apply', null, InputOption::VALUE_NONE, 'Replace validated photo associations; do not delete uploaded files.'); }
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        try {
            $apply = (bool) $input->getOption('apply'); $result = $this->synchronizer->synchronize($apply);
            if ($result['busy']) { $io->note('Une synchronisation des photos est déjà en cours.'); return Command::SUCCESS; }
            $io->table(['Logement', 'Action', 'Avant', 'Après'], array_map(static fn ($row) => array_values($row), $result['report']));
            $io->success($apply ? 'Photos synchronisées ; fichiers locaux sauvegardés conservés.' : 'Simulation : aucune photo modifiée. Utilisez --apply pour enregistrer.');
            return Command::SUCCESS;
        } catch (\Throwable) { $io->error('Synchronisation des photos impossible ; dernières galeries valides conservées.'); return Command::FAILURE; }
    }
}
