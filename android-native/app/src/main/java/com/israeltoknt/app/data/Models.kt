package com.israeltoknt.app.data

import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.TimeZone

// Shapes returned by YORU's RPCs (the same JSON the website reads, see
// src/lib/types.ts). Parsed by hand with org.json: no reflection, so the
// release build can shrink freely.

internal fun JSONObject.s(key: String, def: String = ""): String = if (isNull(key)) def else optString(key, def)
internal fun JSONObject.sn(key: String): String? = if (!has(key) || isNull(key)) null else optString(key).ifEmpty { null }
internal fun JSONObject.i(key: String, def: Int = 0): Int = if (isNull(key)) def else optInt(key, def)
internal fun JSONObject.b(key: String): Boolean = !isNull(key) && optBoolean(key, false)
internal fun JSONObject.o(key: String): JSONObject? = if (!has(key) || isNull(key)) null else optJSONObject(key)
internal fun JSONObject.a(key: String): JSONArray = if (!has(key) || isNull(key)) JSONArray() else optJSONArray(key) ?: JSONArray()
internal inline fun <T> JSONArray.map(fn: (JSONObject) -> T): List<T> = (0 until length()).mapNotNull { optJSONObject(it)?.let(fn) }
internal fun JSONArray.strings(): List<String> = (0 until length()).map { optString(it) }

/** Milliseconds since epoch for Postgres/ISO timestamps (works on Android 7). */
fun parseTime(iso: String?): Long {
    if (iso.isNullOrEmpty()) return 0
    val m = Regex("""(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})?""").find(iso) ?: return 0
    val g = m.groupValues
    val cal = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
    cal.clear()
    cal.set(g[1].toInt(), g[2].toInt() - 1, g[3].toInt(), g[4].toInt(), g[5].toInt(), g[6].toInt())
    var ms = cal.timeInMillis + (g[7].take(3).padEnd(3, '0').toIntOrNull() ?: 0)
    val tz = g[8]
    if (tz.isNotEmpty() && tz != "Z") {
        val sign = if (tz[0] == '-') -1 else 1
        val digits = tz.substring(1).replace(":", "")
        val off = (digits.take(2).toInt() * 60 + digits.drop(2).toInt()) * 60_000L
        ms -= sign * off
    }
    return ms
}

fun timeAgo(iso: String?, now: Long = System.currentTimeMillis()): String {
    val t = parseTime(iso)
    if (t == 0L) return ""
    val s = ((now - t) / 1000).coerceAtLeast(0)
    return when {
        s < 60 -> "now"
        s < 3600 -> "${s / 60}m"
        s < 86_400 -> "${s / 3600}h"
        s < 604_800 -> "${s / 86_400}d"
        s < 31_536_000 -> "${s / 604_800}w"
        else -> "${s / 31_536_000}y"
    }
}

fun compact(n: Int): String = when {
    n < 1000 -> n.toString()
    n < 10_000 -> String.format(java.util.Locale.US, "%.1fK", n / 1000.0).replace(".0K", "K")
    n < 1_000_000 -> "${n / 1000}K"
    else -> String.format(java.util.Locale.US, "%.1fM", n / 1_000_000.0)
}

data class Profile(
    val id: String,
    val username: String,
    val displayName: String,
    val avatarUrl: String?,
    val badge: String,
    val verified: Boolean,
    val isBot: Boolean,
    val role: String,
    val status: String,
    val online: Boolean,
    val level: Int,
    val ring: String?,
) {
    val isStaff get() = role == "owner" || role == "admin" || role == "moderator"

    companion object {
        fun parse(o: JSONObject) = Profile(
            id = o.s("id"),
            username = o.s("username"),
            displayName = o.s("display_name", o.s("username")),
            avatarUrl = o.sn("avatar_url"),
            badge = o.s("badge"),
            verified = o.b("verified"),
            isBot = o.b("is_bot"),
            role = o.s("role", "member"),
            status = o.s("status"),
            online = o.b("online"),
            level = o.i("level"),
            ring = o.o("look")?.sn("ring"),
        )
    }
}

