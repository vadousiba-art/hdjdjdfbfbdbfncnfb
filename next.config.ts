import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Microphone for YORU's own pages only (Atlas voice); camera and location stay off.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  // PGlite ships a WASM Postgres; keep it out of the server bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The APK used to be served as israeltoknt.apk; old links keep working.
  async redirects() {
    return [{ source: "/download/israeltoknt.apk", destination: "/download/yoru.apk", permanent: false }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Welcome film files live under a versioned folder (/welcome/v1/...),
      // so they never change in place and can be cached for a year.
      { source: "/welcome/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // Serve the APK as a plain file download (stores fetch it from this URL).
      {
        source: "/download/:file*",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="YORU.apk"' },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300" },
        ],
      },
    ];
  },
};

export default nextConfig;
