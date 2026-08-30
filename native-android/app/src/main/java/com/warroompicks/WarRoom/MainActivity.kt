package com.warroompicks.WarRoom

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import com.warroompicks.WarRoom.ui.WarRoomApp
import com.warroompicks.WarRoom.ui.theme.WarRoomTheme
import android.content.Intent
import androidx.compose.runtime.mutableStateOf
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

class MainActivity : ComponentActivity() {
    private val destination = mutableStateOf<String?>(null)
    private val recoveryToken = mutableStateOf<String?>(null)
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        destination.value = intent.getStringExtra("notification_destination")
        recoveryToken.value = intent.recoveryAccessToken()
        enableEdgeToEdge()
        setContent { WarRoomTheme { WarRoomApp(viewModel(), destination.value, recoveryToken.value) { recoveryToken.value = null } } }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        destination.value = intent.getStringExtra("notification_destination")
        recoveryToken.value = intent.recoveryAccessToken()
    }

    private fun Intent.recoveryAccessToken(): String? {
        val uri = data ?: return null
        val values = (uri.fragment ?: uri.query ?: "").split('&').mapNotNull {
            val parts = it.split('=', limit = 2)
            if (parts.size == 2) parts[0] to java.net.URLDecoder.decode(parts[1], Charsets.UTF_8.name()) else null
        }.toMap()
        return values["access_token"]?.takeIf { values["type"] == "recovery" || uri.path?.contains("reset-password") == true }
    }
}
