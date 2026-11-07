"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { useSWRConfig } from "swr";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/bits";
import { useApp } from "@/components/providers/AppProvider";
import { rpc, uploadFile } from "@/lib/client/api";
import { byFn } from "@/lib/client/hooks";
import type { Me } from "@/lib/types";
import { AtlasAssist } from "@/components/atlas/AtlasAssist";

const BADGES = ["", "👑", "⚔️", "🥷", "🐈", "😁", "💀", "🔥", "🧢", "🤡", "🫡", "🗿", "🐸", "🦅", "🧠", "🍕"];

export function EditProfileDialog({ me, open, onClose }: { me: Me; open: boolean; onClose: () => void }) {
  const { toast, toastError, supabase } = useApp();
  const { mutate } = useSWRConfig();
  const [form, setForm] = useState({ display_name: "", bio: "", status: "", badge: "", avatar_url: "" as string | null });
  const [jokes, setJokes] = useState<string[]>([]);
  const [joke, setJoke] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setForm({ display_name: me.display_name, bio: me.bio, status: me.status, badge: me.badge, avatar_url: me.avatar_url });
    setJokes(me.inside_jokes);
    setPreview(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, me]);

  async function pickAvatar(file: File) {
    if (!file.type.startsWith("image/")) return toast("Avatars must be images.", "error");
    setUploading(true);
    try {
      const up = await uploadFile(file, supabase);
      setForm((f) => ({ ...f, avatar_url: up.path }));
      setPreview(URL.createObjectURL(file));
    } catch (err) {
      toastError(err);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      await rpc("update_my_profile", { p: { ...form, inside_jokes: jokes } });
      toast("Profile updated. Rebrand complete.", "success", "✨");
      mutate(byFn("get_me", "get_profile", "get_members"));
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-xl border border-line bg-card-2 px-3 py-2.5 text-sm outline-none focus:border-brand";

  return (
    <Modal open={open} onClose={onClose} title="Edit profile">
      <div className="flex items-center gap-4">
        <button onClick={() => fileRef.current?.click()} className="relative" aria-label="Change avatar">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <Avatar src={form.avatar_url} name={form.display_name || me.username} size={80} />
          )}
          <span className="absolute bottom-0 right-0 rounded-full bg-brand p-1.5 text-white">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          </span>
        </button>
        <div className="flex-1">
          <label className="text-xs font-bold text-muted">Display name</label>
          <input
            data-autofocus
            className={input}
            value={form.display_name}
            maxLength={40}
            onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
          />
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => e.target.files?.[0] && pickAvatar(e.target.files[0])} />
      <label className="mt-3 block text-xs font-bold text-muted">
        Status
        <input className={`${input} mt-1`} value={form.status} maxLength={80} placeholder="currently: rewatching Evangelion" onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} />
      </label>
      <label className="mt-3 block text-xs font-bold text-muted">
        Bio
        <textarea
          className={`${input} mt-1 h-20 resize-none`}
          value={form.bio}
          maxLength={280}
          onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
        />
      </label>
      <div className="mt-1 flex justify-end">
        <AtlasAssist value={form.bio} onUse={(t) => setForm((f) => ({ ...f, bio: t.slice(0, 280) }))} tasks={["bio", "rewrite"]} align="end" />
      </div>
      <div className="mt-3">
        <div className="text-xs font-bold text-muted">Flair</div>
        <div className="mt-1 flex flex-wrap gap-1">
          {BADGES.map((b) => (
            <button
              key={b || "none"}
              onClick={() => setForm((f) => ({ ...f, badge: b }))}
              className={`h-9 w-9 rounded-xl text-lg ${form.badge === b ? "bg-brand/25 ring-2 ring-brand" : "hover:bg-card-2"}`}
              aria-label={b ? `Flair ${b}` : "No flair"}
            >
              {b || "∅"}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <div className="text-xs font-bold text-muted">Inside jokes (shown on your profile)</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {jokes.map((j) => (
            <span key={j} className="flex items-center gap-1 rounded-full bg-volt/15 px-2.5 py-1 text-xs font-bold">
              {j}
              <button onClick={() => setJokes((all) => all.filter((x) => x !== j))} aria-label={`Remove ${j}`}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        {jokes.length < 12 && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = joke.trim().slice(0, 40);
              if (v && !jokes.includes(v)) setJokes((all) => [...all, v]);
              setJoke("");
            }}
          >
            <input className={input} value={joke} onChange={(e) => setJoke(e.target.value)} placeholder="the Costco incident" maxLength={40} />
            <Button type="submit" variant="outline">
              Add
            </Button>
          </form>
        )}
      </div>
      <Button onClick={save} disabled={busy || uploading || !form.display_name.trim()} className="mt-5 w-full">
        {busy ? "Saving..." : "Save"}
      </Button>
    </Modal>
  );
}
