"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { Play, Volume2 } from "lucide-react";
import type {
  BadgeP, BannerP, BoardP, ChatP, CollectionP, DraftP, EffectP, FeedP, HubP, HubViewP, LabP, LayoutP, MilestoneP,
  NameplateP, PlannerP, ReactionP, RingP, SoundP, ThemeP,
} from "@/lib/pro/catalog";
import type { Item } from "@/lib/pro/types";
import { SET_BY_ID } from "@/lib/pro/sets";
import { Avatar } from "@/components/ui/Avatar";
import { burst } from "@/components/ui/EmojiBurst";
import { playSound } from "@/lib/client/pro-fx";
import { RingOverlay } from "./art/Ring";
import { BannerArt } from "./art/Banner";
import { BadgeArt, CoverArt, MilestoneEmblem, Nameplate } from "./art/Marks";
import { AmbientEffect, TransitionFlash } from "./art/Effects";

// One preview for any catalog item. `big` is the detail view; small is the
// catalog card. Previews are purely visual: they never equip or unlock.

export function RingAvatar({ ring, size, src, name, still }: { ring?: RingP; size: number; src?: string | null; name: string; still?: boolean }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <Avatar src={src} name={name} size={size} />
      {ring && <RingOverlay p={ring} size={size} still={still} />}
    </div>
  );
}

function ThemeSwatch({ t }: { t: ThemeP }) {
  const brand = `hsl(${t.hue}, 90%, ${t.mode === "dark" ? 50 : 44}%)`;
  return (
    <div className="h-full w-full p-2" style={{ background: t.bg }}>
      <div className="h-full rounded-lg border p-2" style={{ background: t.card, borderColor: t.line }}>
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full" style={{ background: brand }} />
          <div className="h-2 w-14 rounded" style={{ background: t.ink }} />
        </div>
        <div className="mt-2 h-1.5 w-[85%] rounded" style={{ background: t.ink2, opacity: 0.8 }} />
        <div className="mt-1 h-1.5 w-[60%] rounded" style={{ background: t.muted }} />
        <div className="mt-2 flex gap-1">
          <div className="h-4 w-10 rounded-full" style={{ background: brand }} />
          <div className="h-4 w-8 rounded-full" style={{ background: t.card2, border: `1px solid ${t.line}` }} />
        </div>
      </div>
    </div>
  );
}

// The chat theme's background (colour plus a light pattern), also used in chat.
export function chatBackground(c: ChatP) {
  const pattern: Record<string, string> = {
    static: "radial-gradient(rgba(255,255,255,.07) 1px, transparent 1.5px) 0 0/5px 5px",
    grid: `linear-gradient(${c.accent}22 1px, transparent 1px) 0 0/16px 16px, linear-gradient(90deg, ${c.accent}22 1px, transparent 1px) 0 0/16px 16px`,
    lines: "repeating-linear-gradient(0deg, rgba(0,0,0,.06) 0 1px, transparent 1px 18px)",
    stars: "radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 60%, #fff, transparent), radial-gradient(1.5px 1.5px at 40% 80%, #fff, transparent)",
    dust: `radial-gradient(1px 1px at 15% 25%, ${c.accent}, transparent), radial-gradient(1px 1px at 65% 45%, ${c.accent}, transparent), radial-gradient(1px 1px at 35% 75%, #fff, transparent), radial-gradient(1px 1px at 85% 85%, ${c.accent}, transparent)`,
    rain: `repeating-linear-gradient(100deg, ${c.accent}18 0 1px, transparent 1px 10px)`,
    petals: `radial-gradient(ellipse 5px 3px at 20% 20%, ${c.accent}88, transparent), radial-gradient(ellipse 5px 3px at 75% 70%, ${c.accent}88, transparent)`,
    smoke: `radial-gradient(120% 50% at 50% 110%, ${c.accent}33, transparent)`,
    pixel: `conic-gradient(${c.accent}14 25%, transparent 0 50%, ${c.accent}0d 0 75%, transparent 0) 0 0/10px 10px`,
    mist: "radial-gradient(80% 40% at 30% 50%, rgba(255,255,255,.07), transparent)",
    glass: "linear-gradient(135deg, rgba(255,255,255,.06), transparent 40%)",
    moon: `radial-gradient(circle at 85% 15%, ${c.accent}55 0 14px, transparent 15px)`,
    lotus: `radial-gradient(ellipse 30px 14px at 80% 85%, ${c.accent}22, transparent)`,
    torii: `linear-gradient(${c.accent}22, ${c.accent}22) 70% 20%/40px 3px no-repeat, radial-gradient(circle at 75% 25%, #ffffff22 0 18px, transparent 19px)`,
    none: "none",
  };
  return pattern[c.pattern] === "none" ? c.bg : `${pattern[c.pattern]}, ${c.bg}`;
}

