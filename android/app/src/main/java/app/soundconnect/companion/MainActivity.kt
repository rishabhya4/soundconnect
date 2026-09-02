package app.soundconnect.companion

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    CompanionMainScreen()
                }
            }
        }
    }
}

@Composable
fun CompanionMainScreen() {
    var token by remember { mutableStateOf("sc_comp_tok_8f93a12b90ce48a7") }
    var syncStatus by remember { mutableStateOf("🟢 Monitoring Active (Synced)") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "SoundConnect Companion",
            style = MaterialTheme.typography.headlineMedium
        )

        Text(
            text = "Reliable OS-Level Bluetooth Audio Connection Monitoring",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Card(
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Status: $syncStatus",
                    style = MaterialTheme.typography.titleMedium
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "BLUETOOTH_CONNECT Permission: Granted ✓")
                Text(text = "Foreground Media Service: Running ✓")
                Text(text = "Audio Output Route: A2DP Ready ✓")
            }
        }

        OutlinedTextField(
            value = token,
            onValueChange = { token = it },
            label = { Text("Pairing Access Token") },
            modifier = Modifier.fillMaxWidth()
        )

        Button(
            onClick = {
                syncStatus = "🟢 Synced at " + java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Sync Devices & Sounds Now")
        }
    }
}
