// "What's new in YORU": versioned release notes. Only shipped, working
// features belong here; each entry must match code that is live.
import type { MessageKey } from "@/lib/i18n/messages/en";

export const WHATS_NEW_EVENT = "yoru:whats-new";
export const RELEASE_SEEN_KEY = "yoru-release-seen";

export type ReleaseSlide = { kicker: string; title: string; body: string; href?: string; cta?: MessageKey };

export type Release = { version: string; name: string; date: string; slides: ReleaseSlide[] };

export const CURRENT_RELEASE: Release = {
  version: "2.2",
  name: "Night Watch",
  date: "2026-10-28",
  slides: [
    {
      kicker: "夜 A cleaner YORU",
      title: "A new look, built around your posts.",
      body: "Edge-to-edge photos and videos, For You, Latest and Interests tabs, and a simpler tab bar: Home, Watch, Create, Inbox and you.",
    },
    {
      kicker: "映 Watch",
      title: "Swipe through videos.",
      body: "Watch plays videos full screen, one per swipe. Videos in your feed now play on their own, muted, as you scroll. Tap the speaker for sound.",
      href: "/watch",
      cta: "nav.watch",
    },
    {
      kicker: "信 Inbox",
      title: "Messages, reorganised.",
      body: "Your group chats sit in a rail on the left, with who's active now at the top. Notices from YORU arrive from the official account.",
      href: "/chat",
      cta: "nav.inbox",
    },
    {
      kicker: "守 Night Watch",
      title: "Safer, and fair about it.",
      body: "New automated moderation stops slurs, scams and spam before they post. Every decision is explained in Account Standing, and you can appeal. Bans are always decided by a person.",
      href: "/standing",
      cta: "nav.standing",
    },
  ],
};

// Earlier releases, kept for reference.
export const PREVIOUS_RELEASES: Release[] = [
  {
    version: "2.1",
    name: "Night Universe",
    date: "2026-10-28",
    slides: [
      {
        kicker: "宇宙 Night Universe",
        title: "Your profile can move now.",
        body: "Animated rings, living banners, nameplates, badges, themes and effects. Hundreds of cosmetics, with a free set for every member and more you earn by taking part.",
        href: "/pro/shop",
        cta: "nav.pro",
      },
      {
        kicker: "試 Try before anything",
        title: "Try on any look.",
        body: "Preview any ring, banner or nameplate on your own profile. Try-ons stay on your device. Nothing is saved or shown to anyone until you equip something you own.",
        href: "/pro/shop",
        cta: "nav.pro",
      },
      {
        kicker: "予 Drafts & planner",
        title: "Write now, post later.",
        body: "Save private drafts, plan posts on a calendar and schedule them for the time you choose. Scheduled posts go out as you, under the same rules as every post.",
      },
      {
        kicker: "数 Your numbers",
        title: "Analytics from real activity only.",
        body: "Reach, reactions, comments and profile visit totals for your own posts. Nobody ever sees who visited, not even you.",
      },
      {
        kicker: "夜 YORU Pro",
        title: "Pro is coming soon.",
        body: "Purchases aren't open yet, so nobody can be charged. Some members are testing Pro for free. Pro never changes who sees your posts.",
        href: "/pro",
        cta: "nav.pro",
      },
    ],
  },
  {
    version: "2.0",
    name: "Open Gates",
    date: "2026-10-27",
    slides: [
      {
        kicker: "門 Open Gates",
        title: "YORU opens up.",
        body: "A bigger, more personal YORU: your language, your interests, your look, and new ways to find your people. Everything you had is still here.",
      },
      {
        kicker: "言 16 languages",
        title: "YORU speaks your language.",
        body: "Pick from 16 interface languages in Settings, including Arabic with right-to-left layout. Posts stay exactly as their authors wrote them.",
        href: "/settings",
        cta: "nav.settings",
      },
      {
        kicker: "縁 Discover",
        title: "Find people who share your interests.",
        body: "Add up to 8 interests, then explore people with the same ones, anywhere in the world. Prefer to stay hidden? Switch off “Show me in Discover”.",
        href: "/explore",
        cta: "nav.explore",
      },
      {
        kicker: "顔 Your profile",
        title: "Banners, frames and a badge showcase.",
        body: "Choose a banner style and avatar frame, pin your three proudest badges, and save up to 3 favourite looks to switch between.",
        href: "/settings",
        cta: "nav.settings",
      },
      {
        kicker: "集 Collections",
        title: "Organise what you save.",
        body: "Group posts into named collections. Keep them to yourself or share them with members.",
        href: "/collections",
        cta: "nav.collections",
      },
      {
        kicker: "影 Ghost Mode",
        title: "Go invisible.",
        body: "Turn on Ghost Mode in Settings → Privacy. Your online dot disappears and YORU stops recording when you were last active.",
        href: "/settings",
        cta: "nav.settings",
      },
      {
        kicker: "創 Creators",
        title: "The Creator Showcase is open.",
        body: "Artists, writers, cosplayers and musicians can apply for a creator label. Every application is reviewed by an admin.",
        href: "/creators",
        cta: "nav.creators",
      },
    ],
  },
];