function ChatSwatch({ c, big }: { c: ChatP; big?: boolean }) {
  return (
    <div className={clsx("flex h-full w-full flex-col justify-center gap-1.5 p-3", big && "gap-2 p-5")} data-chat-theme="preview" style={{ background: chatBackground(c), "--chat-me": c.me, "--chat-them": c.them } as React.CSSProperties}>
      <div className="max-w-[75%] self-start rounded-2xl rounded-bl-md px-3 py-1.5 text-xs" style={{ background: c.them, color: c.themInk }}>
        still up?
      </div>
      <div className="max-w-[75%] self-end rounded-2xl rounded-br-md px-3 py-1.5 text-xs" style={{ background: c.me, color: c.meInk }}>
        always. it&apos;s YORU 夜
      </div>
      {big && (
        <div className="max-w-[75%] self-start rounded-2xl rounded-bl-md px-3 py-1.5 text-xs" style={{ background: c.them, color: c.themInk }}>
          that theme is clean
        </div>
      )}
    </div>
  );
}

const SECTION_LABEL: Record<string, string> = {
  stats: "Stats", xp: "Level", showcase: "Showcase", interests: "Interests", achievements: "Achievements", jokes: "Jokes",
  timeline: "Timeline", collections: "Collections", pinned: "Pinned", tabs: "Posts",
};
function LayoutSwatch({ l }: { l: LayoutP }) {
  const frame = { panel: "border-2 border-ink", terminal: "font-mono border border-online/60", editorial: "border-b border-line", scrapbook: "rotate-[-1deg] shadow", neon: "border border-brand shadow-[0_0_6px_var(--brand)]", magazine: "border-l-4 border-brand", gallery: "", none: "" }[l.frame];
  return (
    <div className="flex h-full w-full flex-col gap-1 bg-bg p-2">
      <div className={clsx("rounded bg-card-2", l.header === "compact" ? "h-3" : l.header === "cinematic" ? "h-10" : l.header === "tall" ? "h-8" : "h-6")} />
      {l.order.slice(0, 4).map((s) =>
        s === "tabs" ? (
          <div key={s} className={clsx("grid flex-1 gap-0.5", l.posts === "grid" ? "grid-cols-3" : "grid-cols-1")}>
            {Array.from({ length: l.posts === "grid" ? 6 : 2 }, (_, i) => <div key={i} className={clsx("rounded-sm bg-card", frame)} />)}
          </div>
        ) : (
          <div key={s} className={clsx("flex h-3 items-center rounded-sm bg-card px-1 text-[6px] font-bold uppercase text-muted", frame)}>{SECTION_LABEL[s]}</div>
        ),
      )}
    </div>
  );
}

function Board({ w, big }: { w: string[]; big?: boolean }) {
  return (
    <div className={clsx("grid h-full w-full grid-cols-2 gap-1 bg-bg p-2", big && "gap-2 p-4")}>
      {w.slice(0, 4).map((x, i) => (
        <div key={x + i} className={clsx("flex flex-col justify-between rounded bg-card p-1", i === 0 && w.length < 3 && "col-span-2")}>
          <span className="text-[7px] font-bold uppercase tracking-wide text-muted">{x.replace(/_/g, " ")}</span>
          <svg viewBox="0 0 40 12" className="h-3 w-full" aria-hidden>
            <polyline points={`0,10 8,${7 - i} 16,8 24,${4 + i} 32,5 40,${2 + i}`} fill="none" stroke="var(--brand)" strokeWidth="1.5" />
          </svg>
        </div>
      ))}
    </div>
  );
}

