package com.israeltoknt.app.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.israeltoknt.app.data.Api
import com.israeltoknt.app.data.timeAgo
import com.israeltoknt.app.ui.LocalApp
import com.israeltoknt.app.ui.components.Avatar
import com.israeltoknt.app.ui.components.PillButton
import com.israeltoknt.app.ui.components.VideoView
import com.israeltoknt.app.ui.theme.Y
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

val STORY_BG = mapOf(
    "lime" to listOf(Color(0xFF1F2A10), Color(0xFF0B0F05)), "pink" to listOf(Color(0xFF4A0F2A), Color(0xFF14040C)),
    "purple" to listOf(Color(0xFF2B1452), Color(0xFF0B0516)), "blue" to listOf(Color(0xFF0F2A4A), Color(0xFF040B14)),
    "fire" to listOf(Color(0xFF5A1205), Color(0xFF160402)), "void" to listOf(Color(0xFF1A1A1A), Color(0xFF050505)),
)

/** Full-screen stories: tap right for next, left for back; auto-advances. */
@Composable
fun StoryViewer(start: Int) {
    val app = LocalApp.current
    val groups = StoryStore.groups
    var g by remember { mutableIntStateOf(start.coerceIn(0, (groups.size - 1).coerceAtLeast(0))) }
    var i by remember { mutableIntStateOf(0) }
    var progress by remember { mutableFloatStateOf(0f) }
    if (groups.isEmpty()) { app.back(); return }
    val group = groups[g]
    val story = group.items.getOrNull(i) ?: run { app.back(); return }

    fun next() {
        when {
            i < group.items.size - 1 -> i++
            g < groups.size - 1 -> { g++; i = 0 }
            else -> app.back()
        }
    }
    fun prev() {
        when {
            i > 0 -> i--
            g > 0 -> { g--; i = 0 }
        }
    }
    LaunchedEffect(story.id) {
        runCatching { Api.rpc("view_story", "p_story_id" to story.id) }
        progress = 0f
        val total = if (story.mediaType == "video") 15_000 else 6_000
        val step = 50
        var t = 0
        while (t < total) { delay(step.toLong()); t += step; progress = t / total.toFloat() }
        next()
    }

    Box(Modifier.fillMaxSize().background(Color.Black).pointerInput(story.id) {
        detectTapGestures { o -> if (o.x < size.width / 3) prev() else next() }
    }) {
        when {
            story.mediaUrl != null && story.mediaType == "video" -> VideoView(Api.media(story.mediaUrl)!!, active = true, fill = true)
            story.mediaUrl != null -> AsyncImage(Api.media(story.mediaUrl), story.text.ifEmpty { "Story" }, contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize())
            else -> Box(Modifier.fillMaxSize().background(Brush.verticalGradient(STORY_BG[story.bg] ?: STORY_BG.getValue("void"))), contentAlignment = Alignment.Center) {
                Text(story.text, color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.padding(32.dp))
            }
        }
        if (story.mediaUrl != null && story.text.isNotBlank()) {
            Text(story.text, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center,
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 64.dp, start = 24.dp, end = 24.dp).clip(RoundedCornerShape(10.dp)).background(Color.Black.copy(alpha = 0.45f)).padding(10.dp))
        }
        Column(Modifier.fillMaxWidth().statusBarsPadding().padding(10.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                group.items.forEachIndexed { k, _ ->
                    LinearProgressIndicator(
                        progress = { if (k < i) 1f else if (k == i) progress else 0f },
                        color = Color.White, trackColor = Color.White.copy(alpha = 0.3f), drawStopIndicator = {}, gapSize = 0.dp,
                        modifier = Modifier.weight(1f).height(2.5.dp).clip(CircleShape),
                    )
                }
            }
            Row(Modifier.padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Avatar(story.author.avatarUrl, story.author.displayName, 32.dp)
                Text("  ${story.author.displayName}", color = Color.White, fontWeight = FontWeight.SemiBold)
                Text("  ${timeAgo(story.createdAt)}", color = Color.White.copy(alpha = 0.7f), fontSize = 13.sp, modifier = Modifier.weight(1f))
                IconButton(onClick = app::back) { Icon(Icons.Filled.Close, "Close", tint = Color.White) }
            }
        }
    }
}

/** Add to your story: a photo or video, or a line of text on a color. */
@Composable
fun StoryComposeScreen() {
    val app = LocalApp.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var media by remember { mutableStateOf<Uri?>(null) }
    var text by remember { mutableStateOf("") }
    var bg by remember { mutableStateOf("purple") }
    var busy by remember { mutableStateOf(false) }
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { if (it != null) media = it }

    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(STORY_BG[bg] ?: STORY_BG.getValue("void"))).imePadding()) {
        media?.let { AsyncImage(it, "Story media", contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize()) }
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = app::back) { Icon(Icons.Filled.Close, "Cancel", tint = Color.White) }
                Spacer(Modifier.weight(1f))
                if (busy) CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(10.dp))
                PillButton("Share story", {
                    busy = true
                    scope.launch {
                        runCatching {
                            val m = media?.let { Api.upload(ctx, it) }
                            Api.rpc("create_story", "p_text" to text.trim(), "p_media_url" to m?.path, "p_media_type" to m?.kind, "p_bg" to bg)
                        }.onSuccess { app.feedVersion++; app.toast("Added to your story."); app.back() }.onFailure { app.error(it) }
                        busy = false
                    }
                }, enabled = !busy && (media != null || text.isNotBlank()))
            }
            Spacer(Modifier.weight(1f))
            TextField(
                text, { text = it.take(200) },
                placeholder = { Text("Say something…", color = Color.White.copy(alpha = 0.6f), fontSize = 24.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) },
                textStyle = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center),
                colors = TextFieldDefaults.colors(focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent, cursorColor = Color.White),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            )
            Spacer(Modifier.weight(1f))
            Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                IconButton(onClick = { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)) },
                    modifier = Modifier.clip(CircleShape).background(Color.White.copy(alpha = 0.15f))) { Icon(Icons.Outlined.Image, "Add photo or video", tint = Color.White) }
                STORY_BG.keys.forEach { k ->
                    Box(Modifier.size(28.dp).clip(CircleShape).background(Brush.verticalGradient(STORY_BG.getValue(k)))
                        .border(if (bg == k) 2.dp else 1.dp, if (bg == k) Color.White else Color.White.copy(alpha = 0.3f), CircleShape).clickable { bg = k })
                }
            }
        }
    }
}
