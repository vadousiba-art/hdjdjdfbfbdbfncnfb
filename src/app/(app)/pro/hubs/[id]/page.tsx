"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Pin } from "lucide-react";
import useSWRInfinite from "swr/infinite";
import { Gate } from "@/components/yoru/Gate";
import { Button, ChaosLoader, Empty } from "@/components/ui/bits";
import { Avatar } from "@/components/ui/Avatar";
import { useApp } from "@/components/providers/AppProvider";
import { PostCard } from "@/components/feed/PostCard";
import { rpc } from "@/lib/client/api";
import { item, type HubP } from "@/lib/pro/catalog";
import { ownsItem, saveProSettings, useMyPro, useProUniverse } from "@/lib/client/pro";
import type { Post, ProfileLite } from "@/lib/types";

type Hub = { id: string; owned: boolean; tags: string[]; posts: Post[]; members: ProfileLite[] };

export default function HubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Gate>
      <HubView id={decodeURIComponent(id)} />
    </Gate>
  );
}

function HubView({ id }: { id: string }) {
  const h = item<HubP>(id);
  const { available } = useProUniverse();
  const { data: me } = useMyPro();
  const { toast, toastError } = useApp();
  const [tags, setTags] = useState("");
  const { data, size, setSize, error, mutate } = useSWRInfinite<Hub>(
    (i, prev) => (!available || !h || h.cat !== "hub" ? null : prev && prev.posts.length < 15 ? null : ["hub", id, i === 0 ? null : prev?.posts[prev.posts.length - 1]?.created_at]),
    ([, hid, before]: [string, string, string | null]) => rpc<Hub>("get_hub", { p_hub: hid, p_before: before, p_limit: 15 }),
  );
  if (!h || h.cat !== "hub") return <Empty emoji="🧭" text="No such hub." />;
  if (!available) return <Empty emoji="🧭" text="Interest Hubs switch on with the next database update." />;
  if (error) return <Empty emoji="🧭" text={error.message} />;
  if (!data) return <ChaosLoader />;
  const first = data[0];
  const posts = data.flatMap((d) => d.posts);
  const pinned = me?.settings.pinned_hubs?.includes(id);
  const owned = ownsItem(h, me);
  const done = data[data.length - 1].posts.length < 15;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-line" style={{ background: `linear-gradient(135deg, ${h.p.b}, ${h.p.a}66)` }}>
        <div className="p-5 text-white">
          <Link href="/pro/hubs" className="text-xs font-bold uppercase tracking-[0.25em] text-white/80">Interest Hubs</Link>
          <h1 className="mt-1 text-3xl font-black"><span aria-hidden>{h.p.emoji}</span> {h.name}</h1>
          <p className="text-sm text-white/85">{h.desc} {first.tags.length > 0 && <span className="opacity-80">{first.tags.map((t) => `#${t}`).join(" ")}</span>}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {owned ? (
              <Button variant="outline" className="!border-white/40 !text-white" onClick={async () => {
                try {
                  await saveProSettings({ pinned_hubs: pinned ? (me?.settings.pinned_hubs ?? []).filter((x) => x !== id) : [...(me?.settings.pinned_hubs ?? []), id] });
                  toast(pinned ? "Unpinned." : "Pinned.", "success", "📌");
                } catch (err) { toastError(err); }
              }}><Pin size={16} /> {pinned ? "Unpin" : "Pin hub"}</Button>
            ) : (
              <span className="rounded-full bg-black/30 px-3 py-1.5 text-xs font-bold">Previewing. Pinning this hub is part of YORU Pro.</span>
            )}
          </div>
        </div>
      </div>

      {h.p.custom && owned && (
        <form className="card flex gap-2 p-3" onSubmit={async (e) => {
          e.preventDefault();
          try {
            await saveProSettings({ hub_tags: tags.split(/[\s,#]+/).filter(Boolean) });
            await mutate();
          } catch (err) { toastError(err); }
        }}>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={first.tags.join(" ") || "Tags, e.g. vocaloid miku"} aria-label="Hub tags" className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm" />
          <Button>Save tags</Button>
        </form>
      )}

      {first.members.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Members into this</h2>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1">
            {first.members.map((m) => (
              <Link key={m.id} href={`/u/${m.username}`} className="flex w-16 shrink-0 flex-col items-center text-center">
                <Avatar src={m.avatar_url} name={m.display_name} size={48} online={m.online} proRing={m.look?.ring} />
                <span className="mt-1 w-full truncate text-[11px] font-semibold">{m.display_name}</span>
              </Link>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">Only members who chose to be discoverable.</p>
        </section>
      )}

      {posts.length === 0 ? (
        <Empty emoji={h.p.emoji} text={first.tags.length ? "No posts with these tags yet. Be the first." : "Add some tags to fill this hub."} />
      ) : (
        <div className="space-y-4">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
      )}
      {!done && <button type="button" onClick={() => setSize(size + 1)} className="w-full rounded-full border border-line py-2.5 text-sm font-bold">Load more</button>}
    </div>
  );
}
