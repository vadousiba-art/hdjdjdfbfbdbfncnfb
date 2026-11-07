package com.israeltoknt.app.ui.screens

import android.content.Intent
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.outlined.Movie
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.israeltoknt.app.data.Api
import com.israeltoknt.app.data.Post
import com.israeltoknt.app.data.compact
import com.israeltoknt.app.data.map
import com.israeltoknt.app.ui.LocalApp
import com.israeltoknt.app.ui.components.Avatar
import com.israeltoknt.app.ui.components.CommentThread
import com.israeltoknt.app.ui.components.HeartBurst
import com.israeltoknt.app.ui.components.RichText
import com.israeltoknt.app.ui.components.Verified
import com.israeltoknt.app.ui.components.VideoPrefs
import com.israeltoknt.app.ui.components.VideoView
import com.israeltoknt.app.ui.theme.Y
import kotlinx.coroutines.launch

/** Watch: full-screen vertical video, one per swipe. */
@Composable
fun WatchScreen() {
    val app = LocalApp.current
    var mode by remember { mutableStateOf("for_you") }
    var posts by remember(mode) { mutableStateOf<List<Post>?>(null) }
    var done by remember(mode) { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun more() {
        if (loading || done) return
        loading = true
        val sofar = posts.orEmpty()
        runCatching { Api.rpcArr("get_watch", "p_mode" to mode, "p_offset" to sofar.size, "p_limit" to 6).map { Post.parse(it) } }
            .onSuccess { page -> posts = sofar + page.filter { p -> sofar.none { it.id == p.id } }; done = page.size < 6 }
            .onFailure { if (posts == null) posts = emptyList(); app.error(it) }
        loading = false
    }
    LaunchedEffect(mode) { more() }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        val list = posts
        if (list == null) {
            CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.align(Alignment.Center).size(30.dp))
        } else if (list.isEmpty()) {
            Column(Modifier.align(Alignment.Center).padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(Icons.Outlined.Movie, null, tint = Color.White.copy(alpha = 0.7f), modifier = Modifier.size(34.dp))
                Text("No videos yet", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                Text("Videos people post show up here, one per swipe. Post one and you're first.", color = Color.White.copy(alpha = 0.65f), textAlign = TextAlign.Center, fontSize = 14.sp)
            }
        } else {
            val pager = rememberPagerState { list.size }
            LaunchedEffect(pager, list.size) {
                snapshotFlow { pager.currentPage }.collect { if (it >= list.size - 2) scope.launch { more() } }
            }
            VerticalPager(pager, beyondViewportPageCount = 1, key = { list[it].id }, modifier = Modifier.fillMaxSize()) { page ->
                Clip(list[page], active = pager.settledPage == page)
            }
        }
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 4.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Spacer(Modifier.width(48.dp))
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.Center) {
                listOf("for_you" to "For You", "latest" to "Latest").forEach { (k, label) ->
                    Column(Modifier.clickable { mode = k }.padding(horizontal = 12.dp, vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(label, color = if (mode == k) Color.White else Color.White.copy(alpha = 0.55f), fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                        Spacer(Modifier.height(4.dp))
                        Box(Modifier.width(28.dp).height(3.dp).background(if (mode == k) Color.White else Color.Transparent, CircleShape))
                    }
                }
            }
            IconButton(onClick = { VideoPrefs.muted = !VideoPrefs.muted }) {
                Icon(if (VideoPrefs.muted) Icons.AutoMirrored.Filled.VolumeOff else Icons.AutoMirrored.Filled.VolumeUp, if (VideoPrefs.muted) "Turn sound on" else "Mute", tint = Color.White)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Clip(initial: Post, active: Boolean) {
    val app = LocalApp.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var post by remember(initial.id) { mutableStateOf(initial) }
    var comments by remember { mutableStateOf(false) }
    var burst by remember { mutableIntStateOf(0) }
    var expanded by remember { mutableStateOf(false) }

    fun like(force: Boolean = false) {
        if (force && post.liked) { burst++; return }
        val had = post.liked
        post = post.copy(liked = !had, likes = (post.likes + if (had) -1 else 1).coerceAtLeast(0))
        if (!had) burst++
        scope.launch { runCatching { Api.rpc("toggle_reaction", "p_post_id" to post.id, "p_kind" to "heart") }.onFailure { post = initial; app.error(it) } }
    }

    Box(Modifier.fillMaxSize()) {
        VideoView(Api.media(post.mediaUrl)!!, active = active, fill = true, onDoubleTap = { like(force = true) })
        Box(Modifier.align(Alignment.Center)) { HeartBurst(burst) }
        Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(240.dp).background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.75f)))))

        Column(Modifier.align(Alignment.BottomEnd).padding(end = 8.dp, bottom = 20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Box(Modifier.border(2.dp, Color.White, CircleShape).padding(2.dp).clickable { app.profile(post.author.username) }) {
                Avatar(post.author.avatarUrl, post.author.displayName, 44.dp)
            }
            RailButton(Icons.Filled.Favorite, compact(post.likes), if (post.liked) Y.brand else Color.White, if (post.liked) "Unlike" else "Like") { like() }
            RailButton(Icons.Filled.ChatBubble, compact(post.comments), Color.White, "${post.comments} comments") { comments = true }
            RailButton(Icons.Filled.Bookmark, "Save", if (post.bookmarked) Y.amber else Color.White, if (post.bookmarked) "Remove bookmark" else "Bookmark") {
                val was = post.bookmarked
                post = post.copy(bookmarked = !was)
                scope.launch { runCatching { Api.rpc("toggle_bookmark", "p_post_id" to post.id) }.onFailure { post = initial; app.error(it) } }
            }
            RailButton(Icons.AutoMirrored.Filled.Send, "Share", Color.White, "Share") {
                ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, Api.webUrl("/post/${post.id}")), "Share video"))
            }
        }
        Column(Modifier.align(Alignment.BottomStart).padding(start = 14.dp, end = 80.dp, bottom = 22.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { app.profile(post.author.username) }) {
                Text(post.author.username, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                if (post.author.verified) { Spacer(Modifier.width(4.dp)); Verified(15.dp) }
            }
            if (post.body.isNotBlank()) {
                RichText(
                    post.body, Modifier.padding(top = 4.dp).clickable { expanded = !expanded },
                    style = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 14.5.sp, lineHeight = 20.sp),
                    maxLines = if (expanded) 12 else 2,
                )
            }
        }
    }
    if (comments) {
        ModalBottomSheet(onDismissRequest = { comments = false }, containerColor = Y.bg2) {
            Text("${post.comments} comments", fontWeight = FontWeight.SemiBold, modifier = Modifier.align(Alignment.CenterHorizontally).padding(bottom = 8.dp))
            Column(Modifier.verticalScroll(rememberScrollState())) {
                CommentThread(post.id, onCount = { post = post.copy(comments = it) })
            }
        }
    }
}

@Composable
private fun RailButton(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, tint: Color, desc: String, onClick: () -> Unit) {
    Column(Modifier.clickable(onClick = onClick), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, desc, tint = tint, modifier = Modifier.size(32.dp))
        Text(label, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}
