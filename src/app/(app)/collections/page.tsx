"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useRpc } from "@/lib/client/hooks";
import { rpc } from "@/lib/client/api";
import { useApp } from "@/components/providers/AppProvider";
import { useT } from "@/components/providers/I18nProvider";
import { Button, ChaosLoader, Empty, PageTitle } from "@/components/ui/bits";
import { Gate } from "@/components/yoru/Gate";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { CollectionForm } from "@/components/collections/CollectionForm";
import type { CollectionSummary } from "@/lib/opengates";
import { collectionTemplates, item, type CollectionP } from "@/lib/pro/catalog";
import { ownsItem, useMyPro, useProUniverse } from "@/lib/client/pro";
import { CoverArt } from "@/components/pro/art/Marks";

export default function CollectionsPage() {
  return (
    <Gate>
      <Suspense fallback={<ChaosLoader />}>
        <Collections />
      </Suspense>
    </Gate>
  );
}

function Collections() {
  const t = useT();
  const { toastError } = useApp();
  const { data, error, mutate } = useRpc<CollectionSummary[]>("get_my_collections", {});
  const params = useSearchParams();
  const router = useRouter();
  const { available: proOn } = useProUniverse();
  const { data: pro } = useMyPro();
  const fromUrl = params.get("template");
  const [creating, setCreating] = useState(Boolean(fromUrl));
  const [template, setTemplate] = useState<string | null>(fromUrl && item(fromUrl)?.cat === "collection" ? fromUrl : null);
  const tpl = item<CollectionP>(template);

  return (
    <div className="space-y-4">
      <PageTitle sub={t("col.sub")}>{t("col.title")}</PageTitle>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} /> {t("col.new")}
        </Button>
      </div>
      {proOn && (
        <section aria-label="Start from a template">
          <div className="mb-1.5 text-xs font-bold uppercase tracking-widest text-muted">Start from a template</div>
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
            {collectionTemplates.map((c) => {
              const owned = ownsItem(c, pro);
              return (
                <button key={c.id} type="button" disabled={!owned} onClick={() => { setTemplate(c.id); setCreating(true); }}
                  className="w-28 shrink-0 overflow-hidden rounded-xl border border-line text-left disabled:opacity-50" title={owned ? c.desc : "Part of YORU Pro"}>
                  <CoverArt p={c.p} className="h-14" />
                  <div className="truncate px-2 py-1 text-[11px] font-semibold">{c.name}{owned ? "" : " · Pro"}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {error && <Empty text={t("common.error")} />}
      {!data && !error && <ChaosLoader />}
      {data?.length === 0 && <Empty text={t("col.empty")} />}
      {!!data?.length && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((c) => (
            <CollectionCard key={c.id} c={c} />
          ))}
        </div>
      )}
      <CollectionForm
        key={template ?? "blank"}
        fresh
        open={creating}
        initial={tpl?.cat === "collection" && tpl.p.title ? { p_name: tpl.p.title, p_description: tpl.p.about, p_emoji: tpl.p.emoji, p_visibility: tpl.p.visibility } : undefined}
        onClose={() => { setCreating(false); setTemplate(null); if (fromUrl) router.replace("/collections"); }}
        onSave={async (v) => {
          try {
            const c = await rpc<CollectionSummary>("save_collection", v);
            if (tpl?.cat === "collection") await rpc("pro_style_collection", { p_id: c.id, p_template: tpl.id, p_sort: tpl.p.sort });
            setCreating(false);
            setTemplate(null);
            mutate();
          } catch (err) {
            toastError(err);
          }
        }}
      />
    </div>
  );
}
