"use client";

import { useState } from "react";
import { Check, CheckCircle2, Copy, Heart, Landmark, Loader2, Moon, Send, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import clsx from "clsx";
import { rpc } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";
import { dollars, parseDollars } from "@/lib/billing/etransfer";
import { refreshETransfers, type ETransferConfig, type ETransferOrder } from "@/lib/client/etransfer";

// Checkout by Interac e-Transfer: the member gets their own exact amount and a
// reference code, sends it from their bank, and taps "I've sent it". The owner
// confirms it in the Watchtower; Pro switches on then (never before).

const RECENT_MS = 14 * 24 * 3600_000;
const isWaiting = (o: ETransferOrder) => o.status === "open" || o.status === "sent";
const recent = (o: ETransferOrder) => Boolean(o.decided_at) && Date.now() - Date.parse(o.decided_at!) < RECENT_MS;
const shortDay = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
// $5 rather than $5.00 for round amounts
export const roundDollars = (cents: number) => (cents % 100 === 0 ? `$${cents / 100}` : dollars(cents));

function useAction() {
  const { toastError } = useApp();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refreshETransfers();
      return true;
    } catch (err) {
      toastError(err);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

// Checkout → Send → Confirmed
function Progress({ step }: { step: 0 | 1 | 2 | 3 }) {
  const labels = ["Checkout", "Send it", "Confirmed"];
  return (
    <ol className="flex items-center gap-2" aria-label="Payment progress">
      {labels.map((label, i) => {
        const done = step > i;
        const now = step === i;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2" aria-current={now ? "step" : undefined}>
            <span
              className={clsx(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black",
                done ? "bg-online text-black" : now ? "bg-brand text-white ring-4 ring-brand/20" : "border border-line text-muted",
              )}
            >
              {done ? <Check size={13} strokeWidth={3} /> : i + 1}
            </span>
            <span className={clsx("truncate text-xs font-bold", now ? "text-ink" : done ? "text-ink-2" : "text-muted")}>{label}</span>
            {i < labels.length - 1 && <span className={clsx("h-px min-w-3 flex-1", done ? "bg-online/60" : "bg-line")} />}
          </li>
        );
      })}
    </ol>
  );
}

function CopyRow({ label, value, hint, kind }: { label: string; value: string; hint?: string; kind?: "amount" | "code" }) {
  const [done, setDone] = useState(false);
  return (
    <div className={clsx("flex items-center gap-3 rounded-2xl border px-4 py-3", kind === "amount" ? "border-brand/50 bg-brand/[0.07]" : "border-line bg-card-2")}>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{label}</div>
        <div
          className={clsx(
            "break-all font-black tabular-nums",
            kind === "amount" ? "text-3xl leading-tight" : kind === "code" ? "font-mono text-xl tracking-[0.12em]" : "text-base",
          )}
        >
          {value}
        </div>
        {hint ? <div className="mt-0.5 text-xs text-ink-2">{hint}</div> : null}
      </div>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard?.writeText(value).catch(() => null);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
        className={clsx(
          "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors",
          done ? "bg-online text-black" : "bg-ink text-bg hover:opacity-90",
        )}
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Step({ n, children, last }: { n: number; children: React.ReactNode; last?: boolean }) {
  return (
    <li className="relative flex gap-3">
      {!last && <span className="absolute bottom-0 start-[11px] top-7 w-px bg-line" aria-hidden />}
      <span className="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-black text-white">{n}</span>
      <div className="min-w-0 flex-1 space-y-2 pb-5">{children}</div>
    </li>
  );
}

function Instructions({ order, cfg }: { order: ETransferOrder; cfg: ETransferConfig }) {
  const off = order.base_cents - order.amount_cents;
  return (
    <ol>
      <Step n={1}>
        <p className="text-sm">
          Open your bank app or website and choose <b>Interac e-Transfer</b> → <b>Send money</b>.
        </p>
      </Step>
      <Step n={2}>
        <p className="text-sm">Send it to this email. It deposits automatically, so there’s no security question to answer.</p>
        <CopyRow label="Send to" value={cfg.email} />
      </Step>
      <Step n={3}>
        <p className="text-sm">
          Send <b>exactly</b> this amount, cents included.
        </p>
        <CopyRow
          label={`Amount (${cfg.currency})`}
          value={dollars(order.amount_cents)}
          kind="amount"
          hint={off > 0 ? `That’s ${dollars(off)} under ${dollars(order.base_cents)}: the cents are how we know the payment is yours.` : undefined}
        />
      </Step>
      <Step n={4} last>
        <p className="text-sm">
          Put this code in the e-Transfer <b>message</b>.
        </p>
        <CopyRow label="Message" value={order.code} kind="code" />
      </Step>
    </ol>
  );
}

// An order that hasn't been sent yet: the instructions, then "I've sent it".
function SendPanel({ order, cfg }: { order: ETransferOrder; cfg: ETransferConfig }) {
  const { toast } = useApp();
  const { busy, run } = useAction();
  const [name, setName] = useState(order.sender_name);

  return (
    <div className="card space-y-5 p-5">
      <Progress step={1} />
      <div>
        <h2 className="text-lg font-black">{order.kind === "pro" ? "Send your e-Transfer" : "Send your donation"}</h2>
        <p className="text-sm text-ink-2">
          {order.kind === "pro" ? "YORU Pro, 1 month" : "Donation"} · {dollars(order.amount_cents)} {cfg.currency}
        </p>
      </div>
      <Instructions order={order} cfg={cfg} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">
          Name on your bank account <span className="font-normal text-muted">(optional)</span>
        </span>
        <input
          id={`etransfer-name-${order.id}`}
          value={name}
          maxLength={80}
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
          placeholder="As it appears on the e-Transfer"
          className="w-full rounded-xl border border-line bg-card-2 px-3.5 py-2.5 text-sm outline-none focus:border-brand"
        />
        <span className="mt-1 block text-xs text-muted">Helps us match your payment if the message gets lost.</span>
      </label>
      <div className="space-y-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (await run(() => rpc("etransfer_mark_sent", { p_id: order.id, p_sender_name: name.trim() })))
              toast("Thanks! We’ll confirm it as soon as it arrives.", "success", "🌙");
          }}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-2 disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} I’ve sent it
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => rpc("etransfer_cancel", { p_id: order.id }))}
          className="w-full rounded-full px-5 py-2 text-sm font-semibold text-muted hover:text-ink disabled:opacity-60"
        >
          Cancel this checkout
        </button>
        <p className="text-center text-xs text-muted">
          Only tap “I’ve sent it” once your bank has sent the e-Transfer. Unsent checkouts expire after {cfg.open_days} days.
        </p>
      </div>
    </div>
  );
}

