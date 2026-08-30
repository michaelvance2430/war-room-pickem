package com.warroompicks.WarRoom.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.warroompicks.WarRoom.ui.theme.WarBlack
import com.warroompicks.WarRoom.ui.theme.WarGreen

@Composable
fun AuthScreen(
    busy: Boolean,
    error: String?,
    notice: String?,
    signIn: (String, String) -> Unit,
    signUp: (String, String, String) -> Unit,
    recover: (String) -> Unit,
) {
    var create by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    Column(
        Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF06371D), WarBlack, Color.Black)))
            .verticalScroll(rememberScrollState()).navigationBarsPadding().padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("WAR ROOM // LIVE", color = WarGreen, fontWeight = FontWeight.Black, letterSpacing = 3.sp)
        Text("PICK'EM", color = Color.White, fontSize = 54.sp, lineHeight = 52.sp, fontWeight = FontWeight.Black)
        Text("CFB SATURDAYS. NFL SUNDAYS. ONE PERMANENT RECORD.", color = Color.White.copy(alpha = .58f), fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(30.dp))
        if (create) OutlinedTextField(name, { name = it }, label = { Text("DISPLAY NAME") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(email, { email = it }, label = { Text("EMAIL") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(password, { password = it }, label = { Text("PASSWORD") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(vertical = 8.dp)) }
        notice?.let { Text(it, color = WarGreen, modifier = Modifier.padding(vertical = 8.dp)) }
        Spacer(Modifier.height(12.dp))
        Button(
            onClick = { if (create) signUp(email, password, name) else signIn(email, password) },
            enabled = !busy && email.isNotBlank() && password.length >= 6 && (!create || name.isNotBlank()),
            modifier = Modifier.fillMaxWidth().height(54.dp),
        ) { if (busy) CircularProgressIndicator(Modifier.size(22.dp)) else Text(if (create) "CREATE ACCOUNT" else "ENTER THE WAR ROOM", fontWeight = FontWeight.Black) }
        TextButton(onClick = { create = !create }, modifier = Modifier.fillMaxWidth()) { Text(if (create) "I ALREADY HAVE AN ACCOUNT" else "CREATE AN ACCOUNT") }
        if (!create) TextButton(onClick = { recover(email) }, enabled = email.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("FORGOT PASSWORD?") }
    }
}

@Composable
fun ResetPasswordScreen(busy: Boolean, error: String?, update: (String) -> Unit) {
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    Column(
        Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF06371D), WarBlack, Color.Black)))
            .navigationBarsPadding().padding(24.dp), verticalArrangement = Arrangement.Center,
    ) {
        Text("ACCOUNT RECOVERY", color = WarGreen, fontWeight = FontWeight.Black, letterSpacing = 3.sp)
        Text("SET A NEW PASSWORD", color = Color.White, fontSize = 36.sp, lineHeight = 39.sp, fontWeight = FontWeight.Black)
        Text("The recovery link is verified. Choose a new War Room password.", color = Color.White.copy(alpha = .62f))
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(password, { password = it }, label = { Text("NEW PASSWORD") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(confirm, { confirm = it }, label = { Text("CONFIRM PASSWORD") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        if (confirm.isNotEmpty() && password != confirm) Text("Passwords do not match.", color = MaterialTheme.colorScheme.error)
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Button(
            onClick = { update(password) }, enabled = !busy && password.length >= 8 && password == confirm,
            modifier = Modifier.fillMaxWidth().height(54.dp),
        ) { if (busy) CircularProgressIndicator(Modifier.size(22.dp)) else Text("UPDATE PASSWORD", fontWeight = FontWeight.Black) }
    }
}
