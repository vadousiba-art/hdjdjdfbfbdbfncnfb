package com.israeltoknt.app.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import com.israeltoknt.app.data.Api
import com.israeltoknt.app.data.Post
import com.israeltoknt.app.data.map
import com.israeltoknt.app.ui.LocalApp
import kotlinx.coroutines.launch

const val PAGE = 10

/** Where a feed's posts come from; [next] gets the posts loaded so far. */
fun interface FeedSource {
    suspend fun next(loaded: List<Post>): List<Post>
}

object Feeds {
    private fun posts(a: org.json.JSONArray) = a.map { Post.parse(it) }

    fun forYou(myUsername: String?) = FeedSource { loaded ->
        val top = posts(Api.rpcArr("get_feed", "p_mode" to "trending", "p_limit" to PAGE, "p_offset" to loaded.size))
        if (loaded.isEmpty() && myUsername != null) {
            // Your posts from the last half hour come first, like on the website.
            val mine = posts(Api.rpcArr("get_feed", "p_mode" to "user", "p_arg" to myUsername, "p_limit" to 3))
                .filter { System.currentTimeMillis() - com.israeltoknt.app.data.parseTime(it.createdAt) < 30 * 60_000 }
            mine + top
        } else top
    }

    private fun before(loaded: List<Post>) = loaded.lastOrNull()?.createdAt
    fun latest() = FeedSource { posts(Api.rpcArr("get_feed", "p_mode" to "latest", "p_limit" to PAGE, "p_before" to before(it))) }
    fun interests() = FeedSource { posts(Api.rpcArr("get_interest_feed", "p_limit" to PAGE, "p_before" to before(it))) }
    fun user(username: String) = FeedSource { posts(Api.rpcArr("get_feed", "p_mode" to "user", "p_arg" to username, "p_limit" to PAGE, "p_before" to before(it))) }
    fun bookmarks() = FeedSource { posts(Api.rpcArr("get_feed", "p_mode" to "bookmarks", "p_limit" to PAGE, "p_before" to before(it))) }
}

/**
 * An infinite list of posts with pull to refresh. The video that is most in
 * view plays (muted); the rest show their first frame.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PostFeed(
    source: FeedSource,
    key: Any,
    modifier: Modifier = Modifier,
    emptyText: String = "Nothing here yet.",
    contentPadding: PaddingValues = PaddingValues(),
    header: LazyListScope.() -> Unit = {},
) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var posts by remember(key) { mutableStateOf<List<Post>?>(null) }
    var done by remember(key) { mutableStateOf(false) }
    var loading by remember(key) { mutableStateOf(false) }
    var refreshing by remember { mutableStateOf(false) }
    var hidden by remember { mutableStateOf(setOf<String>()) }
    val list = rememberLazyListState()

    suspend fun load(reset: Boolean) {
        if (loading) return
        loading = true
        val sofar = if (reset) emptyList() else posts.orEmpty()
        runCatching { source.next(sofar) }
            .onSuccess { page ->
                val seen = sofar.map { it.id }.toMutableSet()
                posts = sofar + page.filter { seen.add(it.id) }
                done = page.size < PAGE
            }
            .onFailure { if (posts == null) posts = emptyList(); app.error(it) }
        loading = false
    }

    LaunchedEffect(key, app.feedVersion) { load(reset = true) }
    LaunchedEffect(list, key) {
        snapshotFlow { list.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0 }.collect { last ->
            if (!done && posts != null && last >= list.layoutInfo.totalItemsCount - 4) load(reset = false)
        }
    }
    val shown = posts.orEmpty().filter { it.id !in hidden }
    val activeVideo by remember(shown) {
        derivedStateOf {
            val info = list.layoutInfo
            info.visibleItemsInfo.firstOrNull { item ->
                val post = shown.firstOrNull { "p:${it.id}" == item.key } ?: return@firstOrNull false
                if (!post.shown.isVideo) return@firstOrNull false
                val top = maxOf(item.offset, info.viewportStartOffset)
                val bottom = minOf(item.offset + item.size, info.viewportEndOffset)
                (bottom - top).toFloat() / item.size.coerceAtLeast(1) >= 0.55f
            }?.key
        }
    }

    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = { scope.launch { refreshing = true; load(reset = true); refreshing = false } },
        modifier = modifier.fillMaxSize(),
    ) {
        LazyColumn(state = list, contentPadding = contentPadding, modifier = Modifier.fillMaxSize()) {
            header()
            if (posts == null) item { Loading() }
            else if (shown.isEmpty()) item { EmptyState(emptyText) }
            items(shown, key = { "p:${it.id}" }) { p ->
                PostCard(p, videoActive = activeVideo == "p:${p.id}", onRemoved = { id -> hidden = hidden + id })
            }
            if (loading && posts != null && !refreshing) item { Loading() }
        }
    }
}

@Composable
fun FeedBox(content: @Composable () -> Unit) = Box(Modifier.fillMaxSize()) { content() }
