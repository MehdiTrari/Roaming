<?php
namespace App\Command;

use App\Booking\BookingDates;
use App\Integration\GuestLucky\GuestLuckyClient;
use App\Integration\GuestLucky\StayUnavailable;
use App\Repository\PropertyRepository;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:guestlucky:check', description: 'Read fresh GuestLucky calendars and a quote; never create a booking or change the public gate.')]
final class GuestLuckyCheckCommand extends Command
{
    public function __construct(private PropertyRepository $properties, private GuestLuckyClient $client) { parent::__construct(); }

    protected function configure(): void
    {
        $this->addArgument('slug', InputArgument::REQUIRED, 'Active property slug');
        $this->addArgument('arrival', InputArgument::REQUIRED, 'Arrival YYYY-MM-DD');
        $this->addArgument('departure', InputArgument::REQUIRED, 'Departure YYYY-MM-DD');
        $this->addOption('guests', null, InputOption::VALUE_REQUIRED, 'Guest count', '2');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        try {
            $arrival = $input->getArgument('arrival');
            $departure = $input->getArgument('departure');
            $guests = filter_var($input->getOption('guests'), FILTER_VALIDATE_INT);
            if ($guests === false) { throw new \InvalidArgumentException(); }
            BookingDates::stay($arrival, $departure, $guests);
            $property = $this->properties->findActiveSlug($input->getArgument('slug'));
            if (!$property || !$property->getGuestLuckyId() || $guests > $property->getTravelers()) { throw new \InvalidArgumentException(); }
            $id = $property->getGuestLuckyId();
            $io->note('Read-only GET requests. No booking, payment, price or block is created. The publication gate is unchanged.');
            $lastNight = (new \DateTimeImmutable($departure))->modify('-1 day');
            $cursor = (new \DateTimeImmutable($arrival))->modify('first day of this month');
            $pending = [];
            while ($cursor <= $lastNight) {
                $year = (int) $cursor->format('Y'); $month = (int) $cursor->format('n');
                $pending[] = [$year, $month, $this->client->startCalendar($id, $year, $month)];
                $cursor = $cursor->modify('+1 month');
            }
            $rows = [];
            foreach ($pending as [$year, $month, $response]) {
                $days = $this->client->readCalendar($response, $id, $year, $month);
                foreach ($days as $day) {
                    if ($day['date'] >= $arrival && $day['date'] < $departure) {
                        $rows[] = [$day['date'], $day['available'] ? 'Available' : 'Unavailable', $day['price'].' EUR', $day['minStay']];
                    }
                }
            }
            $io->table(['Night', 'Provider state', 'Nightly price', 'Minimum nights'], $rows);
            $io->text('Missing dates are unverified. Fresh read at '.gmdate(DATE_ATOM));
            try {
                $quote = $this->client->readQuote($this->client->startQuote($id, $arrival, $departure, $guests), $id, $arrival, $departure, $guests);
                $io->success('Provider accepted quote: '.$quote['price'].' EUR for '.$quote['nights'].' nights. This does not validate Channel Manager consistency.');
            } catch (StayUnavailable) {
                $io->success('Provider explicitly refused the stay (422). The read-only check succeeded.');
            }
            return Command::SUCCESS;
        } catch (\InvalidArgumentException) {
            $io->error('Invalid dates, guest count or active property.');
            return Command::INVALID;
        } catch (\Throwable) {
            // Never print a transport exception: it can contain the booking key.
            $io->error('Provider or database check failed. Availability remains unverified.');
            return Command::FAILURE;
        }
    }
}
