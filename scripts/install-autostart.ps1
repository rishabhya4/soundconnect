<#
    Installs the SoundConnect companion so it starts at login.

    Two things this deliberately does:

    1. Copies the build to %LOCALAPPDATA%\SoundConnect\app rather than pointing at
       bin\Debug. Rebuilding the project would otherwise lock or replace the very
       files the shortcut launches.

    2. Launches through a .vbs stub so no console window flashes on login. The
       companion still logs to %LOCALAPPDATA%\SoundConnect\companion.log.

    Per-user only. No admin rights, no service, nothing outside your profile.
    Undo with uninstall-autostart.ps1, or delete the shortcut from shell:startup.
#>

$ErrorActionPreference = 'Stop'

$root     = Join-Path $env:LOCALAPPDATA 'SoundConnect'
$appDir   = Join-Path $root 'app'
$launcher = Join-Path $root 'start-companion.cmd'
$logFile  = Join-Path $root 'companion.log'
$startup  = [Environment]::GetFolderPath('Startup')
$shortcut = Join-Path $startup 'SoundConnect Companion.lnk'

$projectDir = (Resolve-Path (Join-Path $PSScriptRoot '..\companion\SoundConnect.Companion')).Path
$dotnet     = Join-Path $env:USERPROFILE '.dotnet\dotnet.exe'

if (-not (Test-Path $dotnet)) {
    throw "dotnet not found at $dotnet. Install the .NET 8 SDK first."
}

New-Item -ItemType Directory -Force -Path $root | Out-Null

# Stop any companion already running, so the publish can overwrite its files and
# the new instance can bind the port. Covers both shapes: the self-contained exe,
# and a framework-dependent run through dotnet from an earlier install.
Get-Process soundconnect -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process dotnet -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -eq $dotnet } |
    Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

Write-Host 'Publishing self-contained build (bundles its own runtime)...'
& $dotnet publish $projectDir -c Release -r win-x64 --self-contained true -o $appDir -v q --nologo
if ($LASTEXITCODE -ne 0) { throw 'Publish failed.' }

$exe = Join-Path $appDir 'soundconnect.exe'
if (-not (Test-Path $exe)) { throw "Publish produced no soundconnect.exe in $appDir" }

Write-Host 'Writing launcher...'

# A .cmd wrapper rather than a VBS stub. Launching with no console at all left the
# process alive but never binding, and with output nowhere to be seen; going
# through cmd keeps a console for the process and sends its output to the log.
$launcherLines = @(
    '@echo off',
    'rem Starts the SoundConnect companion and records what it does.',
    ('"' + $exe + '" >> "' + $logFile + '" 2>&1')
)
Set-Content -Path $launcher -Value $launcherLines -Encoding ascii

Write-Host 'Creating startup shortcut...'
$ws  = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($shortcut)
$lnk.TargetPath       = $launcher
$lnk.WorkingDirectory = $root
$lnk.Description      = 'Plays your assigned sound when a Bluetooth audio device connects'
$lnk.WindowStyle      = 7   # minimised, so login is not interrupted
$lnk.Save()

Write-Host 'Starting it now...'
Start-Process -FilePath $launcher -WindowStyle Hidden
Start-Sleep -Seconds 8

try {
    $health = Invoke-WebRequest -Uri 'http://127.0.0.1:17385/api/health' -UseBasicParsing -TimeoutSec 5
    Write-Host ''
    Write-Host 'Companion is running.' -ForegroundColor Green
    Write-Host $health.Content
} catch {
    Write-Warning "Companion did not answer on 127.0.0.1:17385 - check $logFile"
}

Write-Host ''
Write-Host 'Installed:'
Write-Host "  app       $appDir"
Write-Host "  shortcut  $shortcut"
Write-Host "  log       $logFile"
Write-Host ''
Write-Host 'To undo: run scripts\uninstall-autostart.ps1'
