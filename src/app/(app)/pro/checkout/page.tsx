"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Heart, Landmark, Sparkles } from "lucide-react";
import { Gate } from "@/components/yoru/Gate";
import { ChaosLoader } from "@/components/ui/bits";
import { useIdentity } from "@/lib/client/gates";
import { useETransfer, useMyETransfers } from "@/lib/client/etransfer";
import { dollars } from "@/lib/billing/etransfer";
import { DonateCheckout, PaymentHistory, ProCheckout, roundDollars } from "@/components/pro/ETransferCheckout";

// /pro/checkout: YORU Pro or a donation, paid by Interac e-Transfer.
// ?for=donate opens the donation side.

export default function CheckoutPage() {
  return (
    <Gate>
      <Suspense fallback={<ChaosLoader />}>
        <Checkout />
      </Suspense>
    </Gate>
  );
}

const FAQ: [string, string][] = [
  [
    "Why is the amount a few cents less than the price?",
    "Every checkout gets its own amount, so when your e-Transfer arrives we can tell it’s yours. You pay a little less, never more.",
  ],
  ["What if I forget the code?", "Send it anyway. The exact amount (and your bank name, if you added it) usually tells us who it’s from. If not, contact support."],
  ["When does Pro start?", "As soon as your payment is confirmed, usually within a day. You’ll get a notification. If you already have Pro, the new month starts when your current one ends."],
  ["Does it renew?", "No. Each e-Transfer pays for one month, and nothing is ever taken from your account. Pay again whenever you want another month."],
];

function Checkout() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("for") === "donate" ? "donate" : "pro";
  const et = useETransfer();
  const { data: id } = useIdentity();
  const { data: orders } = useMyETransfers(et.available);
  const cfg = et.available ? et.config : undefined;
  const proUntil = id?.pro_until && id.pro_until !== "infinity" ? id.pro_until : null;
  const go = (t: "pro" | "donate") => router.replace(t === "donate" ? "/pro/checkout?for=donate" : "/pro/checkout", { scroll: false });

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-6">
      <Link href="/pro" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} /> YORU Pro
      </Link>

      <header>
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-muted">
          <Landmark size={14} className="text-brand" /> Interac e-Transfer
        </div>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Checkout</h1>
        <p className="mt-1 text-sm text-ink-2">Pay from your own bank in a couple of minutes. No card, nothing to sign up for, and nothing renews.</p>
      </header>

      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="What you’re paying for">
        {(
          [
            ["pro", Sparkles, "YORU Pro", cfg ? `${dollars(cfg.pro_cents)} for a month` : "One month"],
            ["donate", Heart, "Donate", cfg ? `Any amount up to ${roundDollars(cfg.donation_max_cents)}` : "Any amount"],
          ] as const
        ).map(([key, Icon, title, sub]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => go(key)}
            className={clsx(
              "rounded-2xl border p-3.5 text-start transition-colors",
              tab === key ? "border-brand bg-brand/10" : "border-line bg-card hover:border-brand/60",
            )}
          >
            <Icon size={18} className={tab === key ? "text-brand" : "text-muted"} />
            <div className="mt-1.5 font-black">{title}</div>
            <div className="text-xs text-muted">{sub}</div>
          </button>
        ))}
      </div>

      {!et.ready || (cfg && !orders) ? (
        <ChaosLoader />
      ) : !cfg ? (
        <div className="card p-5 text-sm text-ink-2">Checkout couldn’t load right now. Refresh the page to try again.</div>
      ) : tab === "pro" ? (
        <ProCheckout cfg={cfg} orders={orders ?? []} isPro={Boolean(id?.pro)} proUntil={proUntil} />
      ) : (
        <DonateCheckout cfg={cfg} orders={orders ?? []} />
      )}

      <section className="card p-5">
        <h2 className="font-black">How it works</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["1", "Check out", "You get an exact amount and a reference code."],
            ["2", "Send it", "Send an Interac e-Transfer from your bank with the code in the message."],
            ["3", "Confirmed", "We confirm it, usually within a day, and you get a notification."],
          ].map(([n, title, body]) => (
            <li key={n} className="flex gap-3 rounded-2xl border border-line bg-card-2 p-3 sm:flex-col sm:gap-1.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-black text-white">{n}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{title}</span>
                <span className="block text-xs text-muted">{body}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-4 divide-y divide-line border-t border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-2.5">
              <summary className="cursor-pointer text-sm font-semibold marker:text-muted">{q}</summary>
              <p className="mt-1.5 text-sm text-ink-2">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {orders && <PaymentHistory orders={orders} />}

      <p className="text-center text-xs text-muted">
        By paying you agree to the <Link href="/terms" className="underline">Terms</Link>. See the <Link href="/privacy" className="underline">Privacy Policy</Link> for
        what a payment records.
      </p>
    </div>
  );
}
