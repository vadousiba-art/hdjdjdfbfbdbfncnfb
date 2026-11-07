"use client";

import { useState } from "react";
import clsx from "clsx";
import { Table2 } from "lucide-react";

// Small, dependency-free charts in the app's own tokens. One axis, thin
// marks, a legend whenever there are two series, hover and keyboard focus
// tooltips, and a table view so no value depends on hovering or on colour.

export const compact = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e4 ? `${Math.round(n / 1e3)}K` : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));
function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = [1, 2, 2.5, 5, 10].find((k) => k * p >= v)!;
  return m * p;
}

export type Series = { key: string; label: string; color: string; values: number[] };

export function StatTile({ label, value, prev, period, suffix }: { label: string; value: number; prev?: number; period?: string; suffix?: string }) {
  const delta = prev === undefined ? null : value - prev;
  return (
    <div className="rounded-xl bg-card-2 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold">{compact(value)}{suffix}</div>
      {delta !== null && (
        <div className="text-[11px] text-muted">
          <span className={clsx("font-semibold", delta > 0 ? "text-online" : delta < 0 ? "text-ink-2" : "")}>{delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {delta > 0 ? "+" : ""}{compact(delta)}</span> vs {period}
        </div>
      )}
    </div>
  );
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="mb-1 flex flex-wrap gap-3 text-[11px] text-ink-2">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5"><span className="h-[3px] w-3 rounded-full" style={{ background: s.color }} />{s.label}</span>
      ))}
    </div>
  );
}

function TableView({ labels, series }: { labels: string[]; series: Series[] }) {
  return (
    <div className="max-h-56 overflow-auto rounded-lg border border-line">
      <table className="w-full text-left text-xs [font-variant-numeric:tabular-nums]">
        <thead className="sticky top-0 bg-card text-muted"><tr><th className="px-2 py-1 font-semibold">When</th>{series.map((s) => <th key={s.key} className="px-2 py-1 text-right font-semibold">{s.label}</th>)}</tr></thead>
        <tbody>{labels.map((l, i) => <tr key={l + i} className="border-t border-line"><td className="px-2 py-1">{l}</td>{series.map((s) => <td key={s.key} className="px-2 py-1 text-right">{s.values[i]}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

// Line chart (one or two series) with a crosshair that snaps to the nearest X.
// Column chart when `bars` (single series only).
export function TimeChart({ labels, series, bars, height = 150, title }: { labels: string[]; series: Series[]; bars?: boolean; height?: number; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const W = 600, H = height, L = 30, B = 18, T = 8;
  const n = labels.length;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const x = (i: number) => L + ((W - L - 6) * (bars ? i + 0.5 : i)) / (bars ? n : Math.max(1, n - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, max / 2, max];
  const bw = Math.min(24, ((W - L) / n) * 0.62);
  const empty = series.every((s) => s.values.every((v) => v === 0));
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <Legend series={series} />
        <button type="button" onClick={() => setTable(!table)} className="ms-auto inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-ink" aria-pressed={table}>
          <Table2 size={12} /> {table ? "Chart" : "Table"}
        </button>
      </div>
      {table ? <TableView labels={labels} series={series} /> : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${title}. ${empty ? "No activity yet." : "Use the table view for exact values."}`}
            onPointerLeave={() => setHover(null)}
            onPointerMove={(e) => {
              const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * W;
              let best = 0;
              for (let i = 1; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
              setHover(best);
            }}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} strokeWidth="1" />
                <text x={L - 5} y={y(t) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{compact(t)}</text>
              </g>
            ))}
            {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
              <text key={i} x={x(i)} y={H - 4} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="9" fill="var(--muted)">{labels[i]}</text>
            ))}
            {bars
              ? series[0].values.map((v, i) => {
                  const h = Math.max(0, y(0) - y(v));
                  const r = Math.min(4, h / 2, bw / 2);
                  return (
                    <path key={i} tabIndex={0} aria-label={`${labels[i]}: ${v}`} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                      d={h <= 0 ? "" : `M${x(i) - bw / 2},${y(0)} V${y(v) + r} Q${x(i) - bw / 2},${y(v)} ${x(i) - bw / 2 + r},${y(v)} H${x(i) + bw / 2 - r} Q${x(i) + bw / 2},${y(v)} ${x(i) + bw / 2},${y(v) + r} V${y(0)} Z`}
                      fill={series[0].color} opacity={hover === null || hover === i ? 1 : 0.55} className="outline-none" />
                  );
                })
              : series.map((s) => (
                  <g key={s.key}>
                    {series.length === 1 && <path d={`M${x(0)},${y(0)} ${s.values.map((v, i) => `L${x(i)},${y(v)}`).join(" ")} L${x(n - 1)},${y(0)} Z`} fill={s.color} opacity="0.1" />}
                    <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    <circle cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r="4" fill={s.color} stroke="var(--card)" strokeWidth="2" />
                  </g>
                ))}
            {hover !== null && !bars && (
              <>
                <line x1={x(hover)} x2={x(hover)} y1={T} y2={y(0)} stroke="var(--muted)" strokeWidth="1" />
                {series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r="4" fill={s.color} stroke="var(--card)" strokeWidth="2" />)}
              </>
            )}
          </svg>
          {hover !== null && (
            <div className="pointer-events-none absolute top-0 z-10 min-w-24 rounded-lg border border-line bg-card px-2 py-1.5 text-xs shadow-lg"
              style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${x(hover) > W / 2 ? "-105%" : "5%"})` }}>
              <div className="text-[10px] text-muted">{labels[hover]}</div>
              {series.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5"><span className="h-[3px] w-2.5 rounded-full" style={{ background: s.color }} /><b>{s.values[hover]}</b><span className="text-muted">{s.label}</span></div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Horizontal bars, sorted, value at the tip (categories with long names).
export function BarList({ rows, color = "var(--viz-1)", unit = "" }: { rows: { label: string; value: number; hint?: string }[]; color?: string; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-xs" title={r.hint}>
          <span className="truncate text-ink-2">{r.label}</span>
          <span className="h-3 rounded-e-[4px]" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color, maxWidth: "100%" }} />
          <span className="font-semibold [font-variant-numeric:tabular-nums]">{r.value}{unit}</span>
        </li>
      ))}
    </ul>
  );
}

// Posting days over 12 weeks: one sequential hue, posted vs not, with labels.
export function DayGrid({ days, weeks = 12 }: { days: Set<string>; weeks?: number }) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks * 7 - 1) - ((start.getDay() + 6) % 7 === 6 ? 0 : 0));
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = d.toISOString().slice(0, 10);
    return { k, on: days.has(k), d };
  });
  return (
    <div>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label={`${days.size} posting days in the last ${weeks} weeks`}>
        {cells.map((c) => (
          <span key={c.k} title={`${c.d.toLocaleDateString()}: ${c.on ? "posted" : "no posts"}`} className="aspect-square rounded-[3px]"
            style={{ background: c.on ? "var(--viz-seq-2)" : "var(--viz-seq-0)" }} />
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--viz-seq-0)" }} /> No posts
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--viz-seq-2)" }} /> Posted
      </div>
    </div>
  );
}
