package com.israeltoknt.app.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.israeltoknt.app.data.Api
import com.israeltoknt.app.data.Channel
import com.israeltoknt.app.data.ChannelDetail
import com.israeltoknt.app.data.Message
import com.israeltoknt.app.data.Profile
import com.israeltoknt.app.data.map
import com.israeltoknt.app.data.timeAgo
import com.israeltoknt.app.ui.LocalApp
import com.israeltoknt.app.ui.Routes
import com.israeltoknt.app.ui.components.Avatar
import com.israeltoknt.app.ui.components.EmptyState
import com.israeltoknt.app.ui.components.Loading
import com.israeltoknt.app.ui.components.PillButton
import com.israeltoknt.app.ui.components.RichText
import com.israeltoknt.app.ui.components.SectionLabel
import com.israeltoknt.app.ui.components.fieldColors
import com.israeltoknt.app.ui.theme.Y
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Inbox, like Discord: group chats in a rail, DMs on the right, official notices pinned. */
@Composable
fun InboxScreen() {
    val app = LocalApp.current
    var channels by remember { mutableStateOf<List<Channel>?>(null) }
    var newChat by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        while (true) {
            runCatching { Api.rpcArr("get_channels").map { Channel.parse(it) } }.onSuccess { channels = it }.onFailure { if (channels == null) channels = emptyList() }
            delay(8_000)
        }
    }
    val all = channels.orEmpty()
    val official = all.firstOrNull { it.isOfficial }
    val groups = all.filter { it.kind == "group" && it.isMember }
    val dms = all.filter { it.kind == "dm" && !it.isOfficial }
    val active = dms.filter { it.dmUser?.online == true }.take(8)
    val list = (dms + groups).sortedByDescending { it.lastMessageAt }

    Row(Modifier.fillMaxSize()) {
        LazyColumn(Modifier.width(72.dp).fillMaxHeight(), horizontalAlignment = Alignment.CenterHorizontally, contentPadding = PaddingValues(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                Box(Modifier.size(48.dp).clip(RoundedCornerShape(16.dp)).background(Y.brand), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.ChatBubble, "Direct messages", tint = Color.White, modifier = Modifier.size(22.dp))
                }
                HorizontalDivider(Modifier.width(32.dp).padding(top = 8.dp), color = Y.line)
            }
            items(groups, key = { it.id }) { g ->
                Box(Modifier.size(52.dp).clickable { app.chat(g.id) }) {
                    Box(Modifier.align(Alignment.Center).size(48.dp).clip(RoundedCornerShape(18.dp)).background(Y.card2), contentAlignment = Alignment.Center) {
                        Text(g.emoji, fontSize = 22.sp)
                    }
                    if (g.unread > 0) Badge(g.unread, Modifier.align(Alignment.BottomEnd))
                }
            }
            item {
                Box(
                    Modifier.size(48.dp).clip(RoundedCornerShape(18.dp)).border(1.dp, Y.line, RoundedCornerShape(18.dp)).clickable { newChat = true },
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Filled.Add, "New chat", tint = Y.online) }
            }
        }
        VerticalDivider(color = Y.line.copy(alpha = 0.7f))
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp)) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Inbox", fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    PillButton("+ New", { newChat = true })
                }
            }
            if (active.isNotEmpty()) item {
                SectionLabel("Active now", Modifier.padding(top = 16.dp, bottom = 8.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(active, key = { it.id }) { c ->
                        Column(
                            Modifier.width(80.dp).clip(RoundedCornerShape(16.dp)).background(Y.card2.copy(alpha = 0.7f)).clickable { app.chat(c.id) }.padding(vertical = 12.dp, horizontal = 6.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Avatar(c.dmUser!!.avatarUrl, c.dmUser.displayName, 46.dp, online = true)
                            Text(c.dmUser.displayName, fontSize = 12.sp, color = Y.ink2, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp))
                        }
                    }
                }
            }
            item { Spacer(Modifier.height(10.dp)) }
            if (channels == null) item { Loading() }
            official?.let { o -> item(key = o.id) { ChannelRow(o, official = true) } }
            items(list, key = { it.id }) { ChannelRow(it) }
            if (channels != null && list.isEmpty() && official == null) item { EmptyState("No messages yet. Start one with someone you know.") }
        }
    }
    if (newChat) NewChatSheet { newChat = false }
}

@Composable
private fun Badge(n: Int, modifier: Modifier = Modifier) {
    Text(
        if (n > 99) "99+" else "$n", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold,
        modifier = modifier.clip(CircleShape).background(Y.brand).padding(horizontal = 5.dp, vertical = 1.dp),
    )
}

