<?php
declare(strict_types=1);
namespace App\Command;

use App\Integration\GuestLucky\CatalogueSynchronizer;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

#[AsCommand(name: 'app:guestlucky:sync', description: 'Read the live GuestLucky MCP catalogue and preview or apply local property updates.')]
final class GuestLuckySyncCommand extends Command
{
    public function __construct(private CatalogueSynchronizer $synchronizer, #[Autowire('%kernel.project_dir%/var/guestlucky')] private string $directory) { parent::__construct(); }
    protected function configure(): void { $this->addOption('apply', null, InputOption::VALUE_NONE, 'Save new properties and update public basics; preserve photos, descriptions, URLs and absent listings.'); }
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output); $apply = (bool) $input->getOption('apply');
        if (!is_dir($this->directory) && !mkdir($this->directory, 0700, true) && !is_dir($this->directory)) { $io->error('Répertoire de synchronisation inaccessible.'); return Command::FAILURE; }
        $lock = fopen($this->directory.'/sync.lock', 'c');
        if (!$lock) { $io->error('Verrou de synchronisation inaccessible.'); return Command::FAILURE; }
        if (!flock($lock, LOCK_EX | LOCK_NB)) { fclose($lock); $io->note('Une synchronisation est déjà en cours.'); return Command::SUCCESS; }
        $state = json_decode(@file_get_contents($this->directory.'/sync-status.json') ?: '{}', true) ?: [];
        $state['lastAttemptAt'] = date(DATE_ATOM);
        try {
            $result = $this->synchronizer->synchronize($apply);
            $io->table(['Action locale', 'Slug'], array_map(static fn ($row) => [$row['action'], $row['slug']], $result['report']));
            if ($apply) {
                $this->save('catalogue.json', $result['catalogue']);
                $this->save('sync-status.json', ['lastAttemptAt' => $state['lastAttemptAt'], 'lastSuccessAt' => date(DATE_ATOM), 'properties' => $result['catalogue']['total'], 'status' => 'ok', 'error' => null]);
            }
            $io->success($apply ? 'Catalogue synchronisé. Contenus existants préservés ; aucune écriture dans GuestLucky.' : 'Simulation locale : aucune modification enregistrée. Ajoutez --apply pour enregistrer.');
            return Command::SUCCESS;
        } catch (\Throwable $exception) {
            // Only our controlled validation errors are displayed; transport/DB details may contain secrets.
            $message = $exception instanceof \RuntimeException && $exception->getPrevious() === null ? $exception->getMessage() : 'Synchronisation impossible. Vérifiez la configuration et la base locale.';
            if ($apply) { $state['status'] = 'error'; $state['error'] = $message; try { $this->save('sync-status.json', $state); } catch (\Throwable) {} }
            $io->error($message); return Command::FAILURE;
        } finally { flock($lock, LOCK_UN); fclose($lock); }
    }
    private function save(string $name, array $data): void
    {
        $path = $this->directory.'/'.$name; $temporary = $path.'.'.bin2hex(random_bytes(6)).'.tmp';
        if (file_put_contents($temporary, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), LOCK_EX) === false) { throw new \RuntimeException('Écriture du journal de synchronisation impossible.'); }
        chmod($temporary, 0600);
        if (!rename($temporary, $path)) { @unlink($temporary); throw new \RuntimeException('Mise à jour du journal de synchronisation impossible.'); }
    }
}
