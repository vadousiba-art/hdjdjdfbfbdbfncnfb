package com.israeltoknt.app.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.israeltoknt.app.R
import com.israeltoknt.app.data.Api
import com.israeltoknt.app.data.Profile
import com.israeltoknt.app.ui.components.Avatar
import com.israeltoknt.app.ui.components.fieldColors
import com.israeltoknt.app.ui.theme.Y
import kotlinx.coroutines.launch

/** Sign in with the same account as the website. New members join on the web sign-up page. */
@Composable
fun LoginScreen(onSignedIn: () -> Unit, onJoin: () -> Unit) {
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var demo by remember { mutableStateOf<List<Profile>?>(null) }
    LaunchedEffect(Unit) { demo = Api.demoUsers() }

    fun run(block: suspend () -> Unit) {
        busy = true
        error = null
        scope.launch {
            runCatching { block() }.onSuccess { onSignedIn() }.onFailure { error = it.message }
            busy = false
        }
    }

    Column(
        Modifier.fillMaxSize().statusBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(72.dp))
        Image(painterResource(R.drawable.wordmark), "YORU 夜", modifier = Modifier.width(210.dp))
        Text("THE INTERNET AFTER DARK.", color = Y.ink2, fontSize = 10.sp, letterSpacing = 4.sp, modifier = Modifier.padding(top = 10.dp))
        Spacer(Modifier.height(40.dp))
        val people = demo
        if (people != null) {
            Text("Choose an account", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
            Text("Demo server: anyone can sign in as anyone.", color = Y.muted, fontSize = 13.sp, modifier = Modifier.padding(top = 2.dp, bottom = 12.dp))
            people.take(12).forEach { p ->
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable(enabled = !busy) { run { Api.demoLogin(p.id) } }.padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Avatar(p.avatarUrl, p.displayName, 40.dp)
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(p.displayName, fontWeight = FontWeight.SemiBold)
                        Text("@${p.username}", color = Y.muted, fontSize = 13.sp)
                    }
                }
            }
        } else {
            OutlinedTextField(email, { email = it.trim() }, label = { Text("Email") }, singleLine = true, colors = fieldColors,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(password, { password = it }, label = { Text("Password") }, singleLine = true, colors = fieldColors,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(16.dp))
            Button(
                onClick = { run { Api.login(email, password) } },
                enabled = !busy && email.isNotBlank() && password.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = Y.brand, contentColor = androidx.compose.ui.graphics.Color.White),
                shape = RoundedCornerShape(50),
                modifier = Modifier.fillMaxWidth().height(50.dp),
            ) {
                if (busy) CircularProgressIndicator(color = androidx.compose.ui.graphics.Color.White, strokeWidth = 2.dp, modifier = Modifier.width(20.dp))
                else Text("Log in", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            }
        }
        error?.let { Text(it, color = Y.brand2, fontSize = 13.5.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 12.dp)) }
        Spacer(Modifier.height(28.dp))
        Row(horizontalArrangement = Arrangement.Center) {
            Text("New here? ", color = Y.muted)
            Text("Create an account", color = Y.brand2, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable(onClick = onJoin))
        }
        Text("You must be 16 or older.", color = Y.muted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp, bottom = 40.dp))
    }
}
