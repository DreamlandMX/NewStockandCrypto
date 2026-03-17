$ErrorActionPreference = 'Stop'

function Test-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSec = 8
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
    } catch {
        return $false
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$statusPath = Join-Path $repoRoot 'logs\local-public\public-site-status.json'

if (-not (Test-Path $statusPath)) {
    throw "No local public site status file found at $statusPath"
}

$status = Get-Content -Path $statusPath -Raw | ConvertFrom-Json

[pscustomobject]@{
    StartedAt = $status.startedAt
    ModelMode = $status.modelMode
    LocalUrl = $status.localUrl
    LocalHealthy = Test-HttpOk -Url $status.localUrl
    ModelHealthUrl = $status.modelHealthUrl
    ModelHealthy = Test-HttpOk -Url $status.modelHealthUrl
    PublicUrl = $status.publicUrl
    PublicHealthy = Test-HttpOk -Url $status.publicUrl
    Port = $status.port
    ModelPort = $status.modelPort
    StatusFile = $statusPath
} | Format-List
