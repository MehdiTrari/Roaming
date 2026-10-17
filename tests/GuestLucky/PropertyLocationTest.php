<?php

namespace App\Tests\GuestLucky;

use App\Entity\Property;
use PHPUnit\Framework\TestCase;

final class PropertyLocationTest extends TestCase
{
    public function testAddressFormattingPreservesCoordinatesButMovingClearsThem(): void
    {
        $property = (new Property())->setAddress('256 Avenue de Dunkerque, 59130 Lambersart')->setCoordinates(50.637488, 3.024341);
        $property->setAddress('256 AVENUE DE DUNKERQUE 59130 LAMBERSART, France');
        self::assertSame(50.637488, $property->getLatitude());
        self::assertSame(3.024341, $property->getLongitude());
        $property->setAddress('195 Rue du Collège, 59100 Roubaix');
        self::assertNull($property->getLatitude()); self::assertNull($property->getLongitude());
    }
    public function testDirectionsUseTheExactAddressWithoutInventingAnOrigin(): void
    {
        $property = (new Property())->setCity('Douai');
        self::assertNull($property->getDirectionsUrl());
        $property->setAddress('118 Rue de l’Hippodrome, 59500 Douai');
        $url = parse_url($property->getDirectionsUrl()); parse_str($url['query'], $query);
        self::assertSame('https', $url['scheme']); self::assertSame('www.google.com', $url['host']);
        self::assertSame('118 Rue de l’Hippodrome, 59500 Douai', $query['destination']);
        self::assertArrayNotHasKey('origin', $query);
    }
    public function testCoordinatesMustBeAPairOfFiniteValidNumbers(): void
    {
        foreach ([[50.5, null], [null, 3.1], [91, 3.1], [50.5, 181], [NAN, 3.1], [50.5, INF]] as [$lat, $lng]) {
            try { (new Property())->setCoordinates($lat, $lng); self::fail('Invalid coordinates accepted.'); }
            catch (\InvalidArgumentException) { self::assertTrue(true); }
        }
    }
}
