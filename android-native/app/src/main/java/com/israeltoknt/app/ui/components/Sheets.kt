package com.israeltoknt.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.israeltoknt.app.data.Api
import com.israeltoknt.app.data.Comment
import com.israeltoknt.app.data.map
import com.israeltoknt.app.data.timeAgo
import com.israeltoknt.app.ui.LocalApp
import com.israeltoknt.app.ui.theme.Y
import kotlinx.coroutines.launch

private val REPORT_REASONS = listOf(
    "harassment" to "Harassment or bullying",
    "hate" to "Hate or slurs",
    "privacy" to "Sharing private information",
    "spam" to "Spam or scam",
    "explicit" to "Sexual or explicit content",
    "impersonation" to "Pretending to be someone",
    "self_harm" to "Someone may be at risk",
    "other" to "Something else",
)

val fieldColors @Composable get() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Y.ink.copy(alpha = 0.4f), unfocusedBorderColor = Y.line, cursorColor = Y.ink,
    focusedContainerColor = Y.card2, unfocusedContainerColor = Y.card2,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportSheet(type: String, id: String, onClose: () -> Unit) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var cat by remember { mutableStateOf("harassment") }
    var detail by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    ModalBottomSheet(onDismissRequest = onClose, containerColor = Y.bg2) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp).imePadding()) {
            Text("Report", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text("The person you report is never told who reported them.", color = Y.muted, fontSize = 13.sp, modifier = Modifier.padding(top = 2.dp, bottom = 8.dp))
            REPORT_REASONS.forEach { (k, label) ->
                Row(Modifier.fillMaxWidth().clickable { cat = k }.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(cat == k, { cat = k }, colors = RadioButtonDefaults.colors(selectedColor = Y.ink))
                    Text(label, fontSize = 14.5.sp)
                }
            }
            OutlinedTextField(detail, { detail = it.take(500) }, placeholder = { Text("Add details (optional)") }, colors = fieldColors,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp), minLines = 2)
            Button(
                onClick = {
                    busy = true
                    scope.launch {
                        runCatching {
                            Api.rpc("create_report", "p_target_type" to type, "p_target_id" to id,
                                "p_reason" to detail.ifBlank { REPORT_REASONS.first { it.first == cat }.second }, "p_category" to cat)
                        }.onSuccess { app.toast("Thanks. Night Watch is checking it now."); onClose() }.onFailure { app.error(it) }
                        busy = false
                    }
                },
                enabled = !busy,
                colors = ButtonDefaults.buttonColors(containerColor = Y.brand),
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            ) { Text("Send report") }
        }
    }
}

/** Comments for a post, with replies indented one level, and a reply box. */
@Composable
fun CommentThread(postId: String, modifier: Modifier = Modifier, onCount: (Int) -> Unit = {}) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var comments by remember(postId) { mutableStateOf<List<Comment>?>(null) }
    var text by remember { mutableStateOf("") }
    var replyTo by remember { mutableStateOf<Comment?>(null) }
    var version by remember { mutableStateOf(0) }
    LaunchedEffect(postId, version) {
        runCatching { Api.rpcArr("get_comments", "p_post_id" to postId).map { Comment.parse(it) } }
            .onSuccess { comments = it; onCount(it.count { c -> !c.deleted }) }
            .onFailure { app.error(it) }
    }
    Column(modifier) {
        val list = comments
        if (list == null) Loading()
        else if (list.isEmpty()) Text("No comments yet. Say something.", color = Y.muted, fontSize = 14.sp, modifier = Modifier.padding(16.dp))
        else {
            val roots = list.filter { it.parentId == null }
            roots.forEach { c ->
                CommentRow(c, 0) { replyTo = it }
                list.filter { it.parentId == c.id }.forEach { r -> CommentRow(r, 1) { replyTo = c } }
            }
        }
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                text, { text = it.take(1000) },
                placeholder = { Text(replyTo?.let { "Reply to ${it.author.displayName}" } ?: "Add a comment...") },
                colors = fieldColors, shape = RoundedCornerShape(22.dp), maxLines = 4, modifier = Modifier.weight(1f),
            )
            IconButton(
                onClick = {
                    val body = text.trim()
                    if (body.isEmpty()) return@IconButton
                    scope.launch {
                        runCatching { Api.rpc("add_comment", "p_post_id" to postId, "p_body" to body, "p_parent_id" to replyTo?.id) }
                            .onSuccess { text = ""; replyTo = null; version++ }
                            .onFailure { app.error(it) }
                    }
                },
            ) { Icon(Icons.AutoMirrored.Filled.Send, "Send comment", tint = Y.brand) }
        }
    }
}

@Composable
private fun CommentRow(c: Comment, depth: Int, onReply: (Comment) -> Unit) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var liked by remember(c.id) { mutableStateOf(c.liked) }
    var likes by remember(c.id) { mutableStateOf(c.likes) }
    Row(Modifier.fillMaxWidth().padding(start = (16 + depth * 40).dp, end = 8.dp, top = 8.dp, bottom = 4.dp), verticalAlignment = Alignment.Top) {
        Avatar(c.author.avatarUrl, c.author.displayName, if (depth == 0) 32.dp else 26.dp, modifier = Modifier.clickable { app.profile(c.author.username) })
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(c.author.displayName, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp)
                if (c.author.verified) Verified(13.dp)
                Text(timeAgo(c.createdAt), color = Y.muted, fontSize = 12.sp)
            }
            if (c.deleted) Text("Comment removed", color = Y.muted, fontSize = 14.sp)
            else RichText(c.body, style = androidx.compose.ui.text.TextStyle(fontSize = 14.sp, lineHeight = 20.sp, color = Y.ink))
            Text("Reply", color = Y.muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 2.dp).clickable { onReply(c) })
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clip(RoundedCornerShape(50)).clickable {
            liked = !liked
            likes += if (liked) 1 else -1
            scope.launch { runCatching { Api.rpc("toggle_comment_like", "p_comment_id" to c.id) }.onFailure { app.error(it) } }
        }.padding(6.dp)) {
            Icon(if (liked) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder, if (liked) "Unlike comment" else "Like comment", tint = if (liked) Y.brand else Y.muted, modifier = Modifier.size(16.dp))
            if (likes > 0) Text("$likes", color = Y.muted, fontSize = 11.sp)
        }
    }
}

@Composable
fun PillButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, primary: Boolean = true, enabled: Boolean = true) {
    Text(
        text,
        color = if (primary) Y.bg else Y.ink,
        fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp,
        modifier = modifier.clip(RoundedCornerShape(50)).background(if (primary) Y.ink else Y.card2)
            .clickable(enabled = enabled, onClick = onClick).padding(horizontal = 16.dp, vertical = 9.dp),
    )
}
