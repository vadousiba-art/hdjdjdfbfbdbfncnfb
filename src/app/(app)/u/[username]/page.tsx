"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Ban, Bot, CalendarDays, Flag, Flame, MessageCircle, MoreHorizontal, Pencil, Pin, Settings } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import { useSWRConfig } from "swr";
import { byFn, refreshFeeds, useRpc } from "@/lib/client/hooks";
import { ai, rpc } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";
import { useShell } from "@/components/shell/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ChaosLoader, Empty, VerifiedBadge } from "@/components/ui/bits";
import { Menu } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { Feed } from "@/components/feed/Feed";
import { ReportDialog } from "@/components/feed/ReportDialog";
import { EditProfileDialog } from "@/components/profile/EditProfileDialog";
import { FollowButton, FollowCounts } from "@/components/profile/Follow";
import { PostCard } from "@/components/feed/PostCard";
import { XpBar } from "@/components/yoru/Progression";
import { CURRENTLY, hueColor, levelProgress } from "@/lib/progress";
import { BADGES } from "@/lib/jokes";
import type { Profile, ProfileExtras } from "@/lib/types";
import { useOpenGates } from "@/lib/client/gates";
import { useT } from "@/components/providers/I18nProvider";
import { AvatarFrameWrap, ProfileBanner } from "@/components/yoru/ProfileLook";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { INTEREST_EMOJI, type ProfileIdentity } from "@/lib/opengates";
import { item, type BannerP, type LayoutP, type MilestoneP, type ProfileSection } from "@/lib/pro/catalog";
import { useProUniverse, useTryOn } from "@/lib/client/pro";
import { BannerArt } from "@/components/pro/art/Banner";
import { MilestoneEmblem } from "@/components/pro/art/Marks";
import { ProBadgeMark, ProNameplateMark } from "@/components/pro/ProMarks";

