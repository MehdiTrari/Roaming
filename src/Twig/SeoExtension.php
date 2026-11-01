<?php

declare(strict_types=1);

namespace App\Twig;

use App\Service\SeoUrlGenerator;
use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;
use Twig\TwigFunction;

final class SeoExtension extends AbstractExtension
{
    public function __construct(private SeoUrlGenerator $urls) {}
    public function getFunctions(): array
    {
        return [new TwigFunction('seo_url', $this->urls->url(...)), new TwigFunction('seo_absolute', $this->urls->absolute(...))];
    }
    public function getFilters(): array { return [new TwigFilter('seo_summary', $this->summary(...))]; }
    public function summary(string $text, int $limit = 165): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', strip_tags($text)));
        if (mb_strlen($text) <= $limit) return $text;
        $cut = mb_substr($text, 0, $limit - 1);
        $space = mb_strrpos($cut, ' ');
        return rtrim($space !== false ? mb_substr($cut, 0, $space) : $cut, ' ,;:.-').'…';
    }
}
