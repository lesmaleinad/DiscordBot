param(
    [switch]$Staging,
    [string]$EnvironmentFile = 'C:\ProgramData\OceanCurse\secrets\oceancurse.env'
)

$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$runtimeRoot = 'C:\ProgramData\OceanCurse'
$node = Join-Path $runtimeRoot 'runtime\node-v22.14.0-win-x64\node.exe'
$logDir = Join-Path $runtimeRoot 'logs'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Location -LiteralPath $repo

Get-Content -LiteralPath $EnvironmentFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
        $name = $matches[1]
        $value = $matches[2].Trim()
        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

if ($Staging) {
    if (-not $env:DISCORD_CLIENT_KEY_s) {
        throw 'DISCORD_CLIENT_KEY_s is missing from the environment file.'
    }
    $env:DISCORD_CLIENT_KEY = $env:DISCORD_CLIENT_KEY_s
    $env:STAGING = 'true'
    $env:HEALTH_FILE = Join-Path $runtimeRoot 'state\staging-ready'
    $env:DIAGNOSTIC_LOG = Join-Path $logDir 'staging-diagnostic.log'
}

$timestamp = Get-Date -Format 'yyyy-MM-ddTHH:mm:ssK'
$logName = if ($Staging) { 'staging.log' } else { 'oceancurse.log' }
$logFile = Join-Path $logDir $logName
"[$timestamp] Starting Ocean Curse (staging=$Staging)" |
    Out-File -LiteralPath $logFile -Append

& $node 'dist\index.js' $(if ($Staging) { '--staging' }) *>> $logFile
exit $LASTEXITCODE
