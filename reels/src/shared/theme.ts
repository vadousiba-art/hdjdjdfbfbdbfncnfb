// Copied from brand/theme.ts (the YORU theme, see brand/BRAND.md).
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const C = {
  night: "#080808",
  night2: "#0C0C0C",
  card: "#121212",
  card2: "#1A1A1A",
  line: "#292929",
  ink: "#F5F5F5",
  ink2: "#D6D6D6",
  muted: "#999999",
  red: "#F20D2F",
  redBright: "#FF3355",
  redDark: "#A30F25",
  logoWhite: "#FFF3EE",
} as const;

export const FONT = '"Inter", system-ui, sans-serif';
export const KANJI = '"YoruKanji", "Inter", sans-serif';
export const EMOJI = '"Noto Color Emoji", "Apple Color Emoji", sans-serif';

// the app's tagline treatment
export const TAGLINE: React.CSSProperties = {
  fontFamily: FONT,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.32em",
};

// soft shadow + thin dark edge for white text over footage
export const TEXT_ON_VIDEO: React.CSSProperties = {
  textShadow: "0 3px 12px rgba(0,0,0,0.75)",
  WebkitTextStroke: "2px rgba(0,0,0,0.35)",
  paintOrder: "stroke fill",
};

export const loadBrandFonts = () =>
  Promise.all([
    loadFont({ family: "Inter", url: staticFile("brand/fonts/inter-latin-wght.woff2"), weight: "100 900" }),
    loadFont({ family: "YoruKanji", url: staticFile("brand/fonts/yoru-kanji.woff2"), weight: "900" }),
  ]);
