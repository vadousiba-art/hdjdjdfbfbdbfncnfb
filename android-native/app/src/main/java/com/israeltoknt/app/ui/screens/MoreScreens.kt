package com.israeltoknt.app.ui.screens

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Bookmark
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.FolderSpecial
import androidx.compose.material.icons.outlined.Gavel
import androidx.compose.material.icons.outlined.Leaderboard
import androidx.compose.material.icons.outlined.NightsStay
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.Policy
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.SmartToy
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.israeltoknt.app.BuildConfig
import com.israeltoknt.app.data.Api
import com.israeltoknt.app.data.CATEGORY_LABEL
import com.israeltoknt.app.data.Decision
import com.israeltoknt.app.data.Standing
import com.israeltoknt.app.data.timeAgo
import com.israeltoknt.app.ui.LocalApp
import com.israeltoknt.app.ui.Routes
import com.israeltoknt.app.ui.components.Avatar
import com.israeltoknt.app.ui.components.Chip
import com.israeltoknt.app.ui.components.EmptyState
import com.israeltoknt.app.ui.components.Loading
import com.israeltoknt.app.ui.components.PillButton
import com.israeltoknt.app.ui.components.fieldColors
import com.israeltoknt.app.ui.theme.Y
import kotlinx.coroutines.launch

private val LEVELS = listOf(
    "All good" to "No active strikes.",
    "Warned" to "One active strike. Nothing is limited.",
    "Limited" to "Recent strikes come with short mutes.",
    "Very limited" to "Another strike means a week-long mute.",
    "At risk" to "An admin may review your account for a ban.",
)
private val VERDICT = mapOf("label" to "Screened", "flag" to "Flagged", "hold" to "Held", "remove" to "Removed", "block" to "Blocked")

/** Account Standing: strikes, every decision about your content, and appeals. */
@Composable
fun StandingScreen() {
    val app = LocalApp.current
    var s by remember { mutableStateOf<Standing?>(null) }
    var version by remember { mutableIntStateOf(0) }
    var appealing by remember { mutableStateOf<Decision?>(null) }
    LaunchedEffect(version) { runCatching { Standing.parse(Api.rpcObj("get_my_standing")) }.onSuccess { s = it }.onFailure { app.error(it) } }
    Column(Modifier.fillMaxSize()) {
        BackBar("Account standing", app::back)
        val st = s ?: run { Loading(); return@Column }
        val level = st.activeStrikes.coerceAtMost(4)
        val tone = when { level == 0 -> Y.online; level >= 3 -> Y.brand; else -> Y.amber }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp)) {
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).border(1.dp, Y.line, RoundedCornerShape(16.dp)).padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(46.dp).clip(CircleShape).background(tone.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) {
                        Icon(if (level == 0) Icons.Outlined.VerifiedUser else Icons.Outlined.Shield, null, tint = tone)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(LEVELS[level].first, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                        Text(LEVELS[level].second, color = Y.muted, fontSize = 13.5.sp)
                    }
                }
                Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    LEVELS.forEachIndexed { k, l ->
                        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(Modifier.fillMaxWidth().height(7.dp).clip(CircleShape).background(if (k <= level) tone else Y.card2))
                            Text(l.first, fontSize = 9.5.sp, color = if (k == level) Y.ink else Y.muted, fontWeight = if (k == level) FontWeight.SemiBold else FontWeight.Normal, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }
                st.mutedUntil?.let {
                    Text("Posting, comments and messages are paused until ${it.take(16).replace('T', ' ')} UTC. You can still read and browse.",
                        fontSize = 13.sp, color = Y.ink2, modifier = Modifier.padding(top = 14.dp).clip(RoundedCornerShape(10.dp)).background(Y.card2).padding(10.dp))
                }
            }
            Text("How strikes work", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 22.dp, bottom = 8.dp))
            st.ladder.forEachIndexed { k, m ->
                Text("${k + 1}.  " + (if (m == 0) "A warning, nothing else" else "Paused for ${if (m >= 1440) "${m / 1440} day${if (m >= 2880) "s" else ""}" else "${m / 60} hours"}") +
                    (if (k == st.ladder.size - 1) " (and an admin review)" else ""), color = Y.ink2, fontSize = 14.sp, modifier = Modifier.padding(vertical = 3.dp))
            }
            Text("Strikes expire after ${st.strikeDays} days. Bans are never automatic: a person decides.", color = Y.muted, fontSize = 12.5.sp, modifier = Modifier.padding(top = 6.dp))
            Text("Decisions about your content", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 22.dp, bottom = 6.dp))
            if (st.decisions.isEmpty()) Text("Nothing here. Keep being you.", color = Y.muted, fontSize = 14.sp)
            st.decisions.forEach { d ->
                Column(Modifier.padding(vertical = 10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Chip(if (d.status == "overturned") "Reversed" else VERDICT[d.verdict] ?: d.verdict, if (d.status == "overturned") Y.online else Y.ink2, Y.card2)
                        Text(CATEGORY_LABEL[d.category] ?: d.category, fontWeight = FontWeight.Medium, fontSize = 13.5.sp, modifier = Modifier.weight(1f))
                        Text(timeAgo(d.createdAt), color = Y.muted, fontSize = 12.sp)
                    }
                    if (d.excerpt.isNotBlank()) Text("“${d.excerpt}”", fontSize = 13.5.sp, color = Y.ink2, maxLines = 3,
                        modifier = Modifier.padding(top = 6.dp).fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Y.card2).padding(10.dp))
                    when {
                        d.appealStatus != null -> Text("Appeal ${if (d.appealStatus == "open") "in review" else d.appealStatus}${d.appealNote?.let { " · $it" } ?: ""}", color = Y.ink2, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                        d.appealable -> PillButton("Appeal", { appealing = d }, Modifier.padding(top = 8.dp), primary = false)
                    }
                }
                HorizontalDivider(color = Y.line.copy(alpha = 0.6f))
            }
        }
    }
    appealing?.let { d -> AppealDialog(d, onClose = { appealing = null }, onDone = { version++ }) }
}

