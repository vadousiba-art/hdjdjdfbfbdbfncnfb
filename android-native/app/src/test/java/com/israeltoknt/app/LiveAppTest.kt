package com.israeltoknt.app

import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.github.takahirom.roborazzi.captureRoboImage
import com.israeltoknt.app.data.Api
import com.israeltoknt.app.data.Channel
import com.israeltoknt.app.data.Notice
import com.israeltoknt.app.data.Post
import com.israeltoknt.app.data.ProfileFull
import com.israeltoknt.app.data.Standing
import com.israeltoknt.app.data.StoryGroup
import com.israeltoknt.app.data.map
import com.israeltoknt.app.ui.theme.YoruTheme
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

// Runs the real app against a local YORU demo server:
//   gradle :app:testDebugUnitTest -PdemoUrl=http://localhost:3200
// Checks every API the app uses, then walks through the main screens and
// saves screenshots to app/build/screens/.
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xxhdpi")
class LiveAppTest {
    @get:Rule val compose = createComposeRule()
    private val demo = System.getProperty("yoru.demoUrl").orEmpty()

    @Before fun signIn() {
        assumeTrue("set -PdemoUrl to run against a demo server", demo.isNotEmpty())
        Api.init(ApplicationProvider.getApplicationContext(), demo)
        runBlocking {
            val ari = Api.demoUsers()!!.first { it.username == "AriMenace" }
            Api.demoLogin(ari.id)
        }
    }

    @Test fun apiMatchesTheServer() = runBlocking {
        val me = Api.me()
        assertEquals("AriMenace", me.profile.username)
        val latest = Api.rpcArr("get_feed", "p_mode" to "latest", "p_limit" to 10).map { Post.parse(it) }
        assertTrue(latest.isNotEmpty())
        assertTrue(latest.all { it.id.isNotEmpty() && it.author.username.isNotEmpty() })
        Api.rpcArr("get_feed", "p_mode" to "trending", "p_limit" to 10, "p_offset" to 0).map { Post.parse(it) }
        Api.rpcArr("get_watch", "p_mode" to "for_you", "p_offset" to 0, "p_limit" to 6).map { Post.parse(it) }.forEach { assertTrue(it.isVideo) }
        val stories = Api.rpcArr("get_stories").map { StoryGroup.parse(it) }
        assertTrue(stories.all { it.items.isNotEmpty() })
        val chans = Api.rpcArr("get_channels").map { Channel.parse(it) }
        assertTrue(chans.isNotEmpty())
        Api.rpcArr("get_notifications", "p_limit" to 20).map { Notice.parse(it) }
        val prof = ProfileFull.parse(Api.rpcObj("get_profile", "p_username" to "AriMenace"))
        assertTrue(prof.isMe)
        Standing.parse(Api.rpcObj("get_my_standing"))

        // Post, like, comment, delete: the same rules as the website.
        val id = Api.rpc("create_post", "p_body" to "posted from the Android app test ${System.currentTimeMillis()}") as String
        Api.rpc("toggle_reaction", "p_post_id" to id, "p_kind" to "heart")
        Api.rpc("add_comment", "p_post_id" to id, "p_body" to "native comment")
        assertTrue(Post.parse(Api.rpcObj("get_post", "p_id" to id)).liked)
        Api.rpc("delete_post", "p_id" to id)

        // Night Watch refuses the same things it refuses on the web (staff are
        // exempt, so check as a regular member).
        Api.demoLogin(Api.demoUsers()!!.first { it.displayName.startsWith("Zach") }.id)
        val refused = runCatching { Api.rpc("create_post", "p_body" to "you absolute f4gg0t") }.exceptionOrNull()
        assertTrue("refusal: ${refused?.message}", refused?.message?.contains("hate speech") == true)
    }

    private fun shot(name: String) = compose.onRoot().captureRoboImage("build/screens/$name.png")

    private fun waitFor(text: String, ms: Long = 20_000) = compose.waitUntil(ms) {
        compose.onAllNodes(hasText(text, substring = true)).fetchSemanticsNodes().isNotEmpty()
    }

    private fun tap(desc: String) = compose.onNode(hasContentDescription(desc, substring = true)).performClick()

    @Test fun screens() {
        compose.setContent { YoruTheme { Root(null) {} } }
        waitFor("For You")
        waitFor("@")
        compose.waitForIdle()
        shot("01-home")
        tap("Watch")
        compose.waitUntil(20_000) {
            compose.onAllNodes(hasText("No videos yet") or hasContentDescription("Like")).fetchSemanticsNodes().isNotEmpty()
        }
        shot("02-watch")
        tap("Inbox")
        waitFor("Inbox")
        waitFor("The Boys")
        shot("03-inbox")
        compose.onNode(hasText("The Boys")).performClick()
        waitFor("Message")
        shot("04-chat")
        compose.onNode(hasContentDescription("Back")).performClick()
        tap("Profile")
        waitFor("Your profile")
        waitFor("POSTS")
        shot("05-profile")
        tap("Home")
        waitFor("For You")
        tap("Activity")
        waitFor("Activity")
        shot("06-activity")
        compose.onNode(hasContentDescription("Back")).performClick()
        tap("Menu")
        waitFor("Account standing")
        shot("07-menu")
        compose.onNode(hasText("Account standing")).performClick()
        waitFor("How strikes work")
        shot("08-standing")
        compose.onNode(hasContentDescription("Back")).performClick()
        compose.onNode(hasContentDescription("Back")).performClick()
        tap("Create")
        waitFor("New post")
        shot("09-compose")
    }
}
