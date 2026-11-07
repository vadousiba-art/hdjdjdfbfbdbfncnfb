package com.israeltoknt.app

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Movie
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.israeltoknt.app.data.Api
import com.israeltoknt.app.ui.AppState
import com.israeltoknt.app.ui.LocalApp
import com.israeltoknt.app.ui.Routes
import com.israeltoknt.app.ui.components.Avatar
import com.israeltoknt.app.ui.components.Loading
import com.israeltoknt.app.ui.screens.BookmarksScreen
import com.israeltoknt.app.ui.screens.ChatScreen
import com.israeltoknt.app.ui.screens.ComposeScreen
import com.israeltoknt.app.ui.screens.HomeScreen
import com.israeltoknt.app.ui.screens.InboxScreen
import com.israeltoknt.app.ui.screens.JoinScreen
import com.israeltoknt.app.ui.screens.LoginScreen
import com.israeltoknt.app.ui.screens.MoreScreen
import com.israeltoknt.app.ui.screens.NotificationsScreen
import com.israeltoknt.app.ui.screens.PostScreen
import com.israeltoknt.app.ui.screens.ProfileScreen
import com.israeltoknt.app.ui.screens.StandingScreen
import com.israeltoknt.app.ui.screens.StoryComposeScreen
import com.israeltoknt.app.ui.screens.StoryViewer
import com.israeltoknt.app.ui.screens.WatchScreen
import com.israeltoknt.app.ui.screens.WebScreen
import com.israeltoknt.app.ui.theme.Y
import com.israeltoknt.app.ui.theme.YoruTheme
import com.israeltoknt.app.work.NotifyWorker
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private var pendingLink by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        pendingLink = intent?.data?.path ?: intent?.getStringExtra("route")
        setContent { YoruTheme { Root(pendingLink) { pendingLink = null } } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        pendingLink = intent.data?.path ?: intent.getStringExtra("route")
    }
}

private sealed interface Gate {
    data object Checking : Gate
    data object SignedOut : Gate
    data object Joining : Gate
    data object SignedIn : Gate
}

@Composable
fun Root(link: String?, onLinkHandled: () -> Unit) {
    val nav = rememberNavController()
    val snack = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val app = remember { AppState(nav, snack, scope) }
    var gate by remember { mutableStateOf<Gate>(Gate.Checking) }
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val askNotify = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }

    LaunchedEffect(gate) {
        if (gate != Gate.Checking) return@LaunchedEffect
        gate = if (!Api.hasSession()) Gate.SignedOut else runCatching { Api.me() }.fold({ app.me = it; Gate.SignedIn }, { Gate.SignedOut })
    }
    LaunchedEffect(gate) {
        if (gate != Gate.SignedIn) return@LaunchedEffect
        runCatching { NotifyWorker.schedule(ctx) }
        if (Build.VERSION.SDK_INT >= 33) askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
        while (true) {
            delay(30_000)
            runCatching { Api.me() }.onSuccess { app.me = it }
        }
    }

    CompositionLocalProvider(LocalApp provides app) {
        Surface(color = Y.bg, modifier = Modifier.fillMaxSize()) {
            when (gate) {
                Gate.Checking -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Loading() }
                Gate.SignedOut -> LoginScreen(onSignedIn = { gate = Gate.Checking }, onJoin = { gate = Gate.Joining })
                Gate.Joining -> CompositionLocalProvider(LocalApp provides app) {
                    Box(Modifier.statusBarsPadding()) {
                        JoinScreen(onDone = { gate = if (Api.hasSession()) Gate.Checking else Gate.SignedOut })
                    }
                }
                Gate.SignedIn -> Shell(app, link, onLinkHandled) {
                    scope.launch {
                        Api.logout()
                        app.me = null
                        gate = Gate.SignedOut
                    }
                }
            }
        }
    }
}

private val TAB_ROUTES = setOf(Routes.HOME, Routes.WATCH, Routes.INBOX, "me")

