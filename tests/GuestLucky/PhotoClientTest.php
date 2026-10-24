<?php
declare(strict_types=1);
namespace App\Tests\GuestLucky;

use App\Integration\GuestLucky\PhotoClient;
use App\Media\PropertyImageUrl;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

final class PhotoClientTest extends TestCase
{
    private const IMAGE = 'https://s3.eu-west-3.amazonaws.com/guestluckybucket/listings/';

    public function testPublicGalleryOrderDuplicatesAndUnrelatedImages(): void
    {
        $http = new MockHttpClient(function ($method, $url, $options) {
            self::assertSame('GET', $method);
            self::assertSame('https://app.guestlucky.io/book/test-private-key/2474', $url);
            self::assertSame(0, $options['max_redirects']);
            return new MockResponse('<img src="https://example.org/logo.png"><div id="gl-gallery"><img src="'.self::IMAGE.'b.jpg"><img src="'.self::IMAGE.'a.jpg"><img src="'.self::IMAGE.'b.jpg"></div>');
        });
        self::assertSame([self::IMAGE.'b.jpg', self::IMAGE.'a.jpg'], (new PhotoClient($http, 'https://app.guestlucky.io', 'test-private-key'))->photos(2474));
        self::assertSame(self::IMAGE.'a.jpg', PropertyImageUrl::resolve(self::IMAGE.'a.jpg'));
        self::assertSame('/uploads/lambersart/existing.jpg', PropertyImageUrl::resolve('lambersart/existing.jpg'));
    }

    public function testUnexpectedMarkupAndExternalOrCredentialedUrlsAreRejected(): void
    {
        foreach (['<h1>Login</h1>', '<div id="gl-gallery"><img src="https://example.org/photo.jpg"></div>', '<div id="gl-gallery"><img src="'.self::IMAGE.'photo.jpg?token=private"></div>'] as $html) {
            try {
                (new PhotoClient(new MockHttpClient(new MockResponse($html)), 'https://app.guestlucky.io', 'test-private-key'))->photos(2474);
                self::fail('Invalid gallery must be rejected.');
            } catch (\RuntimeException $error) {
                self::assertStringNotContainsString('test-private-key', $error->getMessage());
            }
        }
        foreach (['http://s3.eu-west-3.amazonaws.com/guestluckybucket/listings/a.jpg', self::IMAGE.'../a.jpg', self::IMAGE.'%2e%2e/a.jpg', self::IMAGE.'a.svg', 'https://private@s3.eu-west-3.amazonaws.com/guestluckybucket/listings/a.jpg'] as $url) self::assertFalse(PropertyImageUrl::isGuestLucky($url));
    }

    public function testProviderErrorDoesNotExposeBookingKeyAndExplicitEmptyGalleryIsValid(): void
    {
        self::assertSame([], (new PhotoClient(new MockHttpClient(new MockResponse('<div id="gl-gallery"></div>')), 'https://app.guestlucky.io', 'private'))->photos(2474));
        $this->expectExceptionMessage('GuestLucky gallery unavailable; previous photos preserved.');
        (new PhotoClient(new MockHttpClient(new MockResponse('error', ['http_code' => 500])), 'https://app.guestlucky.io', 'test-private-key'))->photos(2474);
    }
}
