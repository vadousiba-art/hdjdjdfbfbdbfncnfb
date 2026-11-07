"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Lock, Trash2 } from "lucide-react";
import { useSWRConfig } from "swr";
import { byFn, useProgress, useRpc } from "@/lib/client/hooks";
import { post, rpc } from "@/lib/client/api";
import { useApp, type MotionPref, type ThemePref } from "@/components/providers/AppProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { useShell } from "@/components/shell/AppShell";
import { Avatar } from "@/components/ui/Avatar";
import { Button, PageTitle, Toggle } from "@/components/ui/bits";
import { IntensityPicker } from "@/components/menace/IntensityPicker";
import { AMBIENCE_MODES, type AmbienceMode } from "@/components/fx/Ambience";
import { CURRENTLY, PALETTE_EVENT, applyHue, hueColor } from "@/lib/progress";
import { ColorSlider } from "@/components/yoru/ColorSlider";
import { DeleteAccount } from "@/components/profile/DeleteAccount";
import { ProfileBanner } from "@/components/yoru/ProfileLook";
import { LEGAL_LINKS } from "@/components/public/LegalLinks";
import { useIdentity, useOpenGates, type Identity } from "@/lib/client/gates";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import { AVATAR_FRAMES, BANNER_STYLES, INTERESTS, INTEREST_EMOJI, PRO_BANNERS, PRO_FRAMES, type Interest } from "@/lib/opengates";
import { BADGES } from "@/lib/jokes";
import { WHATS_NEW_EVENT } from "@/lib/releases";
import Link from "next/link";
import type { MessageKey } from "@/lib/i18n/messages/en";
import type { CurrentlyKind, Me, NotificationPrefs, Profile, ProfileLite } from "@/lib/types";
import { PushPrompt } from "@/components/notifications/PushPrompt";
import { forgetPushDevice } from "@/lib/client/push";

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section className="card scroll-mt-20 p-4" id={id}>
      <h2 className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">{title}</h2>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="py-3">
      <div className="mb-2 text-sm font-semibold">{label}</div>
      <div className="flex gap-1 rounded-full border border-line p-1" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button
            key={v}
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={clsx("flex-1 rounded-full py-1.5 text-sm font-bold", value === v ? "bg-brand text-white" : "text-muted")}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

// "friend_posts" (every post by anyone) is gone: new posts now notify followers only (migration 0017).
const NOTIF: (keyof NotificationPrefs)[] = ["likes", "comments", "mentions", "reposts", "messages", "awards", "following_posts", "follows", "top_posts", "moonrise"];

type SavedTheme = { id: string; name: string; accent_hue: number; theme: ThemePref; ambience: AmbienceMode };

