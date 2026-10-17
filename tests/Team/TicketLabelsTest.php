<?php
declare(strict_types=1);
namespace App\Tests\Team;
use App\Service\TicketLabels;
use PHPUnit\Framework\TestCase;

final class TicketLabelsTest extends TestCase
{
    public function testLabelsAreNormalizedWithoutLosingAccents(): void
    {
        self::assertSame(['mobile', 'calendrier', 'équipe'], TicketLabels::parse(' Mobile, calendrier; ÉQUIPE, mobile , '));
        self::assertSame([], TicketLabels::parse(' , ; '));
    }
    public function testTooManyLabelsAreRejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        TicketLabels::parse('a,b,c,d,e,f,g,h,i');
    }
    public function testLongLabelsAreRejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        TicketLabels::parse(str_repeat('é', 33));
    }
}
