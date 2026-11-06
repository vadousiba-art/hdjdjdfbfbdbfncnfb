"use client";

import { useEffect, useState } from "react";
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
