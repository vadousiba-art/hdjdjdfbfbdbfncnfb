"use client";

import clsx from "clsx";
import { mediaSrc } from "@/lib/client/api";
import { item, type RingP } from "@/lib/pro/catalog";
import { RingOverlay } from "@/components/pro/art/Ring";

// Initials avatars use shades of the app color so they match the theme.
const GRADIENTS = [
  "linear-gradient(135deg,var(--brand),var(--ring-b))",
  "linear-gradient(135deg,var(--ring-b),#1a1a1a)",
  "linear-gradient(135deg,var(--brand-2),var(--brand))",
  "linear-gradient(135deg,#2e2e2e,var(--ring-b))",
  "linear-gradient(135deg,var(--brand),#141414)",
  "linear-gradient(135deg,#3a3a3a,#141414)",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type Props = {
  src?: string | null;
  name: string;
  size?: number;
  ring?: "none" | "gradient" | "brand" | "story" | "seen";
  online?: boolean;
  className?: string;
  // YORU Pro ring (item id). Small avatars draw it without motion.
  proRing?: string | null;
};

export function Avatar({ src, name, size = 44, ring = "none", online, className, proRing }: Props) {
  const pro = item<RingP>(proRing);
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const ringPad = ring === "none" ? 0 : ring === "story" || ring === "seen" ? 3 : 2.5;
  const inner = size - ringPad * 2 - (ring === "none" ? 0 : 3);
  const image = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaSrc(src)}
      alt=""
      width={inner}
      height={inner}
      className="h-full w-full rounded-full object-cover"
      loading="lazy"
      draggable={false}
    />
  ) : (
    <div
      className="flex h-full w-full items-center justify-center rounded-full font-bold text-white"
      style={{ background: GRADIENTS[hash(name) % GRADIENTS.length], fontSize: Math.max(10, inner * 0.38) }}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );

  return (
    <div className={clsx("relative shrink-0", className)} style={{ width: size, height: size }}>
      {ring === "none" ? (
        <div className="h-full w-full overflow-hidden rounded-full">{image}</div>
      ) : (
        <div
          className={clsx(
            "h-full w-full rounded-full",
            ring === "gradient" && "ring-gradient",
            ring === "brand" && "bg-brand",
            ring === "story" && "bg-brand",
            ring === "seen" && "bg-line",
          )}
          style={{ padding: ringPad }}
        >
          <div className="h-full w-full rounded-full bg-bg p-[2px]">{image}</div>
        </div>
      )}
      {pro?.cat === "ring" && <RingOverlay p={pro.p} size={size} still={size < 64} />}
      {online && (
        <span
          className="absolute rounded-full border-[2.5px] border-bg bg-online"
          style={{ width: size * 0.24, height: size * 0.24, right: size * 0.02, bottom: size * 0.02 }}
          aria-label="online"
        />
      )}
    </div>
  );
}
