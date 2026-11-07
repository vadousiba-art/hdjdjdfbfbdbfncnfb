package com.israeltoknt.app.ui.screens

import android.annotation.SuppressLint
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.israeltoknt.app.data.Api
import com.israeltoknt.app.data.Notice
import com.israeltoknt.app.data.ProfileFull
import com.israeltoknt.app.data.compact
import com.israeltoknt.app.data.map
import com.israeltoknt.app.data.timeAgo
import com.israeltoknt.app.ui.LocalApp
import com.israeltoknt.app.ui.Routes
import com.israeltoknt.app.ui.components.Avatar
import com.israeltoknt.app.ui.components.EmptyState
import com.israeltoknt.app.ui.components.Feeds
import com.israeltoknt.app.ui.components.Loading
import com.israeltoknt.app.ui.components.PillButton
import com.israeltoknt.app.ui.components.PostFeed
import com.israeltoknt.app.ui.components.ReportSheet
import com.israeltoknt.app.ui.components.Verified
import com.israeltoknt.app.ui.theme.Y
import kotlinx.coroutines.launch

/**
 * The animated part of a profile (banner, ring, nameplate) is drawn by the
 * same renderer as the website so cosmetics look identical; the rest is native.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun LookHeader(username: String) {
    if (LocalInspectionMode.current) {
        Box(Modifier.fillMaxWidth().height(178.dp).background(Y.card2))
        return
    }
    AndroidView(
        factory = { ctx ->
            Api.cookiesToWebView()
            WebView(ctx).apply {
                setBackgroundColor(android.graphics.Color.parseColor("#080808"))
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                isVerticalScrollBarEnabled = false
                webViewClient = WebViewClient()
                loadUrl(Api.webUrl("/embed/look?u=${android.net.Uri.encode(username)}"))
            }
        },
        modifier = Modifier.fillMaxWidth().height(178.dp),
    )
}

@Composable
fun ProfileScreen(username: String) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var p by remember(username) { mutableStateOf<ProfileFull?>(null) }
    var err by remember { mutableStateOf<String?>(null) }
    var reporting by remember { mutableStateOf(false) }
    LaunchedEffect(username) {
        runCatching { ProfileFull.parse(Api.rpcObj("get_profile", "p_username" to username)) }.onSuccess { p = it }.onFailure { err = it.message }
    }
    Column(Modifier.fillMaxSize()) {
        val isMe = p?.isMe == true
        BackBar(if (isMe) "Your profile" else "@$username", app::back) {
            if (isMe) androidx.compose.material3.IconButton(onClick = { app.web("/settings", "Settings") }) { Icon(Icons.Outlined.Settings, "Settings", tint = Y.ink) }
        }
        val prof = p
        if (prof == null) {
            if (err != null) EmptyState(err!!) else Loading()
            return@Column
        }
        PostFeed(Feeds.user(username), key = "user:$username", emptyText = "No posts yet.") {
            item(key = "head") {
                Column {
                    LookHeader(username)
                    Column(Modifier.padding(horizontal = 16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(prof.profile.displayName, fontSize = 21.sp, fontWeight = FontWeight.Bold)
                            if (prof.profile.verified) Verified(18.dp)
                            if (prof.profile.badge.isNotEmpty()) Text(prof.profile.badge, fontSize = 17.sp)
                        }
                        Text("@${prof.profile.username}", color = Y.muted, fontSize = 14.sp)
                        if (prof.profile.status.isNotBlank()) Text("● ${prof.profile.status}", color = Y.online, fontSize = 13.5.sp, modifier = Modifier.padding(top = 4.dp))
                        if (prof.bio.isNotBlank()) Text(prof.bio, fontSize = 15.sp, modifier = Modifier.padding(top = 8.dp))
                        Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("Posts" to prof.posts, "Likes" to prof.likes, "Awards" to prof.awards, "Points" to prof.points).forEach { (l, v) ->
                                Column(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(Y.card2).padding(vertical = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(compact(v), fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                                    Text(l.uppercase(), color = Y.muted, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                        Row(Modifier.padding(vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (isMe) {
                                PillButton("Edit profile", { app.web("/settings", "Settings") }, primary = false)
                                PillButton("Customize look", { app.web("/pro/hub", "YORU Pro") }, primary = false)
                            } else if (!prof.profile.isBot) {
                                PillButton("Message", {
                                    scope.launch {
                                        runCatching { Api.rpc("start_dm", "p_user_id" to prof.profile.id) as? String }
                                            .onSuccess { it?.let(app::chat) }.onFailure { app.error(it) }
                                    }
                                })
                                PillButton("Report", { reporting = true }, primary = false)
                            }
                        }
                    }
                    HorizontalDivider(color = Y.line.copy(alpha = 0.7f))
                }
            }
        }
    }
    if (reporting) p?.let { ReportSheet("user", it.profile.id) { reporting = false } }
}

/** Activity: likes, comments, mentions, messages and Night Watch notices. */
@Composable
fun NotificationsScreen() {
    val app = LocalApp.current
    var list by remember { mutableStateOf<List<Notice>?>(null) }
    LaunchedEffect(Unit) {
        runCatching { Api.rpcArr("get_notifications", "p_limit" to 60).map { Notice.parse(it) } }.onSuccess { list = it }.onFailure { list = emptyList(); app.error(it) }
        kotlinx.coroutines.delay(2000)
        runCatching { Api.rpc("mark_notifications_read") }
        runCatching { app.me = Api.me() }
    }
    Column(Modifier.fillMaxSize()) {
        BackBar("Activity", app::back)
        LazyColumn(Modifier.weight(1f)) {
            val items = list
            if (items == null) item { Loading() }
            else if (items.isEmpty()) item { EmptyState("Nothing yet. Post something and the night will notice.") }
            else items(items, key = { it.id }) { n -> NoticeRow(n) }
        }
    }
}