@Composable
private fun AppealDialog(d: Decision, onClose: () -> Unit, onDone: () -> Unit) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var body by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onClose,
        containerColor = Y.bg2,
        title = { Text("Appeal this decision") },
        text = {
            Column {
                Text("Tell us what we got wrong: a joke between friends, a quote, or a mistake? Each decision can be appealed once.", color = Y.muted, fontSize = 13.5.sp)
                OutlinedTextField(body, { body = it.take(1000) }, minLines = 4, colors = fieldColors, placeholder = { Text("Why should this be reversed?") }, modifier = Modifier.padding(top = 10.dp).fillMaxWidth())
            }
        },
        confirmButton = {
            TextButton(enabled = body.trim().length >= 3, onClick = {
                scope.launch {
                    runCatching { Api.rpcObj("submit_appeal", "p_event_id" to d.id, "p_body" to body.trim()) }
                        .onSuccess { app.toast(if (it.optString("status") == "granted") "Appeal granted. It's back." else "Appeal sent."); onDone(); onClose() }
                        .onFailure { app.error(it) }
                }
            }) { Text("Send appeal", color = Y.ink) }
        },
        dismissButton = { TextButton(onClick = onClose) { Text("Cancel", color = Y.muted) } },
    )
}

/** Everything that isn't a tab: native screens first, then the website's pages. */
@Composable
fun MoreScreen(onLogout: () -> Unit) {
    val app = LocalApp.current
    val me = app.me?.profile
    Column(Modifier.fillMaxSize()) {
        BackBar("Menu", app::back)
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            if (me != null) {
                Row(Modifier.fillMaxWidth().clickable { app.profile(me.username) }.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Avatar(me.avatarUrl, me.displayName, 48.dp)
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(me.displayName, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                        Text("@${me.username}", color = Y.muted, fontSize = 13.sp)
                    }
                }
                HorizontalDivider(color = Y.line.copy(alpha = 0.6f))
            }
            MenuRow(Icons.Outlined.Explore, "Explore") { app.web("/explore", "Explore") }
            MenuRow(Icons.Outlined.Bookmark, "Bookmarks") { app.go("bookmarks") }
            MenuRow(Icons.Outlined.FolderSpecial, "Collections") { app.web("/collections", "Collections") }
            MenuRow(Icons.Outlined.Palette, "Creators") { app.web("/creators", "Creators") }
            MenuRow(Icons.Outlined.WorkspacePremium, "YORU Pro") { app.web("/pro", "YORU Pro") }
            MenuRow(Icons.Outlined.SmartToy, "AI Menace") { app.web("/menace", "AI Menace") }
            MenuRow(Icons.Outlined.NightsStay, "Chaos Tools") { app.web("/chaos", "Chaos Tools") }
            MenuRow(Icons.Outlined.Leaderboard, "Leaderboards") { app.web("/leaderboard", "Leaderboards") }
            MenuRow(Icons.Outlined.Gavel, "Account standing") { app.go(Routes.STANDING) }
            MenuRow(Icons.Outlined.Settings, "Settings") { app.web("/settings", "Settings") }
            if (me?.isStaff == true) MenuRow(Icons.Outlined.Shield, "Watchtower") { app.web("/admin", "Watchtower") }
            MenuRow(Icons.Outlined.Policy, "Terms, privacy and Trust Center") { app.web("/trust", "Trust Center") }
            HorizontalDivider(color = Y.line.copy(alpha = 0.6f))
            MenuRow(Icons.AutoMirrored.Outlined.Logout, "Log out", Y.brand2) { onLogout() }
            Text("YORU for Android ${BuildConfig.VERSION_NAME}", color = Y.muted, fontSize = 12.sp, modifier = Modifier.padding(16.dp))
        }
    }
}