// Sent: waiting for the owner to confirm it.
function WaitingPanel({ order, cfg }: { order: ETransferOrder; cfg: ETransferConfig }) {
  const pro = order.kind === "pro";
  return (
    <div className="card space-y-5 p-5">
      <Progress step={2} />
      <div className="flex items-start gap-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-brand">
          <Moon size={20} />
          <span className="absolute -end-0.5 -top-0.5 h-3 w-3 animate-ping rounded-full bg-brand/60" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-black">{pro ? "Payment sent. Pro is on its way." : "Thank you for your donation!"}</h2>
          <p className="text-sm text-ink-2">
            Payments are checked every day. {pro ? "Pro switches on" : "We’ll let you know"} as soon as your {dollars(order.amount_cents)} e-Transfer
            ({order.code}) is confirmed, and you’ll get a notification.
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-card-2 p-3 text-center">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-widest text-muted">Amount</dt>
          <dd className="font-black tabular-nums">{dollars(order.amount_cents)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-widest text-muted">Code</dt>
          <dd className="font-mono font-black">{order.code}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-widest text-muted">Sent</dt>
          <dd className="font-black">{shortDay(order.sent_at ?? order.created_at)}</dd>
        </div>
      </dl>
      <details className="group text-sm">
        <summary className="cursor-pointer font-semibold text-muted hover:text-ink">Show the payment details again</summary>
        <div className="mt-4">
          <Instructions order={order} cfg={cfg} />
        </div>
      </details>
    </div>
  );
}

function Outcome({ order, proUntil }: { order: ETransferOrder; proUntil?: string | null }) {
  if (order.status === "confirmed")
    return (
      <div className="flex items-start gap-2.5 rounded-2xl border border-online/40 bg-online/10 p-3.5 text-sm">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-online" />
        <span>
          {order.kind === "pro" ? (
            <>
              <b>Payment received ({order.code}).</b> {proUntil ? `YORU Pro runs until ${shortDay(proUntil)}.` : "YORU Pro is on."}
            </>
          ) : (
            <>
              <b>Your donation arrived ({order.code}).</b> Thank you for supporting YORU.
            </>
          )}
        </span>
      </div>
    );
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-hot/40 bg-hot/10 p-3.5 text-sm">
      <XCircle size={18} className="mt-0.5 shrink-0 text-hot" />
      <span>
        <b>We couldn’t find your e-Transfer {order.code}.</b> If it left your bank, contact support with the code and we’ll sort it out.
      </span>
    </div>
  );
}

