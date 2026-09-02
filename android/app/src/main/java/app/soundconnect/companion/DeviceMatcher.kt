package app.soundconnect.companion

import android.bluetooth.BluetoothDevice

data class DeviceAssignment(
    val deviceId: String,
    val deviceIdentifier: String,
    val deviceName: String,
    val soundId: String?,
    val soundUrl: String?,
    val localSoundPath: String?,
    val volume: Int = 80,
    val maxDurationMs: Int = 5000,
    val enabled: Boolean = true
)

class DeviceMatcher {
    private val cachedAssignments = mutableMapOf<String, DeviceAssignment>()

    fun updateCache(assignments: List<DeviceAssignment>) {
        cachedAssignments.clear()
        assignments.forEach { asgn ->
            // Key by identifier (MAC/UUID) or clean device name
            cachedAssignments[asgn.deviceIdentifier.uppercase()] = asgn
            cachedAssignments[asgn.deviceName.uppercase()] = asgn
        }
    }

    fun findMatch(device: BluetoothDevice): DeviceAssignment? {
        val addressMatch = device.address?.let { cachedAssignments[it.uppercase()] }
        if (addressMatch != null) return addressMatch

        val nameMatch = device.name?.let { cachedAssignments[it.uppercase()] }
        return nameMatch
    }
}
