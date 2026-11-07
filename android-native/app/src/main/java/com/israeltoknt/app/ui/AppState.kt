package com.israeltoknt.app.ui

import android.net.Uri
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.navigation.NavHostController
import com.israeltoknt.app.data.ApiError
import com.israeltoknt.app.data.Me
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** App-wide state: the signed-in member, navigation and messages. */
class AppState(val nav: NavHostController, val snack: SnackbarHostState, private val scope: CoroutineScope) {
    var me by mutableStateOf<Me?>(null)
    /** Bumped after posting so feeds reload. */
    var feedVersion by mutableIntStateOf(0)

    fun toast(text: String) {
        scope.launch {
            snack.currentSnackbarData?.dismiss()
            snack.showSnackbar(text)
        }
    }

    fun error(e: Throwable) {
        // Leaving a screen cancels its work; that isn't something to report.
        if (e is kotlinx.coroutines.CancellationException) return
        toast((e as? ApiError)?.message ?: e.message ?: "Something went wrong.")
    }

    fun go(route: String) = nav.navigate(route) { launchSingleTop = true }
    fun back() {
        if (!nav.popBackStack()) nav.navigate(Routes.HOME)
    }

    fun post(id: String) = go("post/$id")
    fun profile(username: String) = go("u/$username")
    fun chat(id: String) = go("chat/$id")
    fun web(path: String, title: String = "") = go("web?path=${Uri.encode(path)}&title=${Uri.encode(title)}")
    fun tag(tag: String) = web("/explore?tag=${tag.removePrefix("#")}", "#${tag.removePrefix("#")}")
}

object Routes {
    const val HOME = "home"
    const val WATCH = "watch"
    const val INBOX = "inbox"
    const val NOTIFS = "notifications"
    const val COMPOSE = "compose"
    const val STANDING = "standing"
    const val MORE = "more"
    const val STORY_NEW = "story/new"
}

val LocalApp = compositionLocalOf<AppState> { error("AppState not provided") }
