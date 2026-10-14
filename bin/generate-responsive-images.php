<?php
// Local derivatives only. Run with: php -d extension=gd bin/generate-responsive-images.php [source-list.json]
declare(strict_types=1);
$root = dirname(__DIR__);
$destination = $root.'/public/images/responsive';
$manifestPath = $destination.'/manifest.json';
if (!extension_loaded('gd') || !function_exists('imagewebp')) { throw new RuntimeException('GD with WebP support is required for this command only.'); }
$filenames = isset($argv[1]) ? json_decode(file_get_contents($argv[1]), true, flags: JSON_THROW_ON_ERROR) : array_keys(json_decode(file_get_contents($manifestPath), true, flags: JSON_THROW_ON_ERROR));
if (!is_dir($destination)) { mkdir($destination, 0775, true); }
$manifest = []; $originalBytes = $derivativeBytes = 0;
foreach ($filenames as $filename) {
    $sourcePath = realpath($root.'/public/uploads/'.$filename);
    $uploadRoot = realpath($root.'/public/uploads').DIRECTORY_SEPARATOR;
    if (!$sourcePath || !str_starts_with($sourcePath, $uploadRoot)) { throw new RuntimeException('Image outside the local uploads directory.'); }
    [$width, $height] = getimagesize($sourcePath);
    $image = imagecreatefromstring(file_get_contents($sourcePath));
    if (!$image) { throw new RuntimeException('Unsupported local image.'); }
    $hash = substr(hash_file('sha256', $sourcePath), 0, 20);
    $variants = [];
    foreach (array_unique(array_map(fn ($size) => min($width, $size), [320, 640, 960, 1440])) as $size) {
        $scaled = imagescale($image, $size, max(1, (int) round($height * $size / $width)), IMG_BICUBIC);
        $name = $hash.'-'.$size.'.webp';
        if (!imagewebp($scaled, $destination.'/'.$name, 82)) { throw new RuntimeException('WebP conversion failed.'); }
        $variants[] = ['url' => 'images/responsive/'.$name, 'width' => $size];
        $derivativeBytes += filesize($destination.'/'.$name);
        imagedestroy($scaled);
    }
    imagedestroy($image);
    $originalBytes += filesize($sourcePath);
    $manifest[$filename] = ['width' => $width, 'height' => $height, 'variants' => $variants];
}
ksort($manifest);
file_put_contents($manifestPath, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)."\n");
echo json_encode(['images' => count($manifest), 'originalBytes' => $originalBytes, 'allDerivativeBytes' => $derivativeBytes])."\n";
