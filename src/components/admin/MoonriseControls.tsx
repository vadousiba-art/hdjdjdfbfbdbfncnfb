"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useShell } from "@/components/shell/AppShell";
import { motion } from "motion/react";
import { useSWRConfig } from "swr";
import { byFn, useRpc } from "@/lib/client/hooks";
import { rpc } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";
import { Button, ChaosLoader, Toggle } from "@/components/ui/bits";
import { MOON_PHASES, MoonGlyph } from "@/components/moon/MoonGlyph";

// Watchtower -> Controls: Moonrise's switch and numbers (docs/MOONRISE.md).

type Admin = {
  enabled: boolean;
  config: { sizes: number[]; quotas: number[]; starter: number[]; second_night: boolean; slots: number };
  phases: Record<string, number>;
  open: number;
  decided_week: number;
  moved_up_week: number;
};

const field = "w-full rounded-xl border border-line bg-card-2 px-3 py-2 text-sm tabular-nums text-ink outline-none focus:border-brand";

// The Night Crew (migration 0018): labeled YORU bot accounts that like new
// posts and follow members. The owner sets how many there are, creates them
// (names and bios by Gemini), and unleashes them.
type Crew = {
  enabled: boolean;
  max_likes: number;
  follows: number;
  chance: number;
  likes_week: number;
  follows_total: number;
  crew: { id: string; username: string; display_name: string; bio: string; active: boolean }[];
};

export function NightCrew() {
  const { toast, toastError } = useApp();
  const { me } = useShell();
  const owner = me.role === "owner";
  const { data, mutate } = useRpc<Crew>("admin_get_crew");
  const [add, setAdd] = useState("5");
  const [busy, setBusy] = useState<string | null>(null);
  if (!data) return null;
  const active = data.crew.filter((c) => c.active).length;

  async function run<T>(key: string, job: () => Promise<T>, done: (r: T) => string) {
    setBusy(key);
    try {
      const r = await job();
      toast(done(r), "success", "🌙");
      mutate();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(null);
    }
  }
  const set = (p: Record<string, unknown>) => run("set", () => rpc<Crew>("admin_set_crew", { p }), () => "Saved.");
  const create = () =>
    run(
      "add",
      async () => {
        const res = await fetch("/api/crew", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ count: Number(add) }) });
        const j = await res.json().catch(() => null);
        if (!res.ok) throw new Error(j?.error?.message ?? "Couldn't add them.");
        return (j?.data ?? j) as { added: number; by: string };
      },
      (r) => `Added ${r.added} to the Night Crew${r.by === "gemini" ? ", written by Gemini" : ""}.`,
    );
  const unleash = () =>
    run("unleash", () => rpc<{ liked?: number; followed?: number }>("admin_unleash_crew"), (r) => `Unleashed: ${r.liked ?? 0} likes, ${r.followed ?? 0} follows.`);

  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Night Crew</h3>
          <p className="text-xs text-muted">
            YORU bot accounts, always labeled as bots, that like new posts at random times and follow members. {active} active of {data.crew.length}
            {" · "}
            {data.likes_week} likes this week · {data.follows_total} follows.
          </p>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          disabled={!owner || busy !== null || !data.enabled || active === 0}
          onClick={unleash}
          className="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-[0_0_24px_rgb(225_29_72/0.35)] disabled:opacity-40"
        >
          {busy === "unleash" ? "Unleashing…" : "Unleash now"}
        </motion.button>
      </div>
      <Toggle checked={data.enabled} onChange={(v) => owner && set({ enabled: v })} label="Night Crew is on" description="Runs every 10 minutes. Unleash fills every post's and member's quota at once." />
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-muted">
          Likes per post (max)
          <input className={field} type="number" min={1} max={50} defaultValue={data.max_likes} disabled={!owner} onBlur={(e) => Number(e.target.value) !== data.max_likes && set({ max_likes: Number(e.target.value) })} />
        </label>
        <label className="text-xs text-muted">
          Follows per member
          <input className={field} type="number" min={0} max={50} defaultValue={data.follows} disabled={!owner} onBlur={(e) => Number(e.target.value) !== data.follows && set({ follows: Number(e.target.value) })} />
        </label>
        <label className="text-xs text-muted">
          Activity (% per run)
          <input className={field} type="number" min={5} max={100} defaultValue={Math.round(data.chance * 100)} disabled={!owner} onBlur={(e) => Number(e.target.value) !== Math.round(data.chance * 100) && set({ chance: Number(e.target.value) / 100 })} />
        </label>
      </div>
      <div className="flex items-end gap-2">
        <label className="w-24 text-xs text-muted">
          How many
          <input className={field} type="number" min={1} max={50} value={add} disabled={!owner} onChange={(e) => setAdd(e.target.value.replace(/[^0-9]/g, ""))} />
        </label>
        <Button variant="outline" disabled={!owner || busy !== null || !(Number(add) >= 1 && Number(add) <= 50)} onClick={create}>
          {busy === "add" ? "Creating…" : "Create bots with Gemini"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {data.crew.map((c) => (
          <button
            key={c.id}
            type="button"
            title={`${c.bio}\n@${c.username} · tap to ${c.active ? "pause" : "wake"}`}
            disabled={!owner || busy !== null}
            onClick={() => run("member", () => rpc("admin_set_crew_member", { p_id: c.id, p_active: !c.active }), () => (c.active ? `${c.display_name} is resting.` : `${c.display_name} is back.`))}
            className={clsx("rounded-full border px-2.5 py-1 text-xs transition", c.active ? "border-brand/50 text-ink" : "border-line text-muted line-through")}
          >
            🌙 {c.display_name.replace(/ · Night Crew$/, "")}
          </button>
        ))}
      </div>
      {!owner && <p className="text-xs text-muted">Only the owner can change or unleash the Night Crew.</p>}
    </div>
  );
}

