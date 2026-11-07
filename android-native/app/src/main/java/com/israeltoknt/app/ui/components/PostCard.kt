package com.israeltoknt.app.ui.components

import android.content.Intent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.GppMaybe
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.Repeat
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.israeltoknt.app.data.Api
import com.israeltoknt.app.data.Post
import com.israeltoknt.app.data.compact
import com.israeltoknt.app.data.timeAgo
import com.israeltoknt.app.ui.LocalApp
import com.israeltoknt.app.ui.theme.Y
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * A post in the feed, flat and edge to edge like the website: author row,
 * text, media, then like / comment / repost / share / save.
 */
@Composable
fun PostCard(initial: Post, videoActive: Boolean = false, detail: Boolean = false, onRemoved: (String) -> Unit = {}) {
    val app = LocalApp.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var post by remember(initial) { mutableStateOf(initial) }
    val p = post.shown
    var menu by remember { mutableStateOf(false) }
    var reporting by remember { mutableStateOf(false) }
    var heart by remember { mutableIntStateOf(0) }
    val mine = post.author.id == app.me?.profile?.id

    fun patch(fn: (Post) -> Post) {
        post = if (post.shown !== post) post.copy(repostOf = fn(post.repostOf!!)) else fn(post)
    }

    fun like() {
        val had = p.liked
        patch { it.copy(liked = !had, likes = (it.likes + if (had) -1 else 1).coerceAtLeast(0)) }
        if (!had) heart++
        scope.launch { runCatching { Api.rpc("toggle_reaction", "p_post_id" to p.id, "p_kind" to "heart") }.onFailure { post = initial; app.error(it) } }
    }

    fun repost() {
        val was = p.reposted
        patch { it.copy(reposted = !was, reposts = it.reposts + if (was) -1 else 1) }
        scope.launch {
            runCatching { Api.rpc("toggle_repost", "p_post_id" to p.id) }
                .onSuccess { app.toast(if (was) "Repost removed." else "Reposted.") }
                .onFailure { post = initial; app.error(it) }
        }
    }

    fun save() {
        val was = p.bookmarked
        patch { it.copy(bookmarked = !was) }
        scope.launch {
            runCatching { Api.rpc("toggle_bookmark", "p_post_id" to p.id) }
                .onSuccess { app.toast(if (was) "Removed from bookmarks." else "Saved to bookmarks.") }
                .onFailure { post = initial; app.error(it) }
        }
    }

    fun share() {
        val url = Api.webUrl("/post/${p.id}")
        ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, url), "Share post"))
    }

    Column(
        Modifier.fillMaxWidth()
            .then(if (detail) Modifier else Modifier.clickable { app.post(p.id) })
            .padding(vertical = 12.dp),
    ) {
        if (post.kind == "repost" && post.shown !== post) {
            Row(Modifier.padding(start = 16.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Repeat, null, tint = Y.muted, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(6.dp))
                Text("${if (mine) "You" else post.author.displayName} reposted", color = Y.muted, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
            }
        }
        if (post.modState == "held") {
            Row(
                Modifier.padding(horizontal = 16.dp).padding(bottom = 10.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp))
                    .background(Y.amber.copy(alpha = 0.12f)).border(1.dp, Y.amber.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                    .clickable { app.go("standing") }.padding(10.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Icon(Icons.Outlined.GppMaybe, null, tint = Y.amber, modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(8.dp))
                Text("Under review. Only you${if (mine) "" else " and moderators"} can see this until Night Watch's review is done.", fontSize = 13.sp, color = Y.ink2)
            }
        }
        Row(Modifier.padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Avatar(p.author.avatarUrl, p.author.displayName, if (detail) 44.dp else 38.dp, ring = p.author.ring != null,
                modifier = Modifier.clickable { app.profile(p.author.username) })
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(p.author.displayName, fontWeight = FontWeight.SemiBold, fontSize = 14.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                    if (p.author.verified) Verified(14.dp)
                    if (p.author.badge.isNotEmpty() && p.author.badge != "🤖") Text(p.author.badge, fontSize = 13.sp)
                    if (!p.author.isBot) LevelChip(p.author.level)
                }
                Text("@${p.author.username} · ${timeAgo(p.createdAt)}", color = Y.muted, fontSize = 12.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Box {
                IconButton(onClick = { menu = true }) { Icon(Icons.Outlined.MoreHoriz, "More options", tint = Y.ink2) }
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    DropdownMenuItem(text = { Text("Copy link") }, onClick = {
                        menu = false
                        val cm = ctx.getSystemService(android.content.ClipboardManager::class.java)
                        cm?.setPrimaryClip(android.content.ClipData.newPlainText("YORU", Api.webUrl("/post/${p.id}")))
                        app.toast("Link copied.")
                    })
                    if (!mine) DropdownMenuItem(text = { Text("Report") }, onClick = { menu = false; reporting = true })
                    if (!mine && !p.author.isBot) DropdownMenuItem(text = { Text("Block @${p.author.username}", color = Y.brand2) }, onClick = {
                        menu = false
                        scope.launch {
                            runCatching { Api.rpc("toggle_block", "p_user_id" to p.author.id) }
                                .onSuccess { app.toast("Blocked @${p.author.username}."); onRemoved(post.id) }
                                .onFailure { app.error(it) }
                        }
                    })
                    if (mine) DropdownMenuItem(text = { Text(if (post.kind == "repost") "Undo repost" else "Delete post", color = Y.brand2) }, onClick = {
                        menu = false
                        scope.launch {
                            runCatching { Api.rpc("delete_post", "p_id" to post.id) }
                                .onSuccess { app.toast("Post deleted."); onRemoved(post.id) }
                                .onFailure { app.error(it) }
                        }
                    })
                }
            }
        }
        if (p.body.isNotBlank()) {
            RichText(p.body, Modifier.padding(horizontal = 16.dp).padding(top = 8.dp), style = androidx.compose.ui.text.TextStyle(fontSize = if (detail) 16.5.sp else 15.sp, lineHeight = 22.sp, color = Y.ink))
        }
        if (post.kind != "repost" && post.repostOf != null) {
            Column(
                Modifier.padding(horizontal = 16.dp).padding(top = 10.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp))
                    .border(1.dp, Y.line, RoundedCornerShape(12.dp)).clickable { app.post(post.repostOf!!.id) }.padding(12.dp),
            ) {
                val q = post.repostOf!!
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Avatar(q.author.avatarUrl, q.author.displayName, 20.dp)
                    Spacer(Modifier.width(6.dp))
                    Text(q.author.displayName, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    Text("  @${q.author.username}", color = Y.muted, fontSize = 13.sp)
                }
                if (q.body.isNotBlank()) RichText(q.body, Modifier.padding(top = 4.dp), maxLines = 4)
                if (q.mediaUrl != null && !q.isVideo) {
                    AsyncImage(Api.media(q.mediaUrl), null, contentScale = ContentScale.Crop, modifier = Modifier.padding(top = 8.dp).fillMaxWidth().heightIn(max = 220.dp).clip(RoundedCornerShape(8.dp)))
                }
            }
        }
        if (p.mediaUrl != null) {
            val sensitive = post.modState == "label"
            var reveal by remember { mutableStateOf(false) }
            Box(Modifier.padding(top = 10.dp).fillMaxWidth(), contentAlignment = Alignment.Center) {
                val blurMod = if (sensitive && !reveal) Modifier.blur(28.dp) else Modifier
                if (p.isVideo) {
                    VideoView(Api.media(p.mediaUrl)!!, active = videoActive && (!sensitive || reveal), modifier = blurMod, onDoubleTap = { if (!p.liked) like() else heart++ })
                } else {
                    AsyncImage(
                        Api.media(p.mediaUrl), p.body.take(120).ifEmpty { "Post image" },
                        contentScale = ContentScale.FillWidth,
                        modifier = blurMod.fillMaxWidth().heightIn(min = 120.dp, max = 620.dp).background(Color.Black)
                            .pointerInput(p.id) {
                                detectTapGestures(onDoubleTap = { if (!p.liked) like() else heart++ }, onTap = { if (!detail) app.post(p.id) })
                            },
                    )
                }
                if (sensitive && !reveal) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                        Icon(Icons.Outlined.VisibilityOff, null, tint = Color.White, modifier = Modifier.size(26.dp))
                        Text("This may be sensitive", color = Color.White, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 6.dp))
                        TextButton(onClick = { reveal = true }) { Text("See post", color = Color.White) }
                    }
                }
                HeartBurst(heart)
            }
        }
        p.roast?.let { roast ->
            Column(
                Modifier.padding(horizontal = 16.dp).padding(top = 10.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp))
                    .background(Y.brand.copy(alpha = 0.07f)).border(1.dp, Y.brand.copy(alpha = 0.5f), RoundedCornerShape(12.dp)).padding(12.dp),
            ) {
                Text((p.roastLabel ?: "Roast").uppercase(), color = Y.brand2, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp)
                Text(roast, fontSize = 15.sp, modifier = Modifier.padding(top = 2.dp))
            }
        }
        p.poll?.let { PollView(p.id, it) { np -> patch { x -> x.copy(poll = np) } } }
        p.linkUrl?.let { link ->
            Text(
                link, color = Y.ink2, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(horizontal = 16.dp).padding(top = 10.dp).fillMaxWidth().clip(RoundedCornerShape(12.dp))
                    .border(1.dp, Y.line, RoundedCornerShape(12.dp))
                    .clickable { ctx.startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(link))) }.padding(12.dp),
            )
        }
        Row(Modifier.padding(start = 6.dp, end = 6.dp, top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Action(if (p.liked) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder, if (p.liked) "Unlike" else "Like", p.likes, if (p.liked) Y.brand else Y.ink) { like() }
            Action(Icons.Outlined.ChatBubbleOutline, "${p.comments} comments", p.comments, Y.ink) { app.post(p.id) }
            Action(Icons.Outlined.Repeat, if (p.reposted) "Undo repost" else "Repost", p.reposts, if (p.reposted) Y.online else Y.ink) { repost() }
            Action(Icons.AutoMirrored.Outlined.Send, "Share", 0, Y.ink) { share() }
            Spacer(Modifier.weight(1f))
            Action(if (p.bookmarked) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder, if (p.bookmarked) "Remove bookmark" else "Bookmark", 0, Y.ink) { save() }
        }
    }
    HorizontalDivider(color = Y.line.copy(alpha = 0.7f))
    if (reporting) ReportSheet("post", post.id) { reporting = false }
}

