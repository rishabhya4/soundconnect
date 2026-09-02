<#
    Removes the SoundConnect companion autostart and stops it.

    Leaves your assignments and sounds alone — those live in
    %LOCALAPPDATA%\SoundConnect\assignments.json and \sounds\, and are only
    removed if you pass -RemoveData.
#>

param([switch]$RemoveData)

$ErrorActionPreference = 'Continue'

$root     = Join-Path $env:LOCALAPPDATA 'SoundConnect'
$launcher = Join-Path $root 'start-companion.cmd'
$appDir   = Join-Path $root 'app'
$shortcut = Join-Path ([Environment]::GetFolderPath('Startup')) 'SoundConnect Companion.lnk'
$dotnet   = Join-Path $env:USERPROFILE '.dotnet\dotnet.exe'

Write-Host "Stopping companion..."
Get-Process dotnet -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -eq $dotnet } |
    Stop-Process -Force -ErrorAction SilentlyContinue

foreach ($path in @($shortcut, $launcher)) {
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Host "Removed $path"
    }
}

if (Test-Path $appDir) {
    Remove-Item $appDir -Recurse -Force
    Write-Host "Removed $appDir"
}

if ($RemoveData) {
    foreach ($path in @((Join-Path $root 'assignments.json'), (Join-Path $root 'sounds'))) {
        if (Test-Path $path) {
            Remove-Item $path -Recurse -Force
            Write-Host "Removed $path"
        }
    }
} else {
    Write-Host ""
    Write-Host "Your assignments and sounds were kept in $root"
    Write-Host "Pass -RemoveData to delete them too."
}

Write-Host ""
Write-Host "Autostart removed."
