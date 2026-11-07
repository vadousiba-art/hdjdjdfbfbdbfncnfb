"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Eye, X } from "lucide-react";
import { useMe } from "@/lib/client/hooks";
import { lookWith, tryOn, useMyPro, useTryOn } from "@/lib/client/pro";
import { applyTheme, playSound } from "@/lib/client/pro-fx";
import { setBurstStyle } from "@/components/ui/EmojiBurst";
import { item, type EffectP, type ReactionP, type SoundP, type ThemeP } from "@/lib/pro/catalog";
import { AmbientEffect, RouteTransition } from "./art/Effects";

// Applies the member's personal slots: theme, interface effect, reaction
// style and notification sound. It uses only what the server says is in
// effect, plus any try-on in this tab (shown with a bar to end it). Nothing
// here is visible to other members, and a try-on is never saved.
export function ProRuntime() {
  const { data: pro } = useMyPro();
  const { data: me } = useMe();
  const t = useTryOn();
  const theme = item<ThemeP>(lookWith(pro, t, "theme"));
  const effect = item<EffectP>(lookWith(pro, t, "effect"));
  const reaction = item<ReactionP>(lookWith(pro, t, "reaction"));
  const sound = item<SoundP>(pro?.equips.sound?.active ? pro.equips.sound.item : undefined);
  const effectsOn = pro?.settings.effects_on !== false;
  const trying = Object.values(t).some(Boolean);

  useEffect(() => {
    applyTheme(theme?.cat === "theme" ? theme.p : null);
  }, [theme]);
  useEffect(() => () => applyTheme(null), []);

  useEffect(() => {
    setBurstStyle(reaction?.cat === "reaction" ? reaction.p : null);
    return () => setBurstStyle(null);
  }, [reaction]);

  // A new notification plays the chosen sound, only if sounds are switched on.
  const unread = me?.unread_notifications ?? 0;
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (last.current !== null && unread > last.current && sound && pro?.settings.sounds_on && document.visibilityState === "visible") {
      playSound(sound.p, pro.settings.sound_volume ?? 60);
    }
    last.current = unread;
  }, [unread, sound, pro?.settings.sounds_on, pro?.settings.sound_volume]);

  return (
    <>
      {effect?.cat === "effect" && effectsOn && (effect.p.kind === "particles" ? <AmbientEffect p={effect.p} /> : <RouteTransition p={effect.p} />)}
      {trying && (
        <div role="status" className="fixed inset-x-3 bottom-20 z-[70] mx-auto flex max-w-md items-center gap-2 rounded-full border border-line bg-card/95 px-4 py-2 text-sm shadow-lg backdrop-blur lg:bottom-6">
          <Eye size={16} className="shrink-0 text-brand" />
          <span className="min-w-0 flex-1 truncate">Trying on: only you can see this, nothing is saved.</span>
          <Link href="/pro/shop" className="shrink-0 font-bold text-brand">Shop</Link>
          <button type="button" onClick={() => tryOn.clear()} className="shrink-0 rounded-full p-1 hover:bg-card-2" aria-label="End try-on">
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
