param(
    [string]$Repo = 'C:\Users\lesma\Code\DiscordBot'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = 'C:\ProgramData\OceanCurse'
$serviceDir = Join-Path $root 'service'
$appDir = Join-Path $root 'app'
$secretsDir = Join-Path $root 'secrets'
$stateDir = Join-Path $root 'state'
$logsDir = Join-Path $root 'logs'
$runtimeDir = Join-Path $root 'runtime'
$binDir = Join-Path $root 'bin'
$wrapper = Join-Path $serviceDir 'OceanCurseService.exe'

$directories = @(
    $serviceDir,
    $appDir,
    $secretsDir,
    $stateDir,
    $logsDir
)
foreach ($directory in $directories) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
}

Copy-Item `
    -LiteralPath (Join-Path $Repo 'ops\windows\OceanCurseService.xml') `
    -Destination (Join-Path $serviceDir 'OceanCurseService.xml') `
    -Force

$appItems = @(
    'config',
    'dist',
    'models',
    'node_modules',
    'package.json',
    'package-lock.json'
)
foreach ($item in $appItems) {
    Copy-Item `
        -LiteralPath (Join-Path $Repo $item) `
        -Destination $appDir `
        -Recurse `
        -Force
}

if (-not (Test-Path -LiteralPath $wrapper)) {
    Invoke-WebRequest `
        -UseBasicParsing `
        -Uri 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe' `
        -OutFile $wrapper
}

Write-Output "WinSW SHA-256: $(
    (Get-FileHash -Algorithm SHA256 -LiteralPath $wrapper).Hash.ToLowerInvariant()
)"

Copy-Item `
    -LiteralPath (Join-Path $Repo '.env') `
    -Destination (Join-Path $secretsDir 'oceancurse.env') `
    -Force
$stateFile = Join-Path $stateDir 'state.json'
if (-not (Test-Path -LiteralPath $stateFile)) {
    Copy-Item `
        -LiteralPath (Join-Path $Repo 'state.env') `
        -Destination $stateFile
}

& icacls.exe (Join-Path $secretsDir 'oceancurse.env') `
    /inheritance:r `
    /grant:r '*S-1-5-18:(F)' '*S-1-5-32-544:(F)' '*S-1-5-20:(R)' |
    Out-Null
& icacls.exe $stateDir `
    /inheritance:r `
    /grant:r `
    '*S-1-5-18:(OI)(CI)(F)' `
    '*S-1-5-32-544:(OI)(CI)(F)' `
    '*S-1-5-20:(OI)(CI)(M)' |
    Out-Null
& icacls.exe $logsDir `
    /inheritance:r `
    /grant:r `
    '*S-1-5-18:(OI)(CI)(F)' `
    '*S-1-5-32-544:(OI)(CI)(F)' `
    '*S-1-5-20:(OI)(CI)(M)' |
    Out-Null

$readOnlyTrees = @($serviceDir, $appDir, $runtimeDir, $binDir)
foreach ($tree in $readOnlyTrees) {
    & icacls.exe $tree /grant '*S-1-5-20:(OI)(CI)(RX)' /T /C |
        Out-Null
}

Stop-ScheduledTask `
    -TaskName 'OceanCurse-Test' `
    -ErrorAction SilentlyContinue
Unregister-ScheduledTask `
    -TaskName 'OceanCurse-Test' `
    -Confirm:$false `
    -ErrorAction SilentlyContinue

Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object {
        $_.ExecutablePath -eq (
            Join-Path $runtimeDir 'node-v22.14.0-win-x64\node.exe'
        ) -and $_.CommandLine -match 'dist[\\/]index\.js'
    } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force
    }

if (Get-Service -Name 'OceanCurse' -ErrorAction SilentlyContinue) {
    & $wrapper stop
    & $wrapper uninstall
}

& $wrapper install
if ($LASTEXITCODE -ne 0) {
    throw "WinSW install exited $LASTEXITCODE"
}

& $wrapper start
if ($LASTEXITCODE -ne 0) {
    throw "WinSW start exited $LASTEXITCODE"
}

Write-Output 'OceanCurse service installed and started.'
