package com.israeltoknt.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.outlined.NightsStay
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.israeltoknt.app.data.Api
import com.israeltoknt.app.ui.theme.Y
import kotlin.math.abs

private val avatarGradients = listOf(
    listOf(Y.brand, Color(0xFF7A0718)),
    listOf(Color(0xFF7A0718), Color(0xFF1A1A1A)),
    listOf(Y.brand2, Y.brand),
    listOf(Color(0xFF2E2E2E), Color(0xFF7A0718)),
)

/** Round avatar with initials fallback, an optional online dot and Pro ring hint. */
@Composable
fun Avatar(url: String?, name: String, size: Dp, modifier: Modifier = Modifier, online: Boolean = false, ring: Boolean = false) {
    Box(modifier.size(size)) {
        val inner = if (ring) Modifier.border(2.dp, Brush.sweepGradient(listOf(Y.brand, Y.ember, Y.violet, Y.brand)), CircleShape).padding(3.dp) else Modifier
        Box(inner.size(size).clip(CircleShape)) {
            val src = Api.media(url)
            if (src != null) {
                AsyncImage(model = src, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.matchParentSize().background(Y.card2))
            } else {
                val g = avatarGradients[abs(name.hashCode()) % avatarGradients.size]
                Box(Modifier.matchParentSize().background(Brush.linearGradient(g)), contentAlignment = Alignment.Center) {
                    Text(
                        name.split(" ").mapNotNull { it.firstOrNull()?.uppercase() }.take(2).joinToString(""),
                        color = Color.White, fontWeight = FontWeight.Bold, fontSize = (size.value * 0.36f).sp,
                    )
                }
            }
        }
        if (online) {
            Box(
                Modifier.align(Alignment.BottomEnd).size((size.value * 0.27f).coerceAtLeast(9f).dp)
                    .border(2.dp, Y.bg, CircleShape).padding(2.dp).clip(CircleShape).background(Y.online),
            )
        }
    }
}

@Composable
fun Verified(size: Dp = 15.dp) = Icon(Icons.Filled.Verified, contentDescription = "Verified", tint = Y.brand2, modifier = Modifier.size(size))

@Composable
fun LevelChip(level: Int) {
    if (level <= 0) return
    Text(
        "Lv$level",
        fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = Y.brand2,
        modifier = Modifier.border(1.dp, Y.brand.copy(alpha = 0.5f), RoundedCornerShape(6.dp)).padding(horizontal = 4.dp, vertical = 0.dp),
    )
}

@Composable
fun Loading(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Y.ink, strokeWidth = 2.dp, modifier = Modifier.size(26.dp))
    }
}

@Composable
fun EmptyState(text: String, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Column(modifier.fillMaxWidth().padding(horizontal = 32.dp, vertical = 48.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(Icons.Outlined.NightsStay, null, tint = Y.brand, modifier = Modifier.size(30.dp))
        Text(text, color = Y.muted, textAlign = TextAlign.Center, style = TextStyle(fontSize = 14.sp, lineHeight = 20.sp))
        action?.invoke()
    }
}

/** Post text with #tags and @mentions highlighted. */
@Composable
fun RichText(text: String, modifier: Modifier = Modifier, style: TextStyle = TextStyle(fontSize = 15.sp, lineHeight = 22.sp, color = Y.ink), maxLines: Int = Int.MAX_VALUE) {
    val annotated = buildAnnotatedString {
        val re = Regex("""([#@][A-Za-z0-9_]{1,30})""")
        var last = 0
        for (m in re.findAll(text)) {
            append(text.substring(last, m.range.first))
            withStyle(SpanStyle(color = Y.brand2, fontWeight = FontWeight.Medium)) { append(m.value) }
            last = m.range.last + 1
        }
        append(text.substring(last))
    }
    Text(annotated, modifier = modifier, style = style, maxLines = maxLines, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
}

@Composable
fun Chip(text: String, color: Color, bg: Color) {
    Text(
        text.uppercase(), color = color, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.4.sp,
        modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(bg).padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    Text(text.uppercase(), color = Y.muted, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp, modifier = modifier)
}

@Composable
fun Row2(modifier: Modifier = Modifier, content: @Composable () -> Unit) =
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { content() }
