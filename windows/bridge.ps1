# SoundConnect Windows Native Bluetooth Monitor Engine
# Uses Windows WMI Win32_PnPEntity & Win32_DeviceChangeEvent to query real Windows paired Bluetooth audio devices

function Get-WindowsBluetoothDevices {
    try {
        # Query Windows PnP Bluetooth Audio devices (A2DP / HFP / Headset)
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

# Output current Windows Bluetooth audio devices
Get-WindowsBluetoothDevices
