package com.warroompicks.WarRoom.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val WarGreen = Color(0xFF45E06F)
val WarYellow = Color(0xFFFFDB32)
val NflCyan = Color(0xFF4FD8FF)
val NflBlue = Color(0xFF245BFF)
val WarBlack = Color(0xFF020604)
val PanelBlack = Color(0xEB07100B)
val Muted = Color(0xFF9DA7A1)

private val Colors = darkColorScheme(
    primary = WarGreen,
    secondary = WarYellow,
    background = WarBlack,
    surface = PanelBlack,
    onPrimary = Color.Black,
    onBackground = Color.White,
    onSurface = Color.White,
)

@Composable
fun WarRoomTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Colors, typography = MaterialTheme.typography, content = content)
}