@Composable
private fun ChannelRow(c: Channel, official: Boolean = false) {
    val app = LocalApp.current
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(if (official) Y.card2.copy(alpha = 0.6f) else Color.Transparent)
            .clickable { app.chat(c.id) }.padding(horizontal = 8.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (c.kind == "dm" && c.dmUser != null) Avatar(c.dmUser.avatarUrl, c.dmUser.displayName, 48.dp, online = !official && c.dmUser.online)
        else Box(Modifier.size(48.dp).clip(RoundedCornerShape(18.dp)).background(Y.card2), contentAlignment = Alignment.Center) { Text(c.emoji, fontSize = 22.sp) }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(c.title, fontWeight = if (c.unread > 0) FontWeight.SemiBold else FontWeight.Medium, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                if (official) {
                    Spacer(Modifier.width(6.dp))
                    Row(Modifier.clip(RoundedCornerShape(5.dp)).background(Y.official).padding(horizontal = 5.dp, vertical = 1.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Verified, null, tint = Color.White, modifier = Modifier.size(11.dp))
                        Text(" OFFICIAL", color = Color.White, fontSize = 9.5.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(Modifier.weight(1f))
                c.lastAt?.let { Text(timeAgo(it), color = Y.muted, fontSize = 12.sp) }
            }
            Text(
                when {
                    c.lastBody != null -> (if (c.kind == "group") "${c.lastAuthor}: " else "") + c.lastBody
                    c.isMember -> "No messages yet"
                    else -> "${c.memberCount} members · tap to join"
                },
                color = if (c.unread > 0) Y.ink2 else Y.muted, fontSize = 13.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
        if (c.unread > 0) { Spacer(Modifier.width(8.dp)); Badge(c.unread) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NewChatSheet(onClose: () -> Unit) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var q by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<Profile>>(emptyList()) }
    LaunchedEffect(q) {
        if (q.trim().length < 2) { results = emptyList(); return@LaunchedEffect }
        delay(250)
        runCatching { Api.rpcArr("search_profiles", "p_q" to q.trim()).map { Profile.parse(it) } }.onSuccess { results = it }
    }
    ModalBottomSheet(onDismissRequest = onClose, containerColor = Y.bg2) {
        Column(Modifier.padding(horizontal = 16.dp).padding(bottom = 24.dp).heightIn(min = 320.dp).imePadding()) {
            Text("New message", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            OutlinedTextField(q, { q = it.take(40) }, placeholder = { Text("Search people") }, leadingIcon = { Icon(Icons.Outlined.Search, null) },
                singleLine = true, colors = fieldColors, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().padding(top = 10.dp))
            results.filter { it.id != app.me?.profile?.id && !it.isBot }.forEach { p ->
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable {
                        scope.launch {
                            runCatching { Api.rpc("start_dm", "p_user_id" to p.id) as? String }
                                .onSuccess { id -> onClose(); id?.let { app.chat(it) } }
                                .onFailure { app.error(it) }
                        }
                    }.padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Avatar(p.avatarUrl, p.displayName, 40.dp, online = p.online)
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(p.displayName, fontWeight = FontWeight.SemiBold)
                        Text("@${p.username}", color = Y.muted, fontSize = 13.sp)
                    }
                }
            }
            Text("Group chats can be created on the website for now.", color = Y.muted, fontSize = 12.sp, modifier = Modifier.padding(top = 16.dp).clickable { onClose(); app.web("/chat", "Chats") })
        }
    }
}

/** One conversation. New messages arrive every few seconds while it's open. */
@Composable
fun ChatScreen(id: String) {
    val app = LocalApp.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var detail by remember(id) { mutableStateOf<ChannelDetail?>(null) }
    var messages by remember(id) { mutableStateOf<List<Message>?>(null) }
    var text by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    val list = rememberLazyListState()
    val meId = app.me?.profile?.id
    val other = detail?.members?.firstOrNull { it.id != meId }
    val official = detail?.kind == "dm" && other?.id == com.israeltoknt.app.data.OFFICIAL_ID

    suspend fun refresh() {
        val after = messages?.lastOrNull()?.createdAt
        runCatching { Api.rpcArr("get_messages", "p_channel_id" to id, "p_limit" to 60, "p_after" to after).map { Message.parse(it) } }
            .onSuccess { page ->
                if (page.isNotEmpty() || messages == null) {
                    val prev = messages.orEmpty()
                    val merged = (prev + page.filter { p -> prev.none { it.id == p.id } }).sortedBy { com.israeltoknt.app.data.parseTime(it.createdAt) }
                    messages = merged
                    runCatching { Api.rpc("mark_channel_read", "p_channel_id" to id) }
                }
            }
    }
    LaunchedEffect(id) {
        runCatching {
            val d = ChannelDetail.parse(Api.rpcObj("get_channel", "p_id" to id))
            if (!d.isMember) Api.rpc("join_channel", "p_channel_id" to id)
            d
        }.onSuccess { detail = it }.onFailure { app.error(it) }
        while (true) {
            refresh()
            delay(2_500)
        }
    }
    LaunchedEffect(messages?.size) { messages?.let { if (it.isNotEmpty()) list.animateScrollToItem(it.size - 1) } }

    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri: Uri? ->
        if (uri != null) scope.launch {
            sending = true
            runCatching {
                val m = Api.upload(ctx, uri)
                Api.rpc("send_message", "p_channel_id" to id, "p_body" to "", "p_media_url" to m.path, "p_media_type" to m.kind)
            }.onSuccess { refresh() }.onFailure { app.error(it) }
            sending = false
        }
    }

    Column(Modifier.fillMaxSize().imePadding()) {
        val title = if (detail?.kind == "dm") other?.displayName ?: "Chat" else "${detail?.emoji ?: ""} ${detail?.name ?: ""}"
        BackBar(title, app::back)
        LazyColumn(state = list, modifier = Modifier.weight(1f), contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp)) {
            val msgs = messages
            if (msgs == null) item { Loading() }
            else if (msgs.isEmpty()) item { EmptyState("No messages yet. Say hi.") }
            else items(msgs.size, key = { msgs[it].id }) { i ->
                val m = msgs[i]
                val prev = msgs.getOrNull(i - 1)
                val head = prev == null || prev.author.id != m.author.id || com.israeltoknt.app.data.parseTime(m.createdAt) - com.israeltoknt.app.data.parseTime(prev.createdAt) > 5 * 60_000
                Bubble(m, mine = m.author.id == meId, head = head)
            }
        }
        if (official) {
            Row(Modifier.fillMaxWidth().padding(12.dp).clip(RoundedCornerShape(16.dp)).background(Y.card).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Shield, null, tint = Y.official)
                Text("Notices only, so replies aren't read. To appeal, use Account Standing.", fontSize = 13.sp, color = Y.ink2, modifier = Modifier.weight(1f).padding(horizontal = 10.dp))
                PillButton("Standing", { app.go(Routes.STANDING) })
            }
        } else {
            Row(Modifier.fillMaxWidth().padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)) }, enabled = !sending) {
                    Icon(Icons.Outlined.Image, "Attach media", tint = Y.brand)
                }
                OutlinedTextField(text, { text = it.take(2000) }, placeholder = { Text("Message") }, colors = fieldColors, shape = RoundedCornerShape(22.dp), maxLines = 5, modifier = Modifier.weight(1f))
                IconButton(
                    onClick = {
                        val body = text.trim()
                        if (body.isEmpty()) return@IconButton
                        sending = true
                        scope.launch {
                            runCatching { Api.rpc("send_message", "p_channel_id" to id, "p_body" to body) }
                                .onSuccess { text = ""; refresh() }.onFailure { app.error(it) }
                            sending = false
                        }
                    },
                    enabled = !sending,
                ) { Icon(Icons.AutoMirrored.Filled.Send, "Send", tint = Y.brand) }
            }
        }
    }
}

