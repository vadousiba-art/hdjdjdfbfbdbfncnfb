// Character sheet for checking the art (node film/render.mjs --sheet): colour versions.
import { head, standing, PAL } from "./art.js";

export function sheet(g) {
  const bg = g.createLinearGradient(0, 0, 0, 1920);
  bg.addColorStop(0, "#ffb27a");
  bg.addColorStop(0.5, "#e2557a");
  bg.addColorStop(1, "#3a2b6e");
  g.fillStyle = bg;
  g.fillRect(0, 0, 1080, 1920);
  const at = (x, y, s, fn) => { g.save(); g.translate(x, y); g.scale(s, s); fn(); g.restore(); };
  at(0, 0, 0.6, () => head(g, { pal: PAL.hero, headphones: true, eyes: "open", mouth: "soft", rim: 1 }));
  at(360, 0, 0.6, () => head(g, { pal: PAL.bob, hair: "bob", mouth: "grin", eyes: "smile", earring: true, collar: "tee" }));
  at(720, 0, 0.6, () => head(g, { pal: PAL.curly, hair: "curly", mouth: "smile", headset: true, collar: "jacket" }));
  at(0, 440, 0.6, () => head(g, { pal: PAL.cap, hair: "cap", mouth: "open", collar: "dark", eyes: "wide" }));
  at(360, 440, 0.6, () => head(g, { pal: PAL.long, hair: "long", glasses: true, mouth: "soft", collar: "tee" }));
  at(720, 440, 0.6, () => head(g, { pal: PAL.buns, hair: "buns", mouth: "grin", eyes: "smile", blush: true }));
  at(0, 880, 0.6, () => head(g, { pal: PAL.undercut, hair: "undercut", shave: true, mouth: "smile", earring: true, collar: "jacket" }));
  at(380, 900, 0.4, () => standing(g, { pal: PAL.hero, headphones: true, eyes: "open", mouth: "soft", rim: 1 }));
  at(760, 880, 0.6, () => head(g, { headphones: true, eyes: "open", mouth: "soft" }));
}
