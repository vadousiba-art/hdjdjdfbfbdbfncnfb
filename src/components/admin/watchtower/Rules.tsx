"use client";

import { useState } from "react";
import { Bot, FlaskConical, Play, ScrollText } from "lucide-react";
import clsx from "clsx";
import { useRpc } from "@/lib/client/hooks";
import { rpc } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";
import { Button, ChaosLoader, Empty } from "@/components/ui/bits";
import { NW_ACTIONS, NW_ACTION_LABEL, NW_CATEGORIES, NW_LABEL, VERDICT_LABEL } from "@/lib/nightwatch";

type Cat = { action: string; rules: string; threshold: number };
type Config = {
  enabled: boolean;
  test_mode: boolean;
  ai_text: boolean;
  ai_images: boolean;
  auto_dismiss_reports: boolean;
  new_account_hours: number;
  new_account_links: "hold" | "allow";
  max_mentions: number;
  max_links: number;
  duplicate_minutes: number;
  burst_posts: number;
  burst_minutes: number;
  strike_days: number;
  ladder: number[];
  categories: Record<string, Cat>;
  terms: Record<string, string[]>;
};
type TestResult = {
  rules: { verdict: string; category?: string; reason?: string; normalized?: string };
  ai: { classification: { category: string; confidence: number; reason: string } | "refused" | null; decision: { verdict: string } | null } | null;
};

const TERM_LISTS = ["hate", "harassment", "threats", "sexual", "scam", "self_harm", "minors", "minor_signals"];

function Toggle({ label, hint, value, onChange, disabled }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={clsx("flex items-start gap-3 py-3", disabled && "opacity-60")}>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium">{label}</span>
        <span className="block text-[12.5px] text-muted">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={clsx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors", value ? "bg-online" : "bg-line")}
      >
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", value ? "start-[22px]" : "start-0.5")} />
      </button>
    </label>
  );
}

function Num({ label, value, onChange, min, max, suffix, disabled }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; suffix?: string; disabled?: boolean }) {
  return (
    <label className="block text-[12.5px] text-muted">
      {label}
      <span className="mt-1 flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
          className="w-full rounded-lg border border-line bg-card-2 px-2.5 py-1.5 text-[14px] text-ink outline-none focus:border-ink/40"
        />
        {suffix && <span className="shrink-0">{suffix}</span>}
      </span>
    </label>
  );
}

