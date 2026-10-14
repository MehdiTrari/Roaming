<?php
namespace App\Command;
use App\Integration\GuestLucky\CatalogueImporter;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:guestlucky:catalogue', description: 'Preview or apply a complete verified GuestLucky catalogue.')]
final class GuestLuckyCatalogueCommand extends Command
{
    public function __construct(private CatalogueImporter $importer) { parent::__construct(); }
    protected function configure(): void
    {
        $this->addArgument('file', InputArgument::REQUIRED, 'Path to the complete verified MCP JSON catalogue');
        $this->addOption('apply', null, InputOption::VALUE_NONE, 'Apply transactionally; without this option the command only previews changes');
    }
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        try {
            $file = $input->getArgument('file');
            if (!is_file($file) || !is_readable($file)) { throw new \InvalidArgumentException('Catalogue file cannot be read.'); }
            $data = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($data)) { throw new \InvalidArgumentException('Expected a JSON object.'); }
            $report = $this->importer->import($data, $input->getOption('apply'));
            $io->table(['Action', 'Slug'], array_map(fn ($r) => [$r['action'], $r['slug']], $report));
            $io->success($input->getOption('apply') ? 'Catalogue applied. Content and photos preserved.' : 'Preview only. No changes saved. Use --apply to save.');
            return Command::SUCCESS;
        } catch (\InvalidArgumentException|\JsonException $e) {
            $io->error($e->getMessage());
        } catch (\Throwable) {
            $io->error('Import failed. No transaction was committed. Check database access and schema.');
        }
        return Command::FAILURE;
    }
}