private val NOTICE_TEXT = mapOf(
    "like" to "liked your post", "reaction" to "reacted to your post", "comment" to "commented on your post",
    "reply" to "replied to your comment", "mention" to "mentioned you", "repost" to "reposted your post",
    "award" to "gave your post an award", "message" to "sent you a message", "friend_post" to "posted something",
    "roast" to "roasted you", "announcement" to "posted an announcement", "system" to "sent you a notice",
    "moderation" to "· Night Watch", "report_update" to "· update on your report",
)

@Composable
private fun NoticeRow(n: Notice) {
    val app = LocalApp.current
    Row(
        Modifier.fillMaxWidth().background(if (!n.read) Y.brand.copy(alpha = 0.06f) else Color.Transparent).clickable {
            when {
                n.kind == "report_update" -> app.go(Routes.STANDING)
                n.postId != null -> app.post(n.postId)
                n.channelId != null -> app.chat(n.channelId)
                n.actor != null -> app.profile(n.actor.username)
            }
        }.padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        if (n.kind == "level_up") Box(Modifier.size(42.dp).clip(CircleShape).background(Y.brand), contentAlignment = Alignment.Center) { Text("昇", color = Color.White, fontWeight = FontWeight.Bold) }
        else Avatar(n.actor?.avatarUrl, n.actor?.displayName ?: "?", 42.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                if (n.kind == "level_up") "Level up! You reached level ${n.body}." else "${n.actor?.displayName ?: "Someone"} ${NOTICE_TEXT[n.kind] ?: n.kind}",
                fontSize = 14.5.sp, fontWeight = FontWeight.Medium,
            )
            if (n.body.isNotBlank() && n.kind !in setOf("like", "reaction", "level_up")) Text(n.body, color = Y.ink2, fontSize = 13.5.sp, maxLines = 2, modifier = Modifier.padding(top = 2.dp))
            Text(timeAgo(n.createdAt), color = Y.muted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
        }
        if (n.kind == "message") Icon(Icons.Outlined.ChatBubbleOutline, null, tint = Y.muted, modifier = Modifier.size(18.dp))
    }
}
