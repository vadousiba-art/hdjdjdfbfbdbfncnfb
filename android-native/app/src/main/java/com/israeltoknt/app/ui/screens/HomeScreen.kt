package com.israeltoknt.app.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.israeltoknt.app.R
import com.israeltoknt.app.data.Api
import com.israeltoknt.app.data.StoryGroup
import com.israeltoknt.app.data.map
import com.israeltoknt.app.ui.LocalApp
import com.israeltoknt.app.ui.Routes
import com.israeltoknt.app.ui.components.Avatar
import com.israeltoknt.app.ui.components.Feeds
import com.israeltoknt.app.ui.components.PostFeed
import com.israeltoknt.app.ui.theme.Y

object StoryStore {
    var groups by mutableStateOf<List<StoryGroup>>(emptyList())
}

@Composable
fun TopBar(content: @Composable () -> Unit = {}) {
    val app = LocalApp.current
    val unread = app.me?.unreadNotifications ?: 0
    Column(Modifier.background(Y.bg)) {
        Row(Modifier.fillMaxWidth().height(54.dp).padding(start = 14.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Image(painterResource(R.drawable.wordmark), "YORU home", modifier = Modifier.width(98.dp))
            content()
            Spacer(Modifier.weight(1f))
            IconButton(onClick = { app.web("/explore", "Explore") }) { Icon(Icons.Outlined.Search, "Search", tint = Y.ink) }
            IconButton(onClick = { app.go(Routes.NOTIFS) }) {
                BadgedBox(badge = { if (unread > 0) Badge(containerColor = Y.brand) { Text(if (unread > 99) "99+" else "$unread") } }) {
                    Icon(Icons.Outlined.FavoriteBorder, if (unread > 0) "Activity, $unread unread" else "Activity", tint = Y.ink)
                }
            }
            IconButton(onClick = { app.go(Routes.MORE) }) { Icon(Icons.Outlined.Menu, "Menu", tint = Y.ink) }
        }
        HorizontalDivider(color = Y.line.copy(alpha = 0.6f))
    }
}

/** Home: stories, then For You / Latest / Interests. */
@Composable
fun HomeScreen() {
    val app = LocalApp.current
    var tab by rememberSaveable { mutableStateOf(0) }
    LaunchedEffect(app.feedVersion) {
        runCatching { Api.rpcArr("get_stories").map { StoryGroup.parse(it) } }.onSuccess { StoryStore.groups = it }
    }
    Column {
        TopBar()
        val source = remember(tab, app.me?.profile?.username) {
            when (tab) {
                1 -> Feeds.latest()
                2 -> Feeds.interests()
                else -> Feeds.forYou(app.me?.profile?.username)
            }
        }
        PostFeed(
            source, key = "home$tab",
            emptyText = when (tab) {
                2 -> "Pick a few interests in Settings and this tab fills with posts from people who share them."
                0 -> "Nothing trending yet. Check Latest for everything new."
                else -> "No posts yet. Be the first."
            },
        ) {
            item(key = "stories") { StoriesRow() }
            item(key = "tabs") { FeedTabs(tab) { tab = it } }
        }
    }
}

@Composable
fun FeedTabs(tab: Int, onTab: (Int) -> Unit) {
    Column {
        Row(Modifier.fillMaxWidth()) {
            listOf("For You", "Latest", "Interests").forEachIndexed { i, label ->
                Column(Modifier.weight(1f).clickable { onTab(i) }.padding(top = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(label, color = if (tab == i) Y.ink else Y.muted, fontWeight = if (tab == i) FontWeight.SemiBold else FontWeight.Normal, fontSize = 14.5.sp)
                    Spacer(Modifier.height(10.dp))
                    Box(Modifier.width(42.dp).height(3.dp).clip(CircleShape).background(if (tab == i) Y.ink else androidx.compose.ui.graphics.Color.Transparent))
                }
            }
        }
        HorizontalDivider(color = Y.line.copy(alpha = 0.7f))
    }
}

private val storyRing = Brush.sweepGradient(listOf(Y.brand, Y.ember, Y.pink, Y.violet, Y.brand))

@Composable
fun StoriesRow() {
    val app = LocalApp.current
    val me = app.me?.profile
    Column {
        LazyRow(contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 8.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            item {
                Column(Modifier.width(76.dp).clickable { app.go(Routes.STORY_NEW) }, horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(66.dp).padding(3.dp)) {
                        Avatar(me?.avatarUrl, me?.displayName ?: "You", 60.dp)
                        Box(
                            Modifier.align(Alignment.BottomEnd).offset(x = 2.dp, y = 2.dp).size(22.dp).clip(CircleShape).background(Y.bg).padding(2.dp)
                                .clip(CircleShape).background(Y.ink),
                            contentAlignment = Alignment.Center,
                        ) { Icon(Icons.Filled.Add, "Add to your story", tint = Y.bg, modifier = Modifier.size(14.dp)) }
                    }
                    Text("Your story", fontSize = 12.sp, color = Y.ink2, modifier = Modifier.padding(top = 4.dp))
                }
            }
            items(StoryStore.groups, key = { it.key }) { g ->
                val i = StoryStore.groups.indexOf(g)
                Column(Modifier.width(76.dp).clickable { app.go("story/view/$i") }, horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        Modifier.size(66.dp).clip(CircleShape)
                            .then(if (g.allViewed) Modifier.border(1.5.dp, Y.line, CircleShape) else Modifier.background(storyRing))
                            .padding(2.5.dp).clip(CircleShape).background(Y.bg).padding(2.5.dp),
                    ) {
                        val thumb = g.author?.avatarUrl ?: g.items.lastOrNull()?.mediaUrl
                        Avatar(thumb, g.label, 56.dp)
                    }
                    Text(g.author?.username ?: g.label, fontSize = 12.sp, color = if (g.allViewed) Y.muted else Y.ink2, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
        HorizontalDivider(color = Y.line.copy(alpha = 0.7f))
    }
}