data class Me(val profile: Profile, val bio: String, val unreadNotifications: Int, val unreadMessages: Int) {
    companion object {
        fun parse(o: JSONObject) = Me(Profile.parse(o), o.s("bio"), o.i("unread_notifications"), o.i("unread_messages"))
    }
}

data class PollOption(val id: String, val label: String, val votes: Int)
data class Poll(val options: List<PollOption>, val total: Int, val myVote: String?)

data class Post(
    val id: String,
    val kind: String,
    val body: String,
    val mediaUrl: String?,
    val mediaType: String?,
    val linkUrl: String?,
    val roast: String?,
    val roastLabel: String?,
    val createdAt: String,
    val author: Profile,
    val likes: Int,
    val comments: Int,
    val reposts: Int,
    val liked: Boolean,
    val bookmarked: Boolean,
    val reposted: Boolean,
    val poll: Poll?,
    val repostOf: Post?,
    val modState: String?,
    val modLabel: String?,
) {
    /** Plain reposts show the original post. */
    val shown: Post get() = if (kind == "repost" && repostOf != null && body.isEmpty()) repostOf else this
    val isVideo get() = mediaType == "video"

    companion object {
        fun parse(o: JSONObject): Post {
            val counts = o.o("counts") ?: JSONObject()
            val mine = o.a("my_reactions").strings()
            val poll = o.o("poll")?.let { p ->
                Poll(p.a("options").map { PollOption(it.s("id"), it.s("label"), it.i("votes")) }, p.i("total"), p.sn("my_vote"))
            }
            val mod = o.o("mod")
            return Post(
                id = o.s("id"),
                kind = o.s("kind", "post"),
                body = o.s("body"),
                mediaUrl = o.sn("media_url"),
                mediaType = o.sn("media_type"),
                linkUrl = o.sn("link_url"),
                roast = o.sn("roast"),
                roastLabel = o.sn("roast_label"),
                createdAt = o.s("created_at"),
                author = Profile.parse(o.o("author") ?: JSONObject()),
                likes = counts.i("likes"),
                comments = counts.i("comments"),
                reposts = counts.i("reposts"),
                liked = "heart" in mine,
                bookmarked = o.b("bookmarked"),
                reposted = o.b("reposted"),
                poll = poll,
                repostOf = o.o("repost_of")?.let { parse(it) },
                modState = mod?.sn("state"),
                modLabel = mod?.sn("label"),
            )
        }
    }
}

data class Comment(
    val id: String,
    val parentId: String?,
    val body: String,
    val deleted: Boolean,
    val isAi: Boolean,
    val createdAt: String,
    val author: Profile,
    val likes: Int,
    val liked: Boolean,
) {
    companion object {
        fun parse(o: JSONObject) = Comment(
            o.s("id"), o.sn("parent_id"), o.s("body"), o.b("deleted"), o.b("is_ai"), o.s("created_at"),
            Profile.parse(o.o("author") ?: JSONObject()), o.i("likes"), o.b("liked"),
        )
    }
}

data class Story(
    val id: String,
    val mediaUrl: String?,
    val mediaType: String?,
    val text: String,
    val bg: String,
    val createdAt: String,
    val author: Profile,
    val viewed: Boolean,
)

data class StoryGroup(val key: String, val label: String, val author: Profile?, val allViewed: Boolean, val items: List<Story>) {
    companion object {
        fun parse(o: JSONObject) = StoryGroup(
            o.s("key"), o.s("label"), o.o("author")?.let { Profile.parse(it) }, o.b("all_viewed"),
            o.a("items").map {
                Story(it.s("id"), it.sn("media_url"), it.sn("media_type"), it.s("text"), it.s("bg", "void"), it.s("created_at"),
                    Profile.parse(it.o("author") ?: JSONObject()), it.b("viewed"))
            },
        )
    }
}

data class Channel(
    val id: String,
    val name: String,
    val emoji: String,
    val kind: String,
    val isPrivate: Boolean,
    val isMember: Boolean,
    val memberCount: Int,
    val unread: Int,
    val lastMessageAt: String,
    val dmUser: Profile?,
    val lastBody: String?,
    val lastAuthor: String?,
    val lastAt: String?,
) {
    val title get() = if (kind == "dm") dmUser?.displayName ?: "Direct message" else name
    val isOfficial get() = dmUser?.id == OFFICIAL_ID

    companion object {
        fun parse(o: JSONObject): Channel {
            val last = o.o("last_message")
            return Channel(
                o.s("id"), o.s("name"), o.s("emoji", "💬"), o.s("kind", "group"), o.b("is_private"), o.b("is_member"),
                o.i("member_count"), o.i("unread"), o.s("last_message_at"), o.o("dm_user")?.let { Profile.parse(it) },
                last?.s("body"), last?.s("author"), last?.s("created_at"),
            )
        }
    }
}

