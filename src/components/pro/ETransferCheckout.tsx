"use client";

import { useState } from "react";
import { Check, Copy, Heart, Landmark, Loader2, Send } from "lucide-react";
import clsx from "clsx";
import { rpc } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";
import { dollars, parseDollars } from "@/lib/billing/etransfer";
import { refreshETransfers, useMyETransfers, type ETransferConfig, type ETransferOrder } from "@/lib/client/etransfer";

// Checkout by Interac e-Transfer: the member gets their own exact amount and a
// reference code, sends it from their bank, and taps "I've sent it". The owner
// confirms it in the Watchtower; Pro switches on then (never before).

function CopyRow({ label, value, hint, big }: { label: string; value: string; hint?: string; big?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-card-2 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
        <div className={clsx("break-all font-black tabular-nums", big ? "text-2xl" : "text-base")}>{value}</div>
        {hint ? <div className="mt-0.5 text-xs text-muted">{hint}</div> : null}
      </div>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard?.writeText(value).catch(() => null);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
        className={clsx("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold", done ? "bg-online text-black" : "bg-ink text-bg")}
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Steps({ order, cfg }: { order: ETransferOrder; cfg: ETransferConfig }) {
  return (
    <ol className="space-y-2.5">
      <li className="flex gap-2.5 text-sm">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-black text-white">1</span>
        <span>Open your bank app and choose <b>Interac e-Transfer</b> → <b>Send money</b>.</span>
      </li>
      <li className="space-y-1.5">
        <div className="flex gap-2.5 text-sm">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-black text-white">2</span>
          <span>Send it to this email. It deposits automatically, so there’s no security question.</span>
        </div>
        <CopyRow label="Send to" value={cfg.email} />
      </li>
      <li className="space-y-1.5">
        <div className="flex gap-2.5 text-sm">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-black text-white">3</span>
          <span>Send <b>exactly</b> this amount.</span>
        </div>
        <CopyRow
          label={`Amount (${cfg.currency})`}
          value={dollars(order.amount_cents)}
          big
          hint={`The cents are how we know it's you, so it's ${dollars(order.base_cents - order.amount_cents)} less than ${dollars(order.base_cents)}.`}
        />
      </li>
      <li className="space-y-1.5">
        <div className="flex gap-2.5 text-sm">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-black text-white">4</span>
          <span>Put this code in the e-Transfer <b>message</b>.</span>
        </div>
        <CopyRow label="Message" value={order.code} />
      </li>
    </ol>
  );
}

function OrderPanel({ order, cfg }: { order: ETransferOrder; cfg: ETransferConfig }) {
  const { toast, toastError } = useApp();
  const [name, setName] = useState(order.sender_name);
  const [busy, setBusy] = useState(false);
  const what = order.kind === "pro" ? "YORU Pro" : "your donation";

  if (order.status === "sent") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-card-2 p-3.5">
          <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-brand" />
          <div className="text-sm">
            <div className="font-bold">Waiting for the payment to be confirmed</div>
            <div className="text-ink-2">
              {dollars(order.amount_cents)} · {order.code}. Payments are checked every day, and you’ll get a notification as soon as {what}{" "}
              {order.kind === "pro" ? "switches on" : "is received"}.
            </div>
          </div>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-muted">Show the payment details again</summary>
          <div className="mt-3">
            <Steps order={order} cfg={cfg} />
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Steps order={order} cfg={cfg} />
      <label className="block">
        <span className="mb-1 block text-xs font-semibold">
          Name on your bank account <span className="font-normal text-muted">(optional: helps match it if the message is missing)</span>
        </span>
        <input
          id={`etransfer-name-${order.id}`}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="As it appears on the e-Transfer"
          className="w-full rounded-xl border border-line bg-card-2 px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await rpc("etransfer_mark_sent", { p_id: order.id, p_sender_name: name.trim() });
              toast("Thanks! We'll confirm it as soon as it arrives.", "success", "🌙");
              await refreshETransfers();
            } catch (err) {
              toastError(err);
            } finally {
              setBusy(false);
            }
          }}
          className="flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          <Send size={16} /> I’ve sent it
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await rpc("etransfer_cancel", { p_id: order.id });
              await refreshETransfers();
            } catch (err) {
              toastError(err);
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-full border border-line px-4 py-2.5 text-sm font-bold text-ink-2 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-muted">
        Only tap “I’ve sent it” once the e-Transfer has gone through. Unsent checkouts expire after {cfg.open_days} days.
      </p>
    </div>
  );
}