@Composable
private fun MenuRow(icon: ImageVector, label: String, tint: Color = Y.ink, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 18.dp, vertical = 15.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(16.dp))
        Text(label, color = tint, fontSize = 15.sp)
    }
}

/**
 * Pages that stay web for now (settings, Pro, Watchtower…) open here, signed
 * in with the app's session. Links back into native screens are intercepted.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebScreen(path: String, title: String, onLeave: () -> Unit = {}) {
    val app = LocalApp.current
    var web by remember { mutableStateOf<WebView?>(null) }
    var progress by remember { mutableIntStateOf(0) }
    var chooser by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        chooser?.onReceiveValue(uris.toTypedArray())
        chooser = null
    }
    BackHandler { if (web?.canGoBack() == true) web?.goBack() else { Api.cookiesFromWebView(); onLeave(); app.back() } }
    Column(Modifier.fillMaxSize().imePadding()) {
        BackBar(title.ifEmpty { "YORU" }, { Api.cookiesFromWebView(); onLeave(); app.back() })
        if (progress in 1..99) LinearProgressIndicator(progress = { progress / 100f }, color = Y.brand, trackColor = Color.Transparent, modifier = Modifier.fillMaxWidth().height(2.dp))
        if (LocalInspectionMode.current) { Box(Modifier.fillMaxSize().background(Y.bg)); return@Column }
        AndroidView(
            factory = { ctx ->
                Api.cookiesToWebView()
                WebView(ctx).apply {
                    setBackgroundColor(android.graphics.Color.parseColor("#080808"))
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.mediaPlaybackRequiresUserGesture = false
                    settings.userAgentString = settings.userAgentString + " YORUApp/2"
                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                            val u = req.url
                            if (u.host != Uri.parse(Api.base).host) {
                                ctx.startActivity(Intent(Intent.ACTION_VIEW, u))
                                return true
                            }
                            val p = u.path ?: "/"
                            return when {
                                p == "/" -> { Api.cookiesFromWebView(); onLeave(); app.back(); true }
                                p.startsWith("/post/") -> { app.post(p.removePrefix("/post/")); true }
                                p.startsWith("/u/") -> { app.profile(p.removePrefix("/u/")); true }
                                p.startsWith("/chat/") -> { app.chat(p.removePrefix("/chat/")); true }
                                p == "/watch" -> { app.go(Routes.WATCH); true }
                                p == "/standing" -> { app.go(Routes.STANDING); true }
                                p == "/login" -> { Api.cookiesFromWebView(); onLeave(); app.back(); true }
                                else -> false
                            }
                        }
                    }
                    webChromeClient = object : WebChromeClient() {
                        override fun onProgressChanged(view: WebView?, newProgress: Int) { progress = newProgress }
                        override fun onShowFileChooser(view: WebView?, cb: ValueCallback<Array<Uri>>?, params: FileChooserParams?): Boolean {
                            chooser?.onReceiveValue(null)
                            chooser = cb
                            pick.launch(params?.acceptTypes?.firstOrNull()?.ifEmpty { null } ?: "*/*")
                            return true
                        }
                    }
                    loadUrl(Api.webUrl(path))
                    web = this
                }
            },
            modifier = Modifier.fillMaxSize(),
        )
    }
}

@Composable
fun BookmarksScreen() {
    val app = LocalApp.current
    Column(Modifier.fillMaxSize()) {
        BackBar("Bookmarks", app::back)
        com.israeltoknt.app.ui.components.PostFeed(com.israeltoknt.app.ui.components.Feeds.bookmarks(), key = "bookmarks", emptyText = "Nothing saved yet. Tap the bookmark on any post.")
    }
}

@Composable
fun JoinScreen(onDone: () -> Unit) {
    WebScreen("/join", "Create your account", onLeave = onDone)
}

@Suppress("unused")
@Composable
private fun Unused() = EmptyState("")
