<?php
declare(strict_types=1);
namespace App\Service;

final class TicketContext
{
    public function page(string $value): string
    {
        if (strlen($value) > 8192 || preg_match('/[\x00-\x20]/', $value)) { return '/'; }
        $parts = parse_url($value);
        if ($parts === false || isset($parts['host']) || isset($parts['scheme'])) { return '/'; }
        $path = $parts['path'] ?? '/';
        if (!str_starts_with($path, '/') || str_starts_with($path, '//') || preg_match('/[\\\\\x00-\x20]/', $path)) { return '/'; }
        parse_str($parts['query'] ?? '', $query);
        $safe = [];
        foreach (['_locale', 'slug', 'year', 'month', 'arrivalDate', 'departureDate', 'guests'] as $key) {
            if (isset($query[$key]) && is_string($query[$key]) && strlen($query[$key]) <= 100) { $safe[$key] = $query[$key]; }
        }
        $result = $path.($safe ? '?'.http_build_query($safe) : '');
        return strlen($result) <= 2048 ? $result : '/';
    }
}
