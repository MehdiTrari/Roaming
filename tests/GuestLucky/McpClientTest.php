<?php
declare(strict_types=1);
namespace App\Tests\GuestLucky;

use App\Integration\GuestLucky\McpClient;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class McpClientTest extends TestCase
{
    private function client(callable $tool, bool $sse = false): McpClient
    {
        return new McpClient(new MockHttpClient(function ($method, $url, $options) use ($tool, $sse) {
            self::assertSame('POST', $method); self::assertSame('https://app.guestlucky.io/api/mcp', $url);
            $payload = json_decode($options['body'], true);
            if ($payload['method'] === 'notifications/initialized') { return new MockResponse('', ['http_code' => 202]); }
            $result = $payload['method'] === 'initialize' ? ['protocolVersion' => '2025-11-25'] : $tool($payload['params']['name'], $payload['params']['arguments']);
            $body = json_encode(['jsonrpc' => '2.0', 'id' => $payload['id'], 'result' => $result]);
            return new MockResponse($sse ? "event: message\ndata: ".$body."\n\n" : $body, ['response_headers' => ['content-type: '.($sse ? 'text/event-stream' : 'application/json'), 'mcp-session-id: test-session']]);
        }), 'https://app.guestlucky.io/api/mcp', 'test-secret');
    }
    private function toolResult(array $data): array { return ['content' => [['type' => 'text', 'text' => json_encode($data)]]]; }
    public function testAllPagesAreReadAndOnlyReadToolsAreCalled(): void
    {
        $calls = [];
        $client = $this->client(function ($name, $arguments) use (&$calls) {
            $calls[] = $name;
            if ($name === 'gl-whoami') { return $this->toolResult(['account_owner_id' => 123]); }
            self::assertSame('gl-list-properties', $name);
            $page = $arguments['page'];
            $rows = array_map(static fn ($id) => ['id' => $id], $page === 1 ? range(1, 50) : [51]);
            return $this->toolResult(['total' => 51, 'page' => $page, 'per_page' => 50, 'count' => count($rows), 'properties' => $rows]);
        });
        self::assertSame(123, $client->identity()['account_owner_id']);
        self::assertCount(51, $client->properties());
        self::assertSame(['gl-whoami', 'gl-list-properties', 'gl-list-properties'], $calls);
    }
    public function testEventStreamAndStructuredContentAreSupported(): void
    {
        $client = $this->client(static fn () => ['structuredContent' => ['account_owner_id' => 123]], true);
        self::assertSame(123, $client->identity()['account_owner_id']);
    }
    public function testDuplicateAndIncompletePagesAreRejected(): void
    {
        $client = $this->client(fn () => $this->toolResult(['total' => 2, 'page' => 1, 'per_page' => 50, 'count' => 2, 'properties' => [['id' => 1], ['id' => 1]]]));
        $this->expectException(\RuntimeException::class); $client->properties();
    }
    public function testEmptyCatalogueDoesNotBecomeADeletion(): void
    {
        $client = $this->client(fn () => $this->toolResult(['total' => 0, 'page' => 1, 'per_page' => 50, 'count' => 0, 'properties' => []]));
        $this->expectException(\RuntimeException::class); $client->properties();
    }
    public function testToolErrorsAreNotMistakenForValidData(): void
    {
        $client = $this->client(static fn () => ['isError' => true, 'content' => [['type' => 'text', 'text' => 'private provider error']]]);
        $this->expectException(\RuntimeException::class); $this->expectExceptionMessage('La lecture de l’outil MCP a échoué.'); $client->identity();
    }
    public function testAuthenticationErrorsNeverExposeTheKeyOrRawBody(): void
    {
        $client = new McpClient(new MockHttpClient(new MockResponse('test-secret private diagnostics', ['http_code' => 401])), 'https://app.guestlucky.io/api/mcp', 'test-secret');
        try { $client->identity(); self::fail(); } catch (\RuntimeException $e) { self::assertStringNotContainsString('test-secret', $e->getMessage()); self::assertStringContainsString('401', $e->getMessage()); }
    }
}