// YORU Pro by e-Transfer: one month per payment, no automatic renewal.
export function ProETransfer({ cfg, isPro }: { cfg: ETransferConfig; isPro: boolean }) {
  const { toastError } = useApp();
  const { data: orders } = useMyETransfers(true);
  const [busy, setBusy] = useState(false);
  const waiting = orders?.find((o) => o.kind === "pro" && (o.status === "open" || o.status === "sent"));

  return (
    <div className="space-y-3 rounded-2xl border border-line p-4">
      <div className="flex items-center gap-2">
        <Landmark size={18} className="text-brand" />
        <h3 className="font-black">{isPro ? "Add a month of Pro" : "Get Pro with Interac e-Transfer"}</h3>
      </div>
      {waiting ? (
        <OrderPanel order={waiting} cfg={cfg} />
      ) : (
        <>
          <p className="text-sm text-ink-2">
            {dollars(cfg.pro_cents)} {cfg.currency} for {cfg.pro_months} month. Nothing renews by itself: pay again whenever you want another month
            {isPro ? ", and it's added after your current one" : ""}. Pro switches on once your payment is confirmed, usually within a day.
          </p>
          <button
            type="button"
            disabled={busy || !orders}
            onClick={async () => {
              setBusy(true);
              try {
                await rpc("etransfer_start", { p_kind: "pro" });
                await refreshETransfers();
              } catch (err) {
                toastError(err);
              } finally {
                setBusy(false);
              }
            }}
            className="flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Landmark size={16} />} Pay by e-Transfer
          </button>
        </>
      )}
      <MyPayments orders={orders} />
    </div>
  );
}

const DONATION_CHIPS = [500, 1000, 2000];

// Donations: any amount in range, same steps, no Pro attached.
export function DonateETransfer({ cfg }: { cfg: ETransferConfig }) {
  const { toastError } = useApp();
  const { data: orders } = useMyETransfers(true);
  const [pick, setPick] = useState<number | null>(1000);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const waiting = orders?.find((o) => o.kind === "donation" && o.status === "open");
  const customCents = custom.trim() ? parseDollars(custom) : null;
  const cents = custom.trim() ? customCents : pick;
  const valid = cents !== null && cents >= cfg.donation_min_cents && cents <= cfg.donation_max_cents;

  return (
    <section className="card space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Heart size={18} className="text-brand" />
        <h2 className="text-lg font-black">Support YORU</h2>
      </div>
      <p className="text-sm text-ink-2">
        YORU is built by one person, with no ads and no third-party tracking. A donation by Interac e-Transfer helps keep it running. It doesn’t buy anything
        in the app; it’s a thank-you.
      </p>
      {waiting ? (
        <OrderPanel order={waiting} cfg={cfg} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {DONATION_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={!custom.trim() && pick === c}
                onClick={() => {
                  setPick(c);
                  setCustom("");
                }}
                className={clsx(
                  "rounded-full border px-4 py-2 text-sm font-bold",
                  !custom.trim() && pick === c ? "border-brand bg-brand text-white" : "border-line hover:border-brand",
                )}
              >
                {dollars(c)}
              </button>
            ))}
            <label className="flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm focus-within:border-brand">
              <span className="text-muted">$</span>
              <input
                id="donation-custom"
                inputMode="decimal"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Other"
                className="w-20 bg-transparent font-bold outline-none"
                aria-label="Other amount in dollars"
              />
            </label>
          </div>
          {custom.trim() && !valid ? (
            <p className="text-xs font-semibold text-hot">
              Enter an amount from {dollars(cfg.donation_min_cents)} to {dollars(cfg.donation_max_cents)}.
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy || !valid}
            onClick={async () => {
              setBusy(true);
              try {
                await rpc("etransfer_start", { p_kind: "donation", p_amount_cents: cents });
                await refreshETransfers();
              } catch (err) {
                toastError(err);
              } finally {
                setBusy(false);
              }
            }}
            className="flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} />} Donate {valid && cents !== null ? dollars(cents) : ""}
          </button>
        </>
      )}
    </section>
  );
}

const STATUS: Record<ETransferOrder["status"], string> = {
  open: "Not sent yet",
  sent: "Waiting for confirmation",
  confirmed: "Confirmed",
  rejected: "Not found",
  canceled: "Canceled",
};

function MyPayments({ orders }: { orders?: ETransferOrder[] }) {
  const past = (orders ?? []).filter((o) => o.status !== "open");
  if (!past.length) return null;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-muted">Your payments</summary>
      <ul className="mt-2 divide-y divide-line">
        {past.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <b>{o.kind === "pro" ? "Pro" : "Donation"}</b> · {dollars(o.amount_cents)} · <span className="font-mono">{o.code}</span>
            </span>
            <span className={clsx("text-xs font-bold", o.status === "confirmed" ? "text-online" : o.status === "rejected" ? "text-hot" : "text-muted")}>
              {STATUS[o.status]}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
