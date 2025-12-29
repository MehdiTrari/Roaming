<?php

namespace App\Controller;

use App\Repository\PropertyRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class AvailabilityController extends AbstractController
{
    private HttpClientInterface $httpClient;
    private PropertyRepository $propertyRepository;

    private const SMOOBU_USER_ID = '1213908';
    private const SMOOBU_BASE_URL = 'https://booking.smoobu.com/RoamingLille';

    /**
     * Public property definitions.
     */
    private const PROPERTIES = [
        [
            'name' => 'Appartement Wazemmes',
            'slug' => 'wazemmes',
            'smoobuId' => '2695213',
            'maxGuests' => 4,
            'city' => 'Lille',
        ],
        [
            'name' => 'Maison familiale Roubaix',
            'slug' => 'roubaix',
            'smoobuId' => '2695583',
            'maxGuests' => 10,
            'city' => 'Roubaix',
        ],
        [
            'name' => 'Appartement Marcq-en-Barœul',
            'slug' => 'appartement-marcq-en-baroeul',
            'smoobuId' => '3006736',
            'maxGuests' => 7,
            'city' => 'Marcq-en-Barœul',
        ],
        [
            'name' => 'Maison Marcq-en-Barœul',
            'slug' => 'maison-marcq-en-baroeul',
            'smoobuId' => '3006741',
            'maxGuests' => 7,
            'city' => 'Marcq-en-Barœul',
        ],
        [
            'name' => 'Duplex Lambersart',
            'slug' => 'lambersart',
            'smoobuId' => '2948001',
            'maxGuests' => 10,
            'city' => 'Lambersart',
        ],
    ];

    public function __construct(HttpClientInterface $httpClient, PropertyRepository $propertyRepository)
    {
        $this->httpClient = $httpClient;
        $this->propertyRepository = $propertyRepository;
    }

    #[Route('/api/availability', name: 'api_availability', methods: ['GET'])]
    public function __invoke(Request $request): JsonResponse
    {
        $arrival = $request->query->get('arrivalDate');
        $departure = $request->query->get('departureDate');
        $guests = (int) $request->query->get('guests', 1);

        if (!$arrival || !$departure) {
            return $this->json(['error' => 'Missing dates'], 400);
        }

        try {
            $arrivalDt = new \DateTimeImmutable($arrival);
            $departureDt = new \DateTimeImmutable($departure);
        } catch (\Exception $e) {
            return $this->json(['error' => 'Invalid date format'], 400);
        }

        $payload = [
            'arrivalDate' => $arrivalDt->format('Y-m-d'),
            'departureDate' => $departureDt->format('Y-m-d'),
            'guests' => $guests,
            'availability' => [],
        ];

        foreach (self::PROPERTIES as $property) {
            $bookingUrl = $property['smoobuId']
                ? $this->buildSmoobuUrl($property['smoobuId'], $arrivalDt, $departureDt, $guests)
                : null;

            $available = false;
            $error = null;
            $price = null;
            $currency = null;
            $nights = null;

            if ($property['smoobuId']) {
                try {
                    $check = $this->fetchAvailability($property['smoobuId'], $arrivalDt, $departureDt, $guests);
                    $status = $check['status'];
                    $data = $check['data'];

                    if ($status >= 200 && $status < 300 && ($data['success'] ?? false)) {
                        $availableIds = $data['data']['availabilityResponse']['availableApartments'] ?? [];
                        $available = in_array((string) $property['smoobuId'], array_map('strval', $availableIds), true);

                        $aptData = $this->findApartmentData($data, $property['smoobuId']);
                        $priceData = $this->findPriceData($data, $property['smoobuId']);

                        if ($aptData) {
                            $bookingUrl = $this->formatBookingUrl($aptData['bookUrl'] ?? $bookingUrl);
                            $price = $aptData['amount'] ?? $priceData['price'] ?? null;
                            $currency = $aptData['currency'] ?? $priceData['currency'] ?? null;
                            $nights = $aptData['numberOfNights'] ?? null;
                        } elseif ($priceData) {
                            $price = $priceData['price'] ?? null;
                            $currency = $priceData['currency'] ?? null;
                        }

                        $error = $data['data']['availabilityResponse']['errorMessages'][$property['smoobuId']]['message']
                            ?? $data['data']['message']
                            ?? null;
                    } else {
                        $error = $data['data']['message']
                            ?? ('Unavailable (status ' . $status . ')');
                    }
                } catch (\Exception $e) {
                    $error = 'Request failed';
                }
            } else {
                $error = 'Smoobu ID missing';
            }

            // Récupérer l'image depuis la base de données
            $dbProperty = $this->propertyRepository->findOneBy(['slug' => $property['slug']]);
            $image = null;
            if ($dbProperty) {
                // Chercher l'image de couverture ou la première image
                $images = $dbProperty->getImages();
                foreach ($images as $img) {
                    if ($img->isCover()) {
                        $image = $img->getFilename();
                        break;
                    }
                }
                // Si pas d'image de couverture, prendre la première
                if (!$image && $images->count() > 0) {
                    $image = $images->first()->getFilename();
                }
            }

            $payload['availability'][] = [
                'name' => $property['name'],
                'slug' => $property['slug'],
                'city' => $property['city'],
                'maxGuests' => $property['maxGuests'],
                'bookingUrl' => $bookingUrl,
                'available' => $available,
                'price' => $price,
                'currency' => $currency,
                'nights' => $nights,
                'error' => $error,
                'image' => $image ? '/uploads/' . $image : null,
            ];
        }

        return $this->json($payload);
    }

    private function fetchAvailability(string $apartmentId, \DateTimeImmutable $arrival, \DateTimeImmutable $departure, int $guests): array
    {
        $query = [
            'theme' => 'booking-tool',
            'arrivalDate' => $arrival->format('d.m.y'),
            'departureDate' => $departure->format('d.m.y'),
            'userId' => self::SMOOBU_USER_ID,
            'guests' => max(1, $guests),
            'adults' => max(1, $guests),
            'children' => 0,
            'apartmentId' => $apartmentId,
        ];

        $response = $this->httpClient->request('GET', self::SMOOBU_BASE_URL . '/checkAvailability', [
            'timeout' => 10,
            'query' => $query,
            'headers' => [
                'user-agent' => 'RoamingLille/1.0 (+https://roaminglille.com)',
            ],
        ]);

        return [
            'status' => $response->getStatusCode(),
            'data' => json_decode($response->getContent(false), true) ?? [],
        ];
    }

    private function buildSmoobuUrl(string $apartmentId, \DateTimeImmutable $arrival, \DateTimeImmutable $departure, int $adults): string
    {
        $arrivalStr = $arrival->format('d/m/Y');
        $departureStr = $departure->format('d/m/Y');

        return sprintf(
            'https://booking.smoobu.com/RoamingLille?apartmentId=%s&arrivalDate=%s&departureDate=%s&adults=%d&children=0&loadForCurrentDate=true',
            $apartmentId,
            $arrivalStr,
            $departureStr,
            max($adults, 1)
        );
    }

    private function findApartmentData(array $data, string $apartmentId): ?array
    {
        $apartments = $data['data']['apartments'] ?? [];
        foreach ($apartments as $apt) {
            if ((string) ($apt['id'] ?? '') === (string) $apartmentId) {
                return $apt;
            }
        }
        return null;
    }

    private function findPriceData(array $data, string $apartmentId): ?array
    {
        $prices = $data['data']['availabilityResponse']['prices'][$apartmentId] ?? null;
        if (!$prices) {
            return null;
        }
        return [
            'price' => $prices['price'] ?? null,
            'currency' => $prices['currency'] ?? ($prices['priceElements'][0]['currencyCode'] ?? null),
        ];
    }

    private function formatBookingUrl(?string $raw): ?string
    {
        if (!$raw) {
            return null;
        }
        if (str_starts_with($raw, 'http')) {
            return $raw;
        }
        return 'https://booking.smoobu.com' . $raw;
    }
}
