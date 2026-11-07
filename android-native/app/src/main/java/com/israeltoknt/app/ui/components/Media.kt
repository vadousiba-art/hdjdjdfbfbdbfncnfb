package com.israeltoknt.app.ui.components

import android.view.ViewGroup
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.israeltoknt.app.data.Api

/** One sound switch for every video in the app (starts muted, like Instagram). */
object VideoPrefs {
    var muted by mutableStateOf(true)
}

/**
 * A video that loads its first frame as soon as it is on screen and plays
 * while [active]. Feed videos loop muted with a sound button; Watch videos
 * fill the screen and pause on tap.
 */
@OptIn(UnstableApi::class)
@Composable
fun VideoView(
    url: String,
    active: Boolean,
    modifier: Modifier = Modifier,
    fill: Boolean = false,
    onDoubleTap: (() -> Unit)? = null,
) {
    if (LocalInspectionMode.current) {
        Box(modifier.fillMaxWidth().heightIn(min = 220.dp).background(Color(0xFF111111)))
        return
    }
    val ctx = LocalContext.current
    var ready by remember { mutableStateOf(false) }
    var userPaused by remember(url) { mutableStateOf(false) }
    val player = remember(url) {
        ExoPlayer.Builder(ctx)
            .setMediaSourceFactory(DefaultMediaSourceFactory(OkHttpDataSource.Factory(Api.http)))
            .build().apply {
                setMediaItem(MediaItem.fromUri(url))
                repeatMode = Player.REPEAT_MODE_ONE
                volume = if (VideoPrefs.muted) 0f else 1f
                addListener(object : Player.Listener {
                    override fun onRenderedFirstFrame() {
                        ready = true
                    }
                })
                prepare()
            }
    }
    DisposableEffect(player) { onDispose { player.release() } }
    LaunchedEffect(active, userPaused) { player.playWhenReady = active && !userPaused }
    LaunchedEffect(VideoPrefs.muted) { player.volume = if (VideoPrefs.muted) 0f else 1f }

    Box(
        modifier
            .then(if (fill) Modifier.fillMaxSize() else Modifier.fillMaxWidth().heightIn(min = 220.dp, max = 560.dp))
            .background(Color.Black)
            .pointerInput(url, fill) {
                detectTapGestures(
                    onDoubleTap = { onDoubleTap?.invoke() },
                    onTap = { if (fill) userPaused = !userPaused else VideoPrefs.muted = !VideoPrefs.muted },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        AndroidView(
            factory = {
                PlayerView(it).apply {
                    useController = false
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                    setShutterBackgroundColor(android.graphics.Color.BLACK)
                    layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                    this.player = player
                }
            },
            update = { it.player = player },
            modifier = if (fill) Modifier.fillMaxSize() else Modifier.fillMaxWidth().heightIn(min = 220.dp, max = 560.dp),
        )
        if (!ready) CircularProgressIndicator(color = Color.White.copy(alpha = 0.8f), strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
        if (ready && fill && userPaused) {
            Icon(Icons.Filled.PlayArrow, "Play", tint = Color.White.copy(alpha = 0.9f), modifier = Modifier.size(72.dp))
        }
        if (!fill) {
            IconButton(
                onClick = { VideoPrefs.muted = !VideoPrefs.muted },
                modifier = Modifier.align(Alignment.BottomEnd).padding(8.dp).size(34.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.6f)),
            ) {
                Icon(if (VideoPrefs.muted) Icons.AutoMirrored.Filled.VolumeOff else Icons.AutoMirrored.Filled.VolumeUp, if (VideoPrefs.muted) "Turn sound on" else "Mute", tint = Color.White, modifier = Modifier.size(18.dp))
            }
        }
    }
}
