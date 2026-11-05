"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, Landmark, RotateCcw, XCircle } from "lucide-react";
import clsx from "clsx";
import { rpc } from "@/lib/client/api";
import { useRpc } from "@/lib/client/hooks";
import { useApp } from "@/components/providers/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { ChaosLoader, Empty, TimeAgo } from "@/components/ui/bits";
import { dollars, parseDollars, reconcile, type Reconcile } from "@/lib/billing/etransfer";
import { refreshETransfers, type ETransferOrder } from "@/lib/client/etransfer";
import type { ProfileLite } from "@/lib/types";

// Watchtower → Payments (owner only). The owner types in what arrived in their
// bank each day; this works out whose e-Transfers that total is made of, using
// each order's own exact amount. Nothing is confirmed until the owner taps it.

type AdminOrder = ETransferOrder & { user: ProfileLite | null; is_pro: boolean };
type Day = { day: string; total_cents: number; note: string; confirmed_cents: number; confirmed_count: number; updated_at: string };

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const endOfLocalDay = (day: string) => new Date(`${day}T23:59:59.999`).getTime();
const niceDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

export function AdminPayments() {
  const { toast, toastError } = useApp();
  const { data: orders, error } = useRpc<AdminOrder[]>("etransfer_admin_orders", {}, { refreshInterval: 60_000 });
  const { data: days } = useRpc<Day[]>("etransfer_days", {});
  const [day, setDay] = useState(localToday());
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const saved = days?.find((d) => d.day === day);
  const typed = amount.trim() ? parseDollars(amount) : null;
  const total = typed ?? saved?.total_cents ?? null;
  const confirmedThatDay = (orders ?? []).filter((o) => o.status === "confirmed" && o.matched_day === day).reduce((s, o) => s + o.amount_cents, 0);
  // the payments that could be in that day's deposits: waiting, and started by the end of that day
  const waiting = (orders ?? []).filter((o) => (o.status === "open" || o.status === "sent") && Date.parse(o.created_at) <= endOfLocalDay(day));
  const result =
    total === null || total - confirmedThatDay < 0
      ? null
      : reconcile(total - confirmedThatDay, waiting.map((o) => ({ id: o.id, amount: o.amount_cents, base: o.base_cents })));

  if (error) return <Empty emoji="🏦" text={error.message} />;
  if (!orders || !days) return <ChaosLoader />;
  const byId = new Map(orders.map((o) => [o.id, o]));
  const allWaiting = orders.filter((o) => o.status === "open" || o.status === "sent");
  const decided = orders.filter((o) => o.status === "confirmed" || o.status === "rejected");

  async function run(fn: string, args: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      await rpc(fn, args);
      toast(msg, "success", "✅");
      await refreshETransfers();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }
  const confirm = (ids: string[], forDay: string | null) =>
    run("etransfer_confirm", { p_ids: ids, p_day: forDay }, `${ids.length} payment${ids.length === 1 ? "" : "s"} confirmed.`);

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Landmark size={18} className="text-brand" />
          <h2 className="text-lg font-black">Daily check</h2>
        </div>
        <p className="text-sm text-ink-2">
          Enter everything that arrived by e-Transfer on a day. YORU works out whose payments that is from their exact amounts.
        </p>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (typed === null) return;
            await run("etransfer_set_day", { p_day: day, p_total_cents: typed }, `Saved ${dollars(typed)} for ${niceDay(day)}.`);
            setAmount("");
          }}
        >
          <label>
            <span className="mb-1 block text-xs font-semibold">Day</span>
            <input
              id="payments-day"
              type="date"
              value={day}
              max={localToday()}
              onChange={(e) => setDay(e.target.value || localToday())}
              className="rounded-xl border border-line bg-card-2 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold">Received that day ($)</span>
            <input
              id="payments-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={saved ? (saved.total_cents / 100).toFixed(2) : "0.00"}
              className="w-36 rounded-xl border border-line bg-card-2 px-3 py-2 text-sm font-bold tabular-nums outline-none focus:border-brand"
            />
          </label>
          <button type="submit" disabled={busy || typed === null} className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            Save
          </button>
          {amount.trim() && typed === null ? <span className="text-xs font-semibold text-hot">Enter an amount like 17.52</span> : null}
        </form>
        {saved && !amount.trim() ? (
          <p className="text-xs text-muted">
            Saved for {niceDay(day)}: {dollars(saved.total_cents)}
            {confirmedThatDay ? `, of which ${dollars(confirmedThatDay)} is already confirmed` : ""}.
          </p>
        ) : null}
        {total !== null && total - confirmedThatDay < 0 ? (
          <Banner tone="bad" icon={<AlertTriangle size={18} />}>
            You’ve confirmed {dollars(confirmedThatDay)} for {niceDay(day)}, more than the {dollars(total)} received. Undo the confirmations that didn’t arrive.
          </Banner>
        ) : null}
        {result ? <CheckResult result={result} day={day} confirmed={confirmedThatDay} byId={byId} busy={busy} onConfirm={confirm} onReject={(id) => run("etransfer_reject", { p_id: id }, "Marked as not received.")} /> : null}
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-black">Waiting ({allWaiting.length})</h2>
        {allWaiting.length === 0 ? (
          <p className="text-sm text-muted">Nobody is waiting for a payment to be confirmed.</p>
        ) : (
          <ul className="divide-y divide-line">
            {allWaiting.map((o) => (
              <OrderRow key={o.id} o={o}>
                <button disabled={busy} onClick={() => confirm([o.id], null)} className="rounded-full bg-online px-3 py-1 text-xs font-bold text-black disabled:opacity-50">
                  Confirm
                </button>
                <button disabled={busy} onClick={() => run("etransfer_reject", { p_id: o.id }, "Marked as not received.")} className="rounded-full border border-line px-3 py-1 text-xs font-bold disabled:opacity-50">
                  Not received
                </button>
              </OrderRow>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-black">Recent decisions</h2>
        {decided.length === 0 ? (
          <p className="text-sm text-muted">Nothing confirmed or rejected yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {decided.slice(0, 40).map((o) => (
              <OrderRow key={o.id} o={o}>
                <button disabled={busy} onClick={() => run("etransfer_undo", { p_id: o.id }, "Back to waiting.")} className="flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-bold disabled:opacity-50">
                  <RotateCcw size={12} /> Undo
                </button>
              </OrderRow>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-black">Days</h2>
        {days.length === 0 ? (
          <p className="text-sm text-muted">No days entered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1 pr-3 font-semibold">Day</th>
                  <th className="py-1 pr-3 font-semibold">Received</th>
                  <th className="py-1 pr-3 font-semibold">Confirmed</th>
                  <th className="py-1 font-semibold">Difference</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const diff = d.total_cents - d.confirmed_cents;
                  return (
                    <tr key={d.day} className="cursor-pointer border-t border-line hover:bg-card-2" onClick={() => setDay(d.day)}>
                      <td className="py-1.5 pr-3">{niceDay(d.day)}</td>
                      <td className="py-1.5 pr-3">{dollars(d.total_cents)}</td>
                      <td className="py-1.5 pr-3">
                        {dollars(d.confirmed_cents)} <span className="text-muted">({d.confirmed_count})</span>
                      </td>
                      <td className={clsx("py-1.5 font-bold", diff === 0 ? "text-online" : "text-hot")}>{diff === 0 ? "Matches" : dollars(diff)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Banner({ tone, icon, children }: { tone: "good" | "warn" | "bad"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        "flex gap-2.5 rounded-2xl border p-3 text-sm",
        tone === "good" && "border-online/50 bg-online/10",
        tone === "warn" && "border-[#f59e0b]/50 bg-[#f59e0b]/10",
        tone === "bad" && "border-hot/50 bg-hot/10",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}

function CheckResult({
  result: r,
  day,
  confirmed,
  byId,
  busy,
  onConfirm,
  onReject,
}: {
  result: Reconcile;
  day: string;
  confirmed: number;
  byId: Map<string, AdminOrder>;
  busy: boolean;
  onConfirm: (ids: string[], day: string) => void;
  onReject: (id: string) => void;
}) {
  const list = (ids: string[]) => ids.map((id) => byId.get(id)).filter((o): o is AdminOrder => Boolean(o));
  const sum = (ids: string[], atBase: string[] = []) =>
    list(ids).reduce((s, o) => s + (atBase.includes(o.id) ? o.base_cents : o.amount_cents), 0);
  const plain = r.plainPrice ? (
    <p className="text-xs text-ink-2">
      This only adds up if someone sent the plain price instead of their exact amount. A plain {dollars(599)} can’t show whose it was, so check the
      reference codes in your deposit messages.
    </p>
  ) : null;

  // r.total is what's left of the day's total after the payments already confirmed for that day
  const left = confirmed > 0 ? `The other ${dollars(r.total)}` : dollars(r.total);
  const waitingCount = r.paid.length + r.unpaid.length + r.unsure.length;

  if (r.status === "empty")
    return (
      <Banner tone="good" icon={<CheckCircle2 size={18} />}>
        {confirmed > 0 ? `Everything received on ${niceDay(day)} is confirmed, and nobody else is waiting. All square.` : "Nothing waiting and nothing received. All square."}
      </Banner>
    );
  if (r.status === "too_big")
    return (
      <Banner tone="warn" icon={<CircleHelp size={18} />}>
        Too many payments are waiting to work this out at once. Confirm them one by one from the reference codes in your deposit messages.
      </Banner>
    );

  if (r.status === "none" && waitingCount === 0)
    return (
      <Banner tone="bad" icon={<XCircle size={18} />}>
        <p className="font-bold">
          {left} didn’t come from anyone waiting: nobody has a payment waiting for {niceDay(day)}.
        </p>
        <p>It may be money sent without a checkout, or a payment you already confirmed on another day. Check the reference code in your deposit messages.</p>
      </Banner>
    );
  if (r.status === "none")
    return (
      <div className="space-y-2">
        <Banner tone="bad" icon={<XCircle size={18} />}>
          <p className="font-bold">No combination of waiting payments adds up to {confirmed > 0 ? `the other ${dollars(r.total)}` : dollars(r.total)}.</p>
          <p>
            Someone may have sent a different amount, or money came in from outside a checkout (for example a donation sent without the button).
            {r.under ? ` The nearest below is ${dollars(r.under.sum)} (${r.under.ids.length} payment${r.under.ids.length === 1 ? "" : "s"}).` : ""}
            {r.over ? ` The nearest above is ${dollars(r.over.sum)}.` : ""} Match the reference codes in your deposit messages and confirm one by one below.
          </p>
        </Banner>
        <People title="Waiting" ids={r.unsure} list={list} busy={busy} day={day} onConfirm={onConfirm} onReject={onReject} />
      </div>
    );

  const allPaid = r.unpaid.length === 0 && r.unsure.length === 0;
  return (
    <div className="space-y-3">
      {r.status === "exact" ? (
        <Banner tone={allPaid ? "good" : "warn"} icon={allPaid ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}>
          <p className="font-bold">
            {allPaid
              ? `It matches. ${r.paid.length} payment${r.paid.length === 1 ? " adds" : "s add"} up to exactly ${confirmed > 0 ? `the other ${dollars(r.total)}` : dollars(r.total)}.`
              : r.paid.length === 0
                ? confirmed > 0
                  ? `Everything received on ${niceDay(day)} is confirmed. The ${r.unpaid.length} still waiting ${r.unpaid.length === 1 ? "wasn’t" : "weren’t"} in it.`
                  : `Nothing arrived on ${niceDay(day)}, so none of the ${r.unpaid.length} waiting payment${r.unpaid.length === 1 ? "" : "s"} came in.`
                : `${left} is exactly ${r.paid.length} of the ${r.paid.length + r.unpaid.length} waiting payments. ${r.unpaid.length} didn’t arrive.`}
          </p>
          {plain}
        </Banner>
      ) : (
        <Banner tone="warn" icon={<CircleHelp size={18} />}>
          <p className="font-bold">
            {left} can be made {r.ways >= 1000 ? "many" : r.ways} different ways from the waiting payments.
          </p>
          <p>
            {r.paid.length ? `${r.paid.length} are in every one of them, so they definitely paid. ` : ""}
            Check the reference codes of the ones marked “check” in your deposit messages, then confirm them one by one.
          </p>
          {plain}
        </Banner>
      )}
      {r.paid.length > 0 && (
        <People
          title={`Paid (${dollars(sum(r.paid, r.atBase))})`}
          tone="good"
          ids={r.paid}
          atBase={r.atBase}
          list={list}
          busy={busy}
          day={day}
          onConfirm={onConfirm}
          onReject={onReject}
          confirmAll
        />
      )}
      {r.unsure.length > 0 && <People title="Check the reference code" tone="warn" ids={r.unsure} list={list} busy={busy} day={day} onConfirm={onConfirm} onReject={onReject} />}
      {r.unpaid.length > 0 && <People title="Didn't pay (no Pro yet)" tone="bad" ids={r.unpaid} list={list} busy={busy} day={day} onConfirm={onConfirm} onReject={onReject} />}
    </div>
  );
}

function People({
  title,
  tone,
  ids,
  atBase = [],
  list,
  busy,
  day,
  onConfirm,
  onReject,
  confirmAll,
}: {
  title: string;
  tone?: "good" | "warn" | "bad";
  ids: string[];
  atBase?: string[];
  list: (ids: string[]) => AdminOrder[];
  busy: boolean;
  day: string;
  onConfirm: (ids: string[], day: string) => void;
  onReject: (id: string) => void;
  confirmAll?: boolean;
}) {
  const rows = list(ids);
  return (
    <div className={clsx("rounded-2xl border p-3", tone === "good" ? "border-online/40" : tone === "warn" ? "border-[#f59e0b]/40" : tone === "bad" ? "border-hot/40" : "border-line")}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black">{title}</h3>
        {confirmAll && rows.length > 0 ? (
          <button disabled={busy} onClick={() => onConfirm(ids, day)} className="rounded-full bg-online px-3.5 py-1.5 text-xs font-black text-black disabled:opacity-50">
            Confirm {rows.length === 1 ? "this payment" : `all ${rows.length}`}
          </button>
        ) : null}
      </div>
      <ul className="divide-y divide-line">
        {rows.map((o) => (
          <OrderRow key={o.id} o={o} plain={atBase.includes(o.id)}>
            {!confirmAll && (
              <button disabled={busy} onClick={() => onConfirm([o.id], day)} className="rounded-full bg-online px-3 py-1 text-xs font-bold text-black disabled:opacity-50">
                Confirm
              </button>
            )}
            <button disabled={busy} onClick={() => onReject(o.id)} className="rounded-full border border-line px-3 py-1 text-xs font-bold disabled:opacity-50">
              Not received
            </button>
          </OrderRow>
        ))}
      </ul>
    </div>
  );
}

const STATUS: Record<ETransferOrder["status"], string> = {
  open: "hasn't tapped \"I've sent it\"",
  sent: "says it's sent",
  confirmed: "confirmed",
  rejected: "not received",
  canceled: "canceled",
};

function OrderRow({ o, plain, children }: { o: AdminOrder; plain?: boolean; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
      <Avatar src={o.user?.avatar_url ?? null} name={o.user?.display_name ?? "Deleted member"} size={32} />
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex flex-wrap items-center gap-x-1.5">
          <b className="truncate">{o.user?.display_name ?? "Deleted member"}</b>
          {o.user ? <span className="text-muted">@{o.user.username}</span> : null}
          <span className={clsx("rounded-full px-1.5 text-[10px] font-bold uppercase", o.is_pro ? "bg-brand text-white" : "bg-card-2 text-muted")}>
            {o.is_pro ? "Pro" : "No Pro"}
          </span>
        </div>
        <div className="text-xs text-ink-2">
          {o.kind === "pro" ? "Pro" : "Donation"} · <b className="tabular-nums">{dollars(o.amount_cents)}</b>
          {plain ? <span className="text-muted"> (sent {dollars(o.base_cents)})</span> : null} · <span className="font-mono">{o.code}</span>
          {o.sender_name ? <> · bank name &ldquo;{o.sender_name}&rdquo;</> : null} · {STATUS[o.status]} · <TimeAgo iso={o.sent_at ?? o.created_at} />
          {o.matched_day ? <> · day {niceDay(o.matched_day)}</> : null}
        </div>
      </div>
      <div className="flex gap-1.5">{children}</div>
    </li>
  );
}
