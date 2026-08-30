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

class MainActivity : ComponentActivity() {
    private val destination = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        destination.value = intent.getStringExtra("notification_destination")
        enableEdgeToEdge()
        setContent { WarRoomTheme { WarRoomApp(viewModel(), destination.value) } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        destination.value = intent.getStringExtra("notification_destination")
    }
}
