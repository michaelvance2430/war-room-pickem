package com.warroompicks.WarRoom.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.warroompicks.WarRoom.model.Sport
import com.warroompicks.WarRoom.ui.theme.*
import coil3.compose.AsyncImage
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale

@Composable
fun WarBackdrop(sport: Sport, content: @Composable ColumnScope.() -> Unit) {
    val colors = if (sport == Sport.NFL) listOf(Color(0xFF061838), Color(0xFF02040B), Color(0xFF24020A))
    else listOf(Color(0xFF032313), WarBlack, Color(0xFF08100B))
    Column(
        modifier = Modifier.fillMaxSize().background(Brush.linearGradient(colors)).padding(horizontal = 16.dp),
        content = content,
    )
}

@Composable
fun WarHeader(kicker: String, title: String, detail: String? = null, sport: Sport = Sport.CFB) {
    val accent = if (sport == Sport.NFL) NflCyan else WarGreen
    Column(Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 12.dp)) {
        Text(kicker.uppercase(), color = accent, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
        Text(title.uppercase(), color = Color.White, fontSize = 29.sp, lineHeight = 29.sp, fontWeight = FontWeight.Black)
        if (detail != null) Text(detail, color = Muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun CommandPanel(
    kicker: String,
    title: String,
    detail: String,
    sport: Sport,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
) {
    val accent = if (sport == Sport.NFL) NflCyan else WarGreen
    val shape = RoundedCornerShape(14.dp)
    Surface(
        onClick = onClick ?: {}, enabled = onClick != null,
        modifier = modifier.fillMaxWidth().border(1.dp, accent.copy(alpha = .5f), shape),
        shape = shape, color = PanelBlack,
    ) {
        Row(Modifier.padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(5.dp).height(76.dp).background(accent))
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(kicker.uppercase(), color = accent, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.7.sp)
                Text(title, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(detail, color = Muted, fontSize = 12.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
            if (onClick != null) Text("›", color = accent, fontSize = 34.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
fun EmptyCommand(title: String, detail: String, sport: Sport) = CommandPanel("AWAITING ORDERS", title, detail, sport)

@Composable
fun PlayerAvatar(name: String, url: String?, accent: Color, modifier: Modifier = Modifier) {
    Box(modifier.size(42.dp).clip(CircleShape).background(accent.copy(alpha = .18f)).border(2.dp, accent, CircleShape), contentAlignment = Alignment.Center) {
        if (url.isNullOrBlank()) Text(name.trim().take(1).uppercase(), color = accent, fontWeight = FontWeight.Black)
        else AsyncImage(model = url, contentDescription = "$name profile picture", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize().clip(CircleShape))
    }
}
