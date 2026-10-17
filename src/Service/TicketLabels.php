<?php
declare(strict_types=1);
namespace App\Service;

final class TicketLabels
{
    public static function parse(string $input): array
    {
        $labels = [];
        foreach (preg_split('/[,;]+/u', $input) ?: [] as $value) {
            $value = mb_strtolower(trim($value));
            if ($value === '') { continue; }
            if (mb_strlen($value) > 32 || preg_match('/[\r\n]/u', $value)) { throw new \InvalidArgumentException('Invalid ticket label.'); }
            $labels[$value] = $value;
        }
        if (count($labels) > 8) { throw new \InvalidArgumentException('Too many ticket labels.'); }
        return array_values($labels);
    }
}
