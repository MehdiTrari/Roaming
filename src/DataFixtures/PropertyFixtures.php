<?php

namespace App\DataFixtures;

use App\Entity\Property;
use App\Entity\PropertyImage;
use App\Entity\Amenity;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

class PropertyFixtures extends Fixture
{
    public function load(ObjectManager $manager): void
    {
        // Create Amenities
        $amenities = [];
        foreach ($this->getAmenitiesData() as $key => $data) {
            $amenity = new Amenity();
            $amenity->setName($data['name']);
            $amenity->setIcon($data['icon']);
            $manager->persist($amenity);
            $amenities[$key] = $amenity;
        }

        $properties = $this->getPropertiesData();
        $catalogue = json_decode(file_get_contents(dirname(__DIR__, 2).'/config/guestlucky/catalogue.json'), true, 512, JSON_THROW_ON_ERROR);
        $current = array_column(\App\Integration\GuestLucky\CatalogueImporter::validate($catalogue), null, 'slug');

        foreach ($properties as $data) {
            $property = new Property();
            $property->setTitle($data['title']);
            if (isset($current[$data['slug']])) {
                $row = $current[$data['slug']];
                $property->setGuestLuckyId($row['id'])->setActive(true)->setTitle($row['name']);
                unset($current[$data['slug']]);
            }
            $property->setSlug($data['slug']);
            $property->setType($data['type']);
            $property->setCity($data['city']);
            $property->setArea($data['area']);
            $property->setTravelers($data['travelers']);
            $property->setBedrooms($data['bedrooms']);
            $property->setBeds($data['beds']);
            $property->setBathrooms($data['bathrooms']);
            // French content
            $property->setShortDescription($data['shortDescription']);
            $property->setAbout($data['about']);
            $property->setAccommodation($data['housing']);
            $property->setGuestAccess($data['guestAccess']);
            $property->setOtherRemarks($data['otherRemarks']);
            // English content
            $property->setShortDescriptionEn($data['shortDescriptionEn']);
            $property->setAboutEn($data['aboutEn']);
            $property->setAccommodationEn($data['housingEn']);
            $property->setGuestAccessEn($data['guestAccessEn']);
            $property->setOtherRemarksEn($data['otherRemarksEn']);
            
            // Airbnb data
            if (isset($data['airbnbUrl'])) {
                $property->setAirbnbUrl($data['airbnbUrl']);
            }
            if (isset($data['airbnbRating'])) {
                $property->setAirbnbRating($data['airbnbRating']);
            }
            if (isset($data['airbnbReviewsCount'])) {
                $property->setAirbnbReviewsCount($data['airbnbReviewsCount']);
            }

            // Add Amenities
            if (isset($data['amenities'])) {
                foreach ($data['amenities'] as $amenityKey) {
                    if (isset($amenities[$amenityKey])) {
                        $property->addAmenity($amenities[$amenityKey]);
                    }
                }
            }

            $manager->persist($property);

            // Add profile image (first image / cover)
            if (isset($data['image'])) {
                $image = new PropertyImage();
                $image->setFilename($data['image']);
                $image->setProperty($property);
                $image->setIsCover(true);
                $image->setPosition(0);
                $manager->persist($image);
            }

            // Add gallery images
            if (isset($data['gallery'])) {
                foreach ($data['gallery'] as $position => $filename) {
                    $image = new PropertyImage();
                    $image->setFilename($filename);
                    $image->setProperty($property);
                    $image->setIsCover(false);
                    $image->setPosition($position + 1);
                    $manager->persist($image);
                }
            }
        }

        foreach ($current as $row) {
            $property = (new Property())->setSlug($row['slug'])->setTitle($row['name'])->setCity($row['city'])->setTravelers($row['capacity'])->setGuestLuckyId($row['id'])->setActive(true);
            $manager->persist($property);
        }
        $manager->flush();
    }

