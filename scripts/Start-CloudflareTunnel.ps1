param(
    [int]$Port = 9000,
    [int]$WaitTimeoutSec = 45,
    [switch]$DownloadIfMissing
)

$ErrorActionPreference = 'Stop'

function Wait-TryCloudflareUrl {
    param(
        [string[]]$LogPaths,
        [int]$TimeoutSec
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $pattern = 'https://[a-z0-9-]+\.trycloudflare\.com'
    while ((Get-Date) -lt $deadline) {
        foreach ($logPath in $LogPaths) {
            if (-not (Test-Path $logPath)) {
                continue
            }

            $content = Get-Content $logPath -Raw -ErrorAction SilentlyContinue
            if ($content -match $pattern) {
                return $matches[0]
            }
        }
        Start-Sleep -Seconds 1
    }

    throw "Timed out waiting for a trycloudflare URL in $($LogPaths -join ', ')."
}

function Get-ProcessCommandLine {
    param([int]$Pid)

    try {
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $Pid" -ErrorAction Stop
        return $processInfo.CommandLine
    } catch {
        return $null
    }
}

function Test-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSec = 10
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
    } catch {
        return $false
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $repoRoot 'logs\local-public'
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

$cloudflaredArgs = @()
if ($DownloadIfMissing) {
    $cloudflaredArgs += '-DownloadIfMissing'
}
$cloudflared = & (Join-Path $PSScriptRoot 'Get-Cloudflared.ps1') @cloudflaredArgs

$stdoutPath = Join-Path $logsDir 'cloudflared.out.log'
$stderrPath = Join-Path $logsDir 'cloudflared.err.log'
$pidPath = Join-Path $logsDir 'tunnel.pid'

$existingUrl = $null
if (Test-Path $pidPath) {
    try {
        $existingPid = [int](Get-Content $pidPath -Raw).Trim()
        $existingProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
        if ($existingProcess) {
            $commandLine = Get-ProcessCommandLine -Pid $existingPid
            if ($commandLine -and $commandLine -match [Regex]::Escape("http://127.0.0.1:$Port")) {
                try {
                    $existingUrl = Wait-TryCloudflareUrl -LogPaths @($stdoutPath, $stderrPath) -TimeoutSec 3
                    if ($existingUrl -and (-not (Test-HttpOk -Url $existingUrl -TimeoutSec 10))) {
                        $existingUrl = $null
                        Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
                        Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
                    }
                } catch {
                }
            } else {
                Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
                Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
    }
}

if (-not $existingUrl) {
    $process = Start-Process -FilePath $cloudflared `
        -ArgumentList 'tunnel', '--url', "http://127.0.0.1:$Port", '--no-autoupdate' `
        -WorkingDirectory $repoRoot `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -PassThru
    Set-Content -Path $pidPath -Value $process.Id
}

$publicUrl = Wait-TryCloudflareUrl -LogPaths @($stdoutPath, $stderrPath) -TimeoutSec $WaitTimeoutSec

[pscustomobject]@{
    PublicUrl = $publicUrl
    TunnelLog = $stdoutPath
    TunnelErrorLog = $stderrPath
} | Format-List
