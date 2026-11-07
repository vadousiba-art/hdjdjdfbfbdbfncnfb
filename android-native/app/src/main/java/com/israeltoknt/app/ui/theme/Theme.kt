package com.israeltoknt.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// YORU's night palette, the same tokens as the website's dark theme.
object Y {
    val bg = Color(0xFF080808)
    val bg2 = Color(0xFF0C0C0C)
    val card = Color(0xFF121212)
    val card2 = Color(0xFF1A1A1A)
    val line = Color(0xFF292929)
    val ink = Color(0xFFF5F5F5)
    val ink2 = Color(0xFFD6D6D6)
    val muted = Color(0xFF999999)
    val brand = Color(0xFFF20D2F)
    val brand2 = Color(0xFFFF3355)
    val online = Color(0xFF22C55E)
    val amber = Color(0xFFF59E0B)
    val official = Color(0xFF5865F2)
    val ember = Color(0xFFF97316)
    val violet = Color(0xFF8B5CF6)
    val pink = Color(0xFFE11D74)
}

private val scheme = darkColorScheme(
    primary = Y.brand,
    onPrimary = Color.White,
    secondary = Y.ink,
    onSecondary = Y.bg,
    background = Y.bg,
    onBackground = Y.ink,
    surface = Y.bg,
    onSurface = Y.ink,
    surfaceVariant = Y.card2,
    onSurfaceVariant = Y.ink2,
    surfaceContainer = Y.card,
    surfaceContainerHigh = Y.card2,
    surfaceContainerHighest = Y.card2,
    surfaceContainerLow = Y.bg2,
    outline = Y.line,
    outlineVariant = Y.line,
    error = Y.brand2,
)

private val type = Typography(
    titleLarge = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.2).sp),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 15.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontSize = 12.5.sp, lineHeight = 17.sp),
    labelLarge = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold),
)

@Composable
fun YoruTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = scheme, typography = type, content = content)
}
