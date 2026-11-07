"use client";

import clsx from "clsx";
import { Check, Lock, Sparkles, Star } from "lucide-react";
import { item, milestoneOf, type BadgeP, type BannerP, type LayoutP, type MilestoneP, type NameplateP, type RingP } from "@/lib/pro/catalog";
import type { Category, Item, Rarity, Slot } from "@/lib/pro/types";
import { slotFor } from "@/lib/pro/types";
import { lookWith, ownsItem, useMyPro, useTryOn, type MyPro } from "@/lib/client/pro";
import { BannerArt } from "./art/Banner";
import { BadgeArt, Nameplate } from "./art/Marks";
import { RingAvatar } from "./ItemPreview";

export const CAT_LABEL: Record<Category, { name: string; n: number; blurb: string }> = {
  ring: { n: 1, name: "Profile Rings", blurb: "Frames around your profile picture." },
  banner: { n: 2, name: "Profile Banners", blurb: "Static and animated profile headers." },
  nameplate: { n: 3, name: "Titles & Nameplates", blurb: "A title that sits with your name." },
  theme: { n: 4, name: "Theme Forge+", blurb: "Whole-interface colour systems." },
  effect: { n: 5, name: "Interface Effects", blurb: "Ambient particles and page transitions." },
  badge: { n: 6, name: "Badge Collection", blurb: "Cosmetic badges next to your name." },
  layout: { n: 7, name: "Profile Layouts", blurb: "Arrange the sections of your profile." },
  collection: { n: 8, name: "Collections+", blurb: "Templates, covers and sorting for collections." },
  draft: { n: 9, name: "Draft Studio", blurb: "Templates and previews for drafts." },
  dashboard: { n: 10, name: "Creator Analytics", blurb: "Dashboards of your real numbers." },
  feed: { n: 11, name: "Feed Controls", blurb: "Saved filters for what you see." },
  hub: { n: 12, name: "Interest Hubs", blurb: "Personal discovery pages." },
  reaction: { n: 13, name: "Reaction Cosmetics", blurb: "How your reactions burst." },
  insight: { n: 14, name: "Profile Insights", blurb: "Aggregate profile statistics." },
  chat: { n: 15, name: "Chat Personalization", blurb: "How conversations look to you." },
  sound: { n: 16, name: "Sound Packs", blurb: "Original notification sounds." },
  planner: { n: 17, name: "Post Planner", blurb: "Plans and schedules for posts." },
  milestone: { n: 18, name: "Profile Evolution", blurb: "Milestones you earn by doing." },
  lab: { n: 19, name: "Preview Lab", blurb: "Opt-in previews and experiments." },
  hubview: { n: 20, name: "Membership Hub", blurb: "Your membership and collection." },
};

export const SLOT_LABEL: Record<Slot, string> = {
  ring: "Ring", banner: "Banner", nameplate: "Nameplate", badge: "Badge", layout: "Layout", milestone: "Featured milestone",
  theme: "Theme", effect: "Effect", reaction: "Reaction style", chat: "Chat theme", sound: "Notification sound",
  feed: "Feed preset", dashboard: "Dashboard", insight: "Insight layout",
};

const RARITY_STYLE: Record<Rarity, string> = {
  common: "border-line text-muted",
  uncommon: "border-emerald-500/40 text-emerald-400",
  rare: "border-sky-500/40 text-sky-400",
  epic: "border-violet-500/40 text-violet-400",
  legendary: "border-amber-400/50 text-amber-300",
};
// Rarity is a cosmetic label. It never means limited supply.
export function RarityChip({ r }: { r: Rarity }) {
  return <span className={clsx("rounded-full border px-1.5 py-px text-[10px] font-bold uppercase tracking-wider", RARITY_STYLE[r])}>{r}</span>;
}

export function unlockText(i: Item, me?: MyPro) {
  if (i.unlock === "free") return "Free for everyone";
  if (i.unlock === "pro") return me?.membership.pro ? "Included with your Pro" : "Part of YORU Pro";
  if (i.unlock === "staff:owner") return "Reserved for YORU's founder";
  if (i.unlock === "staff:admin") return "Reserved for YORU admins";
  if (i.unlock.startsWith("staff:member:")) return i.set === "cofounders_circuit" ? "Reserved for Jesse, YORU's co-founder" : "Reserved for one member of YORU staff";
  const key = milestoneOf(i.unlock)!;
  if (me?.membership.status === "comp" && i.cat !== "milestone" && !me.milestones[key]) return "Unlocked for testers (normally earned)";
  const m = item<MilestoneP>(`milestone.${key}`);
  return me?.milestones[key] ? `Earned: ${m?.name}` : `Earn ${m?.name}: ${m?.p.rule}`;
}

