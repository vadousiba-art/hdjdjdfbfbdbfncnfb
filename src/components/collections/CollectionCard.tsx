"use client";

import Link from "next/link";
import { Lock, Users } from "lucide-react";
import { mediaSrc } from "@/lib/client/api";
import { useT } from "@/components/providers/I18nProvider";
import type { CollectionSummary } from "@/lib/opengates";
import { item, type CollectionP } from "@/lib/pro/catalog";
import { coverBackground } from "@/components/pro/art/Marks";

/* eslint-disable @next/next/no-img-element */
export function CollectionCard({ c, showOwner = false }: { c: CollectionSummary; showOwner?: boolean }) {
  const t = useT();
  // Collections+ template cover (shown when there's no image to use).
  const tpl = item<CollectionP>(c.template);
  return (
    <Link href={`/collections/${c.id}`} className="card group block overflow-hidden transition-colors duration-150 hover:border-brand/60">
      <div className="relative aspect-[16/9] overflow-hidden bg-card-2">
        {c.cover ? (
          <img src={mediaSrc(c.cover)} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl" aria-hidden style={tpl?.cat === "collection" ? { background: coverBackground(tpl.p) } : undefined}>
            {c.emoji}
          </div>
        )}
        <span className="absolute end-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
          {c.visibility === "private" ? <Lock size={11} /> : <Users size={11} />}
          {c.visibility === "private" ? t("col.private") : t("col.members")}
        </span>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-1.5 font-bold">
          <span aria-hidden>{c.emoji}</span>
          <span className="truncate">{c.name}</span>
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {t("col.count", { count: c.count })}
          {showOwner && !c.is_mine ? ` · ${t("col.by", { name: c.owner.display_name })}` : ""}
        </div>
        {c.description && <p className="mt-1 line-clamp-2 text-sm text-ink-2">{c.description}</p>}
      </div>
    </Link>
  );
}
