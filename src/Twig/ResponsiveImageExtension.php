<?php
declare(strict_types=1);
namespace App\Twig;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

final class ResponsiveImageExtension extends AbstractExtension
{
    private ?array $manifest = null;
    public function __construct(#[Autowire('%kernel.project_dir%')] private readonly string $projectDirectory) {}
    public function getFunctions(): array { return [new TwigFunction('responsive_image', $this->image(...))]; }
    public function image(string $filename): ?array
    {
        if ($this->manifest === null) {
            $path = $this->projectDirectory.'/public/images/responsive/manifest.json';
            $this->manifest = is_file($path) ? (json_decode(file_get_contents($path), true) ?? []) : [];
        }
        return $this->manifest[$filename] ?? null;
    }
}
