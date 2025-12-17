<?php

namespace App\Service;

use App\Entity\Property;

class AvailabilityService
{
    public function getAvailability(Property $property): array
    {
        $today = new \DateTimeImmutable('today');

        $booked = [
            ['start' => $today->modify('+2 days')->format('Y-m-d'), 'end' => $today->modify('+4 days')->format('Y-m-d')],
            ['start' => $today->modify('+10 days')->format('Y-m-d'), 'end' => $today->modify('+12 days')->format('Y-m-d')],
        ];

        return [
            'source' => 'demo',
            'nextAvailable' => $today->modify('+5 days')->format('Y-m-d'),
            'booked' => $booked,
        ];
    }
}
