import { describe, expect, it } from "vitest";
import { wordPush, type PushItem } from "@/lib/push";

const SITE = "https://yoru.test";
const zach = { name: "Zach", username: "zach", avatar: "/seed/zach.png" };
const n = (o: Partial<PushItem>): PushItem => ({ id: "n1", kind: "like", body: "", post_id: "p1", channel_id: null, actor: zach, unread: 3, ...o });

describe("push wording", () => {
  it("names who did what, with their avatar, and opens the post", () => {
    expect(wordPush(n({ body: "heart" }), SITE)).toMatchObject({
      title: "Zach", body: "liked your post", url: "/post/p1", icon: "https://yoru.test/seed/zach.png", tag: "likes-p1", unread: 3,
    });
  });

  it("quotes comments and replies, clipped for a lock screen", () => {
    const long = "a".repeat(200);
    const c = wordPush(n({ kind: "comment", body: long }), SITE);
    expect(c.body.startsWith("commented: “aaa")).toBe(true);
    expect(c.body.length).toBeLessThan(110);
    expect(wordPush(n({ kind: "reply", body: "same" }), SITE).body).toBe("replied: “same”");
  });

  it("shows reactions and awards by their emoji, not their codes", () => {
    expect(wordPush(n({ kind: "reaction", body: "skull" }), SITE).body).toMatch(/^reacted .+ to your post$/);
    expect(wordPush(n({ kind: "reaction", body: "skull" }), SITE).body).not.toContain("skull");
    expect(wordPush(n({ kind: "award", body: "menace" }), SITE).body).toBe("gave your post 😈 Certified Menace");
  });

  it("delivers messages as the sender's words, one per chat, re-alerting", () => {
    const m = wordPush(n({ kind: "message", body: "you up?", post_id: null, channel_id: "c9" }), SITE);
    expect(m).toMatchObject({ title: "Zach", body: "you up?", url: "/chat/c9", tag: "chat-c9", renotify: true });
  });

  it("sends chat mentions to the chat", () => {
    expect(wordPush(n({ kind: "mention", body: "@ari look", post_id: null, channel_id: "c9" }), SITE).url).toBe("/chat/c9");
  });

  it("words YORU's own notices and level-ups", () => {
    const mod = wordPush(n({ kind: "moderation", body: "Your post was held for review.", actor: null, post_id: null }), SITE);
    expect(mod).toMatchObject({ title: "YORU · Night Watch", url: "/standing", icon: "https://yoru.test/brand/yoru/app-icon-512.png" });
    expect(wordPush(n({ kind: "level_up", body: "3", actor: null, post_id: null }), SITE).body).toBe("You reached level 3. Keep the night going.");
    expect(wordPush(n({ kind: "announcement", body: "", actor: null, post_id: null }), SITE).body).toBe("You have a new notification.");
  });

  it("words following, new posts, top posts and Moonrise (migration 0017)", () => {
    expect(wordPush(n({ kind: "follow", post_id: null }), SITE)).toMatchObject({ title: "Zach", body: "started following you", url: "/notifications" });
    expect(wordPush(n({ kind: "new_post", body: "night walk #anime" }), SITE)).toMatchObject({ title: "Zach", body: "posted: “night walk #anime”", url: "/post/p1" });
    expect(wordPush(n({ kind: "top_post", body: "🌕 Full Moon · speedrun done #gaming" }), SITE)).toMatchObject({
      title: "🌕 Top post in your interests", body: "Zach: “speedrun done #gaming”", url: "/post/p1", tag: "top-p1",
    });
    expect(wordPush(n({ kind: "top_post", body: "🔴 Blood Moon · everyone saw this" }), SITE).title).toBe("🔴 Trending across YORU");
    expect(wordPush(n({ kind: "moon", body: "Crescent", actor: null }), SITE)).toMatchObject({
      title: "YORU · Moonrise", body: "Your post just reached 🌒 Crescent.", url: "/post/p1", tag: "moon-p1",
    });
  });

  it("resolves storage paths and keeps absolute avatars", () => {
    expect(wordPush(n({ actor: { ...zach, avatar: "u/abc.jpg" } }), SITE).icon).toBe("https://yoru.test/api/media/u/abc.jpg");
    expect(wordPush(n({ actor: { ...zach, avatar: "https://cdn.x/a.png" } }), SITE).icon).toBe("https://cdn.x/a.png");
    expect(wordPush(n({ actor: { ...zach, avatar: null } }), SITE).icon).toBe("https://yoru.test/brand/yoru/app-icon-512.png");
  });
});