@Composable
private fun Action(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, count: Int, tint: Color, onClick: () -> Unit) {
    Row(
        Modifier.clip(RoundedCornerShape(50)).clickable(onClick = onClick).padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, label, tint = tint, modifier = Modifier.size(23.dp))
        if (count > 0) Text(compact(count), color = Y.ink2, fontSize = 13.5.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 5.dp))
    }
}

@Composable
fun HeartBurst(trigger: Int) {
    var shown by remember { mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(trigger) {
        if (trigger > 0) {
            shown = true
            delay(650)
            shown = false
        }
    }
    AnimatedVisibility(shown, enter = scaleIn(initialScale = 0.3f) + fadeIn(), exit = fadeOut()) {
        Icon(Icons.Filled.Favorite, null, tint = Color.White, modifier = Modifier.size(96.dp))
    }
}

@Composable
private fun PollView(postId: String, poll: com.israeltoknt.app.data.Poll, onVoted: (com.israeltoknt.app.data.Poll) -> Unit) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    Column(Modifier.padding(horizontal = 16.dp).padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        poll.options.forEach { o ->
            val pct = if (poll.total > 0) o.votes * 100 / poll.total else 0
            val voted = poll.myVote != null
            Box(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).border(1.dp, if (poll.myVote == o.id) Y.ink else Y.line, RoundedCornerShape(10.dp))
                    .clickable(enabled = !voted) {
                        scope.launch {
                            runCatching { Api.rpcObj("vote_poll", "p_post_id" to postId, "p_option_id" to o.id) }
                                .onSuccess { onVoted(com.israeltoknt.app.data.Post.parse(it).poll ?: poll) }
                                .onFailure { app.error(it) }
                        }
                    },
            ) {
                if (voted) Box(Modifier.fillMaxWidth(pct / 100f).matchParentSizeHeight().background(Y.card2))
                Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp)) {
                    Text(o.label, modifier = Modifier.weight(1f), fontSize = 14.sp)
                    if (voted) Text("$pct%", color = Y.ink2, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        Text("${poll.total} vote${if (poll.total == 1) "" else "s"}", color = Y.muted, fontSize = 12.sp)
    }
}

private fun Modifier.matchParentSizeHeight() = this.then(Modifier.heightIn(min = 40.dp))