export function StateChip({ i, me }: { i: Item; me?: MyPro }) {
  const owned = ownsItem(i, me);
  const slot = slotFor(i.cat);
  const on = slot && me?.equips[slot]?.item === i.id && me.equips[slot]?.active;
  if (on) return <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white"><Check size={11} /> Equipped</span>;
  if (i.unlock.startsWith("staff:")) return <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">{i.unlock === "staff:owner" ? "♛ Founder" : i.set === "cofounders_circuit" ? "⚡ Co-founder" : "⛨ Staff"}</span>;
  if (owned) return <span className="inline-flex items-center gap-1 rounded-full bg-online/15 px-2 py-0.5 text-[10px] font-bold text-online">{i.unlock === "free" ? "Free" : i.unlock === "pro" ? "Owned" : "Earned"}</span>;
  if (i.unlock === "pro") return <span className="inline-flex items-center gap-1 rounded-full bg-card-2 px-2 py-0.5 text-[10px] font-bold text-ink-2"><Lock size={10} /> Pro</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-card-2 px-2 py-0.5 text-[10px] font-bold text-ink-2"><Star size={10} /> Earn it</span>;
}

export function ExperimentalChip() {
  return <span className="inline-flex items-center gap-1 rounded-full border border-[#00e0a4]/40 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-[#00e0a4]"><Sparkles size={10} /> Experimental</span>;
}

// A sample profile card wearing the member's look, with any try-on layered on
// top. Used in the hero, the before/after and the try-on bar.
export function ProfileMock({
  look, name, username, avatar, compact, className, still,
}: {
  look: Partial<Record<Slot, string | undefined>>;
  name: string;
  username: string;
  avatar?: string | null;
  compact?: boolean;
  className?: string;
  still?: boolean;
}) {
  const banner = item<BannerP>(look.banner);
  const ring = item<RingP>(look.ring);
  const np = item<NameplateP>(look.nameplate);
  const badge = item<BadgeP>(look.badge);
  const layout = item<LayoutP>(look.layout);
  const size = compact ? 56 : 76;
  const header = layout?.p.header === "cinematic" ? "h-28" : layout?.p.header === "compact" ? "h-12" : compact ? "h-16" : "h-24";
  return (
    <div className={clsx("overflow-hidden rounded-2xl border border-line bg-card text-left", className)}>
      {banner?.cat === "banner" ? (
        <BannerArt p={banner.p} className={header} still={still} />
      ) : (
        <div className={clsx(header, "bg-[radial-gradient(ellipse_at_top_right,color-mix(in_srgb,var(--brand)_40%,transparent),transparent_65%),linear-gradient(160deg,#1a1a1a,#080808)]")} />
      )}
      <div className="px-4 pb-4">
        <div style={{ marginTop: -size / 2 }} className="flex items-end justify-between">
          <div className="rounded-full bg-card p-1">
            <RingAvatar ring={ring?.cat === "ring" ? ring.p : undefined} size={size} name={name} src={avatar} still={still} />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className={clsx("font-bold text-ink", compact ? "text-base" : "text-lg")}>{name}</span>
          {badge?.cat === "badge" && <BadgeArt p={badge.p} size={compact ? 16 : 20} title={badge.name} />}
        </div>
        <div className="text-xs text-muted">@{username}</div>
        {np?.cat === "nameplate" && <Nameplate p={np.p} className="mt-1.5" still={still} />}
        {!compact && (
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {["Posts", "Likes", "Level"].map((s) => (
              <div key={s} className="rounded-xl bg-card-2 py-1.5 text-center">
                <div className="mx-auto h-2.5 w-6 rounded bg-ink/70" />
                <div className="mt-1 text-[10px] font-bold uppercase text-muted">{s}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// The member's own look with the current try-on applied.
export function useLookWithTryOn() {
  const { data: me } = useMyPro();
  const t = useTryOn();
  const slots: Slot[] = ["ring", "banner", "nameplate", "badge", "layout", "theme", "effect", "reaction", "chat", "sound", "feed", "dashboard", "insight", "milestone"];
  return Object.fromEntries(slots.map((s) => [s, lookWith(me, t, s)])) as Partial<Record<Slot, string | undefined>>;
}
