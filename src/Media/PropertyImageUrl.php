<?php
declare(strict_types=1);
namespace App\Media;

final class PropertyImageUrl
{
    public static function isGuestLucky(string $url): bool
    {
        if (strlen($url) > 255 || !filter_var($url, FILTER_VALIDATE_URL)) return false;
        $p = parse_url($url);
        if (($p['scheme'] ?? '') !== 'https' || isset($p['user']) || isset($p['pass']) || isset($p['port']) || isset($p['query']) || isset($p['fragment'])) return false;
        $prefix = match ($p['host'] ?? '') {
            's3.eu-west-3.amazonaws.com' => '/guestluckybucket/listings/',
            'guestluckybucket.s3.eu-west-3.amazonaws.com' => '/listings/',
            default => null,
        };
        $path = rawurldecode($p['path'] ?? '');
        return $prefix !== null && str_starts_with($path, $prefix) && !str_contains($path, '..') && !str_contains($path, '\\')
            && (bool) preg_match('/\.(?:jpe?g|png|webp|avif)$/iD', $path);
    }

    public static function resolve(string $filename): string
    {
        return self::isGuestLucky($filename) ? $filename : '/uploads/'.ltrim($filename, '/');
    }
}