    private function getPropertiesData(): array
    {
        return [
            [
                'title' => 'Maison Marcq-en-Barœul',
                'slug' => 'maison-marcq-en-baroeul',
                'type' => 'House',
                'city' => 'Marcq-en-Barœul',
                'area' => 105,
                'travelers' => 7,
                'bedrooms' => 3,
                'beds' => 4,
                'bathrooms' => 1.0,
                'image' => 'propertiesFirstPic/MaisonMarqProfil.jpeg',
                'gallery' => [
                    'MaisonMarq/MaisonMarq1.jpeg', 'MaisonMarq/MaisonMarq2.jpeg', 'MaisonMarq/MaisonMarq3.jpeg',
                    'MaisonMarq/MaisonMarq4.jpeg', 'MaisonMarq/MaisonMarq5.jpeg', 'MaisonMarq/MaisonMarq6.jpeg',
                    'MaisonMarq/MaisonMarq7.jpeg', 'MaisonMarq/MaisonMarq8.jpeg', 'MaisonMarq/MaisonMarq9.jpeg',
                    'MaisonMarq/MaisonMarq10.jpeg', 'MaisonMarq/MaisonMarq11.jpeg', 'MaisonMarq/MaisonMarq13.jpeg',
                    'MaisonMarq/MaisonMarq14.jpeg', 'MaisonMarq/MaisonMarq15.jpeg', 'MaisonMarq/MaisonMarq16.jpeg',
                    'MaisonMarq/MaisonMarq17.jpeg', 'MaisonMarq/MaisonMarq18.jpeg', 'MaisonMarq/MaisonMarq19.jpeg',
                    'MaisonMarq/MaisonMarq20.jpeg', 'MaisonMarq/MaisonMarq21.jpeg', 'MaisonMarq/MaisonMarq22.jpeg',
                    'MaisonMarq/MaisonMarq23.jpeg', 'MaisonMarq/MaisonMarq24.jpeg', 'MaisonMarq/MaisonMarq25.jpeg',
                    'MaisonMarq/MaisonMarq26.jpeg', 'MaisonMarq/MaisonMarq27.jpeg', 'MaisonMarq/MaisonMarq28.jpeg',
                    'MaisonMarq/MaisonMarq29.jpeg', 'MaisonMarq/MaisonMarq30.jpeg', 'MaisonMarq/MaisonMarq31.jpeg',
                    'MaisonMarq/MaisonMarq32.jpeg', 'MaisonMarq/MaisonMarq33.jpeg',
                ],
                // French
                'shortDescription' => 'Profitez d\'un séjour inoubliable dans cette superbe maison de 105 m² à Marcq-en-Barœul, à 10 minutes du centre de Lille. Sa grande verrière baigne le salon de lumière naturelle et s\'ouvre sur un jardin paisible.',
                'about' => 'Profitez d\'un séjour inoubliable dans cette superbe maison de 105 m² à Marcq-en-Barœul, à 10 minutes du centre de Lille.
Sa grande verrière baigne le salon de lumière naturelle et s\'ouvre sur un jardin paisible.

Avec ses 4 chambres confortables, sa décoration soignée et sa cuisine entièrement équipée, cet hébergement allie confort, élégance et convivialité pour un séjour réussi.',
                'housing' => 'Cette charmante maison de 105 m² est un véritable havre de paix à Marcq-en-Barœul.

Son vaste salon baigné de lumière grâce à sa verrière donnant sur le jardin offre une atmosphère chaleureuse et conviviale.

La décoration est soignée et allie confort, modernité et élégance.
La cuisine entièrement équipée vous permettra de préparer vos repas comme à la maison.
Les trois chambres sont spacieuses et confortables, chacune avec son ambiance propre.

Un lieu idéal pour se retrouver en famille, entre amis ou pour un séjour professionnel dans un cadre apaisant.',
                'guestAccess' => 'Les voyageurs ont accès à la maison entière ainsi qu\'à un jardin et une terrasse entièrement privés, parfaits pour prendre un café au soleil ou pour les fumeurs.

L\'arrivée se fait en toute autonomie grâce à un coffre à clés sécurisé, pratique pour arriver à l\'heure qui vous convient.

Le stationnement est facile et gratuit dans la rue, sans restrictions particulières.',
                'otherRemarks' => 'L\'hébergement est situé dans un quartier calme et résidentiel de Marcq-en-Barœul, à seulement 10 minutes du centre de Lille et à proximité du tramway et des commerces.

L\'intérieur du logement est non-fumeur, mais la terrasse et le jardin sont à votre disposition.
Les animaux sont également admis à l\'extérieur, sous surveillance.

Veuillez retirer vos chaussures aux 1er et 2e étages afin de préserver les revêtements de sol.

⚠️ Veuillez noter : un léger bruit de ventilation peut être entendu dans la chambre du dernier étage. Ce bruit reste discret, mais peut gêner les personnes au sommeil léger.

Tout est conçu pour que vous passiez un séjour paisible, confortable et agréable.',
                // English
                'shortDescriptionEn' => 'Enjoy an unforgettable stay in this beautiful 105 m² house in Marcq-en-Barœul, 10 minutes from Lille city center. Its large glass roof floods the living room with natural light and opens onto a peaceful garden.',
                'aboutEn' => 'Enjoy an unforgettable stay in this beautiful 105 m² house in Marcq-en-Barœul, 10 minutes from Lille city center.
Its large glass roof floods the living room with natural light and opens onto a peaceful garden.

With its 4 comfortable bedrooms, tasteful decor, and fully equipped kitchen, this home combines comfort, elegance, and warmth for a memorable stay.',
                'housingEn' => 'This charming 105 m² house is a true haven of peace in Marcq-en-Barœul.

Its spacious living room bathed in light from the glass roof overlooking the garden offers a warm and welcoming atmosphere.

The decor is tasteful, combining comfort, modernity, and elegance.
The fully equipped kitchen lets you prepare meals just like at home.
The three bedrooms are spacious and comfortable, each with its own ambiance.

An ideal place for family gatherings, friends, or a business trip in a soothing setting.',
                'guestAccessEn' => 'Guests have access to the entire house as well as a completely private garden and terrace, perfect for enjoying coffee in the sun or for smokers.

Arrival is fully autonomous thanks to a secure key box, convenient for arriving at whatever time suits you.

Parking is easy and free on the street, with no particular restrictions.',
                'otherRemarksEn' => 'The property is located in a quiet, residential neighborhood of Marcq-en-Barœul, just 10 minutes from Lille city center and close to the tramway and shops.

The interior is non-smoking, but the terrace and garden are available for you.
Pets are also welcome outside, under supervision.

Please remove your shoes on the 1st and 2nd floors to preserve the flooring.

⚠️ Please note: a slight ventilation noise may be heard in the top floor bedroom. This noise is discreet but may bother light sleepers.

Everything is designed to ensure you have a peaceful, comfortable, and pleasant stay.',
                'amenities' => ['towels', 'soap', 'tv', 'heating', 'kitchen', 'wifi', 'hairdryer', 'washer', 'dryer', 'parking', 'terrace', 'shampoo', 'hangers', 'pets', 'wheelchair', 'cooking_basics', 'workspace', 'coffee', 'freezer', 'microwave', 'dining_table', 'dishwasher', 'smart_tv'],
                // Airbnb
                'airbnbUrl' => 'airbnb.fr/h/marcq2',
                'airbnbRating' => 5.0,
                'airbnbReviewsCount' => 3,
            ],
            [
                'title' => 'Appartement Marcq-en-Barœul',
                'slug' => 'appartement-marcq-en-baroeul',
                'type' => 'Apartment',
                'city' => 'Marcq-en-Barœul',
                'area' => 90,
                'travelers' => 7,
                'bedrooms' => 4,
                'beds' => 4,
                'bathrooms' => 1.5,
                'image' => 'propertiesFirstPic/AppartementMarqProfil.jpeg',
                'gallery' => [
                    'AppartementMarq/AppartementMarq1.jpeg', 'AppartementMarq/AppartementMarq2.jpeg', 'AppartementMarq/AppartementMarq3.jpeg',
                    'AppartementMarq/AppartementMarq4.jpeg', 'AppartementMarq/AppartementMarq5.jpeg', 'AppartementMarq/AppartementMarq6.jpeg',
                    'AppartementMarq/AppartementMarq7.jpeg', 'AppartementMarq/AppartementMarq8.jpeg', 'AppartementMarq/AppartementMarq9.jpeg',
                    'AppartementMarq/AppartementMarq10.jpeg', 'AppartementMarq/AppartementMarq11.jpeg', 'AppartementMarq/AppartementMarq12.jpeg',
                    'AppartementMarq/AppartementMarq13.jpeg', 'AppartementMarq/AppartementMarq14.jpeg', 'AppartementMarq/AppartementMarq15.jpeg',
                    'AppartementMarq/AppartementMarq16.jpeg', 'AppartementMarq/AppartementMarq17.jpeg', 'AppartementMarq/AppartementMarq18.jpeg',
                    'AppartementMarq/AppartementMarq19.jpeg', 'AppartementMarq/AppartementMarq20.jpeg', 'AppartementMarq/AppartementMarq21.jpeg',
                    'AppartementMarq/AppartementMarq22.jpeg', 'AppartementMarq/AppartementMarq23.jpeg', 'AppartementMarq/AppartementMarq24.jpeg',
                    'AppartementMarq/AppartementMarq26.jpeg', 'AppartementMarq/AppartementMarq27.jpeg', 'AppartementMarq/AppartementMarq28.jpeg',
                    'AppartementMarq/AppartementMarq29.jpeg', 'AppartementMarq/AppartementMarq30.jpeg', 'AppartementMarq/AppartementMarq31.jpeg',
                    'AppartementMarq/AppartementMarq32.jpeg', 'AppartementMarq/AppartementMarq33.jpeg', 'AppartementMarq/AppartementMarq34.jpeg',
                    'AppartementMarq/AppartementMarq35.jpeg', 'AppartementMarq/AppartementMarq36.jpeg', 'AppartementMarq/AppartementMarq37.jpeg',
                    'AppartementMarq/AppartementMarq38.jpeg',
                ],
                // French
                'shortDescription' => 'Appartement haut de gamme de 90 m² à Marcq-en-Barœul, à 10 minutes de Lille. Lumineux et décoré avec soin, il offre un grand séjour design, une cuisine moderne entièrement équipée et quatre chambres confortables.',
                'about' => 'Appartement haut de gamme de 90 m² à Marcq-en-Barœul, à 10 minutes de Lille. Lumineux et décoré avec soin, il offre un grand séjour design, une cuisine moderne entièrement équipée et quatre chambres confortables au style unique.

Idéal pour les familles, les groupes d\'amis ou les voyageurs d\'affaires.
Quartier calme et recherché, à proximité du tramway, des commerces et des restaurants.

Confort, espace et élégance vous attendent.',
                'housing' => 'Découvrez un superbe appartement de 90 m², entièrement rénové et décoré avec soin.

Situé au 2ème étage d\'un immeuble calme, il allie charme, confort et modernité.

Vous profiterez d\'un grand salon lumineux au style design, d\'une cuisine moderne entièrement équipée (four, plaques de cuisson, machine à café, lave-vaisselle…) et de quatre chambres spacieuses, chacune avec son propre univers pour garantir à chacun confort et intimité.

Les vieux parquets, la décoration soignée et la lumière naturelle créent une atmosphère chaleureuse et apaisante, idéale pour se détendre après une journée à Lille ou à Marcq-en-Barœul.',
                'guestAccess' => 'L\'appartement se situe au deuxième étage de l\'immeuble.
L\'entrée se fait par la porte noire au rez-de-chaussée, facilement repérable depuis la rue.
Vous aurez accès à l\'intégralité du logement, qui vous est entièrement réservé.

Un système de boîtes à clés sécurisées vous permettra d\'arriver et de partir indépendamment, à l\'heure qui vous convient.

Le stationnement est gratuit et facile dans la rue, juste en face du logement.',
                'otherRemarks' => 'Le logement est situé dans un quartier résidentiel paisible et très agréable de Marcq-en-Barœul, à quelques pas du tramway, des commerces et à 10 minutes du centre de Lille.

Pour garantir le confort et la tranquillité de tous, l\'établissement est non-fumeur, les animaux ne sont pas acceptés et les fêtes ne sont pas autorisées.

Tout a été pensé pour que vous profitiez d\'un séjour paisible, confortable et sans stress.',
                // English
                'shortDescriptionEn' => 'High-end 90 m² apartment in Marcq-en-Barœul, 10 minutes from Lille. Bright and tastefully decorated, it features a designer living room, a fully equipped modern kitchen, and four comfortable bedrooms.',
                'aboutEn' => 'High-end 90 m² apartment in Marcq-en-Barœul, 10 minutes from Lille. Bright and tastefully decorated, it features a designer living room, a fully equipped modern kitchen, and four comfortable bedrooms with unique styles.

Ideal for families, groups of friends, or business travelers.
Quiet and sought-after neighborhood, close to the tramway, shops, and restaurants.

Comfort, space, and elegance await you.',
                'housingEn' => 'Discover a superb 90 m² apartment, fully renovated and tastefully decorated.

Located on the 2nd floor of a quiet building, it combines charm, comfort, and modernity.

You\'ll enjoy a large, bright living room with a designer style, a fully equipped modern kitchen (oven, stovetop, coffee machine, dishwasher...) and four spacious bedrooms, each with its own character to ensure everyone\'s comfort and privacy.

The old parquet floors, tasteful decor, and natural light create a warm and soothing atmosphere, ideal for relaxing after a day in Lille or Marcq-en-Barœul.',
                'guestAccessEn' => 'The apartment is located on the second floor of the building.
Entry is through the black door on the ground floor, easily visible from the street.
You\'ll have access to the entire property, which is entirely reserved for you.

A secure key box system will allow you to arrive and leave independently, at whatever time suits you.

Parking is free and easy on the street, right in front of the property.',
                'otherRemarksEn' => 'The property is located in a peaceful and pleasant residential neighborhood of Marcq-en-Barœul, just steps from the tramway, shops, and 10 minutes from Lille city center.

To ensure everyone\'s comfort and tranquility, the property is non-smoking, pets are not allowed, and parties are not permitted.

Everything has been designed for you to enjoy a peaceful, comfortable, and stress-free stay.',
                'amenities' => ['towels', 'soap', 'heating', 'kitchen', 'hairdryer', 'parking', 'no_smoking', 'cooking_basics', 'coffee', 'freezer', 'kettle', 'microwave', 'dishwasher'],
                // Airbnb
                'airbnbUrl' => 'airbnb.fr/h/roamingmarcq1',
                'airbnbRating' => 5.0,
                'airbnbReviewsCount' => 4,
            ],
            [
                'title' => 'Duplex Lambersart',
                'slug' => 'lambersart',
                'type' => 'Duplex',
                'city' => 'Lambersart',
                'area' => 140,
                'travelers' => 10,
                'bedrooms' => 4,
                'beds' => 6,
                'bathrooms' => 2.5,
                'image' => 'propertiesFirstPic/LambersartProfil.jpg',
                'gallery' => [
                    'Lambersart/Lambersart1.jpg', 'Lambersart/Lambersart2.jpg', 'Lambersart/Lambersart3.jpg',
                    'Lambersart/Lambersart4.jpg', 'Lambersart/Lambersart5.jpg', 'Lambersart/Lambersart6.jpg',
                    'Lambersart/Lambersart7.jpg', 'Lambersart/Lambersart8.jpg', 'Lambersart/Lambersart9.jpg',
                    'Lambersart/Lambersart10.jpg', 'Lambersart/Lambersart11.jpg', 'Lambersart/Lambersart12.jpg',
                    'Lambersart/Lambersart14.jpg', 'Lambersart/Lambersart15.jpg', 'Lambersart/Lambersart16.jpg',
                    'Lambersart/Lambersart17.jpg', 'Lambersart/Lambersart18.jpg', 'Lambersart/Lambersart19.jpg',
                    'Lambersart/Lambersart20.jpg', 'Lambersart/Lambersart21.jpg',
                ],
                // French
                'shortDescription' => 'Spacieux duplex de 140 m² idéalement situé à Lambersart, à quelques minutes du métro et du centre de Lille. Lumineux, moderne et entièrement équipé, il offre deux grandes terrasses.',
                'about' => 'Spacieux duplex de 140 m² idéalement situé à Lambersart, à quelques minutes du métro et du centre de Lille. Lumineux, moderne et entièrement équipé, il offre deux grandes terrasses, un séjour chaleureux et une cuisine équipée.

Parfait pour les familles, les groupes d\'amis ou les voyageurs d\'affaires.
Le quartier est calme, recherché et très pratique, avec commerces, restaurants et transports en commun accessibles à pied. Confort, espace et tranquillité vous y attendent.',
                'housing' => 'Découvrez un duplex de 140 m² conçu pour le confort de tous.

Le séjour lumineux s\'ouvre sur une grande terrasse, idéale pour se détendre ou prendre ses repas en plein air.
La cuisine est entièrement équipée (four, plaques de cuisson, lave-vaisselle, micro-ondes, cafetière, etc.) pour cuisiner comme à la maison.

Le logement dispose de quatre chambres confortables avec une literie de qualité et peut accueillir jusqu\'à 10 personnes.
Son agencement spacieux, sa luminosité naturelle et sa décoration moderne créent une atmosphère agréable où chacun trouve son espace.',
                'guestAccess' => 'Le duplex est entièrement réservé aux hôtes.
Vous pourrez également profiter des deux terrasses, idéales pour se détendre.
Le stationnement est gratuit et facile dans le quartier.',
                'otherRemarks' => null,
                // English
                'shortDescriptionEn' => 'Spacious 140 m² duplex ideally located in Lambersart, just minutes from the metro and Lille city center. Bright, modern, and fully equipped, it features two large terraces.',
                'aboutEn' => 'Spacious 140 m² duplex ideally located in Lambersart, just minutes from the metro and Lille city center. Bright, modern, and fully equipped, it offers two large terraces, a cozy living room, and an equipped kitchen.

Perfect for families, groups of friends, or business travelers.
The neighborhood is quiet, sought-after, and very convenient, with shops, restaurants, and public transport within walking distance. Comfort, space, and tranquility await you.',
                'housingEn' => 'Discover a 140 m² duplex designed for everyone\'s comfort.

The bright living room opens onto a large terrace, ideal for relaxing or dining outdoors.
The kitchen is fully equipped (oven, stovetop, dishwasher, microwave, coffee maker, etc.) for cooking just like at home.

The property has four comfortable bedrooms with quality bedding and can accommodate up to 10 people.
Its spacious layout, natural light, and modern decor create a pleasant atmosphere where everyone finds their space.',
                'guestAccessEn' => 'The duplex is entirely reserved for guests.
You can also enjoy the two terraces, ideal for relaxing.
Parking is free and easy in the neighborhood.',
                'otherRemarksEn' => null,
                'amenities' => ['towels', 'soap', 'tv', 'heating', 'kitchen', 'wifi', 'washer', 'terrace', 'shampoo', 'hangers', 'cooking_basics', 'workspace', 'coffee', 'freezer', 'kettle', 'microwave', 'dining_table'],
                // Airbnb
                'airbnbUrl' => 'airbnb.fr/h/roamingllambrsart',
                'airbnbRating' => 4.42,
                'airbnbReviewsCount' => 19,
            ],
            [
                'title' => 'Maison familiale Roubaix',
                'slug' => 'roubaix',
                'type' => 'House',
                'city' => 'Roubaix',
                'area' => null,
                'travelers' => 10,
                'bedrooms' => 5,
                'beds' => 6,
                'bathrooms' => 2.0,
                'image' => 'propertiesFirstPic/RoubaixProfil.JPG',
                'gallery' => [
                    'Roubaix/Roubaix1.JPG', 'Roubaix/Roubaix2.JPG', 'Roubaix/Roubaix3.JPG',
                    'Roubaix/Roubaix4.JPG', 'Roubaix/Roubaix5.JPG', 'Roubaix/Roubaix6.JPG',
                    'Roubaix/Roubaix7.JPG', 'Roubaix/Roubaix8.JPG', 'Roubaix/Roubaix9.jpeg',
                    'Roubaix/Roubaix10.JPG', 'Roubaix/Roubaix11.JPG', 'Roubaix/Roubaix12.JPG',
                    'Roubaix/Roubaix13.JPG', 'Roubaix/Roubaix14.JPG', 'Roubaix/Roubaix16.JPG',
                    'Roubaix/Roubaix17.JPG', 'Roubaix/Roubaix18.JPG', 'Roubaix/Roubaix19.JPG',
                    'Roubaix/Roubaix20.JPG',
                ],
                // French
                'shortDescription' => 'Magnifique maison familiale spacieuse et décorée avec goût, à proximité de toutes les commodités. Dotée d\'une charmante cour privée, elle offre un espace convivial pour 10 personnes.',
                'about' => 'Magnifique maison familiale spacieuse et décorée avec goût, à proximité de toutes les commodités.
Dotée d\'une charmante cour privée, elle offre un espace convivial et relaxant pouvant accueillir jusqu\'à 10 personnes.

Idéale pour les familles, les groupes ou les équipes professionnelles.
Confort, espace et convivialité garantis.',
                'housing' => 'La maison comprend :
• 5 chambres spacieuses,
• 6 lits confortables,
• 2 salles de bain modernes,
• 2 WC,
• un salon lumineux,
• une grande salle à manger,
• et une cuisine entièrement équipée (four, plaques de cuisson, micro-ondes, lave-vaisselle, réfrigérateur, etc.).

Vous y trouverez également un baby-foot, des jeux de société et tout le nécessaire pour un séjour agréable.
Le linge de lit (draps et serviettes) est fourni.',
                'guestAccess' => 'Les hôtes ont accès à l\'ensemble de la maison et à la cour privée.
Le stationnement dans la rue est gratuit.',
                'otherRemarks' => null,
                // English
                'shortDescriptionEn' => 'Beautiful, spacious family home tastefully decorated, close to all amenities. Featuring a charming private courtyard, it offers a welcoming space for up to 10 guests.',
                'aboutEn' => 'Beautiful, spacious family home tastefully decorated, close to all amenities.
Featuring a charming private courtyard, it offers a welcoming and relaxing space for up to 10 people.

Ideal for families, groups, or professional teams.
Comfort, space, and conviviality guaranteed.',
                'housingEn' => 'The house includes:
• 5 spacious bedrooms,
• 6 comfortable beds,
• 2 modern bathrooms,
• 2 toilets,
• a bright living room,
• a large dining room,
• and a fully equipped kitchen (oven, stovetop, microwave, dishwasher, refrigerator, etc.).

You\'ll also find a foosball table, board games, and everything you need for a pleasant stay.
Bed linen (sheets and towels) is provided.',
                'guestAccessEn' => 'Guests have access to the entire house and the private courtyard.
Street parking is free.',
                'otherRemarksEn' => null,
                'amenities' => ['towels', 'soap', 'tv', 'cable', 'heating', 'kitchen', 'wifi', 'hairdryer', 'washer', 'dryer', 'terrace', 'hangers', 'cooking_basics', 'workspace', 'freezer', 'kettle', 'dining_table', 'dishwasher'],
            ],
            [
                'title' => 'Appartement Wazemmes',
                'slug' => 'wazemmes',
                'type' => 'Apartment',
                'city' => 'Wazemmes, Lille',
                'area' => null,
                'travelers' => 4,
                'bedrooms' => 1,
                'beds' => 1,
                'bathrooms' => 1.0,
                'image' => 'propertiesFirstPic/WazemmesProfil.avif',
                'gallery' => [
                    'Wazemmes/Wazemmes1.avif', 'Wazemmes/Wazemmes2.avif', 'Wazemmes/Wazemmes3.avif',
                    'Wazemmes/Wazemmes4.avif', 'Wazemmes/Wazemmes5.avif', 'Wazemmes/Wazemmes6.avif',
                ],
                // French
                'shortDescription' => 'Appartement lumineux et accueillant situé au cœur de Wazemmes, l\'un des quartiers les plus animés et authentiques de Lille. À seulement 3 minutes du métro et à deux pas du marché.',
                'about' => 'Appartement lumineux et accueillant situé au cœur de Wazemmes, l\'un des quartiers les plus animés et authentiques de Lille.
À seulement 3 minutes du métro et à deux pas du marché, il bénéficie d\'un emplacement idéal tout en offrant un cadre paisible grâce à sa cour intérieure.

Parfait pour un séjour en couple, entre amis ou pour un voyage d\'affaires.',
                'housing' => 'L\'appartement peut accueillir jusqu\'à 4 personnes et comprend :
• une chambre spacieuse avec rangements,
• un salon confortable avec un canapé-lit,
• une cuisine entièrement équipée (four, plaques de cuisson, micro-ondes, réfrigérateur, ustensiles, etc.) et
• une salle de bain moderne avec douche et lave-linge.

Décoré avec soin et conçu pour votre confort, il offre tout le nécessaire pour un séjour agréable et sans souci.',
                'guestAccess' => 'Le logement est entièrement privé.
Le quartier regorge de commerces et services de proximité : supérette, boulangerie, pharmacie, restaurants, tout est accessible à pied.
Des places de stationnement gratuites sont disponibles dans la rue.',
                'otherRemarks' => 'Le marché de Wazemmes, l\'un des plus réputés de France, est à deux pas.
Logement non-fumeur, animaux non admis, fêtes interdites.
Un cadre paisible et pratique au cœur d\'un quartier animé.',
                // English
                'shortDescriptionEn' => 'Bright and welcoming apartment in the heart of Wazemmes, one of Lille\'s most vibrant and authentic neighborhoods. Just 3 minutes from the metro and steps from the market.',
                'aboutEn' => 'Bright and welcoming apartment in the heart of Wazemmes, one of Lille\'s most vibrant and authentic neighborhoods.
Just 3 minutes from the metro and steps from the market, it enjoys an ideal location while offering a peaceful setting thanks to its inner courtyard.

Perfect for a stay as a couple, with friends, or for a business trip.',
                'housingEn' => 'The apartment can accommodate up to 4 people and includes:
• a spacious bedroom with storage,
• a comfortable living room with a sofa bed,
• a fully equipped kitchen (oven, stovetop, microwave, refrigerator, utensils, etc.) and
• a modern bathroom with shower and washing machine.

Tastefully decorated and designed for your comfort, it offers everything you need for a pleasant and worry-free stay.',
                'guestAccessEn' => 'The property is entirely private.
The neighborhood is full of nearby shops and services: convenience store, bakery, pharmacy, restaurants, everything is within walking distance.
Free parking spaces are available on the street.',
                'otherRemarksEn' => 'The Wazemmes market, one of the most renowned in France, is just steps away.
Non-smoking property, pets not allowed, parties prohibited.
A peaceful and practical setting in the heart of a lively neighborhood.',
                'amenities' => ['towels', 'soap', 'tv', 'heating', 'kitchen', 'wifi', 'washer', 'terrace', 'shampoo', 'hangers', 'cooking_basics', 'workspace', 'coffee', 'freezer', 'kettle', 'microwave', 'dining_table'],
                // Airbnb
                'airbnbUrl' => 'airbnb.fr/h/roaming',
                'airbnbRating' => 4.44,
                'airbnbReviewsCount' => 94,
            ],
        ];
    }

