import { NextRequest } from "next/server";
import { z } from "zod";
import { firebaseAccount, firebaseClient } from "@/lib/config";
import { getUserDb } from "@/lib/server/db";
import { AppError, assertWritable, handle } from "@/lib/server/errors";

// The Android app's notifications. GET says how the app should get them
// (instant through Firebase when it's set up, otherwise a background check).
// POST registers the app's Firebase token for the signed-in member; DELETE
// removes it.

export async function GET() {
  return handle(async () => {
    await getUserDb();
    const firebase = firebaseClient();
    return firebase ? { mode: "fcm", firebase } : { mode: "poll" };
  });
}

const Body = z.object({ token: z.string().regex(/^[A-Za-z0-9_:-]{20,4096}$/), device: z.string().trim().max(80).optional() });

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertWritable();
    if (!firebaseAccount()) throw new AppError("NOT_CONFIGURED", "Instant notifications for the app aren't set up yet.", 503);
    const db = await getUserDb();
    const { token, device } = Body.parse(await req.json().catch(() => ({})));
    return db.rpc<{ devices: number }>("push_subscribe", { p_endpoint: token, p_p256dh: null, p_auth: null, p_device: device ?? "YORU app on Android", p_kind: "fcm" });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    assertWritable();
    const db = await getUserDb();
    const { token } = z.object({ token: z.string().max(4096) }).parse(await req.json().catch(() => ({})));
    return db.rpc<{ devices: number }>("push_unsubscribe", { p_endpoint: token });
  });
}
