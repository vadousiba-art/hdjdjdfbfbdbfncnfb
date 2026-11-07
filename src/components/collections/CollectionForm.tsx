"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/bits";
import { useT } from "@/components/providers/I18nProvider";

type Values = { p_name: string; p_description: string; p_emoji: string; p_visibility: "private" | "members" };
const EMOJI = ["📁", "⭐", "🌸", "🔥", "🎨", "🎮", "📖", "🎶", "😂", "💀", "🗡️", "🌙"];

export function CollectionForm({
  open,
  onClose,
  onSave,
  initial,
  fresh,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (v: Values) => Promise<void>;
  initial?: Partial<Values>;
  fresh?: boolean; // prefilled from a template, but still a new collection
}) {
  const t = useT();
  const [v, setV] = useState<Values>({ p_name: "", p_description: "", p_emoji: "📁", p_visibility: "private", ...initial });
  const [busy, setBusy] = useState(false);
  const field = "w-full rounded-xl border border-line bg-card-2 px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <Modal open={open} onClose={onClose} title={initial && !fresh ? t("common.edit") : t("col.new")}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!v.p_name.trim() || busy) return;
          setBusy(true);
          await onSave({ ...v, p_name: v.p_name.trim() });
          setBusy(false);
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t("col.name")}</span>
          <input value={v.p_name} onChange={(e) => setV({ ...v, p_name: e.target.value.slice(0, 40) })} className={field} required autoFocus />
        </label>
        <div>
          <span className="mb-1 block text-sm font-semibold" id="col-emoji">Emoji</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="col-emoji">
            {EMOJI.map((e) => (
              <button
                type="button"
                key={e}
                role="radio"
                aria-checked={v.p_emoji === e}
                onClick={() => setV({ ...v, p_emoji: e })}
                className={`h-9 w-9 rounded-lg border text-lg ${v.p_emoji === e ? "border-brand bg-brand/15" : "border-line"}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">
            {t("col.description")} <span className="font-normal text-muted">({t("common.optional")})</span>
          </span>
          <textarea value={v.p_description} onChange={(e) => setV({ ...v, p_description: e.target.value.slice(0, 200) })} rows={2} className={field} />
        </label>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">{t("col.visibility")}</legend>
          <div className="flex gap-1 rounded-full border border-line p-1">
            {(["private", "members"] as const).map((x) => (
              <button
                type="button"
                key={x}
                aria-pressed={v.p_visibility === x}
                onClick={() => setV({ ...v, p_visibility: x })}
                className={`flex-1 rounded-full py-1.5 text-sm font-bold ${v.p_visibility === x ? "bg-brand text-white" : "text-muted"}`}
              >
                {x === "private" ? t("col.private") : t("col.members")}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={busy || !v.p_name.trim()}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
