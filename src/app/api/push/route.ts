import { NextRequest } from "next/server";
import { z } from "zod";
import { pushConfig } from "@/lib/config";
import { deliver, webPushEnabled } from "@/lib/server/push";
import { getUserDb } from "@/lib/server/db";
import { AppError, assertWritable, handle } from "@/lib/server/errors";

// Push notifications for this device: the public key the browser needs, and
// turning push on (subscribe), off (unsubscribe) or sending a test.

const Sub = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({ p256dh: z.string().min(40).max(200), auth: z.string().min(10).max(100) }),
});
const Body = z.object({ subscription: Sub, device: z.string().trim().max(80).optional(), test: z.boolean().optional() });

export async function GET() {
  return handle(async () => {
    await getUserDb();
    return { publicKey: pushConfig().publicKey ?? null, enabled: webPushEnabled() };
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertWritable();
    if (!webPushEnabled()) throw new AppError("NOT_CONFIGURED", "Push notifications aren't switched on for YORU yet.", 503);
    const db = await getUserDb();
    const { subscription: s, device, test } = Body.parse(await req.json().catch(() => ({})));
    const out = await db.rpc<{ devices: number }>("push_subscribe", { p_endpoint: s.endpoint, p_p256dh: s.keys.p256dh, p_auth: s.keys.auth, p_device: device ?? "" });
    if (test) {
      const q = await db.rpc<{ allowed: boolean }>("consume_quota", { p_bucket: "push_test", p_max: 5, p_window_seconds: 300 });
      if (!q.allowed) throw new AppError("RATE_LIMIT", "That's plenty of test notifications for now. Try again in a few minutes.", 429);
      const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
      const r = await deliver([{ device: { endpoint: s.endpoint, ...s.keys }, payload: {
        title: "YORU 夜",
        body: "Notifications are on. You'll hear about likes, comments, mentions and messages here, even when YORU is closed.",
        url: "/notifications", tag: "yoru-test", icon: `${site}/brand/yoru/app-icon-512.png`, unread: 0,
      } }]);
      if (!r.ok.length) throw new AppError("PUSH_FAILED", "Your browser's push service didn't accept the test. Try turning notifications off and on again.", 502);
    }
    return out;
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    assertWritable();
    const db = await getUserDb();
    const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(await req.json().catch(() => ({})));
    return db.rpc<{ devices: number }>("push_unsubscribe", { p_endpoint: endpoint });
  });
}
