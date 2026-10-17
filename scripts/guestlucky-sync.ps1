param([string]$PhpPath = 'php')
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectDirectory
try {
    & $PhpPath 'bin/console' 'app:guestlucky:sync' '--apply' '--no-interaction' '--no-debug'
    $syncExit = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $syncExit