function Perk({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm text-ink-2">
      <Check size={16} className="mt-0.5 shrink-0 text-brand" /> <span>{children}</span>
    </li>
  );
}

// YORU Pro: one month per payment, no automatic renewal.
export function ProCheckout({ cfg, orders, isPro, proUntil }: { cfg: ETransferConfig; orders: ETransferOrder[]; isPro: boolean; proUntil: string | null }) {
  const { busy, run } = useAction();
  const waiting = orders.find((o) => o.kind === "pro" && isWaiting(o));
  if (waiting?.status === "open") return <SendPanel order={waiting} cfg={cfg} />;
  if (waiting) return <WaitingPanel order={waiting} cfg={cfg} />;
  const last = orders.find((o) => o.kind === "pro" && (o.status === "confirmed" || o.status === "rejected") && recent(o));

  return (
    <div className="space-y-3">
      {last && <Outcome order={last} proUntil={proUntil} />}
      <div className="card overflow-hidden">
        <div className="relative space-y-5 p-5">
          <div className="pointer-events-none absolute -end-16 -top-20 h-48 w-48 rounded-full bg-brand/20 blur-3xl" aria-hidden />
          <Progress step={0} />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Order summary</div>
              <h2 className="mt-1 flex items-center gap-2 text-xl font-black">
                <Sparkles size={18} className="text-brand" /> YORU Pro
              </h2>
              <div className="text-sm text-ink-2">{isPro ? "One more month" : `${cfg.pro_months} month`}</div>
            </div>
            <div className="shrink-0 text-end">
              <div className="text-3xl font-black tabular-nums">{dollars(cfg.pro_cents)}</div>
              <div className="text-xs font-bold text-muted">{cfg.currency}</div>
            </div>
          </div>
          <ul className="space-y-2">
            <Perk>Every Pro cosmetic, 12 saved looks and the Night Pass streak shield.</Perk>
            <Perk>
              {isPro && proUntil
                ? `Added after your current month, which ends ${shortDay(proUntil)}.`
                : "Starts as soon as your payment is confirmed, usually within a day."}
            </Perk>
            <Perk>Nothing renews by itself. Pay again whenever you want another month.</Perk>
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => rpc("etransfer_start", { p_kind: "pro" }))}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-2 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Landmark size={16} />} Pay {dollars(cfg.pro_cents)} by Interac e-Transfer
          </button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
            <ShieldCheck size={14} /> You pay from your own bank. YORU never sees your bank details.
          </p>
        </div>
      </div>
    </div>
  );
}

const DONATION_CHIPS = [500, 1000, 2000, 5000, 10000];

