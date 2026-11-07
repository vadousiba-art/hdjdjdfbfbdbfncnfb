import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { appMode, supabaseAnonKey, supabaseUrl, realtimeTransport } from "@/lib/config";
import { AppProvider } from "@/components/providers/AppProvider";
import { brandDir } from "@/lib/season";

// Config is read per request (env can differ between build and runtime).
export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const dir = brandDir();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://yoru-social.vercel.app"),
    title: { default: "YORU — 夜", template: "%s · YORU" },
    description: "The internet after dark. A free, Japanese-inspired social network for anime, manga, Vocaloid, gaming and art fans.",
    robots: { index: false, follow: false },
    icons: {
      icon: { url: `${dir}/favicon-512.png`, sizes: "512x512", type: "image/png" },
      apple: { url: `${dir}/apple-icon.png`, sizes: "180x180", type: "image/png" },
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080808" },
    { media: "(prefers-color-scheme: light)", color: "#f5f5f5" },
  ],
};

// Applies the saved theme + motion preference before first paint.
const bootScript = `(function(){try{var t=localStorage.getItem('itn-theme')||'dark';if(t==='system'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t;var m=localStorage.getItem('itn-motion');if(m==='reduce'||m==='full'){document.documentElement.dataset.motion=m}var h=Number(localStorage.getItem('yoru-hue'));if(localStorage.getItem('yoru-hue')&&h>=0&&h<360){document.documentElement.style.setProperty('--accent-h',String(h))}var L=localStorage.getItem('yoru-locale');if(L&&/^[a-z]{2}(-Han[st])?$/.test(L)){document.documentElement.lang=L;document.documentElement.dir=L==='ar'?'rtl':'ltr'}}catch(e){document.documentElement.dataset.theme='dark'}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const mode = appMode();
  const publicConfig = {
    mode,
    supabaseUrl: mode === "supabase" ? (supabaseUrl() ?? null) : null,
    supabaseAnonKey: mode === "supabase" ? (supabaseAnonKey() ?? null) : null,
    realtime: realtimeTransport(),
  };
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-dvh">
        <AppProvider config={publicConfig}>{children}</AppProvider>
      </body>
    </html>
  );
}