export function ItemPreview({ i, big, name = "You", avatar }: { i: Item; big?: boolean; name?: string; avatar?: string | null }) {
  const set = SET_BY_ID[i.set];
  const [pal0, pal1] = set?.palette ?? ["#0a0a0a", "#e5102f"];
  const btn = useRef<HTMLButtonElement>(null);
  const [play, setPlay] = useState(0);
  const p = i.p as never;
  const box = clsx("relative h-full w-full overflow-hidden", big ? "min-h-56" : "min-h-28");
  switch (i.cat) {
    case "ring":
      return (
        <div className={clsx(box, "flex items-center justify-center")} style={{ background: `radial-gradient(circle at 50% 40%, ${pal1}22, ${pal0})` }}>
          <RingAvatar ring={p as RingP} size={big ? 120 : 58} name={name} src={avatar} still={!big} />
        </div>
      );
    case "banner":
      return <BannerArt p={p as BannerP} className={box} still={!big} />;
    case "nameplate":
      return (
        <div className={clsx(box, "flex flex-col items-center justify-center gap-1.5 bg-[#0b0b0b] px-3")}>
          {big && <div className="text-lg font-bold text-white">{name}</div>}
          <Nameplate p={p as NameplateP} still={!big} className={big ? "text-sm" : ""} />
        </div>
      );
    case "badge":
      return (
        <div className={clsx(box, "flex items-center justify-center gap-2")} style={{ background: `radial-gradient(circle, ${pal1}22, ${pal0})` }}>
          <BadgeArt p={p as BadgeP} size={big ? 96 : 52} title={i.name} />
        </div>
      );
    case "theme":
      return <div className={box}><ThemeSwatch t={p as ThemeP} /></div>;
    case "effect": {
      const e = p as EffectP;
      return (
        <div className={clsx(box, "bg-[#060606]")}>
          {big && e.kind === "particles" && <AmbientEffect p={e} contained />}
          {e.kind === "transition" && big && <TransitionFlash p={e} play={play} />}
          <div className="absolute inset-0 flex items-center justify-center">
            {!big || e.kind === "transition" ? (
              <div className="flex items-center gap-1.5">
                {e.colors.map((c) => <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />)}
                {big && e.kind === "transition" && (
                  <button type="button" className="ms-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white" onClick={() => setPlay((n) => n + 1)}>
                    <Play size={12} className="me-1 inline" /> Play transition
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    case "reaction": {
      const r = p as ReactionP;
      return (
        <div className={clsx(box, "flex items-center justify-center")} style={{ background: `radial-gradient(circle, ${r.colors[0]}22, #070707)` }}>
          <button ref={btn} type="button" onClick={() => burst("❤️", btn.current, r)} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">
            ❤️ {big ? "Tap to try" : "Try"}
          </button>
        </div>
      );
    }
    case "chat":
      return <div className={box}><ChatSwatch c={p as ChatP} big={big} /></div>;
    case "layout":
      return <div className={box}><LayoutSwatch l={p as LayoutP} /></div>;
    case "collection": {
      const c = p as CollectionP;
      return (
        <CoverArt p={c} className={box}>
          <span className="absolute bottom-1.5 start-2 text-[10px] font-bold text-white/85 drop-shadow">{c.title || "Your title"}</span>
        </CoverArt>
      );
    }
    case "draft": {
      const d = p as DraftP;
      return (
        <div className={clsx(box, "bg-bg p-2")}>
          <div className="h-full rounded-lg border bg-card p-2 text-[10px] leading-snug" style={{ borderColor: d.accent }}>
            <div className="line-clamp-4 whitespace-pre-wrap text-ink-2">{d.body || "Start typing…"}</div>
            {d.options && <div className="mt-1 space-y-0.5">{d.options.map((o) => <div key={o} className="rounded border border-line px-1">{o}</div>)}</div>}
            {d.media !== "none" && <div className="mt-1 h-5 rounded bg-card-2 text-center text-[8px] leading-5 text-muted">{d.media === "video" ? "▶ video" : "🖼 image"}</div>}
            {d.tags.length > 0 && <div className="mt-1 text-brand">{d.tags.map((t) => `#${t}`).join(" ")}</div>}
          </div>
        </div>
      );
    }
    case "dashboard":
    case "insight":
      return <div className={box}><Board w={(p as BoardP).widgets} big={big} /></div>;
    case "feed": {
      const f = p as FeedP;
      const chips = [f.sort === "top" ? "Most reacted" : "Newest", f.tags?.length ? `#${f.tags[0]}${f.tags.length > 1 ? ` +${f.tags.length - 1}` : ""}` : null, f.interests ? "Your interests" : null,
        f.media && f.media !== "any" ? { image: "Images", video: "Video", text: "Text only" }[f.media] : null, f.authors && f.authors !== "any" ? { new: "New members", active: "Active today", interacted: "People you know", creators: "Creators" }[f.authors] : null,
        f.days ? `${f.days} days` : null, f.muted ? "Muted words off" : null, f.custom ? "Your rules" : null].filter(Boolean);
      return (
        <div className={clsx(box, "flex flex-wrap content-center items-center justify-center gap-1 bg-[#07080d] p-3")}>
          {chips.map((c) => <span key={c} className="rounded-full border border-[#3d8bff]/50 bg-[#3d8bff]/10 px-2 py-0.5 text-[10px] font-semibold text-[#cfe0ff]">{c}</span>)}
        </div>
      );
    }
    case "hub": {
      const h = p as HubP;
      return (
        <div className={clsx(box, "flex flex-col items-center justify-center gap-1")} style={{ background: `linear-gradient(135deg, ${h.b}, ${h.a}55)` }}>
          <span className="text-3xl" aria-hidden>{h.emoji}</span>
          <span className="text-[10px] font-bold text-white/85">{h.tags.length ? h.tags.slice(0, 3).map((t) => `#${t}`).join(" ") : "Your tags"}</span>
        </div>
      );
    }
    case "sound": {
      const s = p as SoundP;
      return (
        <div className={clsx(box, "flex items-center justify-center gap-3 bg-[#08070c]")}>
          <svg viewBox="0 0 60 20" className="h-6 w-20" aria-hidden>
            {s.notes.length ? s.notes.map(([f, st, du], k) => <rect key={k} x={st * 80} y={10 - Math.min(9, f / 300)} width={Math.max(2, du * 60)} height={Math.min(18, f / 150)} rx="1" fill="#a78bfa" />) : <line x1="0" y1="10" x2="60" y2="10" stroke="#555" />}
          </svg>
          <button type="button" onClick={() => playSound(s, 70)} className="rounded-full bg-[#a78bfa]/20 p-2 text-[#ede9fe]" aria-label={`Preview ${i.name}`} disabled={!s.notes.length}>
            <Volume2 size={14} />
          </button>
        </div>
      );
    }
    case "planner": {
      const pl = p as PlannerP;
      const days = new Set(pl.slots.map((s) => s.day));
      const span = Math.max(14, ...pl.slots.map((s) => s.day + 1));
      return (
        <div className={clsx(box, "flex items-center justify-center bg-bg p-2")}>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: Math.min(35, Math.ceil(span / 7) * 7) }, (_, d) => (
              <span key={d} className={clsx("h-2.5 w-2.5 rounded-sm", days.has(d) ? "bg-brand" : "bg-card-2")} />
            ))}
          </div>
        </div>
      );
    }
    case "milestone": {
      const m = p as MilestoneP;
      return (
        <div className={clsx(box, "flex flex-col items-center justify-center gap-1 bg-[#0a0806] px-2 text-center")}>
          <MilestoneEmblem p={m} earned size={big ? 88 : 46} />
          {big && <div className="text-xs text-white/75">{m.rule}</div>}
        </div>
      );
    }
    case "lab":
    case "hubview": {
      const icon = i.cat === "hubview" ? (p as HubViewP).icon : "⚗";
      const tag = i.cat === "lab" ? ((p as LabP).toggle ? "Opt-in switch" : "Preview tool") : "Hub view";
      return (
        <div className={clsx(box, "flex flex-col items-center justify-center gap-1")} style={{ background: `radial-gradient(circle, ${pal1}22, ${pal0})` }}>
          <span className="text-2xl" style={{ color: pal1 }} aria-hidden>{icon}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">{tag}</span>
        </div>
      );
    }
  }
}
