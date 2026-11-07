"use client";

import Link from "next/link";
import { Pin } from "lucide-react";
import { Gate } from "@/components/yoru/Gate";
import { hubs } from "@/lib/pro/catalog";
import { ownsItem, useMyPro } from "@/lib/client/pro";
import { ItemPreview } from "@/components/pro/ItemPreview";
import { StateChip } from "@/components/pro/ui";

// Interest Hubs (12): personal discovery pages built from real posts and real
// members. YORU has no group system, so a hub is never presented as one.
export default function HubsPage() {
  return (
    <Gate>
      <Hubs />
    </Gate>
  );
}

function Hubs() {
  const { data: me } = useMyPro();
  const pinned = new Set(me?.settings.pinned_hubs ?? []);
  const ordered = [...hubs].sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)));
  return (
    <div className="space-y-4">
      <div>
        <Link href="/pro" className="text-xs font-bold uppercase tracking-[0.25em] text-brand">YORU Pro</Link>
        <h1 className="text-2xl font-black">Interest Hubs</h1>
        <p className="text-sm text-muted">Discovery pages for what you&apos;re into: posts with matching tags and members who list the interest. Anyone can open a hub; pinning keeps it at the top.</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {ordered.map((h) => (
          <Link key={h.id} href={`/pro/hubs/${h.id}`} className="group overflow-hidden rounded-2xl border border-line bg-card hover:border-brand">
            <div className="pointer-events-none h-24"><ItemPreview i={h} /></div>
            <div className="p-2.5">
              <div className="flex items-center gap-1 text-sm font-bold group-hover:text-brand">{pinned.has(h.id) && <Pin size={12} className="text-brand" />}{h.name}</div>
              <div className="mt-1 flex items-center gap-1"><StateChip i={h} me={me} />{!ownsItem(h, me) && <span className="text-[10px] text-muted">open to preview</span>}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
