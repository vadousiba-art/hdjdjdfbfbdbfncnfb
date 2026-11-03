import { NextRequest } from "next/server";
import { z } from "zod";
import { SUBSCRIPTION_ID } from "@/lib/billing/paypal";
import { getUserDb } from "@/lib/server/db";
import { assertWritable, handle } from "@/lib/server/errors";
import { syncSubscription } from "@/lib/server/paypal";

// After the member approves the subscription in PayPal's window, the page
// sends its id here. Pro turns on only once PayPal itself says the
// subscription is active, for this plan, and was made by this member; what
// the browser says is never enough. PayPal can take a few seconds to activate
// a new subscription: we wait a little, and the webhook finishes the job if
// it takes longer.

const Body = z.object({ subscriptionId: z.string().regex(SUBSCRIPTION_ID) });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertWritable();
    const db = await getUserDb();
    const { subscriptionId } = Body.parse(await req.json().catch(() => ({})));
    let out = await syncSubscription(subscriptionId, { member: db.userId });
    for (let i = 0; i < 4 && out.change === "pending"; i++) {
      await wait(1500);
      out = await syncSubscription(subscriptionId, { member: db.userId });
    }
    return out;
  });
}
