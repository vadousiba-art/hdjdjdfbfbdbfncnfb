"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import clsx from "clsx";
import { Moon } from "lucide-react";
import { randomLoading } from "@/lib/jokes";

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(m, 1)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()} className={className} suppressHydrationWarning>
      {timeAgo(iso)}
    </time>
  );
}

export function VerifiedBadge({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Verified" role="img" className="shrink-0">
      <path
        fill="var(--brand)"
        d="M12 1.8l2.4 1.8 3-.2 1 2.8 2.6 1.5-.6 2.9 1.4 2.6-2.1 2.1-.2 3-2.9.6L15 21.6l-3-1-3 1-1.6-2.7-2.9-.6-.2-3L2.2 13.2l1.4-2.6L3 7.7l2.6-1.5 1-2.8 3 .2z"
      />
      <path d="M7.6 12.3l3 3 5.8-6.2" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChaosLoader({ className, label }: { className?: string; label?: string }) {
  const [line, setLine] = useState(label ?? "Loading...");
  useEffect(() => {
    if (label) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLine(randomLoading());
    const t = setInterval(() => setLine(randomLoading()), 2200);
    return () => clearInterval(t);
  }, [label]);
  return (
    <div className={clsx("flex flex-col items-center justify-center gap-3 py-10 text-muted", className)} role="status">
      <span className="h-7 w-7 rounded-full border-2 border-line border-t-brand motion-safe:animate-spin" aria-hidden />
      <motion.p key={line} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="text-center text-sm">
        {line}
      </motion.p>
    </div>
  );
}

export function PostSkeleton() {
  return (
    <div className="border-b border-line/70 py-3.5" aria-hidden>
      <div className="flex items-center gap-2.5">
        <div className="skeleton h-[38px] w-[38px] rounded-full" />
        <div className="space-y-1.5">
          <div className="skeleton h-3.5 w-32" />
          <div className="skeleton h-3 w-20" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-2/3" />
      </div>
      <div className="skeleton mt-3 h-56 w-full rounded-xl" />
    </div>
  );
}

// `emoji` is accepted for older call sites; YORU uses one calm moon glyph.
export function Empty({ text, children }: { emoji?: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <Moon size={30} strokeWidth={1.5} className="text-brand" aria-hidden />
      <p className="max-w-xs text-sm text-muted">{text}</p>
      {children}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={clsx("flex cursor-pointer items-center justify-between gap-4 py-3", disabled && "opacity-50")}>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-brand" : "bg-line",
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 600, damping: 30 }}
          className={clsx("absolute top-1 h-5 w-5 rounded-full bg-white shadow", checked ? "end-1" : "start-1")}
        />
      </button>
    </label>
  );
}

export function Button({
  variant = "primary",
  className,
  children,
  ...rest
}: React.ComponentProps<"button"> & { variant?: "primary" | "ghost" | "danger" | "chaos" | "outline" }) {
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition active:scale-95 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-brand text-white hover:bg-brand-2",
        variant === "ghost" && "text-ink hover:bg-card-2",
        variant === "outline" && "border border-line text-ink hover:bg-card-2",
        variant === "danger" && "bg-brand text-white hover:bg-brand-2",
        variant === "chaos" && "bg-brand text-white hover:bg-brand-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PageTitle({ children, sub }: { children: React.ReactNode; emoji?: string; sub?: string }) {
  return (
    <div className="mb-4 px-1">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        {children}
      </h1>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

export function NameLink({ username, children, className }: { username: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={`/u/${username}`} className={clsx("hover:underline", className)} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}
