<?php
declare(strict_types=1);
namespace App\Integration\GuestLucky;

use App\Media\PropertyImageUrl;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/** Read-only public gallery adapter: the MCP catalogue does not include photos. */
final class PhotoClient
{
    public function __construct(private HttpClientInterface $mediaHttpClient, private string $baseUrl, private string $bookingKey) {}

    public function photos(int $providerId): array
    {
        if ($providerId < 1 || $this->baseUrl !== 'https://app.guestlucky.io' || trim($this->bookingKey) === '') throw new \RuntimeException('Photo connection unavailable.');
        try {
            $response = $this->mediaHttpClient->request('GET', $this->baseUrl.'/book/'.rawurlencode($this->bookingKey).'/'.$providerId, [
                'headers' => ['Accept' => 'text/html'], 'timeout' => 10, 'max_duration' => 20, 'max_redirects' => 0,
            ]);
            if ($response->getStatusCode() !== 200) throw new \RuntimeException();
            $html = $response->getContent();
        } catch (\Throwable) { throw new \RuntimeException('GuestLucky gallery unavailable; previous photos preserved.'); }
        if (strlen($html) > 2 * 1024 * 1024) throw new \RuntimeException('GuestLucky gallery is too large.');
        $previous = libxml_use_internal_errors(true);
        try {
            $document = new \DOMDocument();
            if (!$document->loadHTML($html, LIBXML_NONET)) throw new \RuntimeException('GuestLucky gallery is invalid.');
            $xpath = new \DOMXPath($document);
            if ($xpath->query('//*[@id="gl-gallery"]')->length !== 1) throw new \RuntimeException('GuestLucky gallery markup changed; previous photos preserved.');
            $urls = [];
            foreach ($xpath->query('//*[@id="gl-gallery"]//img[@src]') as $image) {
                $url = trim($image->getAttribute('src'));
                if (!PropertyImageUrl::isGuestLucky($url)) throw new \RuntimeException('Unsupported image URL in GuestLucky gallery.');
                if (!in_array($url, $urls, true)) $urls[] = $url;
            }
            if (count($urls) > 250) throw new \RuntimeException('GuestLucky gallery exceeds the photo limit.');
            return $urls;
        } finally { libxml_clear_errors(); libxml_use_internal_errors($previous); }
    }
}
