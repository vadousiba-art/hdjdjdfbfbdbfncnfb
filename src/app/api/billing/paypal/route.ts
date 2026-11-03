import { appMode, paypalConfig } from "@/lib/config";
import { getUserId } from "@/lib/server/db";
import { handle } from "@/lib/server/errors";

// What pages need to know about Pro billing. `enabled` is false until the
// server can confirm and renew PayPal subscriptions, and the subscribe button
// stays hidden until then. For a signed-in member it also carries the public
// client and plan ids and the member id PayPal keeps on the subscription
// (custom_id), so the server can tell whose subscription it is.
export async function GET() {
  return handle(async () => {
    const c = paypalConfig();
    if (!c.enabled || appMode() !== "supabase") return { enabled: false };
    const customId = await getUserId();
    return { enabled: true, clientId: c.clientId, planId: c.planId, customId };
  });
}