    private function getAmenitiesData(): array
    {
        return [
            'towels' => ['name' => 'Serviettes, draps de lit', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M14 4.5V9H2V4.5A2.5 2.5 0 0 1 4.5 2h7A2.5 2.5 0 0 1 14 4.5zm-.5 4a.5.5 0 0 0 .5-.5V4.5A1.5 1.5 0 0 0 12.5 3h-7A1.5 1.5 0 0 0 4 4.5V8a.5.5 0 0 0 .5.5h9zM2 10v1.5A2.5 2.5 0 0 0 4.5 14h7a2.5 2.5 0 0 0 2.5-2.5V10H2zm1 .5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 .5.5v1a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 11.5v-1z"/></svg>'],
            'soap' => ['name' => 'Savon et papier toilette', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M8.5 2.2c.3-.5.8-.7 1.2-.3l3.9 3.3a1 1 0 0 1 .1 1.4l-5.2 6.2c-.3.4-.9.5-1.3.1L3.4 9.7a1 1 0 0 1 0-1.4l5.1-6.1zM5 14a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5A.5.5 0 0 1 5 14z"/></svg>'],
            'tv' => ['name' => 'Télévision', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M2.5 13.5A.5.5 0 0 1 3 13h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zM13.991 3l.024.001a1.46 1.46 0 0 1 .538.143.757.757 0 0 1 .302.254c.067.1.145.277.145.602v5.991l-.001.024a1.464 1.464 0 0 1-.143.538.758.758 0 0 1-.254.302c-.1.067-.277.145-.602.145H2.009l-.024-.001a1.464 1.464 0 0 1-.538-.143.758.758 0 0 1-.302-.254C1.078 10.502 1 10.325 1 10V4.009l.001-.024a1.46 1.46 0 0 1 .143-.538.758.758 0 0 1 .254-.302C1.498 3.078 1.675 3 2 3h11.991zM14 2H2C0 2 0 4 0 4v6c0 2 2 2 2 2h12c2 0 2-2 2-2V4c0-2-2-2-2-2z"/></svg>'],
            'cable' => ['name' => 'Câble', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M3 2a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 3 2zm2 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 5 2zm3.5 1.5a.5.5 0 0 0-1 0v1h1v-1zm-1 4.5h1v1.5h-1V8zm0 3h1v.5a.5.5 0 0 1-.5.5h0a.5.5 0 0 1-.5-.5V11zm0-6h1v1.5h-1V5zm5.5 3v-.5A1.5 1.5 0 0 0 11.5 6h-1V4.5A1.5 1.5 0 0 0 9 3H6a1.5 1.5 0 0 0-1.5 1.5V6h-1A1.5 1.5 0 0 0 2 7.5V8h1v5.5A2.5 2.5 0 0 0 5.5 16h5a2.5 2.5 0 0 0 2.5-2.5V8h1v-.5z"/></svg>'],
            'heating' => ['name' => 'Chauffage', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M5 12.5a1.5 1.5 0 1 1-2-1.415V9.5a.5.5 0 0 1 1 0v1.585A1.5 1.5 0 0 1 5 12.5z"/><path d="M1 2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5z"/><path d="M9 2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5z"/><path d="M13 12.5a1.5 1.5 0 1 1-2-1.415V9.5a.5.5 0 0 1 1 0v1.585a1.5 1.5 0 0 1 1 1.415z"/><path d="M2 1a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V1zm1 0v14h10V1H3z"/></svg>'],
            'kitchen' => ['name' => 'Cuisine', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M3 2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1h1a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1V2zm1 0v1h8V2a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1zm-1 3h10v9H3V5zm2 1a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 1 0v-2A.5.5 0 0 0 5 6zm3 0a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 1 0v-2A.5.5 0 0 0 8 6zm3 0a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 1 0v-2A.5.5 0 0 0 11 6z"/></svg>'],
            'wifi' => ['name' => 'Wi-Fi', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M15.384 6.115a.485.485 0 0 0-.047-.736A12.444 12.444 0 0 0 8 3C5.259 3 2.723 3.882.663 5.379a.485.485 0 0 0-.048.736.518.518 0 0 0 .668.05A11.448 11.448 0 0 1 8 4c2.507 0 4.827.802 6.716 2.164.205.148.49.13.668-.049z"/><path d="M13.229 8.271a.482.482 0 0 0-.063-.745A9.455 9.455 0 0 0 8 6c-1.905 0-3.68.56-5.166 1.526a.48.48 0 0 0-.063.745.525.525 0 0 0 .652.065A8.46 8.46 0 0 1 8 7a8.46 8.46 0 0 1 4.576 1.336c.206.132.48.108.653-.065zm-2.183 2.183c.226-.226.185-.605-.1-.75A6.473 6.473 0 0 0 8 9c-1.06 0-2.062.254-2.946.704-.285.145-.326.524-.1.75l.015.015c.16.16.407.19.611.09A5.478 5.478 0 0 1 8 10c.868 0 1.69.201 2.42.56.203.1.45.07.61-.091l.016-.015zM9.06 12.44c.196-.196.198-.52-.04-.66A1.99 1.99 0 0 0 8 11.5a1.99 1.99 0 0 0-1.02.28c-.238.14-.236.464-.04.66l.706.706a.5.5 0 0 0 .707 0l.707-.707z"/></svg>'],
            'hairdryer' => ['name' => 'Sèche-cheveux', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 512 512"><path d="M322.9 32c-19.5 0-38.1 8.4-51 23.1L154.6 187.4c-25 28.5-38.6 65.2-38.6 103.2V336c0 44.2 35.8 80 80 80h48c17.7 0 32-14.3 32-32s-14.3-32-32-32h-48c-8.8 0-16-7.2-16-16v-45.4c0-22.8 8.2-44.9 23.2-62l117.3-132.3c2.6-2.9 6.3-4.6 10.2-4.6 7.8 0 14.1 6.3 14.1 14.1V192c0 17.7 14.3 32 32 32h64c17.7 0 32-14.3 32-32V96c0-35.3-28.7-64-64-64H322.9zM80 352c-26.5 0-48 21.5-48 48v64c0 26.5 21.5 48 48 48s48-21.5 48-48v-64c0-26.5-21.5-48-48-48z"/></svg>'],
            'washer' => ['name' => 'Machine à laver', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm3.5 1a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1zM5 3.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>'],
            'dryer' => ['name' => 'Sèche-linge', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M8 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM3.5 4a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM6 3.5a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0z"/></svg>'],
            'parking' => ['name' => 'Parking gratuit sur place', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5V5h2V2.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v7.864a.5.5 0 0 1-.5.5H1.5a.5.5 0 0 1-.5-.5V2.5zM2 10v3.5a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5V10H2zm9 0v3.5a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5V10h-3zM6 11h4v.5a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5V11z"/></svg>'],
            'terrace' => ['name' => 'Terrasse', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M8 1a.5.5 0 0 1 .5.5v.5H14a.5.5 0 0 1 .4.8l-2 2.667V14.5a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V5.467L1.1 2.8A.5.5 0 0 1 1.5 2h6V1.5A.5.5 0 0 1 8 1zm5.467 2H2.533L4 5.067V14h8V5.067L13.467 3z"/></svg>'],
            'shampoo' => ['name' => 'Shampooing', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M10 5v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2zm-3-4a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 1 0v-1A.5.5 0 0 0 7 1zm2 0a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 1 0v-1A.5.5 0 0 0 9 1zM4.5 14a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5z"/></svg>'],
            'hangers' => ['name' => 'Cintres', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M8 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM6 4.5a2 2 0 1 1 2.348 1.97L14.5 11.5a.5.5 0 0 1-.354.854l-12.292-.001a.5.5 0 0 1-.354-.853l6.152-5.03A2 2 0 0 1 6 4.5z"/></svg>'],
            'pets' => ['name' => 'Animaux acceptés', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M6 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 6s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H1zM11 3.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5z"/></svg>'],
            'wheelchair' => ['name' => 'Accessible en fauteuil roulant', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4.5a.5.5 0 0 1 .5.5v2h3a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V8h-3a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5zM7 7.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0 0 1H6v5.5a.5.5 0 0 0 1 0V7.5zM8 1a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM4.5 12a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0z"/></svg>'],
            'cooking_basics' => ['name' => 'Équipement de base pour cuisiner', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M7 4.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm-3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm6 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zM2 8v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8H2zm0-1h12a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1z"/></svg>'],
            'workspace' => ['name' => 'Espace de travail', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M13.5 3a.5.5 0 0 1 .5.5V11H2V3.5a.5.5 0 0 1 .5-.5h11zm-11-1A1.5 1.5 0 0 0 1 3.5V12h14V3.5A1.5 1.5 0 0 0 13.5 2h-11zM0 12.5h16v.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 13v-.5z"/></svg>'],
            'coffee' => ['name' => 'Machine à café', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M.5 6a.5.5 0 0 0-.488.608l1.652 7.434A2.5 2.5 0 0 0 4.104 16h5.792a2.5 2.5 0 0 0 2.44-1.958l.131-.59a3 3 0 0 0 1.3-5.854l.221-.99A.5.5 0 0 0 13.5 6H.5ZM13 12.5a2.01 2.01 0 0 1-.316-.025l.867-3.898A2.001 2.001 0 0 1 13 12.5ZM2.64 13.825 1.123 7h11.754l-1.517 6.825A1.5 1.5 0 0 1 9.896 15H4.104a1.5 1.5 0 0 1-1.464-1.175Z"/><path d="m4.4.8-.003.004-.014.019a4.167 4.167 0 0 0-.204.31 2.327 2.327 0 0 0-.141.267c-.026.06-.034.092-.037.103v.004a.593.593 0 0 0 .091.248c.075.133.178.272.308.445l.01.012c.118.158.26.347.37.543.112.2.22.455.22.745 0 .188-.065.368-.119.494a3.31 3.31 0 0 1-.202.388 5.444 5.444 0 0 1-.253.382l-.018.025-.005.008-.002.002A.5.5 0 0 1 3.6 4.2l.003-.004.014-.019a4.149 4.149 0 0 0 .204-.31 2.06 2.06 0 0 0 .141-.267c.026-.06.034-.092.037-.103a.593.593 0 0 0-.09-.252A4.334 4.334 0 0 0 3.6 2.8l-.01-.012a5.099 5.099 0 0 1-.37-.543A1.53 1.53 0 0 1 3 1.5c0-.188.065-.368.119-.494.059-.138.134-.274.202-.388a5.446 5.446 0 0 1 .253-.382l.025-.033A.5.5 0 0 1 4.4.8Zm3 0-.003.004-.014.019a4.167 4.167 0 0 0-.204.31 2.327 2.327 0 0 0-.141.267c-.026.06-.034.092-.037.103v.004a.593.593 0 0 0 .091.248c.075.133.178.272.308.445l.01.012c.118.158.26.347.37.543.112.2.22.455.22.745 0 .188-.065.368-.119.494a3.31 3.31 0 0 1-.202.388 5.444 5.444 0 0 1-.253.382l-.018.025-.005.008-.002.002A.5.5 0 0 1 6.6 4.2l.003-.004.014-.019a4.149 4.149 0 0 0 .204-.31 2.06 2.06 0 0 0 .141-.267c.026-.06.034-.092.037-.103a.593.593 0 0 0-.09-.252A4.334 4.334 0 0 0 6.6 2.8l-.01-.012a5.099 5.099 0 0 1-.37-.543A1.53 1.53 0 0 1 6 1.5c0-.188.065-.368.119-.494.059-.138.134-.274.202-.388a5.446 5.446 0 0 1 .253-.382l.025-.033A.5.5 0 0 1 7.4.8Z"/></svg>'],
            'freezer' => ['name' => 'Congélateur', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0a.5.5 0 0 1 .5.5v2.793l1.146-1.147a.5.5 0 0 1 .708.708L8.5 4.707V7h2.293l1.854-1.854a.5.5 0 0 1 .707.708L12.207 7H15.5a.5.5 0 0 1 0 1h-3.293l1.147 1.146a.5.5 0 0 1-.708.708L11.793 9H8.5v2.293l1.854 1.854a.5.5 0 0 1-.708.707L8.5 12.707V15.5a.5.5 0 0 1-1 0v-2.793l-1.146 1.147a.5.5 0 0 1-.708-.707L6.793 12H4.207l-1.853 1.854a.5.5 0 1 1-.708-.708L2.793 12H.5a.5.5 0 0 1 0-1h2.293L1.646 9.854a.5.5 0 1 1 .708-.708L4.207 11h2.586L6.5 9.207V7H4.207L2.354 8.854a.5.5 0 1 1-.708-.708L2.793 7H.5a.5.5 0 0 1 0-1h2.293L1.646 4.854a.5.5 0 1 1 .708-.708L4.207 6h2.086l.5-.5V2.793L5.646 3.939a.5.5 0 1 1-.708-.707L6.793 1.377 7.5.5A.5.5 0 0 1 8 0z"/></svg>'],
            'kettle' => ['name' => 'Bouilloire', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 6a.5.5 0 0 0-.488.608l1.652 7.434A2.5 2.5 0 0 0 4.104 16h5.792a2.5 2.5 0 0 0 2.44-1.958l.131-.59a3 3 0 0 0 1.3-5.854l.221-.99A.5.5 0 0 0 13.5 6H.5ZM2.64 13.825 1.123 7h11.754l-1.517 6.825A1.5 1.5 0 0 1 9.896 15H4.104a1.5 1.5 0 0 1-1.464-1.175Z"/></svg>'],
            'microwave' => ['name' => 'Micro-ondes', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M2 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H2zm.5 2h8a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-6a.5.5 0 0 1 .5-.5zm10 0a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1zm0 2a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1zm0 2a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1z"/></svg>'],
            'dining_table' => ['name' => 'Table à manger', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M0 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v1H0V5zm1 2h14v1a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V7zm1 3h1v4a.5.5 0 0 1-1 0v-4zm11 0h1v4a.5.5 0 0 1-1 0v-4z"/></svg>'],
            'dishwasher' => ['name' => 'Lave-vaisselle', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm3.5 1a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1zM5 3.5a.5.5 0 1 0 1 0 .5.5 0 0 0-1 0zM2 6v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6H2zm5 4a1 1 0 1 1 2 0 1 1 0 0 1-2 0z"/></svg>'],
            'smart_tv' => ['name' => 'Smart TV', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M2.5 13.5A.5.5 0 0 1 3 13h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zM2 2h12s2 0 2 2v6s0 2-2 2H2s-2 0-2-2V4s0-2 2-2zm6 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>'],
            'no_smoking' => ['name' => 'Interdiction de fumer', 'icon' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M1.293 1.293a1 1 0 0 1 1.414 0l12 12a1 1 0 0 1-1.414 1.414l-12-12a1 1 0 0 1 0-1.414z"/><path d="M13.5 9a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2a.5.5 0 0 1 .5-.5z"/><path d="M11 9.5v2a.5.5 0 0 1-1 0v-2a.5.5 0 0 1 1 0z"/><path d="M2 9.5c0-.28.22-.5.5-.5H9a.5.5 0 0 1 0 1H2.5a.5.5 0 0 1-.5-.5zM2 12c0-.28.22-.5.5-.5H9a.5.5 0 0 1 0 1H2.5a.5.5 0 0 1-.5-.5z"/></svg>'],
        ];
    }
}
