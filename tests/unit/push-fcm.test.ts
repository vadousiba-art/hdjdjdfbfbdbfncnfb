import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

// The Android app's instant notifications: the server signs in to Firebase
// with its service account and sends a notification Android shows itself.

const report = vi.fn<(...args: unknown[]) => Promise<null>>(async () => null);
vi.mock("@/lib/server/db", () => ({ serviceRpc: (...a: unknown[]) => report(...a) }));
vi.mock("@vercel/functions", () => ({ waitUntil: () => {} }));

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const calls: { url: string; body: string; auth?: string }[] = [];
const realFetch = globalThis.fetch;

beforeAll(() => {
  process.env.FIREBASE_SERVICE_ACCOUNT = Buffer.from(JSON.stringify({
    project_id: "yoru-test", client_email: "push@yoru-test.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
  })).toString("base64");
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: String(init.body), auth: (init.headers as Record<string, string>).authorization });
    if (url.startsWith("https://oauth2.googleapis.com")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }));
    const msg = JSON.parse(String(init.body)).message;
    if (msg.token.startsWith("gone")) {
      return new Response(JSON.stringify({ error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }), { status: 404 });
    }
    return new Response("{}");
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
});

describe("Firebase push (Android app)", () => {
  it("signs in with a valid service-account JWT and sends a shade notification", async () => {
    const { deliver } = await import("@/lib/server/push");
    const token = "app-token_".padEnd(40, "x");
    const payload = { title: "Zach", body: "you up?", url: "/chat/c9", tag: "chat-c9", icon: "https://x/a.png", unread: 2, renotify: true };
    const r = await deliver([
      { device: { kind: "fcm", endpoint: token }, payload, urgent: true },
      { device: { kind: "fcm", endpoint: "gone".padEnd(40, "x") }, payload },
    ]);
    expect(r).toEqual({ ok: [token], gone: ["gone".padEnd(40, "x")], failed: [] });

    const signIn = calls.find((c) => c.url.startsWith("https://oauth2.googleapis.com"))!;
    const jwt = new URLSearchParams(signIn.body).get("assertion")!;
    const [h, p, sig] = jwt.split(".");
    expect(crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), publicKey, Buffer.from(sig, "base64url"))).toBe(true);
    expect(JSON.parse(Buffer.from(p, "base64url").toString())).toMatchObject({
      iss: "push@yoru-test.iam.gserviceaccount.com", scope: "https://www.googleapis.com/auth/firebase.messaging",
    });
    expect(calls.filter((c) => c.url.includes("oauth2")).length).toBe(1); // token reused

    const send = calls.find((c) => c.url === "https://fcm.googleapis.com/v1/projects/yoru-test/messages:send")!;
    expect(send.auth).toBe("Bearer tok");
    const { message } = JSON.parse(send.body);
    expect(message).toMatchObject({
      token,
      notification: { title: "Zach", body: "you up?" },
      data: { url: "/chat/c9", tag: "chat-c9", unread: "2" },
      android: { priority: "HIGH", notification: { channel_id: "yoru_messages", icon: "ic_stat_yoru", tag: "chat-c9", notification_count: 2 } },
    });
    expect(report).toHaveBeenCalledWith("push_report", { p_ok: [token], p_gone: ["gone".padEnd(40, "x")], p_failed: [] });
  });
});
