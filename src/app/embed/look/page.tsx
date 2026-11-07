"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRpc } from "@/lib/client/hooks";
import { Avatar } from "@/components/ui/Avatar";
import { BannerArt } from "@/components/pro/art/Banner";
import { ProNameplateMark } from "@/components/pro/ProMarks";
import { AvatarFrameWrap, ProfileBanner } from "@/components/yoru/ProfileLook";
import { hueColor } from "@/lib/progress";
import { item, type BannerP } from "@/lib/pro/catalog";
import type { ProfileIdentity } from "@/lib/opengates";
import type { Profile, ProfileExtras } from "@/lib/types";

// The animated part of a profile (banner, ring, frame, nameplate) for the
// Android app, which draws everything else natively. Members only, like the
// profile page; the app passes the member's session cookies.
function Look() {
  const username = useSearchParams().get("u") ?? "";
  const { data: p } = useRpc<Profile>(username ? "get_profile" : null, { p_username: username });
  const { data: id } = useRpc<ProfileIdentity>(username ? "get_profile_identity" : null, { p_username: username });
  const { data: x } = useRpc<ProfileExtras>(username ? "get_profile_extras" : null, { p_username: username });
  if (!p) return <div className="h-[178px] bg-[#0b0b0b]" />;
  const accent = hueColor(x?.accent_hue);
  const banner = item<BannerP>(id?.look?.banner);
  const tag = p.role === "owner" ? "FOUNDER" : p.role === "admin" ? "ADMIN" : p.role === "moderator" ? "MOD" : p.is_bot ? "AI" : null;
  const sticker = tag && <span className="sticker absolute end-3 top-3 rounded-full border border-white/20 bg-black/40 px-2.5 py-0.5 text-white/80">{tag}</span>;
  return (
    <div className="relative h-[178px] overflow-hidden bg-bg">
      {banner?.cat === "banner" ? (
        <BannerArt p={banner.p} className="h-28">{sticker}</BannerArt>
      ) : (
        <ProfileBanner style={id?.banner_style} accent={accent} className="h-28">{sticker}</ProfileBanner>
      )}
      <div className="absolute bottom-1 start-4 flex items-end gap-3">
        <AvatarFrameWrap frame={id?.avatar_frame} accent={accent}>
          <div className="rounded-full bg-bg p-[3px]">
            <Avatar src={p.avatar_url} name={p.display_name} size={86} proRing={id?.look?.ring} />
          </div>
        </AvatarFrameWrap>
        {id?.look?.nameplate && <ProNameplateMark id={id.look.nameplate} className="mb-2" />}
      </div>
    </div>
  );
}

export default function EmbedLookPage() {
  return (
    <Suspense fallback={<div className="h-[178px] bg-[#0b0b0b]" />}>
      <Look />
    </Suspense>
  );
}
