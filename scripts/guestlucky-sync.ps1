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
    # Reviews have their own atomic snapshot and must not depend on photo success.
    & $PhpPath 'bin/console' 'app:guestlucky:reviews' '--apply' "--env=$Environment" '--no-interaction' '--no-debug'
    if ($LASTEXITCODE -ne 0 -and $syncExit -eq 0) { $syncExit = $LASTEXITCODE }
} finally {
    Pop-Location
}
exit $syncExit
