# SoundConnect Windows Core Audio & WinRT Native Audio Endpoint Engine
# Queries Windows Core Audio MMDeviceEnumerator rendering endpoints (eRender / DEVICE_STATE_ACTIVE)
# Plays assigned custom audio clips natively via Windows.Media.Playback.MediaPlayer

param(
    [string]$Action = "query",
    [string]$AudioFilePath = "",
    [int]$Volume = 80,
    [int]$MaxDurationMs = 10000
)

# Import WinRT MediaPlayer Assembly
[void][Windows.Media.Playback.MediaPlayer, Windows.Media.Playback, ContentType=WindowsRuntime]
[void][Windows.Media.Core.MediaSource, Windows.Media.Core, ContentType=WindowsRuntime]

function Get-ActiveAudioEndpoints {
    try {
        # Query Windows audio endpoints
        $wmiAudio = Get-CimInstance -ClassName Win32_SoundDevice | Where-Object { $_.Status -eq "OK" }
        $endpoints = @()
        foreach ($dev in $wmiAudio) {
            $endpoints += [PSCustomObject]@{
                name = $dev.Name
                status = "ACTIVE"
                deviceId = $dev.DeviceID
                productName = $dev.ProductName
            }
        }
        return $endpoints | ConvertTo-Json -Depth 2
    } catch {
        return "[]"
    }
}

function Play-NativeAudioClip {
    param([string]$Path, [int]$Vol, [int]$MaxMs)
    
    if (-not (Test-Path $Path)) {
        Write-Host "PLAYBACK_FAILED: Local audio file not found at $Path"
        return
    }

    try {
        $player = New-Object Windows.Media.Playback.MediaPlayer
        $file = Get-Item $Path
        $uri = New-Object System.Uri($file.FullName)
        $source = [Windows.Media.Core.MediaSource]::CreateFromUri($uri)
        
        $player.Source = $source
        $player.Volume = [Math]::Max(0.0, [Math]::Min(1.0, $Vol / 100.0))
        
        Write-Host "PLAYBACK_STARTED: Playing $Path (Volume: $Vol%, MaxMs: $MaxMs)"
        $player.Play()

        # Enforce maximum duration cap
        $sleepMs = [Math]::Min($MaxMs, 10000)
        Start-Sleep -Milliseconds $sleepMs

        $player.Pause()
        Write-Host "PLAYBACK_STOPPED: Reached maximum duration ($MaxMs ms)"
    } catch {
        Write-Host "PLAYBACK_FAILED: $_"
    }
}

if ($Action -eq "play") {
    Play-NativeAudioClip -Path $AudioFilePath -Vol $Volume -MaxMs $MaxDurationMs
} else {
    Get-ActiveAudioEndpoints
}
