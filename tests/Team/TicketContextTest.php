<?php
declare(strict_types=1);
namespace App\Tests\Team;
use App\Service\TicketContext;
use PHPUnit\Framework\TestCase;
final class TicketContextTest extends TestCase
{
    public function testContextDropsSecretsFragmentsAndExternalUrls(): void
    {
        $context = new TicketContext();
        self::assertSame('/disponibilites?guests=2', $context->page('/disponibilites?guests=2&token=secret#private'));
        foreach (['https://foreign.test/x', '//foreign.test', '/\\foreign.test', 'javascript:alert(1)', '/x'.chr(0)] as $url) { self::assertSame('/', $context->page($url)); }
    }
}
