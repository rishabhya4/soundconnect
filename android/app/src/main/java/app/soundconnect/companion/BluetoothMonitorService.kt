package app.soundconnect.companion

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.bluetooth.BluetoothDevice
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class BluetoothMonitorService : Service() {

    private lateinit var audioManager: AudioManager
    private lateinit var deviceMatcher: DeviceMatcher
    private lateinit var soundCacheManager: SoundCacheManager

    private val lastTriggerTimestamps = mutableMapOf<String, Long>()
    private val DEBOUNCE_COOLDOWN_MS = 5000L

    override fun onCreate() {
        super.onCreate()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        deviceMatcher = DeviceMatcher()
        soundCacheManager = SoundCacheManager(applicationContext)

        createNotificationChannel()
        startForeground(1001, buildNotification("Monitoring Bluetooth audio connections..."))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        val device: BluetoothDevice? = intent?.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)

        if (device != null && action == BluetoothDevice.ACTION_ACL_CONNECTED) {
            handleDeviceConnected(device)
        }

        return START_STICKY
    }

    private fun handleDeviceConnected(device: BluetoothDevice) {
        val now = System.currentTimeMillis()
        val deviceId = device.address ?: device.name ?: "unknown"

        val lastTrigger = lastTriggerTimestamps[deviceId] ?: 0L
        if (now - lastTrigger < DEBOUNCE_COOLDOWN_MS) {
            android.util.Log.d("SoundConnect", "Skipping duplicate Bluetooth ACL_CONNECTED event for $deviceId")
            return
        }
        lastTriggerTimestamps[deviceId] = now

        CoroutineScope(Dispatchers.IO).launch {
            if (!verifyBluetoothAudioRoute()) {
                android.util.Log.w("SoundConnect", "Bluetooth Audio route not ready yet, retrying with bounded backoff...")
                kotlinx.coroutines.delay(1000)
                if (!verifyBluetoothAudioRoute()) {
                    android.util.Log.e("SoundConnect", "Bluetooth Audio route failed")
                    return@launch
                }
            }

            val match = deviceMatcher.findMatch(device) ?: return@launch
            if (!match.enabled || match.soundId == null || match.soundUrl == null) return@launch

            val audioFile = soundCacheManager.getOrDownloadSound(match.soundId, match.soundUrl)
            if (audioFile != null && audioFile.exists()) {
                playSoundThroughAudioRoute(audioFile, match.volume, match.maxDurationMs)
            }
        }
    }

    private fun verifyBluetoothAudioRoute(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            return devices.any { it.type == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_A2DP }
        }
        return audioManager.isBluetoothA2dpOn
    }

    private fun playSoundThroughAudioRoute(file: File, volume: Int, maxDurationMs: Int) {
        try {
            val attr = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()

            val focusRequest = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(attr)
                    .build()
            } else null

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
                audioManager.requestAudioFocus(focusRequest)
            }

            val mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(attr)
                setDataSource(file.absolutePath)
                setVolume(volume / 100f, volume / 100f)
                prepare()
                start()
            }

            // Cap maximum duration to 10 seconds (10000ms)
            val effectiveDurationMs = Math.min(maxDurationMs, 10000)

            android.os.Handler(mainLooper).postDelayed({
                if (mediaPlayer.isPlaying) {
                    mediaPlayer.stop()
                }
                mediaPlayer.release()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
                    audioManager.abandonAudioFocusRequest(focusRequest)
                }
            }, effectiveDurationMs.toLong())

        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "soundconnect_channel",
                "SoundConnect Companion Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        return NotificationCompat.Builder(this, "soundconnect_channel")
            .setContentTitle("SoundConnect Companion Active")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
