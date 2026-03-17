$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $repoRoot 'logs\local-public'
$pidFiles = @(
    'node.pid',
    'ml.pid',
    'tunnel.pid'
)

foreach ($pidFile in $pidFiles) {
    $pidPath = Join-Path $runtimeDir $pidFile
    if (-not (Test-Path $pidPath)) {
        continue
    }

    try {
        $pidValue = [int](Get-Content $pidPath -Raw).Trim()
    } catch {
        Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
        continue
    }

    $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
    if ($process) {
        Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }

    Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
}

Write-Output 'Stopped tracked local public stack processes.'