// Donations: any amount in range, same steps, no Pro attached.
export function DonateCheckout({ cfg, orders }: { cfg: ETransferConfig; orders: ETransferOrder[] }) {
  const { busy, run } = useAction();
  const [pick, setPick] = useState<number | "custom">(1000);
  const [custom, setCustom] = useState("");
  const open = orders.find((o) => o.kind === "donation" && o.status === "open");
  if (open) return <SendPanel order={open} cfg={cfg} />;

  const sent = orders.filter((o) => o.kind === "donation" && o.status === "sent");
  const thanked = orders.find((o) => o.kind === "donation" && o.status === "confirmed" && recent(o));
  const cents = pick === "custom" ? (custom.trim() ? parseDollars(custom) : null) : pick;
  const valid = cents !== null && cents >= cfg.donation_min_cents && cents <= cfg.donation_max_cents;

  return (
    <div className="space-y-3">
      {thanked && <Outcome order={thanked} />}
      {sent.map((o) => (
        <WaitingPanel key={o.id} order={o} cfg={cfg} />
      ))}
      <div className="card overflow-hidden">
        <div className="relative space-y-5 p-5">
          <div className="pointer-events-none absolute -end-16 -top-20 h-48 w-48 rounded-full bg-brand/20 blur-3xl" aria-hidden />
          <Progress step={0} />
          <div className="relative">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Heart size={18} className="text-brand" /> Support YORU
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              YORU is built by one person, with no ads and no third-party tracking. A donation helps keep it running. It’s a thank-you: it
              doesn’t buy anything in the app.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Donation amount">
            {DONATION_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={pick === c}
                onClick={() => setPick(c)}
                className={clsx(
                  "rounded-2xl border py-3 text-base font-black tabular-nums transition-colors",
                  pick === c ? "border-brand bg-brand text-white" : "border-line bg-card-2 hover:border-brand",
                )}
              >
                {roundDollars(c)}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={pick === "custom"}
              onClick={() => setPick("custom")}
              className={clsx(
                "rounded-2xl border py-3 text-sm font-black transition-colors",
                pick === "custom" ? "border-brand bg-brand text-white" : "border-line bg-card-2 hover:border-brand",
              )}
            >
              Custom
            </button>
          </div>
          {pick === "custom" && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Your amount</span>
              <span className="flex items-center gap-2 rounded-2xl border border-line bg-card-2 px-4 py-2.5 focus-within:border-brand">
                <span className="text-xl font-black text-muted">$</span>
                <input
                  id="donation-custom"
                  inputMode="decimal"
                  autoFocus
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="0.00"
                  className="min-w-0 flex-1 bg-transparent text-xl font-black tabular-nums outline-none"
                  aria-label="Donation amount in dollars"
                />
                <span className="text-xs font-bold text-muted">{cfg.currency}</span>
              </span>
              <span className={clsx("mt-1 block text-xs", custom.trim() && !valid ? "font-semibold text-hot" : "text-muted")}>
                Any amount from {roundDollars(cfg.donation_min_cents)} to {roundDollars(cfg.donation_max_cents)}.
              </span>
            </label>
          )}
          <button
            type="button"
            disabled={busy || !valid}
            onClick={() => run(() => rpc("etransfer_start", { p_kind: "donation", p_amount_cents: cents }))}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-2 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} />}{" "}
            {valid && cents !== null ? `Donate ${dollars(cents)}` : "Donate"}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
            <ShieldCheck size={14} /> Sent by Interac e-Transfer from your own bank.
          </p>
        </div>
      </div>
    </div>
  );
}

const STATUS: Record<ETransferOrder["status"], { label: string; cls: string }> = {
  open: { label: "Not sent yet", cls: "bg-card-2 text-muted" },
  sent: { label: "Waiting", cls: "bg-[#f59e0b]/15 text-[#f59e0b]" },
  confirmed: { label: "Confirmed", cls: "bg-online/15 text-online" },
  rejected: { label: "Not found", cls: "bg-hot/15 text-hot" },
  canceled: { label: "Canceled", cls: "bg-card-2 text-muted" },
};

export function PaymentHistory({ orders }: { orders: ETransferOrder[] }) {
  const shown = orders.filter((o) => o.status !== "open" && o.status !== "canceled");
  if (!shown.length) return null;
  return (
    <section className="card p-5">
      <h2 className="mb-2 font-black">Your payments</h2>
      <ul className="divide-y divide-line">
        {shown.map((o) => (
          <li key={o.id} className="flex items-center gap-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card-2 text-brand">
              {o.kind === "pro" ? <Sparkles size={16} /> : <Heart size={16} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">
                {o.kind === "pro" ? "YORU Pro, 1 month" : "Donation"} · <span className="tabular-nums">{dollars(o.amount_cents)}</span>
              </span>
              <span className="block truncate text-xs text-muted">
                <span className="font-mono">{o.code}</span> · {shortDay(o.created_at)}
              </span>
            </span>
            <span className={clsx("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", STATUS[o.status].cls)}>{STATUS[o.status].label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
