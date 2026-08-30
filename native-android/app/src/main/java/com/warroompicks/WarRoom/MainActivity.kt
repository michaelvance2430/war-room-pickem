package com.warroompicks.WarRoom

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import com.warroompicks.WarRoom.ui.WarRoomApp
import com.warroompicks.WarRoom.ui.theme.WarRoomTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { WarRoomTheme { WarRoomApp(viewModel()) } }
    }
}
