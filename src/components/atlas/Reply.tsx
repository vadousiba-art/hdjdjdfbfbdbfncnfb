"use client";

import { Fragment, useState } from "react";
import { Check, Copy, PenLine, UserRound } from "lucide-react";
import { useSWRConfig } from "swr";
import { rpc } from "@/lib/client/api";
import { byFn } from "@/lib/client/hooks";
import { splitDrafts, type Piece } from "@/lib/client/atlas";
import { useApp } from "@/components/providers/AppProvider";
import { useShell } from "@/components/shell/AppShell";
import { Modal } from "@/components/ui/Modal";

// A small, safe markdown subset for Atlas's replies: paragraphs, lists,
// **bold**, *italic*, `code`, code blocks and https links. Built as React
// nodes (never raw HTML), so a reply can't inject anything into the page.
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)]+|\*[^*\s][^*]*\*)/g;
  let at = 0;
  let i = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > at) out.push(text.slice(at, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k} className="rounded bg-card-2 px-1 py-px font-mono text-[0.9em]">{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) {
      const [, label, href] = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      out.push(<a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-brand underline">{label}</a>);
    } else if (t.startsWith("http")) out.push(<a key={k} href={t} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-brand underline">{t}</a>);
    else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    at = m.index + t.length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

function Markdown({ text }: { text: string }) {
  const blocks = text.split(/(```[\s\S]*?(?:```|$))/g);
  return (
    <>
      {blocks.map((b, bi) => {
        if (b.startsWith("```")) {
          const body = b.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
          return <pre key={bi} className="my-2 overflow-x-auto rounded-xl bg-black/50 p-3 font-mono text-[13px] leading-relaxed text-ink"><code>{body.trimEnd()}</code></pre>;
        }
        const lines = b.split("\n");
        const nodes: React.ReactNode[] = [];
        let list: { ordered: boolean; items: string[] } | null = null;
        const flush = () => {
          if (!list) return;
          const L = list.ordered ? "ol" : "ul";
          nodes.push(<L key={`l${nodes.length}`} className={list.ordered ? "my-1 list-decimal ps-5" : "my-1 list-disc ps-5"}>{list.items.map((it, j) => <li key={j}>{inline(it, `${bi}-${nodes.length}-${j}`)}</li>)}</L>);
          list = null;
        };
        lines.forEach((ln, li) => {
          const bullet = ln.match(/^\s*[-*•]\s+(.*)$/);
          const num = ln.match(/^\s*\d+[.)]\s+(.*)$/);
          if (bullet || num) {
            const ordered = Boolean(num);
            if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
            list.items.push((bullet ?? num)![1]);
            return;
          }
          flush();
          const h = ln.match(/^#{1,4}\s+(.*)$/);
          if (h) nodes.push(<p key={`h${li}`} className="mt-2 font-bold">{inline(h[1], `${bi}h${li}`)}</p>);
          else if (ln.trim()) nodes.push(<p key={`p${li}`} className="my-1">{inline(ln, `${bi}p${li}`)}</p>);
        });
        flush();
        return <Fragment key={bi}>{nodes}</Fragment>;
      })}
    </>
  );
}

const LABEL = { post: "Post draft", bio: "Bio draft", comment: "Comment draft", message: "Message draft" } as const;

function DraftCard({ piece }: { piece: Extract<Piece, { kind: "draft" }> }) {
  const { openComposer } = useShell();
  const { toast, toastError } = useApp();
  const { mutate } = useSWRConfig();
  const [copied, setCopied] = useState(false);
  const [confirmBio, setConfirmBio] = useState(false);
  const [saving, setSaving] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(piece.text).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const tooLong = piece.target === "bio" && piece.text.length > 280;
  return (
    <div className="my-2 overflow-hidden rounded-2xl border border-brand/40 bg-brand/5">
      <div className="flex items-center justify-between border-b border-brand/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-brand">
        {LABEL[piece.target]}
        <span className="font-mono text-muted">{piece.text.length}</span>
      </div>
      <p className="whitespace-pre-wrap px-3 py-2.5 text-[15px] leading-relaxed">{piece.text}</p>
      <div className="flex flex-wrap gap-1.5 px-3 pb-3">
        {piece.target === "post" && (
          <button type="button" onClick={() => openComposer({ tab: "text", text: piece.text.slice(0, 2000) })}
            className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white">
            <PenLine size={13} /> Open in composer
          </button>
        )}
        {piece.target === "bio" && (
          <button type="button" disabled={tooLong} onClick={() => setConfirmBio(true)}
            className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
            <UserRound size={13} /> {tooLong ? "Too long for a bio" : "Use as my bio"}
          </button>
        )}
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-bold">
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <Modal open={confirmBio} onClose={() => setConfirmBio(false)} title="Replace your bio?">
        <p className="whitespace-pre-wrap rounded-xl bg-card-2 p-3 text-sm">{piece.text}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirmBio(false)} className="rounded-full border border-line px-4 py-2 text-sm font-bold">Cancel</button>
          <button type="button" disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await rpc("update_my_profile", { p: { bio: piece.text } });
                mutate(byFn("get_me", "get_profile"));
                toast("Bio updated.", "success", "✦");
                setConfirmBio(false);
              } catch (err) {
                toastError(err);
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Save bio</button>
        </div>
      </Modal>
    </div>
  );
}

export function Reply({ text, streaming }: { text: string; streaming?: boolean }) {
  const pieces = splitDrafts(text);
  return (
    <div className={streaming ? "atlas-caret" : undefined}>
      {pieces.map((p, i) => (p.kind === "draft" && !(streaming && i === pieces.length - 1) ? <DraftCard key={i} piece={p} /> : <Markdown key={i} text={p.text} />))}
    </div>
  );
}
