"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { StoriesBar } from "@/components/stories/StoriesBar";
import { InlineComposer } from "@/components/feed/InlineComposer";
import { Feed } from "@/components/feed/Feed";
import { ForYouFeed } from "@/components/feed/ForYouFeed";
import { FeedTabs, type FeedTab } from "@/components/feed/FeedTabs";
import { FeaturedStrip, NightlyCard, SiteNotices } from "@/components/yoru/Progression";
import { Empty } from "@/components/ui/bits";
import { useIdentity } from "@/lib/client/gates";

const KEY = "yoru:home-tab";
const noop = () => () => {};
function readTab(): FeedTab | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "latest" || v === "interests" || v === "for_you" ? v : null;
  } catch {
    return null;
  }
}

export default function HomePage() {
  const stored = useSyncExternalStore(noop, readTab, () => null);
  const [picked, setPicked] = useState<FeedTab | null>(null);
  const tab: FeedTab = picked ?? stored ?? "for_you";
  const setTab = (t: FeedTab) => {
    setPicked(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* private mode */
    }
    window.scrollTo({ top: 0 });
  };
  const { data: identity } = useIdentity();
  const noInterests = tab === "interests" && identity && (identity.interests?.length ?? 0) === 0;

  return (
    <div>
      <StoriesBar />
      <div className="mt-4 hidden lg:block">
        <InlineComposer />
      </div>
      <div className="mt-3 space-y-3 empty:hidden">
        <SiteNotices />
        <NightlyCard />
      </div>
      <FeedTabs value={tab} onChange={setTab} />
      {tab === "for_you" && <FeaturedStrip />}
      {tab === "for_you" && <ForYouFeed key="for_you" emptyText="Nothing trending yet. Check Latest for everything new." />}
      {tab === "latest" && <Feed key="latest" mode="latest" live />}
      {tab === "interests" &&
        (noInterests ? (
          <Empty text="Pick a few interests and this tab fills with posts from people who share them.">
            <Link href="/settings" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg">
              Choose interests
            </Link>
          </Empty>
        ) : (
          <Feed key="interests" mode="interests" emptyText="No posts from your interests yet. Try adding more interests in Settings." />
        ))}
    </div>
  );
}
