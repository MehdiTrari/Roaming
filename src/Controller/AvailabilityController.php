<?php
namespace App\Controller;
use App\Booking\BookingDates;
use App\Integration\GuestLucky\GuestLuckyClient;
use App\Repository\PropertyRepository;
use App\Service\AvailabilityService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class AvailabilityController extends AbstractController
{
    public function __construct(private PropertyRepository $properties, private AvailabilityService $availability) {}

    #[Route('/disponibilites', name: 'app_calendar', methods: ['GET'])]
    public function page(): Response
    {
        return $this->render('calendar/index.html.twig', ['navProperties' => $this->properties->findActiveWithImages()]);
    }

    #[Route('/test-disponibilites', name: 'app_calendar_test', methods: ['GET'])]
    public function testPage(): Response
    {
        if (!$this->canPreview()) { throw $this->createNotFoundException(); }
        return $this->render('calendar/test.html.twig', ['navProperties' => $this->properties->findActive()]);
    }

    #[Route('/api/test/calendar', name: 'api_calendar_test', methods: ['GET'])]
    public function testCalendar(Request $request): JsonResponse
    {
        if (!$this->canPreview()) { return $this->reply(['error' => 'not_found'], 404); }
        try {
            $year = $this->integer($request, 'year', (int) BookingDates::today()->format('Y'));
            $month = $this->integer($request, 'month', (int) BookingDates::today()->format('n'));
            $slug = $request->query->getString('slug');
            $properties = $slug === '' ? $this->properties->findActive() : [$this->properties->findActiveSlug($slug)];
            if ($slug !== '' && !$properties[0]) { return $this->reply(['error' => 'not_found'], 404); }
            $payload = $this->availability->calendarsForTest($properties, $year, $month);
            foreach ($payload['properties'] as &$row) {
                $row['detailsUrl'] = $this->generateUrl('app_property_show', ['slug' => $row['slug']]);
            }
            return $this->reply($payload);
        } catch (\InvalidArgumentException) { return $this->reply(['error' => 'invalid_month'], 400); }
    }

    #[Route('/api/calendar', name: 'api_calendar', methods: ['GET'])]
    #[Route('/api/properties/{slug}/availability', name: 'api_property_availability', methods: ['GET'])]
    public function calendar(Request $request, ?string $slug = null): JsonResponse
    {
        $properties = $slug === null ? $this->properties->findActive() : [$this->properties->findActiveSlug($slug)];
        if ($slug !== null && !$properties[0]) { return $this->reply(['error' => 'not_found'], 404); }
        try {
            $year = $this->integer($request, 'year', (int) BookingDates::today()->format('Y'));
            $month = $this->integer($request, 'month', (int) BookingDates::today()->format('n'));
            $payload = $this->availability->calendars($properties, $year, $month);
            foreach ($payload['properties'] as &$row) {
                $row['detailsUrl'] = $this->generateUrl('app_property_show', ['slug' => $row['slug']]);
            }
            return $this->reply($payload);
        } catch (\InvalidArgumentException) { return $this->reply(['error' => 'invalid_month'], 400); }
    }

    #[Route('/api/availability', name: 'api_availability', methods: ['GET'])]
    #[Route('/api/test/availability', name: 'api_availability_test', methods: ['GET'])]
    public function search(Request $request): JsonResponse
    {
        $preview = $request->attributes->get('_route') === 'api_availability_test';
        if ($preview && !$this->canPreview()) { return $this->reply(['error' => 'not_found'], 404); }
        try {
            [$arrival, $departure, $guests] = $this->stay($request);
            $slug = $request->query->getString('slug');
            $properties = $slug === '' ? $this->properties->findActive() : [$this->properties->findActiveSlug($slug)];
            if ($slug !== '' && !$properties[0]) { return $this->reply(['error' => 'not_found'], 404); }
            $payload = $preview
                ? $this->availability->quotesForTest($properties, $arrival, $departure, $guests)
                : $this->availability->quotes($properties, $arrival, $departure, $guests);
            $payload['preview'] = $preview;
            foreach ($payload['availability'] as &$row) {
                $row['detailsUrl'] = $this->generateUrl('app_property_show', ['slug' => $row['slug']]);
                $row['bookingUrl'] = !$preview && $row['available'] ? $this->generateUrl('app_booking_redirect', ['slug' => $row['slug'], 'arrivalDate' => $arrival, 'departureDate' => $departure, 'guests' => $guests]) : null;
            }
            return $this->reply($payload);
        } catch (\InvalidArgumentException) { return $this->reply(['error' => 'invalid_stay'], 400); }
    }

    #[Route('/reservation/{slug}', name: 'app_booking_redirect', methods: ['GET'])]
    public function book(string $slug, Request $request, GuestLuckyClient $client): Response
    {
        $property = $this->properties->findActiveSlug($slug);
        if (!$property) { throw $this->createNotFoundException(); }
        $status = 503;
        try {
            [$arrival, $departure, $guests] = $this->stay($request);
            // Always issue a fresh quote, including after a successful search.
            $quote = $this->availability->quotes([$property], $arrival, $departure, $guests)['availability'][0];
            if ($quote['available']) {
                $response = $this->redirect($client->bookingUrl($property->getGuestLuckyId(), $arrival, $departure, $guests));
                $response->headers->set('Cache-Control', 'no-store, private');
                return $response;
            }
            $status = $quote['status'] === 'unavailable' ? 409 : 503;
        } catch (\InvalidArgumentException) { $status = 400; }
        return $this->render('calendar/unavailable.html.twig', ['property' => $property, 'navProperties' => $this->properties->findActive()], new Response('', $status, ['Cache-Control' => 'no-store, private']));
    }

    private function integer(Request $request, string $key, int $default): int
    {
        $raw = $request->query->get($key, (string) $default);
        if (!is_scalar($raw) || !preg_match('/^\d{1,4}$/D', (string) $raw)) { throw new \InvalidArgumentException(); }
        return (int) $raw;
    }

    private function canPreview(): bool
    {
        return $this->getParameter('kernel.environment') === 'dev' || $this->isGranted('ROLE_TESTER');
    }

    private function stay(Request $request): array
    {
        $arrival = $request->query->getString('arrivalDate');
        $departure = $request->query->getString('departureDate');
        $guests = $this->integer($request, 'guests', 1);
        BookingDates::stay($arrival, $departure, $guests);
        return [$arrival, $departure, $guests];
    }

    private function reply(array $payload, int $status = 200): JsonResponse
    {
        return $this->json($payload, $status, ['Cache-Control' => 'no-store, private']);
    }
}