@Composable
private fun Shell(app: AppState, link: String?, onLinkHandled: () -> Unit, onLogout: () -> Unit) {
    val nav = app.nav
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route ?: Routes.HOME
    val dark = route == Routes.WATCH || route.startsWith("story/view")
    val fullscreen = route.startsWith("story") || route == Routes.COMPOSE

    // Links into the app (invite links, notifications) open the right screen.
    LaunchedEffect(link) {
        val path = link ?: return@LaunchedEffect
        when {
            path.startsWith("/post/") -> app.post(path.removePrefix("/post/"))
            path.startsWith("/u/") -> app.profile(path.removePrefix("/u/"))
            path.startsWith("/chat/") -> app.chat(path.removePrefix("/chat/"))
            path == "/chat" -> app.go(Routes.INBOX)
            path == "/notifications" -> app.go(Routes.NOTIFS)
            path == "/watch" -> app.go(Routes.WATCH)
            path == "/standing" -> app.go(Routes.STANDING)
            path.startsWith("/join") -> app.web(path, "Join")
        }
        onLinkHandled()
    }

    Scaffold(
        containerColor = if (dark) Color.Black else Y.bg,
        snackbarHost = { SnackbarHost(app.snack) },
        bottomBar = { if (!fullscreen) BottomBar(app, route, dark) },
    ) { pad ->
        Box(Modifier.fillMaxSize().padding(bottom = pad.calculateBottomPadding()).then(if (dark) Modifier else Modifier.statusBarsPadding())) {
            NavHost(nav, startDestination = Routes.HOME) {
                composable(Routes.HOME) { HomeScreen() }
                composable(Routes.WATCH) { WatchScreen() }
                composable(Routes.INBOX) { InboxScreen() }
                composable("me") { app.me?.let { ProfileScreen(it.profile.username) } }
                composable(Routes.NOTIFS) { NotificationsScreen() }
                composable(Routes.COMPOSE) { Box(Modifier.statusBarsPadding()) { ComposeScreen() } }
                composable(Routes.STANDING) { StandingScreen() }
                composable(Routes.MORE) { MoreScreen(onLogout) }
                composable("bookmarks") { BookmarksScreen() }
                composable(Routes.STORY_NEW) { StoryComposeScreen() }
                composable("story/view/{i}", listOf(navArgument("i") { type = NavType.IntType })) { StoryViewer(it.arguments?.getInt("i") ?: 0) }
                composable("post/{id}") { PostScreen(it.arguments?.getString("id")!!) }
                composable("u/{name}") { ProfileScreen(it.arguments?.getString("name")!!) }
                composable("chat/{id}") { ChatScreen(it.arguments?.getString("id")!!) }
                composable("web?path={path}&title={title}", listOf(navArgument("path") { defaultValue = "/" }, navArgument("title") { defaultValue = "" })) {
                    WebScreen(it.arguments?.getString("path") ?: "/", it.arguments?.getString("title") ?: "")
                }
            }
        }
    }
}

@Composable
private fun BottomBar(app: AppState, route: String, dark: Boolean) {
    val me = app.me
    val fg = if (dark) Color.White else Y.ink
    Column(Modifier.background(if (dark) Color.Black else Y.bg2).navigationBarsPadding()) {
        HorizontalDivider(color = if (dark) Color.White.copy(alpha = 0.1f) else Y.line)
        Row(Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Tab(route == Routes.HOME, "Home", dark, { app.nav.navigate(Routes.HOME) { popUpTo(Routes.HOME) { inclusive = false }; launchSingleTop = true } }) {
                Icon(if (route == Routes.HOME) Icons.Filled.Home else Icons.Outlined.Home, null, tint = fg, modifier = Modifier.size(27.dp))
            }
            Tab(route == Routes.WATCH, "Watch", dark, { tabNav(app, Routes.WATCH) }) {
                Icon(if (route == Routes.WATCH) Icons.Filled.Movie else Icons.Outlined.Movie, null, tint = fg, modifier = Modifier.size(26.dp))
            }
            Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                Box(
                    Modifier.size(width = 48.dp, height = 36.dp).clip(RoundedCornerShape(11.dp)).background(fg)
                        .semantics { contentDescription = "Create" }
                        .clickable { app.go(Routes.COMPOSE) },
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Filled.Add, null, tint = if (dark) Color.Black else Y.bg, modifier = Modifier.size(24.dp)) }
            }
            val unread = me?.unreadMessages ?: 0
            Tab(route == Routes.INBOX || route.startsWith("chat"), if (unread > 0) "Inbox, $unread unread" else "Inbox", dark, { tabNav(app, Routes.INBOX) }) {
                BadgedBox(badge = { if (unread > 0) Badge(containerColor = Y.brand) { Text(if (unread > 99) "99+" else "$unread") } }) {
                    Icon(Icons.Outlined.ChatBubbleOutline, null, tint = fg, modifier = Modifier.size(25.dp))
                }
            }
            Tab(route == "me", "Profile", dark, { tabNav(app, "me") }) {
                Box(Modifier.border(if (route == "me") 1.5.dp else 0.dp, if (route == "me") fg else Color.Transparent, CircleShape).padding(2.dp)) {
                    Avatar(me?.profile?.avatarUrl, me?.profile?.displayName ?: "You", 26.dp)
                }
            }
        }
    }
}

private fun tabNav(app: AppState, route: String) = app.nav.navigate(route) {
    popUpTo(Routes.HOME) { saveState = true }
    launchSingleTop = true
    restoreState = true
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.Tab(active: Boolean, label: String, dark: Boolean, onClick: () -> Unit, icon: @Composable () -> Unit) {
    Box(Modifier.weight(1f).height(48.dp), contentAlignment = Alignment.Center) {
        Box(
            Modifier.width(58.dp).height(40.dp).clip(CircleShape)
                .background(if (active) (if (dark) Color.White.copy(alpha = 0.15f) else Y.card2) else Color.Transparent)
                .semantics { contentDescription = label }
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center,
        ) { icon() }
    }
}

@Suppress("unused")
private val keepTabs = TAB_ROUTES