export default function SettingsPage() {
  const { me } = useShell();
  const { theme, setTheme, motionPref, setMotionPref, sound, setSound, ambience, setAmbience, toastError, toast, config } = useApp();
  const { t, locale, setLocale } = useI18n();
  const { available: gates } = useOpenGates();
  const { data: identity, mutate: mutateIdentity } = useIdentity();
  const { data: progress, mutate: mutateProgress } = useProgress();
  const [currently, setCurrently] = useState<{ kind: CurrentlyKind | ""; title: string }>({ kind: "", title: "" });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (progress) setCurrently({ kind: progress.currently_kind ?? "", title: progress.currently_title ?? "" });
  }, [progress]);

  const { mutate } = useSWRConfig();
  const router = useRouter();
  const { data: blocked, mutate: mutateBlocked } = useRpc<ProfileLite[]>("get_blocked");

  async function saveStyle(p: { currently_kind?: CurrentlyKind | ""; currently_title?: string }) {
    try {
      await rpc("update_my_style", { p });
      mutateProgress();
      mutate(byFn("get_me", "get_profile_extras"));
    } catch (err) {
      toastError(err);
    }
  }

  async function save(p: Partial<Me> | { notification_prefs: Partial<NotificationPrefs> }) {
    // Optimistic: reflect immediately in the cached profile.
    mutate(byFn("get_me"), (cur?: Me) => (cur ? ({ ...cur, ...p, notification_prefs: { ...cur.notification_prefs, ...("notification_prefs" in p ? p.notification_prefs : {}) } } as Me) : cur), { revalidate: false });
    try {
      await rpc("update_my_profile", { p });
      mutate(byFn("get_me"));
    } catch (err) {
      toastError(err);
      mutate(byFn("get_me"));
    }
  }

  async function saveNotif(key: keyof NotificationPrefs, value: boolean) {
    mutate(byFn("get_me"), (cur?: Me) => (cur ? { ...cur, notification_prefs: { ...cur.notification_prefs, [key]: value } } : cur), { revalidate: false });
    try {
      await rpc("set_notification_prefs", { p: { [key]: value } });
    } catch (err) {
      toastError(err);
    }
    mutate(byFn("get_me"));
  }

  // Open Gates profile fields. Optimistic, rolled back by refetching on error.
  async function saveIdentity(p: Partial<Identity>) {
    mutateIdentity((cur) => (cur ? { ...cur, ...p } : cur), { revalidate: false });
    try {
      const next = await rpc<Identity>("update_my_identity", { p });
      mutateIdentity(next, { revalidate: false });
      mutate(byFn("get_profile_identity", "get_members", "get_me"));
    } catch (err) {
      toastError(err);
      mutateIdentity();
    }
  }

  function changeLanguage(l: Locale) {
    setLocale(l);
    if (gates) saveIdentity({ locale: l });
  }

  async function unblock(id: string) {
    try {
      await rpc("toggle_block", { p_user_id: id });
      mutateBlocked();
      toast(t("settings.unblocked"), "success", "🕊️");
    } catch (err) {
      toastError(err);
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle sub={t("settings.sub")}>{t("settings.title")}</PageTitle>

      <Section title={t("settings.appearance")}>
        <Segmented<ThemePref>
          label={t("settings.theme")}
          value={theme}
          onChange={setTheme}
          options={[["dark", t("theme.dark")], ["light", t("theme.light")], ["system", t("theme.system")]]}
        />
        <Segmented<MotionPref>
          label={t("settings.motion")}
          value={motionPref}
          onChange={setMotionPref}
          options={[["system", t("motion.system")], ["reduce", t("motion.reduce")], ["full", t("motion.full")]]}
        />
        <Toggle checked={sound} onChange={setSound} label={t("settings.sound")} description={t("settings.soundDesc")} />
        <div className="py-3">
          <label htmlFor="language" className="mb-1 block text-sm font-semibold">
            {t("settings.language")}
          </label>
          <p className="mb-2 text-xs text-muted">{t("settings.languageDesc")}</p>
          <select
            id="language"
            value={locale}
            onChange={(e) => changeLanguage(e.target.value as Locale)}
            className="w-full rounded-xl border border-line bg-card-2 px-3 py-2 text-sm outline-none focus:border-brand sm:w-72"
          >
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          {locale !== "en" && <p className="mt-2 text-xs text-muted">{t("settings.machineNote")}</p>}
        </div>
      </Section>

      <Section title={t("settings.style")}>
        <ColorSlider />
        <div className="py-3">
          <div className="mb-2 text-sm font-semibold">{t("settings.currently")}</div>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              saveStyle({ currently_kind: currently.kind, currently_title: currently.title.trim() });
              toast(t("common.saved"), "success", "📺");
            }}
          >
            <select
              value={currently.kind}
              onChange={(e) => setCurrently((c) => ({ ...c, kind: e.target.value as CurrentlyKind | "" }))}
              className="rounded-xl border border-line bg-card-2 px-3 py-2 text-sm outline-none focus:border-brand"
              aria-label="Activity"
            >
              <option value="">{t("settings.currentlyNothing")}</option>
              {(Object.keys(CURRENTLY) as CurrentlyKind[]).map((k) => (
                <option key={k} value={k}>
                  {CURRENTLY[k].emoji} {CURRENTLY[k].verb}
                </option>
              ))}
            </select>
            <input
              value={currently.title}
              onChange={(e) => setCurrently((c) => ({ ...c, title: e.target.value.slice(0, 60) }))}
              placeholder="Frieren, Chainsaw Man, Ado, Persona 5..."
              className="min-w-0 flex-1 rounded-xl border border-line bg-card-2 px-3 py-2 text-sm outline-none focus:border-brand"
              aria-label="Title"
            />
            <Button type="submit" className="py-2">
              {t("common.save")}
            </Button>
          </form>
        </div>
        <Segmented
          label={t("settings.ambience")}
          value={ambience}
          onChange={setAmbience}
          options={AMBIENCE_MODES.map((m) => [m.id, `${m.label} ${m.jp}`] as [typeof m.id, string])}
        />
        {gates && identity && <SavedLooks slots={identity.theme_slots} />}
        <div className="py-3 text-xs text-muted">
          Tip: press <kbd className="rounded border border-line px-1">Ctrl</kbd> + <kbd className="rounded border border-line px-1">K</kbd> anywhere (or{" "}
          <button className="text-brand underline" onClick={() => window.dispatchEvent(new Event(PALETTE_EVENT))}>
            tap here
          </button>
          ) for quick jump.
        </div>
      </Section>

      {gates && identity && (
        <Section title={t("settings.look")} id="look">
          <LookPicker identity={identity} username={me.username} hue={progress?.accent_hue} onSave={saveIdentity} />
        </Section>
      )}

      {gates && identity && (
        <Section title={t("settings.interests")} id="interests">
          <div className="py-3">
            <p className="mb-2 text-xs text-muted">{t("settings.interestsDesc")}</p>
            <div className="flex flex-wrap gap-1.5">
              {INTERESTS.map((i) => {
                const on = identity.interests.includes(i);
                const full = !on && identity.interests.length >= 8;
                return (
                  <button
                    key={i}
                    aria-pressed={on}
                    disabled={full}
                    onClick={() => saveIdentity({ interests: on ? identity.interests.filter((x) => x !== i) : [...identity.interests, i] })}
                    className={clsx(
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 disabled:opacity-40",
                      on ? "border-brand bg-brand text-white" : "border-line hover:border-brand",
                    )}
                  >
                    {INTEREST_EMOJI[i as Interest]} {t(`interest.${i}` as MessageKey)}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      <Section title={t("settings.ai")}>
        <Toggle checked={me.roast_opt_in} onChange={(v) => save({ roast_opt_in: v })} label={t("settings.roastMe")} description={t("settings.roastMeDesc")} />
        <div className="py-3">
          <div className="mb-2 text-sm font-semibold">{t("settings.maxIntensity")}</div>
          <IntensityPicker value={me.roast_intensity} onChange={(v) => save({ roast_intensity: v })} />
          <p className="mt-1.5 text-xs text-muted">{t("settings.maxIntensityDesc")}</p>
        </div>
        <Toggle
          checked={me.ai_context_opt_in}
          onChange={(v) => save({ ai_context_opt_in: v })}
          label={t("settings.personalized")}
          description={t("settings.personalizedDesc")}
        />
      </Section>

      <Section title={t("settings.notifications")} id="notifications">
        <PushPrompt variant="settings" />
        {NOTIF.map((key) => (
          <Toggle
            key={key}
            checked={me.notification_prefs[key] ?? true}
            onChange={(v) => saveNotif(key, v)}
            label={t(`notif.${key}` as MessageKey)}
            description={t(`notif.${key}Desc` as MessageKey)}
          />
        ))}
      </Section>

      <Section title={t("settings.privacy")} id="privacy">
        {gates && identity && (
          <>
            <Toggle checked={identity.ghost_mode} onChange={(v) => saveIdentity({ ghost_mode: v })} label={t("settings.ghost")} description={t("settings.ghostDesc")} />
            <Toggle
              checked={identity.discoverable}
              onChange={(v) => saveIdentity({ discoverable: v })}
              label={t("settings.discoverable")}
              description={t("settings.discoverableDesc")}
            />
          </>
        )}
        <Toggle checked={me.leaderboard_opt_in} onChange={(v) => save({ leaderboard_opt_in: v })} label={t("settings.leaderboards")} description={t("settings.leaderboardsDesc")} />
        <div className="py-3">
          <div className="mb-2 text-sm font-semibold">{t("settings.blocked")}</div>
          {blocked?.length === 0 && <p className="text-xs text-muted">{t("settings.nobodyBlocked")}</p>}
          {blocked?.map((b) => (
            <div key={b.id} className="flex items-center gap-3 py-1.5">
              <Avatar src={b.avatar_url} name={b.display_name} size={32} />
              <span className="flex-1 text-sm font-bold">{b.display_name}</span>
              <Button variant="outline" className="py-1.5 text-xs" onClick={() => unblock(b.id)}>
                {t("settings.unblock")}
              </Button>
            </div>
          ))}
        </div>
      </Section>

      {gates && identity && (
        <Section title={`${t("settings.creator")} · ${t("settings.pro")}`}>
          <Link href="/creators" className="flex items-center justify-between gap-3 py-3 hover:text-brand">
            <span>
              <span className="block text-sm font-semibold">{t("settings.creator")}</span>
              <span className="block text-xs text-muted">
                {identity.creator_category ? t("cr.approved", { category: t(`creator.${identity.creator_category}` as MessageKey) }) : t("settings.creatorDesc")}
              </span>
            </span>
            <span aria-hidden>→</span>
          </Link>
          <Link href="/pro" className="flex items-center justify-between gap-3 py-3 hover:text-brand">
            <span>
              <span className="block text-sm font-semibold">{t("settings.pro")}</span>
              <span className="block text-xs text-muted">{identity.pro ? t("pro.activeForever") : t("pro.tagline")}</span>
            </span>
            <span aria-hidden>→</span>
          </Link>
          <div className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm font-semibold">{t("settings.whatsNew")}</span>
            <Button variant="outline" className="py-1.5 text-xs" onClick={() => window.dispatchEvent(new Event(WHATS_NEW_EVENT))}>
              {t("settings.replay")}
            </Button>
          </div>
        </Section>
      )}

      <Section title={t("settings.help")}>
        <div className="flex flex-wrap gap-2 py-3 text-sm">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full border border-line px-3 py-1.5 text-ink-2 transition-colors duration-150 hover:border-brand hover:text-ink">
              {l.label}
            </Link>
          ))}
        </div>
        <p className="py-3 text-xs text-muted">{t("settings.helpText")}</p>
      </Section>

      <Section title={t("settings.account")}>
        <div className="py-3 text-sm text-muted">
          {t("settings.signedInAs")} <b className="text-ink">@{me.username}</b> · role {me.role} · {config.mode} mode
        </div>
        <div className="py-3">
          <Button
            variant="danger"
            onClick={async () => {
              await forgetPushDevice().catch(() => {});
              await post("/api/auth/logout").catch(() => null);
              router.replace("/login");
              router.refresh();
            }}
          >
            {t("settings.logout")}
          </Button>
        </div>
        <DeleteAccount username={me.username} isOwner={me.role === "owner"} />
      </Section>
    </div>
  );
}

// Banner, avatar frame and achievement showcase, previewed live.
function LookPicker({ identity, username, hue, onSave }: { identity: Identity; username: string; hue?: number; onSave: (p: Partial<Identity>) => void }) {
  const { t } = useI18n();
  const { data: profile } = useRpc<Profile>("get_profile", { p_username: username });
  const accent = hueColor(hue);
  const earned = profile?.badges ?? [];
  const pick = (on: boolean, locked: boolean) =>
    clsx("relative rounded-xl border p-1 text-start transition-colors duration-150", on ? "border-brand ring-1 ring-brand" : "border-line hover:border-ink-2", locked && "opacity-60");

  return (
    <>
      <div className="py-3">
        <div className="mb-2 text-sm font-semibold">{t("settings.banner")}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BANNER_STYLES.map((b) => {
            const locked = PRO_BANNERS.includes(b) && !identity.pro;
            return (
              <button key={b} className={pick(identity.banner_style === b, locked)} aria-pressed={identity.banner_style === b} disabled={locked} onClick={() => onSave({ banner_style: b })}>
                <ProfileBanner style={b} accent={accent} className="h-14 rounded-lg" />
                <span className="mt-1 flex items-center gap-1 px-1 text-xs font-semibold">
                  {t(`banner.${b}` as MessageKey)}
                  {PRO_BANNERS.includes(b) && (
                    <span className="ms-auto flex items-center gap-0.5 rounded-full bg-brand px-1.5 text-[10px] font-black text-white">
                      {locked && <Lock size={9} />} PRO
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="py-3">
        <div className="mb-2 text-sm font-semibold">{t("settings.frame")}</div>
        <div className="flex flex-wrap gap-2">
          {AVATAR_FRAMES.map((f) => {
            const locked = PRO_FRAMES.includes(f) && !identity.pro;
            return (
              <button
                key={f}
                disabled={locked}
                aria-pressed={identity.avatar_frame === f}
                onClick={() => onSave({ avatar_frame: f })}
                className={clsx(
                  "flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium disabled:opacity-50",
                  identity.avatar_frame === f ? "border-brand bg-brand text-white" : "border-line hover:border-brand",
                )}
              >
                {t(`frame.${f}` as MessageKey)}
                {PRO_FRAMES.includes(f) && <span className="text-[10px] font-black">{locked ? "🔒 " : ""}PRO</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="py-3">
        <div className="mb-1 text-sm font-semibold">{t("settings.showcase")}</div>
        <p className="mb-2 text-xs text-muted">{earned.length ? t("settings.showcaseDesc") : t("settings.showcaseNone")}</p>
        <div className="flex flex-wrap gap-1.5">
          {earned.map((b) => {
            const on = identity.showcase_badges.includes(b);
            return (
              <button
                key={b}
                aria-pressed={on}
                disabled={!on && identity.showcase_badges.length >= 3}
                onClick={() => onSave({ showcase_badges: on ? identity.showcase_badges.filter((x) => x !== b) : [...identity.showcase_badges, b] })}
                className={clsx(
                  "rounded-full border px-2.5 py-1 text-xs font-bold disabled:opacity-40",
                  on ? "border-brand bg-brand/15" : "border-line hover:border-brand",
                )}
              >
                {BADGES[b]?.emoji} {BADGES[b]?.label ?? b}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// Theme Forge+: save the current color + theme + ambience, switch back later.
function SavedLooks({ slots }: { slots: number }) {
  const { t } = useI18n();
  const { theme, setTheme, ambience, setAmbience, toastError, toast } = useApp();
  const { data: progress, mutate: mutateProgress } = useProgress();
  const { data: looks, mutate } = useRpc<SavedTheme[]>("get_my_themes", {});
  const [name, setName] = useState("");

  async function apply(l: SavedTheme) {
    setTheme(l.theme);
    setAmbience(l.ambience);
    try {
      await rpc("update_my_style", { p: { accent_hue: l.accent_hue } });
      applyHue(l.accent_hue);
      mutateProgress();
      toast(`${l.name} ✓`, "success", "🎨");
    } catch (err) {
      toastError(err);
    }
  }

  return (
    <div className="py-3">
      <div className="mb-1 text-sm font-semibold">{t("settings.themes")}</div>
      <p className="mb-2 text-xs text-muted">{t("settings.themesDesc", { used: looks?.length ?? 0, slots })}</p>
      <div className="flex flex-wrap gap-2">
        {looks?.map((l) => (
          <div key={l.id} className="flex items-center overflow-hidden rounded-full border border-line">
            <button onClick={() => apply(l)} className="flex items-center gap-2 py-1.5 pe-2 ps-3 text-sm font-semibold hover:bg-card-2">
              <span className="h-3.5 w-3.5 rounded-full" style={{ background: hueColor(l.accent_hue) }} aria-hidden />
              {l.name}
            </button>
            <button
              aria-label={`${t("common.delete")} ${l.name}`}
              onClick={async () => {
                try {
                  mutate(await rpc<SavedTheme[]>("delete_theme", { p_id: l.id }), { revalidate: false });
                } catch (err) {
                  toastError(err);
                }
              }}
              className="border-s border-line px-2 py-1.5 text-muted hover:text-brand"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || progress?.accent_hue === undefined) return;
          try {
            mutate(await rpc<SavedTheme[]>("save_theme", { p_name: name.trim(), p_accent_hue: progress.accent_hue, p_theme: theme, p_ambience: ambience }), { revalidate: false });
            setName("");
          } catch (err) {
            toastError(err);
          }
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 30))}
          placeholder={t("settings.themeName")}
          aria-label={t("settings.themeName")}
          className="min-w-0 flex-1 rounded-xl border border-line bg-card-2 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <Button type="submit" variant="outline" className="py-2" disabled={!name.trim() || (looks?.length ?? 0) >= slots}>
          {t("settings.saveLook")}
        </Button>
      </form>
    </div>
  );
}
