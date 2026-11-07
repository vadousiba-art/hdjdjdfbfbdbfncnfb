"use client";

import clsx from "clsx";
import { brandDir, seasonAt } from "@/lib/season";

/* eslint-disable @next/next/no-img-element */

export const BRAND = "YORU";
export const BRAND_JP = "夜";
export const TAGLINE = "THE INTERNET AFTER DARK.";
export const TAGLINE_JP = "夜は、まだ終わらない。";

// The YORU | 夜 wordmark, cut from the official logo artwork. During a season
// (see lib/season) it swaps to that season's art, which keeps its own colors
// rather than following the accent hue: a pumpkin should stay orange.
export function Logo({ width = 170, className }: { width?: number; className?: string; spinOnTap?: boolean }) {
  const season = seasonAt();
  const dir = brandDir(season);
  const height = Math.round((width * (season ? 257 : 213)) / 868);
  return (
    <span className={clsx(!season && "hue-follow", "relative inline-block select-none", className)} style={{ width, height }} role="img" aria-label="YORU 夜">
      <img src={`${dir}/wordmark.png`} alt="" className="absolute inset-0 hidden h-full w-full dark:block" draggable={false} />
      <img src={`${dir}/wordmark-light.png`} alt="" className="absolute inset-0 h-full w-full dark:hidden" draggable={false} />
    </span>
  );
}

export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  const season = seasonAt();
  return (
    <img
      src={`${brandDir(season)}/mark.png`}
      alt=""
      width={size}
      height={Math.round((size * (season ? 174 : 148)) / 159)}
      className={clsx(!season && "hue-follow", "select-none", className)}
      draggable={false}
    />
  );
}

export function Tagline({ className, size = "sm" }: { className?: string; size?: "sm" | "lg" }) {
  return (
    <div className={clsx("tagline text-center text-ink", size === "lg" ? "text-[12px]" : "text-[8.5px]", className)}>
      {TAGLINE}
    </div>
  );
}
