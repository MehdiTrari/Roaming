<?php
declare(strict_types=1);
namespace App\Command;
use App\Integration\GuestLucky\ReviewSynchronizer;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:guestlucky:reviews', description: 'Read GuestLucky guest reviews for every active property; atomically refresh the public snapshot.')]
final class GuestLuckyReviewsCommand extends Command
{
    public function __construct(private ReviewSynchronizer $synchronizer) { parent::__construct(); }
    protected function configure(): void { $this->addOption('apply', null, InputOption::VALUE_NONE, 'Save the complete validated snapshot. No GuestLucky writes.'); }
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        try {
            $apply = (bool) $input->getOption('apply'); $result = $this->synchronizer->synchronize($apply);
            if ($result['busy']) $io->note('Synchronisation des avis déjà en cours.');
            else $io->success(sprintf('%d avis public(s) reçu(s). %s', $result['count'], $apply ? 'Instantané local actualisé ; aucune écriture GuestLucky.' : 'Simulation uniquement.'));
            return Command::SUCCESS;
        } catch (\Throwable) {
            $io->error('Avis non actualisés : vérifiez la connexion MCP et le format des avis. Le dernier instantané valide est conservé.');
            return Command::FAILURE;
        }
    }
}
