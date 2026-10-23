<?php

declare(strict_types=1);

namespace App\Twig;

use App\Entity\Amenity;
use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;

/** Normalize display labels only: existing shared amenities and joins stay untouched. */
final class AmenityPresentationExtension extends AbstractExtension
{
    private const ALIASES = [
        'wi-fi' => ['amenities.wifi'],
        'télévision' => ['amenities.television'],
        'cuisine' => ['amenities.kitchen'],
        'cuisine équipée' => ['amenities.equipped_kitchen'],
        'espace de travail' => ['amenities.workspace'],
        'machine à laver' => ['amenities.washing_machine'],
        'terrasse' => ['amenities.terrace'],
        'serviettes, draps de lit' => ['amenities.bed_linen', 'amenities.towels'],
        'bouilloire' => ['amenities.kettle'],
        'câble' => ['amenities.cable_tv'],
        'chauffage' => ['amenities.heating'],
        'cintres' => ['amenities.hangers'],
        'congélateur' => ['amenities.freezer'],
        'équipement de base pour cuisiner' => ['amenities.cooking_basics'],
        'lave-vaisselle' => ['amenities.dishwasher'],
        'savon et papier toilette' => ['amenities.soap_toilet_paper'],
        'sèche-cheveux' => ['amenities.hair_dryer'],
        'sèche-linge' => ['amenities.dryer'],
        'table à manger' => ['amenities.dining_table'],
    ];

    public function getFilters(): array { return [new TwigFilter('display_amenities', $this->present(...))]; }

    /** @param iterable<Amenity> $amenities @return list<array{name: string, icon: ?string}> */
    public function present(iterable $amenities): array
    {
        $items = [];
        foreach ($amenities as $amenity) {
            $name = trim($amenity->getName() ?? '');
            if ($name === '') continue;
            $normalized = mb_strtolower(preg_replace('/\s+/u', ' ', $name));
            foreach (self::ALIASES[$normalized] ?? [$name] as $key) {
                // A confirmed equipped kitchen supersedes a generic kitchen label.
                $identity = $key === 'amenities.equipped_kitchen' ? 'amenities.kitchen' : $key;
                if (!isset($items[$identity])) $items[$identity] = ['name' => $key, 'icon' => $amenity->getIcon()];
                else {
                    if ($key === 'amenities.equipped_kitchen') $items[$identity]['name'] = $key;
                    if (!$items[$identity]['icon'] && $amenity->getIcon()) $items[$identity]['icon'] = $amenity->getIcon();
                }
            }
        }
        return array_values($items);
    }
}