data class ChannelDetail(val id: String, val name: String, val emoji: String, val kind: String, val isMember: Boolean, val members: List<Profile>) {
    companion object {
        fun parse(o: JSONObject) = ChannelDetail(
            o.s("id"), o.s("name"), o.s("emoji", "💬"), o.s("kind", "group"), o.b("is_member"), o.a("members").map { Profile.parse(it) },
        )
    }
}

data class Message(
    val id: String,
    val body: String,
    val mediaUrl: String?,
    val mediaType: String?,
    val deleted: Boolean,
    val createdAt: String,
    val author: Profile,
    val replyTo: String?,
) {
    companion object {
        fun parse(o: JSONObject) = Message(
            o.s("id"), o.s("body"), o.sn("media_url"), o.sn("media_type"), o.b("deleted"), o.s("created_at"),
            Profile.parse(o.o("author") ?: JSONObject()), o.o("reply_to")?.let { "${it.s("author")}: ${it.s("body")}" },
        )
    }
}

data class Notice(
    val id: String,
    val kind: String,
    val body: String,
    val read: Boolean,
    val createdAt: String,
    val postId: String?,
    val channelId: String?,
    val actor: Profile?,
) {
    companion object {
        fun parse(o: JSONObject) = Notice(
            o.s("id"), o.s("kind"), o.s("body"), o.b("read"), o.s("created_at"), o.sn("post_id"), o.sn("channel_id"),
            o.o("actor")?.let { Profile.parse(it) },
        )
    }
}

data class ProfileFull(
    val profile: Profile,
    val bio: String,
    val createdAt: String,
    val isMe: Boolean,
    val blocked: Boolean,
    val posts: Int,
    val likes: Int,
    val awards: Int,
    val points: Int,
) {
    companion object {
        fun parse(o: JSONObject): ProfileFull {
            val st = o.o("stats") ?: JSONObject()
            return ProfileFull(Profile.parse(o), o.s("bio"), o.s("created_at"), o.b("is_me"), o.b("blocked"),
                st.i("posts"), st.i("likes"), st.i("awards"), st.i("chaos_points"))
        }
    }
}

data class Decision(
    val id: String,
    val createdAt: String,
    val targetType: String,
    val verdict: String,
    val category: String,
    val excerpt: String,
    val status: String,
    val appealable: Boolean,
    val appealStatus: String?,
    val appealNote: String?,
)

data class Standing(
    val status: String,
    val mutedUntil: String?,
    val activeStrikes: Int,
    val strikeDays: Int,
    val ladder: List<Int>,
    val decisions: List<Decision>,
) {
    companion object {
        fun parse(o: JSONObject) = Standing(
            o.s("status", "good"), o.sn("muted_until"), o.i("active_strikes"), o.i("strike_days", 90),
            o.a("ladder").let { a -> (0 until a.length()).map { a.optInt(it) } },
            o.a("decisions").map {
                val ap = it.o("appeal")
                Decision(it.s("id"), it.s("created_at"), it.s("target_type"), it.s("verdict"), it.s("category"), it.s("excerpt"),
                    it.s("status"), it.b("appealable"), ap?.s("status"), ap?.sn("note"))
            },
        )
    }
}

const val OFFICIAL_ID = "00000000-0000-4000-8000-0000000000f1"

val CATEGORY_LABEL = mapOf(
    "minors" to "Child safety", "hate" to "Hate speech", "threats" to "Threats & violence", "sexual" to "Sexual content",
    "scam" to "Scams", "private_info" to "Private information", "harassment" to "Harassment", "violence" to "Graphic content",
    "self_harm" to "Self-harm", "spam" to "Spam", "repeat_media" to "Removed media", "other" to "Other",
)
