"use client";

import { item, type BadgeP, type NameplateP } from "@/lib/pro/catalog";
import { BadgeArt, Nameplate } from "./art/Marks";

// The public Pro look on posts, comments and lists. Ids come from the server
// (effective items only), so a lapsed or unowned item never shows.
export function ProBadgeMark({ id, size = 16 }: { id?: string | null; size?: number }) {
  const b = item<BadgeP>(id);
  if (b?.cat !== "badge") return null;
  return (
    <span className="inline-flex shrink-0" title={`${b.name} (cosmetic badge)`}>
      <BadgeArt p={b.p} size={size} title={b.name} />
    </span>
  );
}

export function ProNameplateMark({ id, className, still }: { id?: string | null; className?: string; still?: boolean }) {
  const n = item<NameplateP>(id);
  if (n?.cat !== "nameplate") return null;
  return <Nameplate p={n.p} className={className} still={still} />;
}
