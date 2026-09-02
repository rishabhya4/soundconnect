package app.soundconnect.companion

import android.content.Context
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SoundCacheManager(private val context: Context) {

    private val soundDir = File(context.filesDir, "sound_cache").apply {
        if (!exists()) mkdirs()
    }

    suspend fun getOrDownloadSound(soundId: String, fileUrl: String): File? = withContext(Dispatchers.IO) {
        val targetFile = File(soundDir, "$soundId.wav")
        if (targetFile.exists() && targetFile.length() > 0) {
            return@withContext targetFile
        }

        try {
            if (fileUrl.startsWith("data:audio")) {
                // Decode base64 data URL locally
                val base64Data = fileUrl.substringAfter("base64,")
                val decodedBytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                FileOutputStream(targetFile).use { it.write(decodedBytes) }
                return@withContext targetFile
            }

            // Otherwise download from server URL
            val url = URL(fileUrl)
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 5000
            connection.readTimeout = 5000
            connection.connect()

            if (connection.responseCode == HttpURLConnection.HTTP_OK) {
                connection.inputStream.use { input ->
                    FileOutputStream(targetFile).use { output ->
                        input.copyTo(output)
                    }
                }
                return@withContext targetFile
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return@withContext if (targetFile.exists()) targetFile else null
    }
}