// Without a Pro layout the profile keeps its usual order.
const DEFAULT_ORDER: ProfileSection[] = ["xp", "stats", "showcase", "timeline", "interests", "achievements", "jokes", "pinned", "tabs"];
const OUTSIDE: ProfileSection[] = ["pinned", "collections", "tabs"];
const HEADER_H = { compact: "h-16", full: "h-28", tall: "h-36", cinematic: "h-52" } as const;
const FRAME: Record<LayoutP["frame"], string> = {
  none: "", gallery: "", panel: "rounded-none border-2 border-ink/80", terminal: "font-mono", editorial: "[&_h2]:font-serif",
  scrapbook: "rotate-[-0.6deg] shadow-lg", neon: "ring-1 ring-brand/60 shadow-[0_0_18px_-6px_var(--brand)]", magazine: "border-s-4 border-s-brand",
};

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { me } = useShell();
  const { toast, toastError } = useApp();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: p, error, mutate: mutateProfile } = useRpc<Profile>("get_profile", { p_username: username });
  const { data: x } = useRpc<ProfileExtras>("get_profile_extras", { p_username: username });
  const { available } = useOpenGates();
  const { data: id } = useRpc<ProfileIdentity>(available ? "get_profile_identity" : null, { p_username: username });
  const t = useT();
  const { available: proOn } = useProUniverse();
  const trying = useTryOn();
  const [tabPick, setTab] = useState<"user" | "media" | "collections" | null>(null);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [roast, setRoast] = useState<string | null>(null);
  const [roasting, setRoasting] = useState(false);

  // Aggregate visit count for the owner's insights (never who visited).
  const pid = p?.id;
  const isMe = p?.is_me;
  useEffect(() => {
    if (proOn && pid && !isMe) rpc("pro_record_profile_view", { p_username: username }).catch(() => {});
  }, [proOn, pid, isMe, username]);

  if (error) return <Empty emoji="👻" text={error.message} />;
  if (!p) return <ChaosLoader />;
  const accent = hueColor(x?.accent_hue);
  // Your own profile shows any try-on too (only to you; nothing is saved).
  const look = { ...(id?.look ?? {}) } as NonNullable<ProfileIdentity["look"]>;
  if (p.is_me) for (const k of ["ring", "banner", "nameplate", "badge", "layout", "milestone"] as const) if (k in trying) look[k] = trying[k] ?? undefined;
  const banner = item<BannerP>(look.banner);
  const layout = item<LayoutP>(look.layout)?.p;
  const featured = item<MilestoneP>(look.milestone);
  const order: ProfileSection[] = layout ? (layout.custom && look.layout_order?.length ? (look.layout_order as ProfileSection[]) : layout.order) : DEFAULT_ORDER;
  const frame = layout ? FRAME[layout.frame] : "";
  const tab = tabPick ?? layout?.tab ?? "user";

  async function dm() {
    try {
      const id = await rpc<string>("start_dm", { p_user_id: p!.id });
      router.push(`/chat/${id}`);
    } catch (err) {
      toastError(err);
    }
  }

  async function block() {
    if (!p!.blocked && !confirm(`Block @${p!.username}? You won't see each other's posts, comments or messages.`)) return;
    try {
      const r = await rpc<{ blocked: boolean }>("toggle_block", { p_user_id: p!.id });
      toast(r.blocked ? "Blocked. Peace and quiet." : "Unblocked.", "success", r.blocked ? "🚫" : "🕊️");
      mutateProfile();
      refreshFeeds();
    } catch (err) {
      toastError(err);
    }
  }

  async function roastThem() {
    setRoasting(true);
    try {
      // Roast their latest post (the API enforces their opt-in + intensity cap).
      const posts = await rpc<{ id: string }[]>("get_feed", { p_mode: "user", p_arg: p!.username, p_limit: 1 });
      if (!posts.length) {
        toast("They haven't posted anything to roast. Suspicious.", "info", "🤔");
        return;
      }
      const r = await ai("roast_post", { post_id: posts[0].id });
      setRoast(r.text);
      mutate(byFn("get_comments"));
    } catch (err) {
      toastError(err);
    } finally {
      setRoasting(false);
    }
  }

  const section = (k: ProfileSection): React.ReactNode => {
    switch (k) {
      case "xp":
        return x && !p.is_bot ? <XpBar xp={x.xp} className="mt-4" /> : null;
      case "stats":
        return layout?.stats === "inline" ? (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {stats.map((st) => <span key={st.label}><b>{st.value}</b> <span className="text-muted">{st.label}</span></span>)}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {stats.map((st, i) => (
              <motion.div key={st.label} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: 0.03 * i }} className="rounded-2xl bg-card-2 py-2 text-center">
                <div className="text-lg font-semibold">{st.value}</div>
                <div className="text-[11px] font-bold uppercase text-muted">{st.label}</div>
              </motion.div>
            ))}
          </div>
        );
      case "showcase":
        return id && p.badges.some((b) => id.showcase_badges.includes(b)) ? (
          <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Achievement showcase">
            {id.showcase_badges.filter((b) => p.badges.includes(b)).map((b) => (
              <div key={b} className="rounded-2xl border border-line bg-card-2 p-2.5 text-center" title={BADGES[b]?.blurb}>
                <div className="text-2xl" aria-hidden>{BADGES[b]?.emoji}</div>
                <div className="mt-1 text-[11px] font-bold leading-tight">{BADGES[b]?.label ?? b}</div>
              </div>
            ))}
          </div>
        ) : null;
      case "timeline":
        return id?.timeline?.length ? (
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted">Profile evolution</div>
            <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="Milestones earned">
              {id.timeline.map((m) => {
                const mi = item<MilestoneP>(`milestone.${m.key}`);
                return mi ? (
                  <li key={m.key} className="flex w-16 shrink-0 flex-col items-center text-center" title={`${mi.p.rule} Earned ${new Date(m.earned_at).toLocaleDateString()}`}>
                    <MilestoneEmblem p={mi.p} earned size={40} />
                    <span className="mt-1 line-clamp-2 text-[10px] font-semibold leading-tight">{mi.name}</span>
                  </li>
                ) : null;
              })}
            </ol>
          </div>
        ) : null;
      case "interests":
        return id && id.interests.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5" aria-label={t("settings.interests")}>
            {id.interests.map((i) => (
              <Link key={i} href={`/explore?interest=${i}`} className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-2 hover:border-brand hover:text-ink">
                {INTEREST_EMOJI[i]} {t(`interest.${i}` as const)}
              </Link>
            ))}
          </div>
        ) : null;
      case "achievements":
        return p.badges.length > 0 ? (
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted">Achievements</div>
            <div className="flex flex-wrap gap-1.5">
              {p.badges.map((b, i) => (
                <motion.span key={b} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18, delay: 0.02 * i }} title={BADGES[b]?.blurb} className="rounded-full border border-line bg-card-2 px-2.5 py-1 text-xs font-bold">
                  {BADGES[b]?.emoji} {BADGES[b]?.label ?? b}
                </motion.span>
              ))}
            </div>
          </div>
        ) : null;
      case "jokes":
        return p.inside_jokes.length > 0 ? (
          <div className="mt-3">
            <div className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted">Inside jokes</div>
            <div className="flex flex-wrap gap-1.5">
              {p.inside_jokes.map((j) => <span key={j} className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-ink">🤫 {j}</span>)}
            </div>
          </div>
        ) : null;
      default:
        return null;
    }
  };
  const outer = (k: ProfileSection): React.ReactNode => {
    if (k === "pinned")
      return x?.pinned ? (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-widest text-muted">
            <Pin size={13} className="text-brand" /> Pinned
          </div>
          <PostCard post={x.pinned} />
        </div>
      ) : null;
    if (k === "collections")
      return id?.collections.length ? (
        <div className="grid gap-3 sm:grid-cols-2">{id.collections.slice(0, 4).map((c) => <CollectionCard key={c.id} c={c} />)}</div>
      ) : null;
    return (
      <div className="space-y-4">
        <div className="flex gap-1 rounded-full border border-line bg-card p-1" role="tablist">
          {(
            [
              ["user", "Posts"],
              ["media", "Media"],
              ...(id && (id.collections.length > 0 || p.is_me) ? ([["collections", t("col.title")]] as const) : []),
            ] as const
          ).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={clsx("flex-1 rounded-full py-2 text-sm font-bold", tab === key ? "bg-brand text-white" : "text-muted")}>
              {label}
            </button>
          ))}
        </div>
        {tab === "collections" ? (
          id?.collections.length ? (
            <div className="grid gap-3 sm:grid-cols-2">{id.collections.map((c) => <CollectionCard key={c.id} c={c} />)}</div>
          ) : (
            <Empty emoji="📁" text={t("col.empty")} />
          )
        ) : (
          <Feed key={tab} mode={tab} arg={p.username} grid={layout?.posts === "grid"} emptyText={p.is_me ? "It's quiet here. Drop a post." : "Nothing here yet."} />
        )}
      </div>
    );
  };
  const inner = (keys: ProfileSection[]) => keys.map((k) => <div key={k}>{section(k)}</div>);
  // Sections before the first outside block share the header card; later
  // inside sections get their own card. Tabs are always shown.
  const seq = order.includes("tabs") ? order : [...order, "tabs" as const];
  const head: ProfileSection[] = [];
  const rest: ProfileSection[][] = [];
  for (const k of seq) {
    if (!rest.length && !OUTSIDE.includes(k)) head.push(k);
    else if (rest.length && OUTSIDE.includes(k) === OUTSIDE.includes(rest[rest.length - 1][0])) rest[rest.length - 1].push(k);
    else rest.push([k]);
  }

  const stats = [
    { label: "Posts", value: p.stats.posts },
    { label: "Likes", value: p.stats.likes },
    { label: "Awards", value: p.stats.awards },
    { label: "Points", value: p.stats.chaos_points },
  ];

  return (
    <div className="space-y-4">
      <div className={clsx("card overflow-hidden", frame)}>
        {banner?.cat === "banner" ? (
          <BannerArt p={banner.p} className={HEADER_H[layout?.header ?? "full"]}>
            <span className="sticker absolute end-3 top-3 rounded-full border border-white/20 bg-black/40 px-2.5 py-0.5 text-white/80">
              {p.role === "owner" ? "FOUNDER" : p.role === "admin" ? "ADMIN" : p.is_bot ? "AI" : "MEMBER"}
            </span>
          </BannerArt>
        ) : (
          <ProfileBanner style={id?.banner_style} accent={accent} className={HEADER_H[layout?.header ?? "full"]}>
            <span className="pointer-events-none absolute -start-2 -top-6 select-none text-[120px] font-bold leading-none text-white/[0.04]" aria-hidden>
              夜
            </span>
            <span className="sticker absolute end-3 top-3 rounded-full border border-white/20 bg-black/30 px-2.5 py-0.5 text-white/80">
              {p.role === "owner" ? "FOUNDER" : p.role === "admin" ? "ADMIN" : p.is_bot ? "AI" : "MEMBER"}
            </span>
          </ProfileBanner>
        )}
        <div className="px-4 pb-4">
          <div className="-mt-12 flex items-end justify-between">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              {x && !p.is_bot ? (
                <AvatarFrameWrap frame={id?.avatar_frame} accent={accent}>
                  <div className="level-ring p-[3px]" style={{ "--p": levelProgress(x.xp).pct, "--brand": accent } as React.CSSProperties}>
                    <div className="rounded-full bg-card p-[3px]">
                      <Avatar src={p.avatar_url} name={p.display_name} size={92} online={p.online} proRing={look.ring} />
                    </div>
                  </div>
                </AvatarFrameWrap>
              ) : (
                <Avatar src={p.avatar_url} name={p.display_name} size={96} online={p.online} />
              )}
              {x && !p.is_bot && (
                <span
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border-2 border-card px-2 py-0.5 text-[11px] font-bold text-white"
                  style={{ background: accent }}
                >
                  Lv {x.level}
                </span>
              )}
            </motion.div>
            <div className="flex gap-2 pb-1">
              {p.is_me ? (
                <>
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil size={16} /> Edit
                  </Button>
                  <Link href="/settings" className="rounded-full border border-line p-2.5 hover:bg-card-2" aria-label="Settings">
                    <Settings size={18} />
                  </Link>
                </>
              ) : p.is_bot && / · Night Crew$/.test(p.display_name) ? (
                <span className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted">🌙 YORU bot</span>
              ) : p.is_bot ? (
                <Link href="/menace">
                  <Button variant="chaos">
                    <Bot size={16} /> Talk to it
                  </Button>
                </Link>
              ) : (
                <>
                  {!p.blocked && <FollowButton userId={p.id} username={p.username} />}
                  {!p.blocked && (
                    <Button variant="outline" onClick={dm} aria-label="Message">
                      <MessageCircle size={16} /> <span className="hidden sm:inline">Message</span>
                    </Button>
                  )}
                  <Menu
                    trigger={<MoreHorizontal size={20} />}
                    items={[
                      { label: roasting ? "Roasting..." : "Get the Menace to roast them", icon: <Bot size={16} />, onSelect: roastThem, hidden: !p.roast_opt_in || p.blocked },
                      { label: "Report", icon: <Flag size={16} />, onSelect: () => setReporting(true) },
                      { label: p.blocked ? "Unblock" : "Block", icon: <Ban size={16} />, onSelect: block, danger: !p.blocked },
                    ]}
                  />
                </>
              )}
            </div>
          </div>
          <div className="mt-2">
            <h1 className="flex items-center gap-1.5 text-2xl font-bold">
              {p.display_name} {p.badge && !p.is_bot && <span>{p.badge}</span>}
              {p.verified && <VerifiedBadge size={20} />}
              <ProBadgeMark id={look.badge} size={22} />
            </h1>
            {(look.nameplate || featured) && (
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <ProNameplateMark id={look.nameplate} />
                {featured?.cat === "milestone" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs font-semibold" title={featured.p.rule}>
                    <MilestoneEmblem p={featured.p} earned size={16} /> {featured.name}
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-2 text-muted">
              @{p.username}
              {x?.flair && <span className="rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-xs text-brand-2">{x.flair}</span>}
              {!!x?.streak && (
                <span className="flex items-center gap-0.5 text-xs" title={`Best streak: ${x.best_streak} nights`}>
                  <Flame size={13} className="text-brand" /> {x.streak} night{x.streak === 1 ? "" : "s"}
                </span>
              )}
              {x?.muted && <span className="rounded-full bg-card-2 px-2 py-0.5 text-xs">muted</span>}
              {id?.creator_category && (
                <Link href="/creators" className="rounded-full border border-line bg-card-2 px-2 py-0.5 text-xs font-semibold text-ink hover:border-brand">
                  {t("cr.label")} · {t(`creator.${id.creator_category}` as const)}
                </Link>
              )}
              {id?.pro && <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-black tracking-wider text-white">PRO</span>}
            </div>
            {x?.currently_kind && x.currently_title && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-line bg-card-2 px-3 py-1 text-sm">
                <span aria-hidden>{CURRENTLY[x.currently_kind].emoji}</span>
                <span className="text-muted">{CURRENTLY[x.currently_kind].verb}</span>
                <span className="font-medium">{x.currently_title}</span>
              </div>
            )}
            {p.status && <div className="mt-1 text-sm font-semibold text-online">● {p.status}</div>}
            {p.bio && <p className="mt-2 whitespace-pre-wrap text-[15px]">{p.bio}</p>}
            {!p.is_bot && !p.blocked && <FollowCounts userId={p.id} />}
            <div className="mt-2 flex items-center gap-1 text-xs text-muted">
              <CalendarDays size={14} /> Joined {new Date(p.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              {p.roast_opt_in && <span className="ms-2 rounded-full bg-roast/15 px-2 py-0.5 font-bold text-roast">🔥 roastable</span>}
              {p.banned && <span className="ms-2 rounded-full bg-hot px-2 py-0.5 font-bold text-white">BANNED</span>}
            </div>
          </div>
          {inner(head)}
        </div>
      </div>

      {p.blocked ? (
        <Empty emoji="🚫" text="You blocked this person. Their posts are hidden." />
      ) : (
        rest.map((chunk, n) =>
          OUTSIDE.includes(chunk[0]) ? (
            <div key={n} className="space-y-4">{chunk.map((k) => <div key={k}>{outer(k)}</div>)}</div>
          ) : (
            <div key={n} className={clsx("card px-4 pb-4", frame)}>{inner(chunk)}</div>
          ),
        )
      )}
      {p.is_me && <EditProfileDialog me={me} open={editing} onClose={() => setEditing(false)} />}
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="user" targetId={p.id} />
      <Modal open={roast !== null} onClose={() => setRoast(null)} title="🔥 The Menace has spoken">
        <p className="text-lg font-semibold">{roast}</p>
        <p className="mt-3 text-xs text-muted">Posted as a comment on their latest post.</p>
      </Modal>
    </div>
  );
}
