<?php

declare(strict_types=1);

namespace App\Tests\GuestLucky;

use App\Entity\Amenity;
use App\Twig\AmenityPresentationExtension;
use PHPUnit\Framework\TestCase;

final class AmenityPresentationTest extends TestCase
{
    public function testAliasesAreDeduplicatedWithoutMutatingNamesOrIcons(): void
    {
        $legacy = (new Amenity())->setName('Wi-Fi')->setIcon('<svg>legacy</svg>');
        $items = [$legacy, (new Amenity())->setName('amenities.wifi'), (new Amenity())->setName('Cuisine'), (new Amenity())->setName('amenities.equipped_kitchen'),
            (new Amenity())->setName('Serviettes, draps de lit'), (new Amenity())->setName('amenities.towels'), (new Amenity())->setName('amenities.bed_linen')];
        $result = (new AmenityPresentationExtension())->present($items);
        self::assertSame(['amenities.wifi', 'amenities.equipped_kitchen', 'amenities.bed_linen', 'amenities.towels'], array_column($result, 'name'));
        self::assertSame('<svg>legacy</svg>', $result[0]['icon']);
        self::assertSame('Wi-Fi', $legacy->getName()); self::assertSame('<svg>legacy</svg>', $legacy->getIcon());
    }

    public function testPotentiallyDistinctOutdoorAmenitiesAndUnknownLabelsStayDistinct(): void
    {
        $items = array_map(static fn ($name) => (new Amenity())->setName($name), ['Terrasse', 'amenities.sheltered_patio', 'amenities.small_terrace', 'Local feature']);
        self::assertSame(['amenities.terrace', 'amenities.sheltered_patio', 'amenities.small_terrace', 'Local feature'], array_column((new AmenityPresentationExtension())->present($items), 'name'));
    }
}
