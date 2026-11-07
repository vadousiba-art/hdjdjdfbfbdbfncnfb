"use client";

import { Heart } from "lucide-react";
import type { Item } from "@/lib/pro/types";
import type { MyPro } from "@/lib/client/pro";
import { ItemPreview } from "./ItemPreview";
import { ExperimentalChip, RarityChip, StateChip } from "./ui";

export function ItemCard({ i, me, onOpen }: { i: Item; me?: MyPro; onOpen: (i: Item) => void }) {
  return (
    <button type="button" onClick={() => onOpen(i)} className="group overflow-hidden rounded-2xl border border-line bg-card text-left transition hover:border-brand focus-visible:border-brand">
      <div className="pointer-events-none h-28 overflow-hidden">
        <ItemPreview i={i} />
      </div>
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 truncate text-sm font-bold group-hover:text-brand">{i.name}</div>
          {me?.wishlist.includes(i.id) && <Heart size={13} className="mt-0.5 shrink-0 fill-brand text-brand" aria-label="On your wishlist" />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <StateChip i={i} me={me} />
          <RarityChip r={i.rarity} />
          {i.status === "experimental" && <ExperimentalChip />}
        </div>
      </div>
    </button>
  );
}

