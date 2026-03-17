param(
    [switch]$DownloadIfMissing
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$toolDir = Join-Path $repoRoot '.local-tools\cloudflared'
$localExe = Join-Path $toolDir 'cloudflared.exe'
$downloadUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'

$globalCommand = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($globalCommand) {
    Write-Output $globalCommand.Source
    exit 0
}

if (Test-Path $localExe) {
    Write-Output $localExe
    exit 0
}

if (-not $DownloadIfMissing) {
    throw "cloudflared was not found on PATH or in $localExe. Re-run with -DownloadIfMissing or install cloudflared manually."
}

New-Item -ItemType Directory -Force -Path $toolDir | Out-Null
Invoke-WebRequest -Uri $downloadUrl -OutFile $localExe

Write-Output $localExe
