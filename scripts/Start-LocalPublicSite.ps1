param(
    [int]$Port = 9000,
    [int]$ModelPort = 8000,
    [ValidateSet('mock', 'live')]
    [string]$ModelMode = 'live',
    [switch]$DownloadCloudflared,
    [switch]$RestartTrackedProcesses,
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'

function Test-TcpPort {
    param([int]$PortNumber)

    try {
        $connection = Get-NetTCPConnection -LocalPort $PortNumber -State Listen -ErrorAction Stop | Select-Object -First 1
        return [bool]$connection
    } catch {
        return $false
    }
}

function Find-AvailablePort {
    param(
        [int]$PreferredPort,
        [int[]]$ReservedPorts = @(),
        [int]$SearchWindow = 200
    )

    if (-not (Test-TcpPort -PortNumber $PreferredPort) -and ($ReservedPorts -notcontains $PreferredPort)) {
        return $PreferredPort
    }

    for ($candidate = $PreferredPort + 1; $candidate -lt ($PreferredPort + $SearchWindow); $candidate++) {
        if ((-not (Test-TcpPort -PortNumber $candidate)) -and ($ReservedPorts -notcontains $candidate)) {
            return $candidate
        }
    }

    throw "Could not find a free port near $PreferredPort."
}

function Wait-UrlHealthy {
    param(
        [string]$Url,
        [int]$TimeoutSec = 45
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                return $true
            }
        } catch {
        }

        Start-Sleep -Seconds 2
    }

    return $false
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$statusDir = Join-Path $repoRoot 'logs\local-public'
New-Item -ItemType Directory -Force -Path $statusDir | Out-Null

$resolvedPort = Find-AvailablePort -PreferredPort $Port
$resolvedModelPort = Find-AvailablePort -PreferredPort $ModelPort -ReservedPorts @($resolvedPort)

$stackArgs = @{
    Port = $resolvedPort
    ModelPort = $resolvedModelPort
    ModelMode = $ModelMode
}
if ($RestartTrackedProcesses) {
    $stackArgs.RestartTrackedProcesses = $true
}
$stackOutput = & (Join-Path $PSScriptRoot 'Start-LocalStack.ps1') @stackArgs | Out-String

$tunnelArgs = @{
    Port = $resolvedPort
}
if ($DownloadCloudflared) {
    $tunnelArgs.DownloadIfMissing = $true
}
$tunnelOutput = & (Join-Path $PSScriptRoot 'Start-CloudflareTunnel.ps1') @tunnelArgs | Out-String

$publicUrl = $null
$urlMatch = [regex]::Match($tunnelOutput, 'https://[a-z0-9-]+\.trycloudflare\.com')
if ($urlMatch.Success) {
    $publicUrl = $urlMatch.Value
}

if (-not $publicUrl) {
    throw 'Cloudflare tunnel started, but no public URL was detected in the script output.'
}

$publicHealthy = Wait-UrlHealthy -Url $publicUrl -TimeoutSec 60
if (-not $publicHealthy) {
    throw "Public URL did not become healthy in time: $publicUrl"
}

$statusPayload = [pscustomobject]@{
    startedAt = (Get-Date).ToString('o')
    modelMode = $ModelMode
    localUrl = "http://127.0.0.1:$resolvedPort"
    modelHealthUrl = "http://127.0.0.1:$resolvedPort/api/model-explorer/health"
    publicUrl = $publicUrl
    port = $resolvedPort
    modelPort = $resolvedModelPort
    status = 'ready'
}

$statusJsonPath = Join-Path $statusDir 'public-site-status.json'
$statusTextPath = Join-Path $statusDir 'public-url.txt'
$statusPayload | ConvertTo-Json | Set-Content -Path $statusJsonPath
$publicUrl | Set-Content -Path $statusTextPath

if (-not $NoOpen) {
    Start-Process $publicUrl | Out-Null
}

Write-Output ''
Write-Output 'Local public site is ready.'
if ($resolvedPort -ne $Port) {
    Write-Output "Requested app port $Port was busy. Using $resolvedPort instead."
}
if ($resolvedModelPort -ne $ModelPort) {
    Write-Output "Requested model port $ModelPort was busy. Using $resolvedModelPort instead."
}
Write-Output "Public URL: $publicUrl"
Write-Output "Status file: $statusJsonPath"
Write-Output $stackOutput
Write-Output $tunnelOutput
