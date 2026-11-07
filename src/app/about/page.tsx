import type { Metadata } from "next";
import QRCode from "qrcode";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: { absolute: "YORU — The internet after dark" },
  description:
    "YORU (夜) is a free social network for anime, manga, music, Vocaloid, gaming and art fans. Posts, stories, group chats, nightly streaks, animated profile cosmetics, scheduled posts and an AI comedian. Use it on the web or download the Android app.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "YORU — The internet after dark",
    description: "Find your people. A free social network for anime, manga, Vocaloid, gaming and art fans.",
    images: [{ url: "/welcome/v1/og.jpg", width: 1200, height: 630, alt: "YORU 夜 — Your world. Your identity. Your night." }],
    url: "/about",
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/brand/yoru/feature-graphic.png"] },
};

const SITE = "https://yoru-social.vercel.app";

export default async function AboutPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const qrSvg = await QRCode.toString(`${SITE}/download/yoru.apk`, { type: "svg", margin: 0, color: { dark: "#080808", light: "#ffffff" } });
  return <Landing qrSvg={qrSvg} deleted={Boolean(deleted)} />;
}
