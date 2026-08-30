package com.warroompicks.WarRoom.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.warroompicks.WarRoom.AppState
import com.warroompicks.WarRoom.model.Sport
import com.warroompicks.WarRoom.ui.components.WarBackdrop
import com.warroompicks.WarRoom.ui.components.WarHeader
import com.warroompicks.WarRoom.ui.components.PlayerAvatar
import com.warroompicks.WarRoom.ui.theme.*

@Composable
fun LockerScreen(state: AppState, postMessage: (String) -> Unit) {
    val league = state.league ?: return
    val accent = if (league.sport == Sport.NFL) NflCyan else WarGreen
    var draft by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) listState.scrollToItem(state.messages.lastIndex)
    }
    WarBackdrop(league.sport) {
        WarHeader("LOCKER ROOM", league.name, "Chat opens at the newest message.", league.sport)
        LazyColumn(Modifier.weight(1f), state = listState, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.messages.size, key = { state.messages[it].id }) { index ->
                val message = state.messages[index]
                Surface(color = PanelBlack, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(12.dp), verticalAlignment = Alignment.Top) {
                        PlayerAvatar(message.displayName, message.avatarUrl, accent)
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(message.displayName.uppercase(), color = accent, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                            Text(message.body, color = Color.White)
                        }
                    }
                }
            }
        }
        Row(Modifier.fillMaxWidth().imePadding().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(draft, { draft = it }, placeholder = { Text("Message the locker room") }, modifier = Modifier.weight(1f), maxLines = 4)
            Spacer(Modifier.width(8.dp))
            Button(onClick = { postMessage(draft); draft = "" }, enabled = draft.trim().isNotEmpty() && !state.busy, colors = ButtonDefaults.buttonColors(containerColor = accent, contentColor = Color.Black)) { Text("SEND", fontWeight = FontWeight.Black) }
        }
    }
}
