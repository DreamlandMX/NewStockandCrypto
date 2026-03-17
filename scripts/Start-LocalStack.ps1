param(
    [int]$Port = 9000,
    [int]$ModelPort = 8000,
    [ValidateSet('mock', 'live')]
    [string]$ModelMode = 'live',
    [string]$PythonExe = '',
    [switch]$RestartTrackedProcesses
)

$ErrorActionPreference = 'Stop'

function Test-TcpPort {
    param([int]$Port)
    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
        return [bool]$connection
    } catch {
        return $false
    }
}

function Wait-HttpOk {
    param(
        [string]$Url,
        [int]$TimeoutSec = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                return $response
            }
        } catch {
        }
        Start-Sleep -Seconds 1
    }

    throw "Timed out waiting for $Url to return HTTP 2xx."
}

function Get-ListeningProcessSummary {
    param([int]$Port)

    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
        if (-not $connection) {
            return $null
        }

        $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            return "$($process.ProcessName) (PID $($process.Id))"
        }

        return "PID $($connection.OwningProcess)"
    } catch {
        return $null
    }
}

function Start-BackgroundPowershell {
    param(
        [string]$ScriptText,
        [string]$WorkingDirectory,
        [string]$StdOutPath,
        [string]$StdErrPath
    )

    $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($ScriptText))
    return Start-Process -FilePath 'powershell.exe' `
        -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encodedCommand `
        -WorkingDirectory $WorkingDirectory `
        -RedirectStandardOutput $StdOutPath `
        -RedirectStandardError $StdErrPath `
        -PassThru
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $repoRoot 'logs\local-public'
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

if ($RestartTrackedProcesses) {
    & (Join-Path $PSScriptRoot 'Stop-LocalPublicStack.ps1') | Out-Null
}

$pythonCandidates = @()
if ($PythonExe) {
    $pythonCandidates += $PythonExe
}
$pythonCandidates += @(
    (Join-Path $repoRoot 'ml-service\.venv-gpu\Scripts\python.exe'),
    (Join-Path $repoRoot 'ml-service\.venv\Scripts\python.exe')
)
$resolvedPython = $pythonCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $resolvedPython) {
    $pyCommand = Get-Command py -ErrorAction SilentlyContinue
    if ($pyCommand) {
        $resolvedPython = $pyCommand.Source
    }
}
if (-not $resolvedPython) {
    throw 'No Python runtime found. Install Python or create ml-service\.venv-gpu first.'
}

$modelArtifactDir = (Resolve-Path (Join-Path $repoRoot 'ml-service\artifacts\latest')).Path
$nodePidPath = Join-Path $logsDir 'node.pid'
$mlPidPath = Join-Path $logsDir 'ml.pid'
$nodeOut = Join-Path $logsDir 'node.out.log'
$nodeErr = Join-Path $logsDir 'node.err.log'
$mlOut = Join-Path $logsDir 'ml.out.log'
$mlErr = Join-Path $logsDir 'ml.err.log'

if (-not (Test-TcpPort -Port $Port)) {
    $nodeCommand = @'
$env:HOST='127.0.0.1'
$env:PORT='{0}'
$env:MODEL_EXPLORER_SCHEME='http'
$env:MODEL_EXPLORER_HOST='127.0.0.1'
$env:MODEL_EXPLORER_PORT='{1}'
Set-Location '{2}'
npm start
'@ -f $Port, $ModelPort, $repoRoot
    $nodeProcess = Start-BackgroundPowershell `
        -ScriptText $nodeCommand `
        -WorkingDirectory $repoRoot `
        -StdOutPath $nodeOut `
        -StdErrPath $nodeErr
    Set-Content -Path $nodePidPath -Value $nodeProcess.Id
} else {
    $nodeOwner = Get-ListeningProcessSummary -Port $Port
    Write-Warning "Port $Port is already in use. Reusing the existing listener ($nodeOwner)."
}

if (-not (Test-TcpPort -Port $ModelPort)) {
    if ($resolvedPython -like '*\py.exe') {
        $pythonLaunch = "& '$resolvedPython' -3 -m uvicorn app.main:app --host 127.0.0.1 --port $ModelPort"
    } else {
        $pythonLaunch = "& '$resolvedPython' -m uvicorn app.main:app --host 127.0.0.1 --port $ModelPort"
    }

    $mlCommand = @'
$env:MODEL_EXPLORER_MODE='{0}'
$env:MODEL_ARTIFACT_DIR='{1}'
Set-Location '{2}'
{3}
'@ -f $ModelMode, $modelArtifactDir, (Join-Path $repoRoot 'ml-service'), $pythonLaunch
    $mlProcess = Start-BackgroundPowershell `
        -ScriptText $mlCommand `
        -WorkingDirectory (Join-Path $repoRoot 'ml-service') `
        -StdOutPath $mlOut `
        -StdErrPath $mlErr
    Set-Content -Path $mlPidPath -Value $mlProcess.Id
} else {
    $mlOwner = Get-ListeningProcessSummary -Port $ModelPort
    Write-Warning "Port $ModelPort is already in use. Reusing the existing listener ($mlOwner)."
}

$homeResponse = Wait-HttpOk -Url "http://127.0.0.1:$Port/" -TimeoutSec 90
$healthResponse = Wait-HttpOk -Url "http://127.0.0.1:$Port/api/model-explorer/health" -TimeoutSec 120
$healthPayload = $healthResponse.Content | ConvertFrom-Json

[pscustomobject]@{
    RepoRoot = $repoRoot
    PublicEntry = "http://127.0.0.1:$Port"
    ModelHealthUrl = "http://127.0.0.1:$Port/api/model-explorer/health"
    ModelMode = $healthPayload.mode
    ModelVersion = $healthPayload.modelVersion
    NodeLog = $nodeOut
    NodeErrorLog = $nodeErr
    MlLog = $mlOut
    MlErrorLog = $mlErr
} | Format-List
