<?php
declare(strict_types=1);
namespace App\Command;
use App\Entity\TeamUser;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

#[AsCommand(name: 'app:team:user', description: 'Create an invited team account or reset its password (hidden prompt).')]
final class TeamUserCommand extends Command
{
    public function __construct(private EntityManagerInterface $em, private UserPasswordHasherInterface $hasher) { parent::__construct(); }
    protected function configure(): void
    {
        $this->addArgument('email', InputArgument::REQUIRED)->addOption('name', null, InputOption::VALUE_REQUIRED)
            ->addOption('admin', null, InputOption::VALUE_NONE, 'Give a NEW account administrator rights.')
            ->addOption('reset-password', null, InputOption::VALUE_NONE, 'Reset an existing account password, preserving its rights.');
    }
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $email = strtolower(trim((string) $input->getArgument('email')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 180) { $io->error('Invalid email.'); return Command::INVALID; }
        $user = $this->em->getRepository(TeamUser::class)->findOneBy(['email' => $email]);
        if ($user && !$input->getOption('reset-password')) { $io->error('Account exists. Use --reset-password.'); return Command::INVALID; }
        if (!$user && $input->getOption('reset-password')) { $io->error('Account not found.'); return Command::INVALID; }
        if (!$input->isInteractive()) { $io->error('An interactive terminal is required for the hidden password prompt.'); return Command::INVALID; }
        if (!$user) {
            $name = trim((string) ($input->getOption('name') ?: $io->ask('Name')));
            if ($name === '' || mb_strlen($name) > 120) { $io->error('Name must contain 1–120 characters.'); return Command::INVALID; }
            $user = new TeamUser($email, $name); $user->setAdmin((bool) $input->getOption('admin'));
        }
        $password = $io->askHidden('Password (at least 12 characters)', static function ($value): string {
            if (!is_string($value) || mb_strlen($value) < 12 || strlen($value) > 72) { throw new \RuntimeException('Use at least 12 characters and at most 72 bytes.'); }
            return $value;
        });
        if ($password !== $io->askHidden('Confirm password')) { $io->error('Passwords do not match.'); return Command::INVALID; }
        $user->setPassword($this->hasher->hashPassword($user, $password));
        $this->em->persist($user); $this->em->flush();
        $io->success('Team account saved.'); return Command::SUCCESS;
    }
}
