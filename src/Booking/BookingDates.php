<?php
namespace App\Booking;
final class BookingDates
{
    public static function today(): \DateTimeImmutable { return new \DateTimeImmutable('today', new \DateTimeZone('Europe/Paris')); }
    public static function month(int $year, int $month): void
    {
        $first = self::today()->modify('first day of this month');
        if ($month < 1 || $month > 12 || $year < 2000 || $year > 2200) { throw new \InvalidArgumentException('Invalid month.'); }
        $date = $first->setDate($year, $month, 1);
        if ($date < $first || $date >= $first->modify('+12 months')) { throw new \InvalidArgumentException('Month outside booking horizon.'); }
    }
    public static function stay(string $arrival, string $departure, int $guests): void
    {
        $a = self::parse($arrival);
        $d = self::parse($departure);
        if ($guests < 1 || $guests > 20 || $a < self::today() || $d <= $a || $d > self::today()->modify('first day of this month')->modify('+12 months')) {
            throw new \InvalidArgumentException('Invalid stay.');
        }
    }
    private static function parse(string $date): \DateTimeImmutable
    {
        $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date, new \DateTimeZone('Europe/Paris'));
        if (!$parsed || $parsed->format('Y-m-d') !== $date) { throw new \InvalidArgumentException('Invalid date.'); }
        return $parsed;
    }
}
