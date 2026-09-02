# SoundConnect Windows Legacy Diagnostic Fallback Script
# This script is maintained ONLY as a diagnostic fallback.
# Production Bluetooth state uses Native WinRT ConnectionStatusChanged events.

function Get-WindowsBluetoothDiagnostics {
    try {
        $btDevices = Get-CimInstance -ClassName Win32_PnPEntity | Where-Object { 
            ($_.PNPClass -eq "Bluetooth" -or $_.PNPClass -eq "AudioEndpoint" -or $_.Service -eq "BTHENUM" -or $_.Caption -like "*Bluetooth*" -or $_.Caption -like "*Airdopes*" -or $_.Caption -like "*realme*" -or $_.Caption -like "*Boult*") -and
            $_.Caption -notlike "*Enumerator*" -and $_.Caption -notlike "*Adapter*" -and $_.Caption -notlike "*Generic*"
        }

        $result = @()
        foreach ($dev in $btDevices) {
            $status = if ($dev.Status -eq "OK" -and $dev.ConfigManagerErrorCode -eq 0) { "Connected" } else { "Available" }
            $result += [PSCustomObject]@{
                id = if ($dev.DeviceID) { $dev.DeviceID } else { [guid]::NewGuid().ToString() }
                name = $dev.Caption
                status = $status
                pnpClass = $dev.PNPClass
                manufacturer = $dev.Manufacturer
            }
        }
        return $result | ConvertTo-Json -Depth 3
    } catch {
        return "[]"
    }
}

Get-WindowsBluetoothDiagnostics
