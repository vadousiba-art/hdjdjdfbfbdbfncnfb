import { NextRequest } from "next/server";
import { getUserDb } from "@/lib/server/db";
import { handle } from "@/lib/server/errors";
import { wordPush, type PushItem } from "@/lib/push";

// For the Android app's background check (used until Firebase is set up):
// unread notifications newer than `since` (with two minutes of overlap; the
// app skips ids it has already shown), worded exactly like pushes. Like
// pushes, a notification waits 30 seconds first, so one you've already read in
// the app never reaches the shade. The app sends its session cookie; refreshed
// cookies come back as usual.

type Row = {
  id: string; kind: string; body: string; read: boolean; created_at: string; post_id: string | null; channel_id: string | null;
  actor: { display_name: string; username: string; avatar_url: string | null } | null;
};

export async function GET(req: NextRequest) {
  return handle(async () => {
    const db = await getUserDb();
    const since = (Date.parse(req.nextUrl.searchParams.get("since") ?? "") || Date.now() - 15 * 60_000) - 120_000;
    const rows = await db.rpc<Row[]>("get_notifications", { p_limit: 30 });
    const unread = rows.filter((r) => !r.read).length;
    const site = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    const due = Date.now() - 30_000;
    const fresh = rows.filter((r) => !r.read && Date.parse(r.created_at) > since && Date.parse(r.created_at) <= due).slice(0, 10);
    const items = fresh.map((r) => {
      const item: PushItem = {
        id: r.id, kind: r.kind, body: r.body, post_id: r.post_id, channel_id: r.channel_id, unread,
        actor: r.actor ? { name: r.actor.display_name, username: r.actor.username, avatar: r.actor.avatar_url } : null,
      };
      return { ...wordPush(item, site), id: r.id, created_at: r.created_at, urgent: r.kind === "message" };
    });
    return { items, unread, newest: rows[0]?.created_at ?? null };
  });
}