export function MoonriseControls() {
  const { toast, toastError } = useApp();
  const { mutate: mutateAll } = useSWRConfig();
  const { data, mutate } = useRpc<Admin>("admin_get_moonrise");
  const [sizes, setSizes] = useState(["20", "100", "500"]);
  const [quotas, setQuotas] = useState(["40", "25", "15", "5"]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setSizes(data.config.sizes.map(String));
    setQuotas(data.config.quotas.map((q) => String(Math.round(q * 1000) / 10)));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data]);

  if (!data) return <ChaosLoader />;

  async function save(p: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      const next = await rpc<Admin>("admin_set_moonrise", { p });
      mutate(next, { revalidate: false });
      mutateAll(byFn("get_moonrise"));
      toast(msg, "success", "🌕");
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }

  const numbers = () =>
    save(
      { sizes: sizes.map((x) => Math.round(Number(x))), quotas: quotas.map((x) => Number(x) / 100) },
      "Moonrise numbers saved.",
    );

  return (
    <section className="card space-y-4 p-4">
      <div className="flex items-start gap-3">
        <div className="flex -space-x-1.5 pt-0.5" aria-hidden>
          {MOON_PHASES.map((_, i) => (
            <motion.span key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
              <MoonGlyph phase={i} size={20} glow={data.enabled && i >= 3} />
            </motion.span>
          ))}
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold">Moonrise</h2>
          <p className="text-xs text-muted">
            Every new post is shown to a small audience of strangers who like that kind of thing. If they love it, it goes to more people: 20,
            then 100, then 500, then its whole fandom, then everyone. Off: For You is the trending feed as before.
          </p>
        </div>
      </div>

      <Toggle
        checked={data.enabled}
        onChange={(v) => save({ enabled: v }, v ? "Moonrise is on. The last day's posts are in." : "Moonrise is off.")}
        label="Moonrise is on"
        description="Turning it on brings in the last 24 hours of posts."
      />

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Open tests" value={data.open} />
        <Stat label="Decided this week" value={data.decided_week} />
        <Stat label="Moved up this week" value={data.moved_up_week} />
      </div>
      <div className="flex flex-wrap gap-2">
        {MOON_PHASES.map((name, i) => (
          <span key={name} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs">
            <MoonGlyph phase={i} size={14} /> {name} <b className="tabular-nums">{data.phases[String(i)] ?? 0}</b>
          </span>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Audience sizes</p>
        <div className="grid grid-cols-3 gap-2">
          {["New Moon", "Crescent", "Half Moon"].map((label, i) => (
            <label key={label} className="text-xs text-muted">
              {label}
              <input
                className={field}
                inputMode="numeric"
                value={sizes[i]}
                onChange={(e) => setSizes((s) => s.map((x, j) => (j === i ? e.target.value.replace(/[^0-9]/g, "") : x)))}
              />
            </label>
          ))}
        </div>
        <p className="text-sm font-semibold">Share that moves up (%)</p>
        <div className="grid grid-cols-4 gap-2">
          {["New Moon", "Crescent", "Half Moon", "Full Moon"].map((label, i) => (
            <label key={label} className="text-xs text-muted">
              {label}
              <input
                className={field}
                inputMode="decimal"
                value={quotas[i]}
                onChange={(e) => setQuotas((s) => s.map((x, j) => (j === i ? e.target.value.replace(/[^0-9.]/g, "") : x)))}
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">
          Until a phase has 20 results in a week it uses starter bars ({data.config.starter.map((x) => `${Math.round(x * 100)}%`).join(" / ")}).
        </p>
        <Button onClick={numbers} disabled={busy} variant="outline">
          Save numbers
        </Button>
      </div>

      <Toggle
        checked={data.config.second_night}
        onChange={(v) => save({ second_night: v }, v ? "Second Night is on." : "Second Night is off.")}
        label="Second Night"
        description="A post that misses New Moon gets one more try the next night, with new people. The better result counts."
      />
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          Moonrise posts per page
          <span className="block text-xs text-muted">Placed 3rd and 8th in For You.</span>
        </span>
        <select
          className="rounded-xl border border-line bg-card-2 px-3 py-2 text-sm"
          value={data.config.slots}
          onChange={(e) => save({ slots: Number(e.target.value) }, "Saved.")}
        >
          {[0, 1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <NightCrew />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line/80 bg-card-2 px-2 py-2">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
