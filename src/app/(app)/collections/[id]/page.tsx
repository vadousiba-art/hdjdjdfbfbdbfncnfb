"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Pencil, Trash2, Users } from "lucide-react";
import { useRpc } from "@/lib/client/hooks";
import { rpc } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";
import { useT } from "@/components/providers/I18nProvider";
import { Button, ChaosLoader, Empty } from "@/components/ui/bits";
import { PostCard } from "@/components/feed/PostCard";
import { Gate } from "@/components/yoru/Gate";
import { CollectionForm } from "@/components/collections/CollectionForm";
import type { CollectionSummary } from "@/lib/opengates";
import type { Post } from "@/lib/types";
import { collectionTemplates, item, type CollectionP } from "@/lib/pro/catalog";
import { ownsItem, useMyPro, useProUniverse } from "@/lib/client/pro";
import { coverBackground } from "@/components/pro/art/Marks";

type Full = CollectionSummary & { posts: (Post & { added_at: string })[] };

export default function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Gate>
      <CollectionView id={id} />
    </Gate>
  );
}

function CollectionView({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const { toastError } = useApp();
  const { available: proOn, ready } = useProUniverse();
  const { data: pro } = useMyPro();
  // With Pro Universe the collection's own sort order is used.
  const { data, error, mutate } = useRpc<Full>(ready ? (proOn ? "get_collection_page" : "get_collection") : null, { p_id: id });
  const [editing, setEditing] = useState(false);
  const [more, setMore] = useState<Full["posts"]>([]);
  const [end, setEnd] = useState(false);

  if (error) return <Empty text={error.message} />;
  if (!data) return <ChaosLoader />;
  const posts = [...data.posts, ...more];
  const tpl = item<CollectionP>(data.template);

  async function style(p: { p_template?: string; p_sort?: string }) {
    try {
      await rpc("pro_style_collection", { p_id: id, ...p });
      setMore([]);
      setEnd(false);
      mutate();
    } catch (err) {
      toastError(err);
    }
  }

  async function loadMore() {
    const last = posts[posts.length - 1];
    if (!last) return;
    try {
      const r = proOn
        ? await rpc<Full>("get_collection_page", { p_id: id, p_offset: posts.length })
        : await rpc<Full>("get_collection", { p_id: id, p_before: last.added_at });
      if (r.posts.length === 0) setEnd(true);
      setMore((m) => [...m, ...r.posts]);
    } catch (err) {
      toastError(err);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        {tpl?.cat === "collection" && <div className="h-16" style={{ background: coverBackground(tpl.p) }} aria-hidden />}
        <div className="flex items-start gap-3 p-4">
          <span className="text-4xl" aria-hidden>{data.emoji}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{data.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
              {data.visibility === "private" ? <Lock size={13} /> : <Users size={13} />}
              {data.visibility === "private" ? t("col.private") : t("col.members")}
              <span>· {t("col.count", { count: data.count })}</span>
              {!data.is_mine && (
                <Link href={`/u/${data.owner.username}`} className="hover:text-ink">
                  · {t("col.by", { name: data.owner.display_name })}
                </Link>
              )}
            </div>
            {data.description && <p className="mt-2 text-[15px]">{data.description}</p>}
          </div>
          {data.is_mine && (
            <div className="flex gap-1">
              <Button variant="outline" className="p-2.5" aria-label={t("common.edit")} onClick={() => setEditing(true)}>
                <Pencil size={16} />
              </Button>
              <Button
                variant="outline"
                className="p-2.5"
                aria-label={t("common.delete")}
                onClick={async () => {
                  if (!confirm(t("col.deleteConfirm"))) return;
                  try {
                    await rpc("delete_collection", { p_id: id });
                    router.replace("/collections");
                  } catch (err) {
                    toastError(err);
                  }
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          )}
        </div>
        {data.is_mine && proOn && (
          <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3 text-xs">
            <label className="flex items-center gap-1.5">Cover
              <select value={data.template ?? ""} onChange={(e) => style({ p_template: e.target.value })} className="rounded-lg border border-line bg-card px-2 py-1">
                <option value="">None</option>
                {collectionTemplates.map((c) => <option key={c.id} value={c.id} disabled={!ownsItem(c, pro)}>{c.name}{ownsItem(c, pro) ? "" : " (Pro)"}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5">Sort
              <select value={data.sort ?? "added_desc"} onChange={(e) => style({ p_sort: e.target.value })} className="rounded-lg border border-line bg-card px-2 py-1">
                <option value="added_desc">Newest saved first</option>
                <option value="added_asc">Oldest saved first</option>
                <option value="popular">Most reacted</option>
              </select>
            </label>
          </div>
        )}
      </div>
      {posts.length === 0 ? (
        <Empty text={t("col.emptyOne")} />
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
          {!end && posts.length >= 20 && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore}>
                {t("common.loadMore")}
              </Button>
            </div>
          )}
        </div>
      )}
      {data.is_mine && editing && (
        <CollectionForm
          open
          initial={{ p_name: data.name, p_description: data.description, p_emoji: data.emoji, p_visibility: data.visibility }}
          onClose={() => setEditing(false)}
          onSave={async (v) => {
            try {
              await rpc("save_collection", { p_id: id, ...v });
              setEditing(false);
              mutate();
            } catch (err) {
              toastError(err);
            }
          }}
        />
      )}
    </div>
  );
}
