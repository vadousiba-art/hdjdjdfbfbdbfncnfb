// Renders a dark-theme code editor showing real YORU source (no secrets: a UI
// component), as B-roll for "here's what nobody shows you", plus a broken
// version with type errors for "i've broken it more times than i can count".
//
//   node reel/vscode.mjs  -> photos/part3/broll/vscode.png, vscode-error.png

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const OUT = path.resolve(HERE, "..", "photos", "part3", "broll");
fs.mkdirSync(OUT, { recursive: true });

const FILE = "src/components/feed/PostCard.tsx";
const FIRST = 53;
const lines = fs.readFileSync(path.join(REPO, FILE), "utf8").split("\n").slice(FIRST - 1, FIRST + 37);

const KW = new Set("import from export function return const let if else for while new type interface extends async await default null undefined true false typeof as".split(" "));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function highlight(line) {
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d_.]*\b)|(<\/?[A-Za-z][\w.]*)|(\b[A-Za-z_$][\w$]*\b)|(\s+)|([^\s\w])/g;
  let out = "", m;
  while ((m = re.exec(line))) {
    const [t] = m;
    if (m[1]) out += `<span class=c>${esc(t)}</span>`;
    else if (m[2]) out += `<span class=s>${esc(t)}</span>`;
    else if (m[3]) out += `<span class=n>${esc(t)}</span>`;
    else if (m[4]) out += `<span class=p>${esc(t.slice(0, t.startsWith("</") ? 2 : 1))}</span><span class=tag>${esc(t.replace(/^<\/?/, ""))}</span>`;
    else if (m[5]) {
      const after = line.slice(re.lastIndex);
      const cls = KW.has(t) ? "k" : /^\s*\(/.test(after) ? "fn" : /^[A-Z]/.test(t) ? "t" : /^\s*[=:]/.test(after) && !/^\s*==/.test(after) ? "a" : "v";
      out += `<span class=${cls}>${esc(t)}</span>`;
    } else out += esc(t);
  }
  return out;
}

const tree = [
  ["▾ ISRAELTOK-N-T", 0, "root"], ["▸ android", 1], ["▸ public", 1], ["▾ src", 1], ["▸ app", 2], ["▾ components", 2],
  ["▸ chat", 3], ["▾ feed", 3], ["Feed.tsx", 4, "tsx"], ["FeedTabs.tsx", 4, "tsx"], ["PollView.tsx", 4, "tsx"],
  ["PostCard.tsx", 4, "tsx active"], ["ComposerModal.tsx", 4, "tsx"], ["▸ profile", 3], ["▸ shell", 3], ["▸ yoru", 3],
  ["▸ lib", 2], ["▸ supabase", 1], ["package.json", 1, "json"], ["README.md", 1, "md"],
];

