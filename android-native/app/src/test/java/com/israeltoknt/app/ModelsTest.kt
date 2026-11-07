package com.israeltoknt.app

import com.israeltoknt.app.data.Post
import com.israeltoknt.app.data.compact
import com.israeltoknt.app.data.parseTime
import com.israeltoknt.app.data.timeAgo
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ModelsTest {
    @Test fun parsesPostgresTimestamps() {
        val utc = parseTime("2026-10-28T03:57:12.123456+00:00")
        assertEquals(parseTime("2026-10-28T03:57:12.123Z"), utc)
        assertEquals(utc, parseTime("2026-10-27T22:57:12.123-05:00"))
        assertEquals(0L, parseTime(null))
    }

    @Test fun timeAgoAndCompactNumbers() {
        val now = parseTime("2026-10-28T12:00:00Z")
        assertEquals("now", timeAgo("2026-10-28T11:59:30Z", now))
        assertEquals("5m", timeAgo("2026-10-28T11:55:00Z", now))
        assertEquals("3h", timeAgo("2026-10-28T09:00:00Z", now))
        assertEquals("2d", timeAgo("2026-10-26T12:00:00Z", now))
        assertEquals("999", compact(999))
        assertEquals("1.5K", compact(1500))
        assertEquals("12K", compact(12_000))
    }

    @Test fun parsesPostsLikeTheWebsite() {
        val json = JSONObject(
            """{"id":"p1","kind":"repost","body":"","media_url":null,"media_type":null,"created_at":"2026-10-28T03:00:00Z",
              "author":{"id":"a","username":"ari","display_name":"Ari","verified":true,"role":"owner","look":{"ring":"ring.x"}},
              "counts":{"likes":3,"comments":1,"reposts":0},"my_reactions":["heart"],"bookmarked":true,"reposted":false,
              "poll":null,"mod":{"state":"held","label":"threats"},
              "repost_of":{"id":"p0","kind":"post","body":"hello #yoru","media_url":"u/x/y.mp4","media_type":"video","created_at":"2026-10-27T03:00:00Z",
                "author":{"id":"b","username":"ben","display_name":"Ben"},"counts":{"likes":9},"my_reactions":[]}}""",
        )
        val p = Post.parse(json)
        assertTrue(p.liked)
        assertEquals("held", p.modState)
        assertEquals("ring.x", p.author.ring)
        assertEquals("p0", p.shown.id)
        assertTrue(p.shown.isVideo)
        assertNull(p.shown.repostOf)
        assertEquals(9, p.shown.likes)
    }
}