// Rules editor (admins) and test bench (everyone on the team).
export function NwRules({ canEdit }: { canEdit: boolean }) {
  const { toast, toastError } = useApp();
  const { data, error, mutate } = useRpc<Config>("nw_get_config");
  const [draft, setDraft] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [sample, setSample] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  if (error) return <Empty text={error.message} />;
  if (!data) return <ChaosLoader />;
  const c = draft ?? data;
  const set = (patch: Partial<Config>) => setDraft({ ...c, ...patch });
  const setCat = (k: string, patch: Partial<Cat>) => set({ categories: { ...c.categories, [k]: { ...c.categories[k], ...patch } } });

  async function save() {
    setSaving(true);
    try {
      const next = await rpc<Config>("nw_set_config", { p: c });
      await mutate(next, { revalidate: false });
      setDraft(null);
      toast("Rules saved. They apply to the next post.", "success");
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  }
  async function test() {
    setTesting(true);
    try {
      setResult(await rpc<TestResult>("nw_test", { p_text: sample }));
    } catch (err) {
      toastError(err);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line p-4">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold">
          <FlaskConical size={16} /> Test bench
        </h3>
        <p className="mt-0.5 text-[12.5px] text-muted">See what Night Watch would do with some text. Nothing is posted or saved.</p>
        <textarea
          value={sample}
          onChange={(e) => setSample(e.target.value.slice(0, 2000))}
          rows={3}
          placeholder="Paste a post or comment…"
          className="mt-3 w-full resize-none rounded-xl border border-line bg-card-2 px-3 py-2 text-[14px] outline-none focus:border-ink/40"
        />
        <Button className="mt-2" onClick={test} disabled={testing || !sample.trim()}>
          <Play size={14} /> Check
        </Button>
        {result && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-card-2 p-3 text-[13px]">
              <div className="flex items-center gap-1.5 font-semibold">
                <ScrollText size={14} /> Rules: {VERDICT_LABEL[result.rules.verdict] ?? result.rules.verdict}
                {result.rules.category && ` · ${NW_LABEL[result.rules.category] ?? result.rules.category}`}
              </div>
              {result.rules.reason && <p className="mt-1 text-ink-2">{result.rules.reason}</p>}
              {result.rules.normalized && <p className="mt-1 break-all text-[11.5px] text-muted">Read as: {result.rules.normalized}</p>}
            </div>
            <div className="rounded-xl bg-card-2 p-3 text-[13px]">
              <div className="flex items-center gap-1.5 font-semibold">
                <Bot size={14} /> AI:{" "}
                {!result.ai
                  ? "off (no API key)"
                  : result.ai.classification === "refused"
                    ? "declined, would hold for a person"
                    : result.ai.classification
                      ? `${VERDICT_LABEL[result.ai.decision?.verdict ?? "allow"] ?? "Allowed"} · ${NW_LABEL[result.ai.classification.category] ?? "No rule"} ${Math.round(result.ai.classification.confidence * 100)}%`
                      : "unavailable right now"}
              </div>
              {result.ai && result.ai.classification && result.ai.classification !== "refused" && <p className="mt-1 text-ink-2">{result.ai.classification.reason}</p>}
            </div>
          </div>
        )}
      </section>

      {!canEdit && <p className="text-[13px] text-muted">Only admins can change the rules. You can read them and use the test bench.</p>}

      <section className="rounded-2xl border border-line px-4 py-1">
        <div className="divide-y divide-line/70">
          <Toggle disabled={!canEdit} label="Night Watch" hint="The rules engine and AI checks. Child-safety rules always stay on." value={c.enabled} onChange={(v) => set({ enabled: v })} />
          <Toggle disabled={!canEdit} label="Test mode" hint="AI decisions are logged in the queue but not enforced. Rules still apply." value={c.test_mode} onChange={(v) => set({ test_mode: v })} />
          <Toggle disabled={!canEdit} label="AI text review" hint="Checks posts, comments and stories before they post." value={c.ai_text} onChange={(v) => set({ ai_text: v })} />
          <Toggle disabled={!canEdit} label="AI image review" hint="Checks uploaded images. Videos are fingerprinted only." value={c.ai_images} onChange={(v) => set({ ai_images: v })} />
          <Toggle disabled={!canEdit} label="Close clear-cut reports automatically" hint="Removes obvious breaks and dismisses reports the AI is very sure about. Reports about someone at risk always go to a person." value={c.auto_dismiss_reports} onChange={(v) => set({ auto_dismiss_reports: v })} />
        </div>
      </section>

      <section className="rounded-2xl border border-line p-4">
        <h3 className="text-[14px] font-semibold">Rules by category</h3>
        <p className="mt-0.5 text-[12.5px] text-muted">What happens when the AI is at least this sure, and what the word lists do on their own. Close calls are held for a person.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead className="text-left text-[11.5px] text-muted">
              <tr>
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">AI decision</th>
                <th className="pb-2 font-medium">Confidence needed</th>
                <th className="pb-2 font-medium">Word lists</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {NW_CATEGORIES.map((k) => {
                const cat = c.categories[k];
                if (!cat) return null;
                const locked = k === "minors";
                return (
                  <tr key={k}>
                    <td className="py-2 pe-2 font-medium">{NW_LABEL[k]}</td>
                    <td className="py-2 pe-2">
                      <select disabled={!canEdit || locked} value={cat.action} onChange={(e) => setCat(k, { action: e.target.value })} className="rounded-lg border border-line bg-card-2 px-2 py-1">
                        {NW_ACTIONS.map((a) => (
                          <option key={a} value={a}>
                            {NW_ACTION_LABEL[a]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pe-2">
                      <span className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0.3}
                          max={0.99}
                          step={0.01}
                          disabled={!canEdit}
                          value={cat.threshold}
                          onChange={(e) => setCat(k, { threshold: Number(e.target.value) })}
                          aria-label={`${NW_LABEL[k]} confidence`}
                          className="w-28 accent-[var(--ink)]"
                        />
                        <span className="w-9 tabular-nums">{Math.round(cat.threshold * 100)}%</span>
                      </span>
                    </td>
                    <td className="py-2">
                      <select disabled={!canEdit || locked} value={cat.rules} onChange={(e) => setCat(k, { rules: e.target.value })} className="rounded-lg border border-line bg-card-2 px-2 py-1">
                        {NW_ACTIONS.map((a) => (
                          <option key={a} value={a}>
                            {NW_ACTION_LABEL[a]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-3">
        <h3 className="text-[14px] font-semibold sm:col-span-3">Spam and new accounts</h3>
        <Num disabled={!canEdit} label="New account period" value={c.new_account_hours} min={0} max={720} suffix="h" onChange={(v) => set({ new_account_hours: v })} />
        <label className="block text-[12.5px] text-muted">
          Links from new accounts
          <select disabled={!canEdit} value={c.new_account_links} onChange={(e) => set({ new_account_links: e.target.value as "hold" | "allow" })} className="mt-1 w-full rounded-lg border border-line bg-card-2 px-2.5 py-1.5 text-[14px] text-ink">
            <option value="hold">Hold for review</option>
            <option value="allow">Allow</option>
          </select>
        </label>
        <Num disabled={!canEdit} label="Max mentions per post" value={c.max_mentions} min={1} max={50} onChange={(v) => set({ max_mentions: v })} />
        <Num disabled={!canEdit} label="Max links per post" value={c.max_links} min={1} max={20} onChange={(v) => set({ max_links: v })} />
        <Num disabled={!canEdit} label="Duplicate window" value={c.duplicate_minutes} min={0} max={1440} suffix="min" onChange={(v) => set({ duplicate_minutes: v })} />
        <Num disabled={!canEdit} label={`Burst: posts per ${c.burst_minutes} min`} value={c.burst_posts} min={2} max={100} onChange={(v) => set({ burst_posts: v })} />
      </section>

      <section className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-5">
        <h3 className="text-[14px] font-semibold sm:col-span-5">Strikes</h3>
        <Num disabled={!canEdit} label="Strikes last" value={c.strike_days} min={7} max={365} suffix="days" onChange={(v) => set({ strike_days: v })} />
        {c.ladder.map((m, i) => (
          <Num
            key={i}
            disabled={!canEdit}
            label={`Strike ${i + 1}${i === c.ladder.length - 1 ? "+" : ""}: mute`}
            value={m}
            min={0}
            max={43200}
            suffix="min"
            onChange={(v) => set({ ladder: c.ladder.map((x, j) => (j === i ? v : x)) })}
          />
        ))}
      </section>

      <section className="rounded-2xl border border-line p-4">
        <h3 className="text-[14px] font-semibold">Word lists</h3>
        <p className="mt-0.5 text-[12.5px] text-muted">One per line. Spelling tricks (l33t, stretched letters, punctuation) are handled. Start a line with * to also match inside words with spaces removed; use it only for unmistakable terms.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {TERM_LISTS.map((k) => (
            <label key={k} className="block text-[12.5px] font-medium text-ink-2">
              {k === "minor_signals" ? "Age signals (child safety)" : NW_LABEL[k]}
              <textarea
                disabled={!canEdit}
                rows={4}
                value={(c.terms[k] ?? []).join("\n")}
                onChange={(e) => set({ terms: { ...c.terms, [k]: e.target.value.split("\n") } })}
                className="mt-1 w-full resize-y rounded-xl border border-line bg-card-2 px-3 py-2 font-mono text-[12.5px] text-ink outline-none focus:border-ink/40"
              />
            </label>
          ))}
        </div>
      </section>

      {canEdit && (
        <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] flex items-center justify-end gap-2 rounded-2xl border border-line bg-bg/95 p-3 backdrop-blur lg:bottom-4">
          {draft && <span className="me-auto text-[13px] text-amber-500">Unsaved changes</span>}
          <Button variant="outline" disabled={!draft} onClick={() => setDraft(null)}>
            Reset
          </Button>
          <Button disabled={!draft || saving} onClick={save}>
            Save rules
          </Button>
        </div>
      )}
    </div>
  );
}
