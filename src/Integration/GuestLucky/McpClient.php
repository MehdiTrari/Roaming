<?php
declare(strict_types=1);
namespace App\Integration\GuestLucky;

use Symfony\Contracts\HttpClient\HttpClientInterface;

/** Private server-side reader. No GuestLucky mutation tool is exposed. */
final class McpClient
{
    private ?string $session = null;
    private string $version = '2025-11-25';
    private bool $initialized = false;
    private int $id = 0;

    public function __construct(private HttpClientInterface $mcpHttpClient, private string $mcpUrl, private string $mcpToken) {}

    public function identity(): array { return $this->readTool('gl-whoami', []); }

    public function properties(): array
    {
        $properties = []; $ids = []; $total = null;
        for ($page = 1; $page <= 100; $page++) {
            $data = $this->readTool('gl-list-properties', ['page' => $page, 'per_page' => 50]);
            $rows = $data['properties'] ?? null;
            if (!is_int($data['total'] ?? null) || $data['total'] < 1 || ($data['page'] ?? null) !== $page || ($data['per_page'] ?? null) !== 50 || !is_array($rows) || !array_is_list($rows) || ($data['count'] ?? null) !== count($rows) || !$rows || ($total !== null && $total !== $data['total'])) {
                throw new \RuntimeException('Catalogue MCP vide, incomplet ou modifié pendant la lecture. Aucun import effectué.');
            }
            $total = $data['total'];
            foreach ($rows as $row) {
                if (!is_array($row) || !is_int($row['id'] ?? null) || $row['id'] < 1 || isset($ids[$row['id']])) { throw new \RuntimeException('Identifiants MCP invalides ou dupliqués.'); }
                $ids[$row['id']] = true; $properties[] = $row;
            }
            if (count($properties) === $total) { return $properties; }
            if (count($properties) > $total || count($rows) < 50) { break; }
        }
        throw new \RuntimeException('Toutes les pages du catalogue MCP n’ont pas pu être vérifiées.');
    }

    private function readTool(string $name, array $arguments): array
    {
        if (!in_array($name, ['gl-whoami', 'gl-list-properties'], true)) { throw new \LogicException('Outil MCP non autorisé.'); }
        if (!$this->initialized) {
            $result = $this->rpc('initialize', ['protocolVersion' => $this->version, 'capabilities' => (object) [], 'clientInfo' => ['name' => 'RoamingCatalogueSync', 'version' => '1.0']]);
            if (!in_array($result['protocolVersion'] ?? null, ['2025-03-26', '2025-06-18', '2025-11-25'], true)) { throw new \RuntimeException('Version MCP non prise en charge.'); }
            $this->version = $result['protocolVersion'];
            $this->rpc('notifications/initialized', (object) [], false);
            $this->initialized = true;
        }
        $result = $this->rpc('tools/call', ['name' => $name, 'arguments' => $arguments ?: (object) []]);
        if (($result['isError'] ?? false) !== false) { throw new \RuntimeException('La lecture de l’outil MCP a échoué.'); }
        $data = $result['structuredContent'] ?? null;
        if (!is_array($data)) {
            foreach ($result['content'] ?? [] as $part) {
                if (($part['type'] ?? '') === 'text' && is_string($part['text'] ?? null)) {
                    try { $parsed = json_decode($part['text'], true, 64, JSON_THROW_ON_ERROR); } catch (\JsonException) { continue; }
                    if (is_array($parsed)) { $data = $parsed; break; }
                }
            }
        }
        if (!is_array($data) || ($data['simulation'] ?? false) === true) { throw new \RuntimeException('Réponse MCP absente ou simulée.'); }
        return $data;
    }

    private function rpc(string $method, array|object $params, bool $expectsResponse = true): array
    {
        if ($this->mcpUrl !== 'https://app.guestlucky.io/api/mcp' || trim($this->mcpToken) === '') { throw new \RuntimeException('Connexion MCP non configurée.'); }
        $headers = ['Authorization' => 'Bearer '.$this->mcpToken, 'Accept' => 'application/json, text/event-stream', 'MCP-Protocol-Version' => $this->version];
        if ($this->session !== null) { $headers['Mcp-Session-Id'] = $this->session; }
        $payload = ['jsonrpc' => '2.0', 'method' => $method, 'params' => $params];
        if ($expectsResponse) { $payload['id'] = ++$this->id; }
        try {
            $response = $this->mcpHttpClient->request('POST', $this->mcpUrl, ['headers' => $headers, 'json' => $payload, 'timeout' => 15, 'max_duration' => 30, 'max_redirects' => 0]);
            $code = $response->getStatusCode(); $body = $response->getContent(false); $responseHeaders = $response->getHeaders(false);
        } catch (\Throwable) { throw new \RuntimeException('Connexion au serveur MCP impossible.'); }
        if ($code < 200 || $code >= 300) { throw new \RuntimeException('Le serveur MCP a refusé la lecture (HTTP '.$code.').'); }
        if (isset($responseHeaders['mcp-session-id'][0])) { $this->session = $responseHeaders['mcp-session-id'][0]; }
        if (!$expectsResponse) { return []; }
        if (strlen($body) > 4 * 1024 * 1024) { throw new \RuntimeException('Réponse MCP trop volumineuse.'); }
        $messages = [];
        if (str_contains($responseHeaders['content-type'][0] ?? '', 'text/event-stream')) {
            foreach (preg_split('/\r?\n\r?\n/', $body) ?: [] as $event) {
                $lines = [];
                foreach (preg_split('/\r?\n/', $event) ?: [] as $line) { if (str_starts_with($line, 'data:')) { $lines[] = ltrim(substr($line, 5), ' '); } }
                if ($lines) { $messages[] = implode("\n", $lines); }
            }
        } else { $messages[] = $body; }
        foreach ($messages as $message) {
            try { $data = json_decode($message, true, 64, JSON_THROW_ON_ERROR); } catch (\JsonException) { continue; }
            if (!is_array($data) || ($data['jsonrpc'] ?? '') !== '2.0' || ($data['id'] ?? null) !== $payload['id']) { continue; }
            if (isset($data['error']) || !is_array($data['result'] ?? null)) { throw new \RuntimeException('Erreur de protocole MCP.'); }
            return $data['result'];
        }
        throw new \RuntimeException('Réponse MCP invalide ou incomplète.');
    }
}