function page(broken) {
  const rows = lines.map((l, i) => {
    const n = FIRST + i;
    let code = highlight(l) || "&nbsp;";
    if (broken && (i === 6 || i === 9)) code = `<span class=err>${code}</span>`;
    return `<div class="row${n === FIRST + 9 ? " cur" : ""}"><span class=ln>${n}</span><span class=code>${code}</span></div>`;
  }).join("");
  const problems = broken
    ? `<div class=panel><div class=ptabs><b>PROBLEMS <i>3</i></b><span>OUTPUT</span><span>TERMINAL</span></div>
       <div class=prob>✖ Property 'media_url' does not exist on type 'PostCore'. ts(2339) <em>PostCard.tsx [Ln 59, Col 18]</em></div>
       <div class=prob>✖ Type 'string | undefined' is not assignable to type 'string'. ts(2322) <em>PostCard.tsx [Ln 62, Col 7]</em></div>
       <div class=prob>✖ Cannot find name 'VideoPlayr'. Did you mean 'VideoPlayer'? ts(2552) <em>PostCard.tsx [Ln 64, Col 10]</em></div></div>`
    : `<div class=panel><div class=ptabs><span>PROBLEMS</span><span>OUTPUT</span><b>TERMINAL</b></div>
       <div class=term><span class=ok>✓</span> Compiled /feed in 812ms<br><span class=dim>○ Local: http://localhost:3000</span></div></div>`;
  return `<!doctype html><html><head><meta charset=utf-8><style>
  @font-face{font-family:Inter;src:url("file://${HERE}/../film/inter.woff2") format("woff2");font-weight:100 900}
  *{box-sizing:border-box}body{margin:0;width:1920px;height:1200px;background:#1f1f1f;font-family:Inter,sans-serif;color:#ccc;overflow:hidden}
  .top{height:38px;background:#181818;border-bottom:1px solid #2b2b2b;display:flex;align-items:center;justify-content:center;font-size:15px;color:#9d9d9d}
  .dots{position:absolute;left:16px;top:12px;display:flex;gap:8px}.dots i{width:13px;height:13px;border-radius:50%;display:block}
  .main{display:flex;height:calc(100% - 38px - 26px)}
  .act{width:52px;background:#181818;border-right:1px solid #2b2b2b;display:flex;flex-direction:column;align-items:center;gap:26px;padding-top:16px}
  .act i{width:24px;height:24px;border:2px solid #858585;border-radius:5px;display:block}.act i.on{border-color:#e7e7e7}
  .side{width:300px;background:#181818;border-right:1px solid #2b2b2b;font-size:15px;padding-top:10px}
  .side h4{margin:4px 18px 10px;font-size:12px;letter-spacing:.08em;color:#9d9d9d;font-weight:600}
  .f{height:26px;line-height:26px;white-space:nowrap;color:#ccc}.f.tsx::before{content:"TS";color:#4d9bdc;font-size:10px;font-weight:800;margin-right:8px}
  .f.json::before{content:"{}";color:#cbcb41;font-size:11px;margin-right:8px}.f.md::before{content:"M↓";color:#519aba;font-size:10px;margin-right:8px}
  .f.active{background:#37373d;color:#fff}
  .ed{flex:1;display:flex;flex-direction:column;min-width:0}
  .tabs{height:40px;background:#181818;display:flex;border-bottom:1px solid #2b2b2b}
  .tab{padding:0 20px;line-height:40px;font-size:15px;color:#9d9d9d;border-right:1px solid #2b2b2b}.tab.on{background:#1f1f1f;color:#fff;border-top:2px solid #e11d48}
  .crumbs{height:28px;line-height:28px;padding-left:24px;font-size:14px;color:#a9a9a9}
  .code{white-space:pre;font-family:"DejaVu Sans Mono",Menlo,monospace}
  .lines{flex:1;font-size:21px;line-height:31px;padding-top:6px;overflow:hidden}
  .row{display:flex;overflow:hidden}.row .code{flex:1;overflow:hidden}.row.cur{background:#ffffff0a}.ln{flex:none;width:84px;text-align:right;padding-right:26px;color:#6e7681;font-family:"DejaVu Sans Mono",monospace}
  .row.cur .ln{color:#ccc}
  .k{color:#569cd6}.s{color:#ce9178}.c{color:#6a9955}.n{color:#b5cea8}.fn{color:#dcdcaa}.t{color:#4ec9b0}.a{color:#9cdcfe}.v{color:#9cdcfe}.tag{color:#4ec9b0}.p{color:#808080}
  .err{text-decoration:underline wavy #f14c4c;text-underline-offset:6px}
  .panel{height:210px;border-top:1px solid #2b2b2b;background:#181818;font-size:15px;padding:0 24px}
  .ptabs{display:flex;gap:28px;height:40px;align-items:center;color:#9d9d9d;font-size:13px;letter-spacing:.04em}.ptabs b{color:#e7e7e7;border-bottom:1px solid #e7e7e7;font-weight:600}
  .ptabs i{font-style:normal;background:#f14c4c;color:#fff;border-radius:9px;padding:0 7px;margin-left:6px}
  .prob{line-height:34px;color:#f14c4c}.prob em{color:#858585;font-style:normal;margin-left:10px}
  .term{font-family:"DejaVu Sans Mono",monospace;line-height:30px;padding-top:8px;font-size:17px}.ok{color:#23d18b}.dim{color:#858585}
  .status{height:26px;background:${broken ? "#c72e2e" : "#e11d48"};color:#fff;font-size:13px;line-height:26px;padding-left:16px;display:flex;gap:24px}
  </style></head><body>
  <div class=top><div class=dots><i style=background:#ff5f57></i><i style=background:#febc2e></i><i style=background:#28c840></i></div>PostCard.tsx — ISRAELTOK-N-T</div>
  <div class=main><div class=act><i class=on></i><i></i><i></i><i></i></div>
  <div class=side><h4>EXPLORER</h4>${tree.map(([t, d, c = ""]) => `<div class="f ${c}" style="padding-left:${14 + d * 16}px">${t}</div>`).join("")}</div>
  <div class=ed><div class=tabs><div class="tab on">PostCard.tsx</div><div class=tab>Feed.tsx</div><div class=tab>ProfileHeader.tsx</div></div>
  <div class=crumbs>src › components › feed › PostCard.tsx › PostMedia</div>
  <div class=lines>${rows}</div>${problems}</div></div>
  <div class=status><span>⎇ main</span><span>${broken ? "⊗ 3  ⚠ 0" : "⊗ 0  ⚠ 0"}</span><span style="margin-left:auto;padding-right:20px">Ln ${FIRST + 9}, Col 18   Spaces: 2   UTF-8   TypeScript JSX</span></div>
  </body></html>`;
}

const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined });
const tab = await browser.newPage({ viewport: { width: 1920, height: 1200 } });
for (const [name, broken] of [["vscode", false], ["vscode-error", true]]) {
  await tab.setContent(page(broken), { waitUntil: "load" });
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("wrote", name);
}
await browser.close();
