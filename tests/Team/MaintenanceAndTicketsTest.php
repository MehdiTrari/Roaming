<?php
declare(strict_types=1);
namespace App\Tests\Team;
use App\Entity\TeamUser;
use App\Entity\TestTicket;
use App\Entity\TicketComment;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

final class MaintenanceAndTicketsTest extends WebTestCase
{
    private $browser;
    private EntityManagerInterface $em;
    private TeamUser $tester;
    private TeamUser $admin;
    private array $saved = [];
    private array $files = [];
    protected function setUp(): void
    {
        parent::setUp();
        if (!extension_loaded('pdo_sqlite')) { self::markTestSkipped('Requires pdo_sqlite.'); }
        foreach (['DATABASE_URL' => 'sqlite:///:memory:', 'SITE_MAINTENANCE' => $this->name() === 'testMaintenanceOffKeepsTicketsPrivate' ? '0' : '1', 'GUESTLUCKY_AVAILABILITY_ENABLED' => '0'] as $key => $value) {
            $this->saved[$key] = [$_ENV[$key] ?? null, $_SERVER[$key] ?? null, getenv($key)];
            $_ENV[$key] = $_SERVER[$key] = $value; putenv($key.'='.$value);
        }
        $this->browser = self::createClient(); $this->browser->disableReboot();
        $this->em = self::getContainer()->get(EntityManagerInterface::class);
        (new SchemaTool($this->em))->createSchema($this->em->getMetadataFactory()->getAllMetadata());
        $hasher = self::getContainer()->get(UserPasswordHasherInterface::class);
        $this->tester = new TeamUser('tester@example.test', 'Testeur');
        $this->admin = new TeamUser('admin@example.test', 'Administrateur'); $this->admin->setAdmin(true);
        foreach ([$this->tester, $this->admin] as $user) { $user->setPassword($hasher->hashPassword($user, 'a-long-test-password')); $this->em->persist($user); }
        $this->em->flush();
    }
    protected function tearDown(): void
    {
        foreach ($this->files as $file) { if (is_file($file)) { unlink($file); } }
        parent::tearDown();
        foreach ($this->saved as $key => [$env, $server, $process]) {
            if ($env === null) unset($_ENV[$key]); else $_ENV[$key] = $env;
            if ($server === null) unset($_SERVER[$key]); else $_SERVER[$key] = $server;
            putenv($process === false ? $key : $key.'='.$process);
        }
    }
    public function testAnonymousMaintenanceAndApiGate(): void
    {
        $this->browser->request('GET', '/?_locale=fr'); self::assertResponseIsSuccessful();
        self::assertSelectorTextContains('h1', 'Nous préparons');
        self::assertStringContainsString('no-store', $this->browser->getResponse()->headers->get('Cache-Control'));
        self::assertStringContainsString('private', $this->browser->getResponse()->headers->get('Cache-Control'));
        // Symfony deliberately adds a noindex header in test/debug; the public template remains indexable.
        self::assertSelectorExists('meta[name="robots"][content="index, follow"]');
        $this->browser->request('GET', '/?_locale=en'); self::assertSelectorTextContains('h1', 'We are preparing');
        foreach (['/property/roubaix', '/reservation/roubaix', '/roubaix', '/not-a-route', '/test-disponibilites'] as $path) {
            $this->browser->request('GET', $path); self::assertResponseRedirects('/', 302);
        }
        foreach (['/api/calendar', '/api/unknown', '/api/test/availability'] as $path) {
            $this->browser->request('GET', $path); self::assertResponseStatusCodeSame(503);
            self::assertJsonStringEqualsJsonString('{"error":"site_maintenance"}', $this->browser->getResponse()->getContent());
        }
        $this->browser->request('GET', '/sitemap.xml'); self::assertResponseStatusCodeSame(503);
        $this->browser->request('POST', '/api/calendar'); self::assertResponseStatusCodeSame(503);
    }
    public function testMaintenanceOffKeepsTicketsPrivate(): void
    {
        $this->browser->request('GET', '/'); self::assertResponseIsSuccessful(); self::assertSelectorNotExists('.team-maintenance');
        $this->browser->request('GET', '/equipe/tickets'); self::assertResponseRedirects('/equipe/connexion');
        $this->browser->request('GET', '/test-disponibilites'); self::assertResponseStatusCodeSame(404);
        $this->browser->loginUser($this->tester);
        $this->browser->request('GET', '/test-disponibilites'); self::assertResponseIsSuccessful();
        self::assertResponseHeaderSame('X-Robots-Tag', 'noindex, nofollow');
    }
    public function testWrongPasswordAndLoginThrottle(): void
    {
        $origin = ['HTTP_ORIGIN' => 'http://localhost', 'REMOTE_ADDR' => '192.0.2.'.random_int(1, 254)];
        for ($attempt = 0; $attempt < 6; ++$attempt) {
            $crawler = $this->browser->request('GET', '/equipe/connexion', [], [], $origin);
            $this->browser->submit($crawler->filter('form')->form(['_username' => 'tester@example.test', '_password' => 'incorrect']), [], $origin);
            self::assertResponseRedirects('/equipe/connexion');
        }
        $crawler = $this->browser->request('GET', '/equipe/connexion', [], [], $origin);
        $this->browser->submit($crawler->filter('form')->form(['_username' => 'tester@example.test', '_password' => 'a-long-test-password']), [], $origin);
        self::assertResponseRedirects('/equipe/connexion');
        $this->browser->request('GET', '/', [], [], $origin); self::assertSelectorExists('.team-maintenance');
    }
    public function testLoginCsrfAndLogout(): void
    {
        $crawler = $this->browser->request('GET', '/equipe/connexion'); self::assertResponseIsSuccessful();
        $this->browser->submit($crawler->filter('form')->form(['_username' => 'tester@example.test', '_password' => 'a-long-test-password']), [], ['HTTP_ORIGIN' => 'http://localhost']);
        self::assertResponseRedirects('/');
        $this->browser->request('GET', '/'); self::assertSelectorExists('[data-team-report]');
        self::assertResponseHeaderSame('X-Robots-Tag', 'noindex, nofollow');
        $this->browser->request('POST', '/equipe/deconnexion', ['_csrf_token' => 'invalid'], [], ['HTTP_ORIGIN' => 'https://foreign.test']);
        self::assertResponseStatusCodeSame(403);
        $crawler = $this->browser->request('GET', '/');
        $this->browser->submit($crawler->filter('form[action="/equipe/deconnexion"]')->form(), [], ['HTTP_ORIGIN' => 'http://localhost']);
        self::assertResponseRedirects('/');
        $this->browser->request('GET', '/'); self::assertSelectorNotExists('[data-team-report]');
    }
    private function createTicket(?UploadedFile $capture = null): void
    {
        $crawler = $this->browser->request('GET', '/equipe/tickets/nouveau');
        $form = $crawler->filter('main form')->form([
            'test_ticket[title]' => '<script>alert(1)</script>', 'test_ticket[category]' => 'bug',
            'test_ticket[description]' => 'A reproducible problem', 'test_ticket[steps]' => 'Open calendar', 'test_ticket[expected]' => 'A price',
            'test_ticket[page]' => '/property/roubaix?guests=2&token=secret&email=private@example.test', 'test_ticket[screen]' => '390x844',
        ]);
        if ($capture) { $form['test_ticket[capture]']->upload($capture->getPathname()); }
        $this->browser->submit($form);
    }
    public function testSharedTicketsCommentsAndAdminOnlyManagement(): void
    {
        $this->browser->loginUser($this->tester); $this->createTicket(); self::assertResponseStatusCodeSame(303);
        $ticket = $this->em->getRepository(TestTicket::class)->findOneBy([]);
        self::assertSame('/property/roubaix?guests=2', $ticket->page);
        self::assertSame('390x844', $ticket->screen); self::assertSame($this->tester->getId(), $ticket->author->getId());
        $crawler = $this->browser->followRedirect(); self::assertSelectorNotExists('script:not([src])');
        self::assertStringContainsString('&lt;script&gt;', $this->browser->getResponse()->getContent());
        $token = $crawler->filter('input[name="_token"]')->attr('value');
        $url = '/equipe/tickets/'.$ticket->getId();
        $this->browser->request('POST', $url, ['_token' => $token, 'action' => 'manage', 'status' => 'resolved', 'priority' => 'high']); self::assertResponseStatusCodeSame(403);
        $this->browser->request('POST', $url, ['_token' => 'bad', 'comment' => 'No CSRF']); self::assertResponseStatusCodeSame(403);
        $this->browser->request('POST', $url, ['_token' => $token, 'comment' => '<img src=x onerror=alert(1)>']); self::assertResponseStatusCodeSame(303);
        self::assertSame(1, $this->em->getRepository(TicketComment::class)->count([]));
        $this->browser->loginUser($this->admin);
        $crawler = $this->browser->request('GET', $url); self::assertSelectorExists('select[name="status"]');
        $token = $crawler->filter('input[name="_token"]')->first()->attr('value');
        $this->browser->request('POST', $url, ['_token' => $token, 'action' => 'manage', 'status' => 'retest', 'priority' => 'high']); self::assertResponseStatusCodeSame(303);
        $ticket = $this->em->find(TestTicket::class, $ticket->getId()); self::assertSame('retest', $ticket->status);
        $this->browser->request('GET', '/equipe/tickets?status=retest'); self::assertSelectorCount(1, 'article');
        $this->browser->request('GET', '/equipe/tickets?status=resolved'); self::assertSelectorCount(0, 'article');
    }
    public function testScreenshotIsPrivateAndInvalidFilesRejected(): void
    {
        $this->browser->loginUser($this->tester);
        $temporary = tempnam(sys_get_temp_dir(), 'ticket'); $file = $temporary.'.png'; rename($temporary, $file); $this->files[] = $file;
        file_put_contents($file, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='));
        $this->createTicket(new UploadedFile($file, 'capture.png', 'image/png', null, true)); self::assertResponseStatusCodeSame(303);
        $ticket = $this->em->getRepository(TestTicket::class)->findOneBy([]);
        $this->files[] = dirname(__DIR__, 2).'/var/private/ticket-captures/'.$ticket->attachment;
        $captureUrl = '/equipe/tickets/'.$ticket->getId().'/capture';
        $this->browser->request('GET', $captureUrl); self::assertResponseIsSuccessful(); self::assertResponseHeaderSame('Content-Type', 'image/png');
        $this->browser->getCookieJar()->clear(); $this->browser->request('GET', $captureUrl); self::assertResponseRedirects();
        $this->browser->loginUser($this->tester);
        file_put_contents($file, '<svg onload="alert(1)"></svg>');
        $this->createTicket(new UploadedFile($file, 'capture.png', 'image/png', null, true)); self::assertResponseStatusCodeSame(422);
        file_put_contents($file, str_repeat('X', 5 * 1024 * 1024 + 1));
        $this->createTicket(new UploadedFile($file, 'oversized.png', 'image/png', null, true)); self::assertResponseStatusCodeSame(422);
        self::assertSame(1, $this->em->getRepository(TestTicket::class)->count([]));
    }
    public function testCombinedFiltersSearchLabelsAndPagination(): void
    {
        $this->browser->loginUser($this->tester);
        foreach ([['Mobile calendar', 'new', 'bug', 'high', ['mobile', 'équipe']], ['Desktop design', 'resolved', 'display', 'low', ['desktop']], ['Mobile menu', 'retest', 'display', 'high', ['mobile']]] as [$title, $status, $category, $priority, $labels]) {
            $ticket = new TestTicket(); $ticket->author = $this->tester; $ticket->title = $title; $ticket->status = $status; $ticket->category = $category; $ticket->priority = $priority; $ticket->labels = $labels; $ticket->description = 'Details'; $ticket->steps = $ticket->expected = ''; $this->em->persist($ticket);
        }
        $this->em->flush();
        $this->browser->request('GET', '/equipe/tickets', ['status' => ['new', 'retest'], 'category' => ['bug', 'display'], 'priority' => ['high'], 'label' => ['mobile'], 'q' => 'Mobile', '_fragment' => 1]);
        self::assertResponseIsSuccessful(); self::assertSelectorCount(2, '.ticket-card'); self::assertSelectorNotExists('.ticket-workspace');
        $this->browser->request('GET', '/equipe/tickets', ['label' => ['mobile', 'équipe']]);
        self::assertSelectorCount(1, '.ticket-card'); self::assertSelectorTextContains('.ticket-card h3', 'Mobile calendar');
        $this->browser->request('GET', '/equipe/tickets', ['status' => ['resolved'], 'label' => ['mobile']]);
        self::assertSelectorCount(0, '.ticket-card');
        $this->browser->request('GET', '/equipe/tickets', ['q' => 'Testeur']); self::assertSelectorCount(3, '.ticket-card');
        $this->tester = $this->em->find(TeamUser::class, $this->tester->getId());
        for ($index = 0; $index < 31; $index++) {
            $ticket = new TestTicket(); $ticket->author = $this->tester; $ticket->title = 'Pagination '.$index; $ticket->category = 'suggestion'; $ticket->description = 'Details'; $ticket->steps = $ticket->expected = ''; $this->em->persist($ticket);
        }
        $this->em->flush();
        $this->browser->request('GET', '/equipe/tickets', ['category' => ['suggestion'], 'page' => 1]); self::assertSelectorCount(30, '.ticket-card'); self::assertSelectorExists('a[data-ticket-page]');
        $this->browser->request('GET', '/equipe/tickets', ['category' => ['suggestion'], 'page' => 2]); self::assertSelectorCount(1, '.ticket-card');
    }
    public function testLabelsPersistAndInvalidLabelsDoNotChangeStatus(): void
    {
        $this->browser->loginUser($this->admin);
        $crawler = $this->browser->request('GET', '/equipe/tickets/nouveau');
        $this->browser->submit($crawler->filter('main form')->form(['test_ticket[title]' => 'Labeled ticket', 'test_ticket[category]' => 'display', 'test_ticket[description]' => 'Details', 'test_ticket[labels]' => ' Mobile, Équipe, mobile']));
        self::assertResponseStatusCodeSame(303);
        $ticket = $this->em->getRepository(TestTicket::class)->findOneBy([]); self::assertSame(['mobile', 'équipe'], $ticket->labels);
        $url = '/equipe/tickets/'.$ticket->getId();
        $crawler = $this->browser->request('GET', $url); $token = $crawler->filter('input[name="_token"]')->first()->attr('value');
        $this->browser->request('POST', $url, ['_token' => $token, 'action' => 'manage', 'status' => 'resolved', 'priority' => 'high', 'labels' => str_repeat('x', 33)]);
        self::assertResponseStatusCodeSame(422);
        $this->em->clear(); $ticket = $this->em->find(TestTicket::class, $ticket->getId()); self::assertSame('new', $ticket->status);
        $this->browser->request('POST', $url, ['_token' => $token, 'action' => 'manage', 'status' => 'retest', 'priority' => 'high', 'labels' => 'calendrier, mobile']);
        self::assertResponseStatusCodeSame(303);
        $this->em->clear(); $ticket = $this->em->find(TestTicket::class, $ticket->getId()); self::assertSame(['calendrier', 'mobile'], $ticket->labels);
        $crawler = $this->browser->request('GET', '/equipe/tickets/nouveau');
        $this->browser->submit($crawler->filter('main form')->form(['test_ticket[title]' => 'Invalid labels', 'test_ticket[category]' => 'display', 'test_ticket[description]' => 'Details', 'test_ticket[labels]' => str_repeat('x', 33)]));
        self::assertResponseStatusCodeSame(422);
        self::assertStringNotContainsString('team.labels_invalid', $this->browser->getResponse()->getContent());
        self::assertSame(1, $this->em->getRepository(TestTicket::class)->count([]));
    }
}
