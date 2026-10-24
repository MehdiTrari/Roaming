param([string]$PhpPath = 'php', [ValidateSet('dev', 'prod')][string]$Environment = 'dev')
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectDirectory
try {
    & $PhpPath 'bin/console' 'app:guestlucky:sync' '--apply' "--env=$Environment" '--no-interaction' '--no-debug'
    $syncExit = $LASTEXITCODE
    if ($syncExit -eq 0) {
        & $PhpPath 'bin/console' 'app:guestlucky:photos' '--apply' "--env=$Environment" '--no-interaction' '--no-debug'
        $syncExit = $LASTEXITCODE
    }
} finally {
    Pop-Location
}
exit $syncExit
