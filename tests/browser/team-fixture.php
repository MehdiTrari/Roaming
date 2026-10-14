<?php
// Isolated browser fixture only. Never connects to the normal application database.
declare(strict_types=1);
if (PHP_SAPI !== 'cli' || getenv('DATABASE_URL') !== 'sqlite:///%kernel.project_dir%/var/team-browser.sqlite') {
    throw new RuntimeException('Use the dedicated team-browser.sqlite database only.');
}
require dirname(__DIR__, 2).'/vendor/autoload.php';
(new Symfony\Component\Dotenv\Dotenv())->bootEnv(dirname(__DIR__, 2).'/.env');
$kernel = new App\Kernel('test', false); $kernel->boot();
$container = $kernel->getContainer()->get('test.service_container');
$em = $container->get(Doctrine\ORM\EntityManagerInterface::class);
if ($em->getConnection()->getParams()['driver'] !== 'pdo_sqlite') { throw new RuntimeException('SQLite required.'); }
$schema = new Doctrine\ORM\Tools\SchemaTool($em); $metadata = $em->getMetadataFactory()->getAllMetadata();
$schema->dropSchema($metadata); $schema->createSchema($metadata);
$hasher = $container->get(Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface::class);
foreach (['tester' => false, 'admin' => true] as $name => $admin) {
    $user = new App\Entity\TeamUser($name.'@example.test', ucfirst($name)); $user->setAdmin($admin);
    $user->setPassword($hasher->hashPassword($user, 'browser-only-password')); $em->persist($user);
}
$property = (new App\Entity\Property())->setSlug('test-house')->setTitle('Test house')->setCity('Lille')->setTravelers(4)->setActive(true)->setAbout('Browser fixture');
$em->persist($property); $em->flush();
echo "Isolated browser fixtures ready.\n";