@Composable
private fun Bubble(m: Message, mine: Boolean, head: Boolean) {
    val app = LocalApp.current
    Column(Modifier.fillMaxWidth().padding(top = if (head) 10.dp else 2.dp), horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
        if (head && !mine) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 3.dp).clickable { app.profile(m.author.username) }) {
                Avatar(m.author.avatarUrl, m.author.displayName, 20.dp)
                Text("  ${m.author.displayName}", fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = Y.ink2)
                Text("  ${timeAgo(m.createdAt)}", fontSize = 11.5.sp, color = Y.muted)
            }
        }
        Column(
            Modifier.widthIn(max = 290.dp).clip(RoundedCornerShape(18.dp)).background(if (mine) Y.brand else Y.card2).padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            m.replyTo?.let { Text(it, fontSize = 12.sp, color = if (mine) Color.White.copy(alpha = 0.75f) else Y.muted, maxLines = 1, overflow = TextOverflow.Ellipsis) }
            if (m.deleted) Text("Message deleted", color = if (mine) Color.White.copy(alpha = 0.7f) else Y.muted, fontSize = 14.sp)
            else {
                m.mediaUrl?.let { url ->
                    if (m.mediaType == "video") Text("🎬 Video", color = if (mine) Color.White else Y.ink)
                    else AsyncImage(Api.media(url), "Photo", contentScale = ContentScale.Crop, modifier = Modifier.padding(bottom = 4.dp).clip(RoundedCornerShape(12.dp)).heightIn(max = 260.dp))
                }
                if (m.body.isNotBlank()) RichText(m.body, style = androidx.compose.ui.text.TextStyle(fontSize = 15.sp, lineHeight = 21.sp, color = if (mine) Color.White else Y.ink))
            }
        }
    }
}
