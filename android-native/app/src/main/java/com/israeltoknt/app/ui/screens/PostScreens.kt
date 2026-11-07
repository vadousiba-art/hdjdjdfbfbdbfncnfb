package com.israeltoknt.app.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material.icons.outlined.Videocam
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import coil3.compose.AsyncImage
import com.israeltoknt.app.data.Api
import com.israeltoknt.app.data.Post
import com.israeltoknt.app.ui.LocalApp
import com.israeltoknt.app.ui.components.Avatar
import com.israeltoknt.app.ui.components.CommentThread
import com.israeltoknt.app.ui.components.Loading
import com.israeltoknt.app.ui.components.PillButton
import com.israeltoknt.app.ui.components.PostCard
import com.israeltoknt.app.ui.theme.Y
import kotlinx.coroutines.launch
import java.io.File

@Composable
fun BackBar(title: String, onBack: () -> Unit, actions: @Composable () -> Unit = {}) {
    Column(Modifier.background(Y.bg)) {
        Row(Modifier.fillMaxWidth().height(54.dp).padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = Y.ink) }
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, modifier = Modifier.weight(1f))
            actions()
        }
        HorizontalDivider(color = Y.line.copy(alpha = 0.6f))
    }
}

@Composable
fun PostScreen(id: String) {
    val app = LocalApp.current
    var post by remember(id) { mutableStateOf<Post?>(null) }
    var gone by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(id) {
        runCatching { Post.parse(Api.rpcObj("get_post", "p_id" to id)) }.onSuccess { post = it }.onFailure { gone = it.message }
    }
    Column(Modifier.fillMaxSize().imePadding()) {
        BackBar("Post", app::back)
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            when {
                gone != null -> Text(gone!!, color = Y.muted, modifier = Modifier.padding(24.dp))
                post == null -> Loading()
                else -> {
                    PostCard(post!!, videoActive = true, detail = true, onRemoved = { app.back() })
                    CommentThread(id)
                }
            }
        }
    }
}

private data class Attachment(val uri: Uri, val video: Boolean)

/** New post: text, plus a photo or video from the gallery or camera. */
@Composable
fun ComposeScreen() {
    val app = LocalApp.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var text by remember { mutableStateOf("") }
    var media by remember { mutableStateOf<Attachment?>(null) }
    var busy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf<String?>(null) }
    var captureUri by remember { mutableStateOf<Uri?>(null) }

    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) media = Attachment(uri, ctx.contentResolver.getType(uri)?.startsWith("video/") == true)
    }
    val photo = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok -> if (ok) captureUri?.let { media = Attachment(it, false) } }
    val video = rememberLauncherForActivityResult(ActivityResultContracts.CaptureVideo()) { ok -> if (ok) captureUri?.let { media = Attachment(it, true) } }
    fun newCapture(ext: String): Uri {
        val dir = File(ctx.cacheDir, "capture").apply { mkdirs() }
        val f = File(dir, "yoru_${System.currentTimeMillis()}.$ext")
        return FileProvider.getUriForFile(ctx, "${ctx.packageName}.files", f).also { captureUri = it }
    }

    fun submit() {
        busy = true
        status = null
        scope.launch {
            runCatching {
                val m = media?.let {
                    status = "Uploading…"
                    Api.upload(ctx, it.uri, if (it.video) ctx.contentResolver.getType(it.uri) ?: "video/mp4" else null)
                }
                status = "Posting…"
                Api.rpc("create_post", "p_body" to text.trim(), "p_media_url" to m?.path, "p_media_type" to m?.kind)
            }.onSuccess {
                app.feedVersion++
                app.toast("Posted.")
                app.back()
            }.onFailure {
                status = null
                app.error(it)
            }
            busy = false
        }
    }

    Column(Modifier.fillMaxSize().imePadding()) {
        Row(Modifier.fillMaxWidth().height(54.dp).padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = app::back) { Icon(Icons.Filled.Close, "Cancel", tint = Y.ink) }
            Text("New post", fontWeight = FontWeight.SemiBold, fontSize = 17.sp, modifier = Modifier.weight(1f))
            if (busy) CircularProgressIndicator(color = Y.ink, strokeWidth = 2.dp, modifier = Modifier.size(22.dp).padding(end = 4.dp))
            PillButton("Post", { submit() }, Modifier.padding(end = 10.dp), enabled = !busy && (text.isNotBlank() || media != null))
        }
        HorizontalDivider(color = Y.line.copy(alpha = 0.6f))
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Avatar(app.me?.profile?.avatarUrl, app.me?.profile?.displayName ?: "You", 40.dp)
                TextField(
                    text, { text = it.take(2000) },
                    placeholder = { Text("What's happening tonight?", color = Y.muted) },
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent,
                        focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent, cursorColor = Y.ink,
                    ),
                    textStyle = androidx.compose.ui.text.TextStyle(fontSize = 17.sp, color = Y.ink),
                    modifier = Modifier.weight(1f).heightIn(min = 140.dp),
                )
            }
            media?.let { m ->
                Box(Modifier.padding(top = 12.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Y.card2)) {
                    if (m.video) {
                        Row(Modifier.fillMaxWidth().padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Videocam, null, tint = Y.ink)
                            Spacer(Modifier.width(10.dp))
                            Text("Video attached", fontWeight = FontWeight.Medium)
                        }
                    } else {
                        AsyncImage(m.uri, "Attached photo", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().heightIn(max = 360.dp))
                    }
                    IconButton(onClick = { media = null }, modifier = Modifier.align(Alignment.TopEnd).padding(6.dp).size(30.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.6f))) {
                        Icon(Icons.Filled.Close, "Remove attachment", tint = Color.White, modifier = Modifier.size(16.dp))
                    }
                }
            }
            status?.let { Text(it, color = Y.muted, fontSize = 13.sp, modifier = Modifier.padding(top = 10.dp)) }
            Text("Posts are checked by Night Watch against the community rules.", color = Y.muted, fontSize = 12.sp, modifier = Modifier.padding(top = 16.dp))
        }
        HorizontalDivider(color = Y.line.copy(alpha = 0.6f))
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Tool(Icons.Outlined.Image, "Photo or video from gallery") { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)) }
            Tool(Icons.Outlined.PhotoCamera, "Take a photo") { photo.launch(newCapture("jpg")) }
            Tool(Icons.Outlined.Videocam, "Record a video") { video.launch(newCapture("mp4")) }
        }
    }
}

@Composable
private fun Tool(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    Box(Modifier.clip(CircleShape).clickable(onClick = onClick).padding(10.dp)) { Icon(icon, label, tint = Y.ink2, modifier = Modifier.size(24.dp)) }
}
