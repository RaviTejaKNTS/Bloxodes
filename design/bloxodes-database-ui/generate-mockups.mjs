import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const outDir = __dirname;
const pagesDir = path.join(outDir, "pages");
const screenshotsDir = path.join(outDir, "screenshots");

const asset = (relativePath) => pathToFileURL(path.join(repoRoot, "public", relativePath)).href;

const assets = {
  logo: asset("Bloxodes-dark.png"),
  gag: {
    carrot: asset("Grow a Garden/Crops/carrot.png"),
    dragonFruit: asset("Grow a Garden/Crops/dragon-fruit.png"),
    sunflower: asset("Grow a Garden/Crops/legacy-sunflower.png"),
    tomato: asset("Grow a Garden/Crops/tomato.png"),
    pet: asset("Grow a Garden/Pets/dragonfly.png"),
    weather: asset("Grow a Garden/Weather/disco.png")
  },
  forge: {
    weapon: asset("The Forge/Weapons/excalibur.webp"),
    ore: asset("The Forge/Ores/diamond.png"),
    armor: asset("The Forge/Armor/dark-knight-chestplate.webp"),
    location: asset("The Forge/Locations/the-forge-480w.webp")
  }
};

const css = `
:root {
  --bg: #fafafa;
  --surface: #ffffff;
  --surface-2: #f5f5f5;
  --surface-3: #eeeeee;
  --fg: #111111;
  --muted: #666666;
  --soft: #8a8a8a;
  --line: #e5e5e5;
  --line-strong: #d4d4d4;
  --accent: #006adc;
  --accent-soft: #edf6ff;
  --good: #11835d;
  --good-soft: #eaf8f1;
  --bad: #c0262d;
  --bad-soft: #fff1f1;
  --warn: #9f5a00;
  --warn-soft: #fff8e8;
  --live: #7c3aed;
  --live-soft: #f5f0ff;
  --radius: 8px;
  --shadow: 0 1px 2px rgba(0,0,0,.04), 0 10px 30px rgba(0,0,0,.04);
}
.theme-dark {
  --bg: #050505;
  --surface: #0d0d0d;
  --surface-2: #151515;
  --surface-3: #202020;
  --fg: #f5f5f5;
  --muted: #a3a3a3;
  --soft: #737373;
  --line: #262626;
  --line-strong: #3f3f3f;
  --accent: #3b9eff;
  --accent-soft: #071b2e;
  --good: #55d99a;
  --good-soft: #082017;
  --bad: #ff6969;
  --bad-soft: #2b0c0c;
  --warn: #f4b74d;
  --warn-soft: #261804;
  --live: #b691ff;
  --live-soft: #180c32;
  --shadow: none;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 14px/1.5 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Arial, sans-serif;
  letter-spacing: 0;
}
a { color: inherit; text-decoration: none; }
img { max-width: 100%; display: block; }
.shell { min-height: 100vh; }
.topbar {
  position: sticky; top: 0; z-index: 10;
  height: 64px; display: flex; align-items: center; gap: 24px;
  border-bottom: 1px solid var(--line); background: rgba(250,250,250,.92);
  backdrop-filter: blur(12px); padding: 0 32px;
}
.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: -.01em; }
.brand-mark { width: 28px; height: 28px; border: 1px solid var(--line); border-radius: 6px; object-fit: contain; background: #fff; padding: 3px; }
.nav { display: flex; align-items: center; gap: 4px; color: var(--muted); font-size: 13px; }
.nav span { padding: 7px 10px; border-radius: 6px; }
.nav .active { color: var(--fg); background: var(--surface-2); }
.search { margin-left: auto; width: 320px; height: 36px; border: 1px solid var(--line); background: var(--surface); border-radius: 6px; color: var(--soft); display:flex; align-items:center; padding: 0 12px; }
.page { max-width: 1280px; margin: 0 auto; padding: 28px 32px 64px; }
.wide { max-width: 1440px; }
.breadcrumbs { display:flex; gap:8px; align-items:center; color: var(--soft); font-size: 12px; margin-bottom: 20px; }
.layout { display:grid; grid-template-columns:minmax(0,1fr) 320px; gap: 28px; align-items:start; }
.layout-wide { display:grid; grid-template-columns: 248px minmax(0,1fr) 320px; gap: 24px; align-items:start; }
.stack { display:grid; gap: 20px; }
.section { border: 1px solid var(--line); background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); }
.section.flat { box-shadow:none; }
.section-head { min-height: 54px; display:flex; justify-content:space-between; align-items:center; gap: 16px; padding: 16px 18px; border-bottom:1px solid var(--line); }
.section-head h2, .section-head h3 { margin: 0; font-size: 17px; line-height:1.2; letter-spacing:-.01em; }
.section-head p { margin: 3px 0 0; color: var(--muted); font-size: 13px; }
.section-body { padding: 18px; }
.hero { display:grid; gap: 18px; margin-bottom: 22px; }
.record-hero {
  display:grid; grid-template-columns: 92px minmax(0,1fr) auto; gap: 18px; align-items:center;
  border: 1px solid var(--line); background: var(--surface); border-radius: var(--radius); padding: 18px; box-shadow: var(--shadow);
}
.record-hero.no-image { grid-template-columns: minmax(0,1fr) auto; }
.hero-img { width: 92px; height: 92px; border-radius: 8px; object-fit: cover; border:1px solid var(--line); background: var(--surface-2); }
.eyebrow { color: var(--soft); text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 700; }
h1 { margin: 4px 0 8px; font-size: 42px; line-height: 1.04; letter-spacing: -.035em; }
.dek { max-width: 720px; margin: 0; color: var(--muted); font-size: 15px; }
.hero-actions { display:flex; gap: 8px; justify-content:flex-end; flex-wrap:wrap; }
.btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:34px; padding: 0 12px; border:1px solid var(--line-strong); border-radius:6px; background:var(--surface); font-weight:650; font-size:13px; }
.btn.primary { background: var(--fg); color:#fff; border-color:var(--fg); }
.meta-row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top: 12px; }
.pill { display:inline-flex; align-items:center; gap:6px; border:1px solid var(--line); border-radius:999px; padding:4px 9px; font-size:12px; font-weight:650; color:var(--muted); background:var(--surface); white-space:nowrap; }
.pill.good { color:var(--good); background:var(--good-soft); border-color:#bfe8d4; }
.pill.bad { color:var(--bad); background:var(--bad-soft); border-color:#ffd3d3; }
.pill.warn { color:var(--warn); background:var(--warn-soft); border-color:#ffe2a6; }
.pill.live { color:var(--live); background:var(--live-soft); border-color:#ddd1ff; }
.stats-grid { display:grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
.stat { border:1px solid var(--line); background:var(--surface); border-radius:8px; padding:13px; }
.stat b { display:block; font-size:22px; letter-spacing:-.03em; line-height:1.1; }
.stat span { display:block; margin-top:4px; color:var(--muted); font-size:12px; }
.tabs { display:flex; gap:5px; padding: 4px; border:1px solid var(--line); background:var(--surface-2); border-radius:8px; width:max-content; }
.tabs span { padding: 6px 10px; border-radius:6px; color:var(--muted); font-size:12px; font-weight:650; }
.tabs .on { background:var(--surface); color:var(--fg); border:1px solid var(--line); }
.toolbar { display:flex; justify-content:space-between; gap:12px; margin-bottom:14px; align-items:center; }
.filter-row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.input { border:1px solid var(--line); background:var(--surface); height:34px; border-radius:6px; color:var(--soft); padding:0 10px; min-width:190px; }
table { width:100%; border-collapse:separate; border-spacing:0; font-size:13px; }
th { text-align:left; color:var(--soft); font-size:11px; text-transform:uppercase; letter-spacing:.08em; font-weight:800; border-bottom:1px solid var(--line); padding: 10px 12px; background:var(--surface-2); }
td { border-bottom:1px solid var(--line); padding: 12px; vertical-align:middle; }
tbody tr:last-child td { border-bottom:0; }
.code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight:800; letter-spacing:.02em; }
.copy { border:1px solid var(--line); border-radius:6px; padding:5px 8px; font-size:12px; font-weight:750; background:var(--surface); }
.item { display:flex; gap:12px; align-items:center; }
.thumb { width:42px; height:42px; border-radius:7px; object-fit:cover; border:1px solid var(--line); background:var(--surface-2); }
.title { font-weight:750; }
.sub { color:var(--muted); font-size:12px; margin-top:2px; }
.grid { display:grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
.grid.two { grid-template-columns: repeat(2,1fr); }
.grid.four { grid-template-columns: repeat(4,1fr); }
.card { border:1px solid var(--line); background:var(--surface); border-radius:8px; padding:14px; }
.card.media { padding:0; overflow:hidden; }
.card-img { height:120px; background:var(--surface-2); object-fit:cover; width:100%; border-bottom:1px solid var(--line); }
.card-body { padding:14px; }
.card h3, .card h4 { margin:0 0 5px; font-size:15px; letter-spacing:-.01em; }
.card p { margin:0; color:var(--muted); font-size:13px; }
.side { position:sticky; top:84px; display:grid; gap:14px; }
.side .section-head { min-height:46px; padding:13px 14px; }
.side .section-body { padding:14px; }
.ad { height:250px; border:1px dashed var(--line-strong); background:repeating-linear-gradient(45deg,#fafafa,#fafafa 8px,#f2f2f2 8px,#f2f2f2 16px); border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--soft); font-size:12px; }
.toc { display:grid; gap:4px; }
.toc a { padding:8px 10px; border-radius:6px; color:var(--muted); font-size:13px; }
.toc .on { color:var(--fg); background:var(--surface-2); font-weight:700; }
.note { border:1px solid var(--line); background:var(--surface-2); border-radius:8px; padding:13px; color:var(--muted); font-size:13px; }
.timeline { display:grid; gap:10px; }
.event { display:grid; grid-template-columns: 10px minmax(0,1fr) auto; gap:12px; align-items:start; border:1px solid var(--line); border-radius:8px; padding:12px; }
.dot { width:10px; height:10px; border-radius:50%; background:var(--soft); margin-top:6px; }
.dot.good { background:var(--good); } .dot.live { background:var(--live); } .dot.bad { background:var(--bad); }
.checklist-board { display:grid; grid-template-columns: repeat(4, minmax(240px,1fr)); gap:12px; overflow:hidden; }
.lane { border:1px solid var(--line); background:var(--surface); border-radius:8px; min-height:620px; }
.lane-head { padding:12px; border-bottom:1px solid var(--line); font-weight:800; }
.tasks { display:grid; gap:8px; padding:10px; }
.task { display:grid; grid-template-columns:18px 1fr; gap:8px; align-items:start; padding:9px; border:1px solid var(--line); border-radius:7px; background:var(--surface-2); font-size:12px; }
.box { width:16px; height:16px; border:1px solid var(--line-strong); border-radius:4px; background:#fff; }
.box.done { background:var(--good); border-color:var(--good); }
.quiz-grid { display:grid; grid-template-columns: minmax(0,1fr) 300px; gap:18px; }
.answer { display:flex; justify-content:space-between; border:1px solid var(--line); border-radius:8px; padding:13px; margin-top:10px; font-weight:650; }
.answer.selected { border-color:var(--accent); background:var(--accent-soft); }
.article-body { display:grid; gap:18px; font-size:16px; color:#333; }
.article-body h2 { margin:0; font-size:24px; letter-spacing:-.02em; }
.article-body p { margin:0; max-width:760px; }
.rank { width:34px; height:34px; border:1px solid var(--line); border-radius:7px; display:flex; align-items:center; justify-content:center; font-weight:850; background:var(--surface-2); }
.style-board { display:grid; gap:24px; }
.palette { display:grid; grid-template-columns:repeat(6,1fr); gap:10px; }
.swatch { height:92px; border:1px solid var(--line); border-radius:8px; padding:10px; display:flex; flex-direction:column; justify-content:end; font-size:12px; font-weight:700; }
.mobile-strip { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.mobile-card { border:1px solid var(--line); background:var(--surface); border-radius:8px; padding:12px; min-height:180px; }
.footer-note { margin-top:36px; border-top:1px solid var(--line); padding-top:18px; color:var(--muted); font-size:12px; }
.codes-v2 { max-width: 1240px; }
.codes-v2 .top-summary {
  display:grid; grid-template-columns: 72px minmax(0,1fr) auto; gap:18px; align-items:start;
  padding-bottom:24px; border-bottom:1px solid var(--line);
}
.codes-v2 .game-icon { width:72px; height:72px; border-radius:10px; object-fit:cover; border:1px solid var(--line); background:var(--surface-2); }
.codes-v2 h1 { margin:2px 0 8px; font-size:44px; line-height:1.04; }
.codes-v2 .page-note { color:var(--muted); max-width:760px; font-size:15px; margin:0; }
.codes-v2 .meta-line { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
.codes-v2 .content-layout { display:grid; grid-template-columns:minmax(0,1fr) 292px; gap:34px; align-items:start; margin-top:26px; }
.codes-v2 .main-flow { display:grid; gap:0; }
.codes-v2 .clean-section { padding:28px 0; border-bottom:1px solid var(--line); }
.codes-v2 .clean-section:first-child { padding-top:0; }
.codes-v2 .clean-section h2 { margin:0 0 10px; font-size:24px; line-height:1.16; letter-spacing:-.025em; }
.codes-v2 .clean-section p { margin:0 0 14px; color:var(--muted); max-width:760px; }
.codes-v2 .section-kicker { color:var(--soft); font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; margin-bottom:8px; }
.codes-v2 .code-table { border:1px solid var(--line); border-radius:8px; overflow:hidden; background:var(--surface); }
.codes-v2 .code-table table { font-size:14px; }
.codes-v2 .code-table th { background:var(--surface-2); }
.codes-v2 .code-table td, .codes-v2 .code-table th { padding:13px 14px; }
.codes-v2 .code-value { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-weight:850; letter-spacing:.03em; }
.codes-v2 .copy-btn { display:inline-flex; align-items:center; justify-content:center; min-height:30px; padding:0 10px; border:1px solid var(--line-strong); border-radius:6px; font-size:12px; font-weight:800; background:transparent; }
.codes-v2 .ordered { display:grid; gap:12px; margin:18px 0 0; padding:0; counter-reset: steps; }
.codes-v2 .ordered li { list-style:none; display:grid; grid-template-columns:32px minmax(0,1fr); gap:12px; align-items:start; color:var(--muted); }
.codes-v2 .ordered li::before { counter-increment:steps; content:counter(steps); display:flex; align-items:center; justify-content:center; width:32px; height:32px; border:1px solid var(--line); border-radius:7px; color:var(--fg); font-weight:850; background:var(--surface); }
.codes-v2 .ordered strong { display:block; color:var(--fg); margin-bottom:2px; }
.codes-v2 .expired-grid { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
.codes-v2 .expired-grid span { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; border:1px solid var(--line); border-radius:6px; padding:7px 9px; color:var(--muted); background:var(--surface); font-size:12px; }
.codes-v2 .info-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; margin-top:16px; }
.codes-v2 .plain-list { display:grid; gap:10px; margin:14px 0 0; padding:0; }
.codes-v2 .plain-list li { list-style:none; padding-left:18px; position:relative; color:var(--muted); }
.codes-v2 .plain-list li::before { content:""; position:absolute; left:0; top:.72em; width:6px; height:6px; border-radius:50%; background:var(--line-strong); }
.codes-v2 .source-links { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
.codes-v2 .source-links span { border:1px solid var(--line); border-radius:6px; padding:8px 10px; font-size:13px; font-weight:750; background:var(--surface); }
.codes-v2 .about-table { margin-top:14px; border-top:1px solid var(--line); }
.codes-v2 .about-row { display:grid; grid-template-columns:170px minmax(0,1fr); gap:16px; padding:12px 0; border-bottom:1px solid var(--line); }
.codes-v2 .about-row span:first-child { color:var(--soft); font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; }
.codes-v2 .side-clean { position:sticky; top:86px; display:grid; gap:18px; }
.codes-v2 .side-block { border-bottom:1px solid var(--line); padding-bottom:18px; }
.codes-v2 .side-block h3 { margin:0 0 12px; font-size:15px; }
.codes-v2 .mini-nav { display:grid; gap:2px; }
.codes-v2 .mini-nav a { color:var(--muted); padding:7px 0; font-size:13px; }
.codes-v2 .mini-nav a:first-child { color:var(--fg); font-weight:750; }
.codes-v2 .side-card { display:flex; gap:10px; align-items:center; padding:9px 0; }
.codes-v2 .side-card img { width:36px; height:36px; border-radius:7px; object-fit:cover; border:1px solid var(--line); background:var(--surface-2); }
.codes-v2 .ad-line { height:220px; border:1px dashed var(--line-strong); border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--soft); font-size:12px; background:var(--surface); }
.codes-v2 .comment-box { border:1px solid var(--line); border-radius:8px; padding:16px; color:var(--muted); background:var(--surface); }
.theme-dark .brand-mark { background:#111; }
.theme-dark .topbar { background:rgba(5,5,5,.88); }
.theme-dark .ad { background:repeating-linear-gradient(45deg,#0d0d0d,#0d0d0d 8px,#141414 8px,#141414 16px); }
.theme-dark .btn.primary { color:#050505; }
@media (max-width: 900px) {
  .topbar { padding:0 16px; }
  .nav { display:none; }
  .search { width:180px; }
  .page { padding:20px 16px 48px; }
  .layout, .layout-wide, .quiz-grid { grid-template-columns:1fr; }
  .side { position:static; }
  .record-hero { grid-template-columns:64px 1fr; }
  .record-hero.no-image { grid-template-columns:1fr; }
  .hero-actions { grid-column:1/-1; justify-content:flex-start; }
  h1 { font-size:32px; }
  .stats-grid, .grid, .grid.two, .grid.four, .palette, .mobile-strip { grid-template-columns:1fr; }
  .checklist-board { grid-template-columns:repeat(2, minmax(240px,1fr)); overflow-x:auto; }
  .codes-v2 .top-summary, .codes-v2 .content-layout, .codes-v2 .info-grid { grid-template-columns:1fr; }
  .codes-v2 .side-clean { position:static; }
  .codes-v2 h1 { font-size:34px; }
}
`;

function shell({ title, active = "Database", body, wide = false, theme = "light", pageClass = "" }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${css}</style>
</head>
<body class="${theme === "dark" ? "theme-dark" : ""}">
  <div class="shell">
    <header class="topbar">
      <div class="brand"><img class="brand-mark" src="${assets.logo}" alt=""> Bloxodes</div>
      <nav class="nav">
        ${["Codes", "Events", "Catalog", "Tools", "Wiki", "Checklists", "Quizzes", "Lists"].map((item) => `<span class="${active === item ? "active" : ""}">${item}</span>`).join("")}
      </nav>
      <div class="search">Search games, tools, items...</div>
    </header>
    <main class="page ${wide ? "wide" : ""} ${pageClass}">${body}</main>
  </div>
</body>
</html>`;
}

const breadcrumbs = (items) => `<div class="breadcrumbs">${items.join(" <span>/</span> ")}</div>`;
const pill = (text, kind = "") => `<span class="pill ${kind}">${text}</span>`;
const ad = () => `<div class="ad">Mediavine Journey placement reserved</div>`;

function hero({ type, title, dek, img, stats = [], actions = [], pills = [], noImage = false }) {
  return `<section class="hero">
    <div class="record-hero ${noImage ? "no-image" : ""}">
      ${noImage ? "" : `<img class="hero-img" src="${img}" alt="">`}
      <div>
        <div class="eyebrow">${type}</div>
        <h1>${title}</h1>
        <p class="dek">${dek}</p>
        <div class="meta-row">${pills.join("")}</div>
      </div>
      <div class="hero-actions">${actions.map((a, i) => `<span class="btn ${i === 0 ? "primary" : ""}">${a}</span>`).join("")}</div>
    </div>
    ${stats.length ? `<div class="stats-grid">${stats.map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join("")}</div>` : ""}
  </section>`;
}

function sideRail({ title = "Page Tools", links = [], related = true }) {
  return `<aside class="side">
    <section class="section flat"><div class="section-head"><h3>${title}</h3></div><div class="section-body"><div class="toc">${links.map((l, i) => `<a class="${i === 0 ? "on" : ""}">${l}</a>`).join("")}</div></div></section>
    ${ad()}
    ${related ? `<section class="section flat"><div class="section-head"><h3>Related</h3></div><div class="section-body stack">
      <div class="item"><img class="thumb" src="${assets.gag.pet}" alt=""><div><div class="title">Grow a Garden Wiki</div><div class="sub">Stats, events, badges</div></div></div>
      <div class="item"><img class="thumb" src="${assets.forge.weapon}" alt=""><div><div class="title">The Forge tools</div><div class="sub">Calculators and databases</div></div></div>
    </div></section>` : ""}
  </aside>`;
}

function codesPage(theme = "light") {
  const activeRows = [
    ["MOTORUSH", "Free cash and boosts", "Working", "Checked today"],
    ["RACEWEEK", "Bonus cash", "Working", "Checked today"],
    ["UPDATE7", "Free spin", "Working", "Checked 2h ago"]
  ];
  const expired = ["THANKYOU", "SPEEDY", "RELEASE", "BOOST", "SORRY4BUGS", "NEWRACE", "100KLIKES", "WEEKEND"];
  return shell({ active: "Codes", title: `Codes page ${theme}`, theme, pageClass: "codes-v2", body: `
    ${breadcrumbs(["Home", "Codes", "MotoRush"])}
    <header class="top-summary">
      <img class="game-icon" src="${assets.gag.dragonFruit}" alt="">
      <div>
        <div class="eyebrow">Roblox codes tracker</div>
        <h1>MotoRush Codes (April 2026)</h1>
        <p class="page-note">We check MotoRush codes regularly and keep this page split into active codes, redeem steps, expired codes, reward notes, and official places to find more codes.</p>
        <div class="meta-line">
          ${pill("Updated Apr 30, 2026")}
          ${pill("Last checked today", "good")}
          ${pill("3 active codes", "good")}
          ${pill("8 expired tracked")}
        </div>
      </div>
      <div class="hero-actions">
        <span class="btn primary">Copy active codes</span>
        <span class="btn">Open Roblox</span>
      </div>
    </header>

    <div class="content-layout">
      <article class="main-flow">
        <section class="clean-section" id="intro">
          <div class="section-kicker">Intro</div>
          <p>Use the active MotoRush codes below before they expire. Code rewards can change by update, so copy the code exactly and redeem it inside the game.</p>
        </section>

        <section class="clean-section" id="active-codes">
          <div class="section-kicker">Active codes</div>
          <h2>Active MotoRush Codes</h2>
          <p>These are the codes currently marked as working. Copy buttons stay close to the code value so the page feels like a tool, not a long article.</p>
          <div class="code-table">
            <table>
              <thead><tr><th>Code</th><th>Reward</th><th>Status</th><th>Last checked</th><th></th></tr></thead>
              <tbody>
                ${activeRows.map(([code, reward, status, checked]) => `<tr><td class="code-value">${code}</td><td>${reward}</td><td>${pill(status, "good")}</td><td>${checked}</td><td><span class="copy-btn">Copy</span></td></tr>`).join("")}
              </tbody>
            </table>
          </div>
        </section>

        <div class="clean-section">
          <div class="ad-line">Mediavine Journey in-content slot</div>
        </div>

        <section class="clean-section" id="redeem">
          <div class="section-kicker">Redeem</div>
          <h2>How to Redeem MotoRush Codes</h2>
          <p>The redeem section keeps the existing page intent, but uses a tighter step list instead of heavy cards.</p>
          <ol class="ordered">
            <li><div><strong>Open MotoRush on Roblox.</strong> Join a server from the official game page.</div></li>
            <li><div><strong>Open the codes menu.</strong> Look for the Codes, Gift, or Settings button in the game UI.</div></li>
            <li><div><strong>Paste one active code.</strong> Submit it and check your balance or inventory for the reward.</div></li>
          </ol>
        </section>

        <section class="clean-section" id="expired">
          <div class="section-kicker">Archive</div>
          <h2>Expired MotoRush Codes</h2>
          <p>Expired codes are still useful for players checking old videos, Discord posts, or copied lists.</p>
          <div class="expired-grid">${expired.map((code) => `<span>${code}</span>`).join("")}</div>
        </section>

        <section class="clean-section" id="troubleshoot">
          <div class="section-kicker">Troubleshooting</div>
          <h2>Why Codes Might Not Work</h2>
          <ul class="plain-list">
            <li>The code may have expired after a new update or event.</li>
            <li>The code may be case-sensitive or include hidden spaces after copy-paste.</li>
            <li>The server may need a restart before a newly released code works.</li>
          </ul>
        </section>

        <section class="clean-section" id="rewards">
          <div class="section-kicker">Rewards</div>
          <h2>What Rewards You Normally Get?</h2>
          <p>MotoRush codes usually give free in-game boosts, cash, spins, or event rewards. Exact rewards are shown in the active codes table when we can verify them.</p>
        </section>

        <section class="clean-section" id="more-codes">
          <div class="section-kicker">Sources</div>
          <h2>Where to Find New Codes for MotoRush</h2>
          <p>We track official sources and update this page when new codes drop. Players can also check the game page and community channels directly.</p>
          <div class="source-links">
            <span>Roblox game</span>
            <span>Discord</span>
            <span>Twitter / X</span>
            <span>@bloxodes</span>
            <span>Chrome extension</span>
          </div>
        </section>

        <section class="clean-section" id="about">
          <div class="section-kicker">Game details</div>
          <h2>About MotoRush</h2>
          <p>A compact game details block preserves the existing “About” section while making it easier to scan.</p>
          <div class="about-table">
            <div class="about-row"><span>Developer</span><strong>MotoRush Studios</strong></div>
            <div class="about-row"><span>Genre</span><strong>Vehicle simulator</strong></div>
            <div class="about-row"><span>Platforms</span><strong>Desktop, Mobile, Tablet, Console</strong></div>
            <div class="about-row"><span>Data freshness</span><strong>Codes checked today</strong></div>
          </div>
        </section>

        <section class="clean-section" id="comments">
          <div class="section-kicker">Comments</div>
          <h2>Comments</h2>
          <div class="comment-box">No comments yet. Be the first to share a working code or a redemption tip.</div>
        </section>
      </article>

      <aside class="side-clean">
        <div class="side-block">
          <h3>On this page</h3>
          <nav class="mini-nav">
            <a>Active codes</a>
            <a>How to redeem</a>
            <a>Expired codes</a>
            <a>Why codes fail</a>
            <a>Rewards</a>
            <a>Where to find more</a>
            <a>About MotoRush</a>
          </nav>
        </div>
        <div class="side-block">
          <h3>Ad placement</h3>
          <div class="ad-line">Sidebar ad slot</div>
        </div>
        <div class="side-block">
          <h3>Related</h3>
          <div class="side-card"><img src="${assets.gag.pet}" alt=""><div><strong>Events for MotoRush</strong><div class="sub">Upcoming and past events</div></div></div>
          <div class="side-card"><img src="${assets.forge.weapon}" alt=""><div><strong>More games with codes</strong><div class="sub">Fresh code pages</div></div></div>
        </div>
      </aside>
    </div>` });
}

function eventsPage() {
  return shell({ active: "Events", title: "Events tracker", body: `
    ${breadcrumbs(["Home", "Events", "Grow a Garden"])}
    <div class="layout">
      <div class="stack">
        ${hero({
          type: "Live event tracker",
          title: "Grow a Garden Events",
          dek: "Tracker-first layout: upcoming events, live events, and archive. Only intro/outro copy stays around the data.",
          img: assets.gag.weather,
          pills: [pill("Updated 12 min ago", "good"), pill("1 live", "live"), pill("3 upcoming", "warn")],
          actions: ["Subscribe", "Open Roblox"],
          stats: [["Upcoming", "3"], ["Live now", "1"], ["Past events", "42"], ["Next start", "2h 14m"]]
        })}
        <section class="section"><div class="section-head"><div><h2>Upcoming events</h2><p>Sorted by start time. No filler sections between users and the schedule.</p></div></div><div class="section-body timeline">
          ${[
            ["Beanstalk Storm", "Starts Apr 30, 7:00 PM PT", "Weather rotation with mutation boosts.", "warn"],
            ["Disco Mutation Weekend", "Starts May 2, 10:00 AM PT", "Limited event weather and shop restocks.", "warn"],
            ["Garden Market Restock", "Starts May 3, 9:00 AM PT", "Merchant inventory refresh.", "warn"]
          ].map(([n,t,d,k]) => `<div class="event"><span class="dot ${k}"></span><div><div class="title">${n}</div><div class="sub">${t}</div><p class="sub">${d}</p></div><span class="btn">Details</span></div>`).join("")}
        </div></section>
        <section class="section"><div class="section-head"><h2>Current running events</h2><span>${pill("Live", "live")}</span></div><div class="section-body">
          <div class="event"><span class="dot live"></span><div><div class="title">Safari Harvest</div><div class="sub">Ends in 8h 22m · Started Apr 30, 11:00 AM PT</div><p class="sub">Active tracker card with countdown and verified Roblox event link.</p></div><span class="btn primary">Open</span></div>
        </div></section>
        <section class="section"><div class="section-head"><h2>Past events</h2><p>Archive stays searchable and compact.</p></div><div class="section-body"><table><thead><tr><th>Event</th><th>Started</th><th>Ended</th><th>Guide</th></tr></thead><tbody>
          ${["Easter Finale", "Bee Swarm", "Night Market", "Blood Moon"].map((e, i) => `<tr><td>${e}</td><td>Apr ${20 - i}, 2026</td><td>Apr ${21 - i}, 2026</td><td><span class="copy">Guide</span></td></tr>`).join("")}
        </tbody></table></div></section>
      </div>
      ${sideRail({ links: ["Upcoming", "Live now", "Past events", "Source notes", "Related pages"] })}
    </div>` });
}

function catalogPage() {
  const items = [
    ["Carrot", assets.gag.carrot, "Common", "Seed Shop", "18"],
    ["Dragon Fruit", assets.gag.dragonFruit, "Legendary", "Seed Pack", "4,287"],
    ["Sunflower", assets.gag.sunflower, "Mythical", "Event", "14,000"],
    ["Tomato", assets.gag.tomato, "Uncommon", "Seed Shop", "32"]
  ];
  return shell({ active: "Catalog", title: "Catalog database", body: `
    ${breadcrumbs(["Home", "Catalog", "Grow a Garden Crops"])}
    <div class="layout">
      <div class="stack">
        ${hero({
          type: "Catalog database",
          title: "All Grow a Garden Crops",
          dek: "Dataset-first catalog pages with filters, sortable columns, and short context. The table is the page.",
          img: assets.gag.sunflower,
          pills: [pill("412 entries"), pill("Images synced", "good"), pill("Dataset updated today")],
          actions: ["Export CSV", "Suggest edit"],
          stats: [["Total crops", "412"], ["Mutations", "86"], ["Sources", "3"], ["Updated", "Today"]]
        })}
        <section class="section"><div class="section-head"><div><h2>Crop database</h2><p>Filter by rarity, source, value, mutation support, or event availability.</p></div></div>
          <div class="section-body"><div class="toolbar"><div class="filter-row"><div class="input">Search crops...</div><span class="btn">Rarity</span><span class="btn">Source</span><span class="btn">Event only</span></div><span class="sub">Showing 4 of 412</span></div>
          <table><thead><tr><th>Crop</th><th>Rarity</th><th>Source</th><th>Base value</th><th>Tracker</th></tr></thead><tbody>${items.map(([n,img,r,s,v]) => `<tr><td><div class="item"><img class="thumb" src="${img}" alt=""><div><div class="title">${n}</div><div class="sub">Grow a Garden</div></div></div></td><td>${pill(r, r === "Mythical" ? "live" : r === "Legendary" ? "warn" : "")}</td><td>${s}</td><td>${v}</td><td><span class="copy">Open</span></td></tr>`).join("")}</tbody></table></div>
        </section>
        <section class="section"><div class="section-head"><h2>Short notes</h2></div><div class="section-body grid two"><div class="note">Intro copy is one concise paragraph, not a long guide.</div><div class="note">FAQ stays scoped to source, updates, and how values are calculated.</div></div></section>
      </div>
      ${sideRail({ links: ["Database", "Filters", "Value notes", "FAQ", "Comments"] })}
    </div>` });
}

function toolsPage() {
  return shell({ active: "Tools", title: "Tool page", body: `
    ${breadcrumbs(["Home", "Tools", "Grow a Garden Crop Value Calculator"])}
    <div class="layout">
      <div class="stack">
        ${hero({
          type: "Interactive tool",
          title: "Grow a Garden Crop Value Calculator",
          dek: "The calculator appears above the fold. Supporting copy explains inputs after the task is usable.",
          img: assets.gag.dragonFruit,
          pills: [pill("Calculator", "good"), pill("Uses 412 crops"), pill("Updated today")],
          actions: ["Reset", "Share"],
          stats: [["Selected crop", "Dragon Fruit"], ["Weight", "3.2kg"], ["Mutations", "4"], ["Estimate", "92.4K"]]
        })}
        <section class="section"><div class="section-head"><div><h2>Calculator</h2><p>Dense, task-first controls with no article block above the tool.</p></div></div><div class="section-body">
          <div class="grid two">
            <div class="card"><h3>Inputs</h3><div class="stack"><div class="input">Crop: Dragon Fruit</div><div class="input">Weight: 3.2 kg</div><div class="input">Quantity: 8</div><div class="filter-row"><span class="pill good">Gold</span><span class="pill live">Disco</span><span class="pill warn">Shocked</span></div></div></div>
            <div class="card"><h3>Result</h3><div class="stat" style="margin-top:12px"><b>92,416</b><span>Total Sheckles estimate</span></div><table><tbody><tr><td>Base value</td><td>18,400</td></tr><tr><td>Mutation multiplier</td><td>5.02x</td></tr><tr><td>Confidence</td><td>${pill("High", "good")}</td></tr></tbody></table></div>
          </div>
        </div></section>
        <section class="section"><div class="section-head"><h2>How this tool works</h2></div><div class="section-body grid three">${["Pick an item", "Apply modifiers", "Read the breakdown"].map((t) => `<div class="card"><h3>${t}</h3><p>Compact explanation after the utility, kept for trust and SEO.</p></div>`).join("")}</div></section>
      </div>
      ${sideRail({ links: ["Calculator", "Result", "How it works", "FAQ", "Comments"] })}
    </div>` });
}

function wikiPage() {
  return shell({ active: "Wiki", title: "Wiki page", body: `
    ${breadcrumbs(["Home", "Wiki", "The Forge"])}
    <div class="layout">
      <div class="stack">
        ${hero({
          type: "Game wiki",
          title: "The Forge Wiki",
          dek: "A compact game record: stats, systems, badges, media, developer links, and related databases.",
          img: assets.forge.location,
          pills: [pill("Roblox universe"), pill("Updated 1h ago", "good"), pill("Tracked systems: 8")],
          actions: ["Play", "Report data"],
          stats: [["Playing now", "18.2K"], ["Visits", "1.4B"], ["Badges", "42"], ["Related pages", "9"]]
        })}
        <section class="section"><div class="section-head"><h2>Game record</h2></div><div class="section-body grid four">
          ${[["Genre","Adventure"],["Created","2024"],["Age rating","9+"],["Platforms","All"]].map(([a,b]) => `<div class="stat"><b>${b}</b><span>${a}</span></div>`).join("")}
        </div></section>
        <section class="section"><div class="section-head"><h2>Systems</h2><p>Wiki sections are database modules, not long prose chapters.</p></div><div class="section-body grid three">
          ${[["Weapons", assets.forge.weapon],["Ores", assets.forge.ore],["Armor", assets.forge.armor]].map(([t,img]) => `<div class="card media"><img class="card-img" src="${img}" alt=""><div class="card-body"><h3>${t}</h3><p>Open structured catalog.</p></div></div>`).join("")}
        </div></section>
        <section class="section"><div class="section-head"><h2>Badges</h2></div><div class="section-body"><table><thead><tr><th>Badge</th><th>Awarded</th><th>Rarity</th></tr></thead><tbody><tr><td>First Forge</td><td>2.1M</td><td>Common</td></tr><tr><td>Crystal Depths</td><td>126K</td><td>Rare</td></tr></tbody></table></div></section>
      </div>
      ${sideRail({ links: ["Overview", "Systems", "Badges", "Media", "Developer"] })}
    </div>` });
}

function checklistPage() {
  const lanes = ["Core setup", "Crops", "Pets", "Events"];
  return shell({ active: "Checklists", title: "Checklist page", wide: true, body: `
    ${breadcrumbs(["Home", "Checklists", "Grow a Garden"])}
    ${hero({
      type: "Progress checklist",
      title: "Grow a Garden Checklist",
      dek: "Keep the successful board-like checklist product, but wrap it in cleaner controls and database navigation.",
      img: assets.gag.pet,
      pills: [pill("284 tasks"), pill("Local progress saved", "good"), pill("63% complete", "warn")],
      actions: ["Sync", "Reset filters"],
      stats: [["Completed", "179"], ["Remaining", "105"], ["Sections", "18"], ["Updated", "Today"]]
    })}
    <section class="section"><div class="section-head"><div><h2>Checklist board</h2><p>Horizontal database board with tighter cards and progress controls.</p></div><div class="filter-row"><span class="btn">Hide done</span><span class="btn">Collapse sections</span></div></div>
      <div class="section-body"><div class="checklist-board">${lanes.map((lane, i) => `<div class="lane"><div class="lane-head">${i + 1}. ${lane}</div><div class="tasks">${Array.from({ length: 7 }).map((_, j) => `<div class="task"><span class="box ${j < 3 ? "done" : ""}"></span><span>${lane} task ${j + 1}<div class="sub">Optional note or source link</div></span></div>`).join("")}</div></div>`).join("")}</div></div>
    </section>` });
}

function quizPage() {
  return shell({ active: "Quizzes", title: "Quiz page", body: `
    ${breadcrumbs(["Home", "Quizzes", "The Forge"])}
    ${hero({
      type: "Interactive quiz",
      title: "The Forge Quiz",
      dek: "Quiz pages stay lightweight, but answer review and related databases add value beyond a thin game.",
      img: assets.forge.weapon,
      pills: [pill("15 questions"), pill("Difficulty: mixed"), pill("Progress saved", "good")],
      actions: ["Restart", "Share"],
      stats: [["Question", "6/15"], ["Score", "4"], ["Time", "2:31"], ["Accuracy", "67%"]]
    })}
    <div class="quiz-grid">
      <section class="section"><div class="section-head"><div><h2>Question 6</h2><p>Which ore has the highest listed value in this sample?</p></div></div><div class="section-body">
        ${["Diamond", "Copper", "Stone", "Iron"].map((a, i) => `<div class="answer ${i === 0 ? "selected" : ""}"><span>${a}</span><span>${i === 0 ? "Selected" : ""}</span></div>`).join("")}
        <div class="note" style="margin-top:16px">Post-answer explanations link directly to the relevant catalog row.</div>
      </div></section>
      <section class="section"><div class="section-head"><h3>Review panel</h3></div><div class="section-body"><div class="stats-grid" style="grid-template-columns:1fr 1fr"><div class="stat"><b>4</b><span>Correct</span></div><div class="stat"><b>2</b><span>Missed</span></div></div><div class="toc" style="margin-top:14px"><a class="on">Weapons</a><a>Ores</a><a>NPCs</a></div></div></section>
    </div>` });
}

function listPage() {
  const games = ["Tower of Hell", "Mega Easy Obby", "Speed Run 4", "Obby But You’re a Ball", "Cart Ride Tower"];
  return shell({ active: "Lists", title: "List page", body: `
    ${breadcrumbs(["Home", "Lists", "Top Trending Tower Obby Games"])}
    <div class="layout">
      <div class="stack">
        ${hero({
          type: "Live ranking",
          title: "Top Trending Roblox Tower Obby Games",
          dek: "Ranking pages need methodology and scan-first metrics, not filler paragraphs.",
          img: assets.gag.pet,
          pills: [pill("Refreshed hourly", "good"), pill("100 games ranked"), pill("Metric: growth")],
          actions: ["Change genre", "Methodology"],
          stats: [["Tracked games", "100"], ["Median growth", "+8.4%"], ["Freshness", "1h"], ["Signals", "5"]]
        })}
        <section class="section"><div class="section-head"><div><h2>Rankings</h2><p>Compact rows with visible metric reason.</p></div></div><div class="section-body"><table><thead><tr><th>Rank</th><th>Game</th><th>Playing</th><th>Growth</th><th>Why ranked</th></tr></thead><tbody>
        ${games.map((g,i) => `<tr><td><span class="rank">#${i+1}</span></td><td><div class="item"><img class="thumb" src="${i % 2 ? assets.gag.dragonFruit : assets.gag.pet}" alt=""><div><div class="title">${g}</div><div class="sub">Tower obby</div></div></div></td><td>${(18-i*2).toFixed(1)}K</td><td>${pill(`+${24-i*3}%`, "good")}</td><td>High recent player growth</td></tr>`).join("")}
        </tbody></table></div></section>
        <section class="section"><div class="section-head"><h2>Methodology</h2></div><div class="section-body grid three">${["Playing now", "Recent growth", "Update freshness"].map((t)=>`<div class="card"><h3>${t}</h3><p>Short scoring note helps trust without turning the page into an article.</p></div>`).join("")}</div></section>
      </div>
      ${sideRail({ links: ["Rankings", "Methodology", "More lists", "Comments"] })}
    </div>` });
}

function articlePage() {
  return shell({ active: "Codes", title: "Article page", body: `
    ${breadcrumbs(["Home", "Articles", "Roblox Error 103"])}
    <div class="layout">
      <article class="stack">
        ${hero({
          type: "Guide article",
          title: "Roblox Error 103 Fix on Xbox Explained",
          dek: "Articles remain editorial, but the design separates actual guide content from database pages.",
          img: assets.forge.location,
          pills: [pill("Guide"), pill("Updated Apr 30, 2026"), pill("6 min read")],
          actions: ["Save", "Share"]
        })}
        <section class="section"><div class="section-head"><h2>Quick fix checklist</h2></div><div class="section-body grid three">${["Check account age settings", "Allow multiplayer", "Restart Roblox"].map((t)=>`<div class="card"><h3>${t}</h3><p>Immediate answer block before the full explanation.</p></div>`).join("")}</div></section>
        <section class="section"><div class="section-body article-body">
          <h2>Why Roblox Error 103 happens on Xbox</h2><p>Error 103 usually means Roblox cannot join the experience because of account privacy, multiplayer restrictions, or compatibility settings.</p>
          <h2>How to fix the error</h2><p>Work through the settings in order, then retry the experience from the same Xbox profile.</p>
          <h2>When to contact support</h2><p>If settings are correct and the error persists across multiple experiences, collect the account and device details before contacting support.</p>
        </div></section>
      </article>
      ${sideRail({ title: "Article Tools", links: ["Quick fix", "Why it happens", "Steps", "Support", "Comments"] })}
    </div>` });
}

function homePage() {
  return shell({ active: "Database", title: "Home database hub", wide: true, body: `
    ${hero({
      type: "Roblox database and tools",
      title: "Track codes, events, items, tools, and game data faster.",
      dek: "The homepage becomes a compact command center for high-intent Roblox tasks rather than a blog front page.",
      noImage: true,
      pills: [pill("134K+ monthly page views"), pill("Database-first redesign"), pill("Minimal content, high utility", "good")],
      actions: ["Search database", "Browse tools"],
      stats: [["Code pages", "100+"], ["Catalog entries", "1.2K+"], ["Tools", "6"], ["Trackers", "Live"]]
    })}
    <section class="section"><div class="section-head"><h2>Primary surfaces</h2><p>Every family uses the same product language: records, trackers, databases, and tools.</p></div><div class="section-body grid four">
      ${[
        ["Codes", "Verified rewards and expired history"],
        ["Events", "Upcoming, live, and past tracker"],
        ["Catalog", "Structured item databases"],
        ["Tools", "Calculators and utilities"],
        ["Wiki", "Game record pages"],
        ["Checklists", "Progress boards"],
        ["Quizzes", "Interactive knowledge checks"],
        ["Lists", "Live ranked datasets"]
      ].map(([t,d])=>`<div class="card"><h3>${t}</h3><p>${d}</p></div>`).join("")}
    </div></section>
    <section class="section"><div class="section-head"><h2>Latest updates</h2></div><div class="section-body"><table><thead><tr><th>Type</th><th>Page</th><th>Status</th><th>Updated</th></tr></thead><tbody>${[
      ["Code", "MotoRush Codes", "Verified", "18 min ago"],
      ["Event", "Grow a Garden Events", "Live", "12 min ago"],
      ["Catalog", "The Forge Weapons", "Synced", "Today"],
      ["Tool", "Crop Value Calculator", "Updated", "Today"]
    ].map(([a,b,c,d])=>`<tr><td>${a}</td><td>${b}</td><td>${pill(c, c==="Live"?"live":"good")}</td><td>${d}</td></tr>`).join("")}</tbody></table></div></section>
  ` });
}

function styleGuidePage() {
  return shell({ active: "Database", title: "Style guide", wide: true, body: `
    <div class="style-board">
      ${hero({
        type: "Design system concept",
        title: "Bloxodes Database UI",
        dek: "Minimal, Vercel-like structure with Roblox-specific status, thumbnails, trackers, and utility controls.",
        noImage: true,
        pills: [pill("Neutral base"), pill("8px radius"), pill("Status color only"), pill("Scan-first")],
        actions: ["Stable SEO", "Surgical rollout"]
      })}
      <section class="section"><div class="section-head"><h2>Visual language</h2></div><div class="section-body palette">
        ${[
          ["#fafafa","Background"],["#ffffff","Surface"],["#111111","Text"],["#666666","Muted"],["#006adc","Action"],["#11835d","Active"],
          ["#c0262d","Expired"],["#9f5a00","Upcoming"],["#7c3aed","Live"],["#e5e5e5","Border"],["#f5f5f5","Subtle"],["#edf6ff","Accent soft"]
        ].map(([c,n])=>`<div class="swatch" style="background:${c}; color:${["#111111","#666666","#006adc","#11835d","#c0262d","#9f5a00","#7c3aed"].includes(c) ? "#fff" : "#111"}">${n}<br>${c}</div>`).join("")}
      </div></section>
      <section class="section"><div class="section-head"><h2>Component grammar</h2><p>Reusable across all page families.</p></div><div class="section-body grid four">
        ${["Record hero", "Status pills", "Data tables", "Tool panels", "Tracker timelines", "Compact cards", "Ad reserves", "Side TOC"].map((t)=>`<div class="card"><h3>${t}</h3><p>Consistent spacing, visible state, and stable slots.</p></div>`).join("")}
      </div></section>
      <section class="section"><div class="section-head"><h2>Mobile direction</h2></div><div class="section-body mobile-strip">
        <div class="mobile-card"><div class="eyebrow">Hero</div><h3>Small record header</h3><p>Image, title, status, and one primary action.</p></div>
        <div class="mobile-card"><div class="eyebrow">Data</div><h3>Stacked rows</h3><p>Tables become compact record rows with key metrics first.</p></div>
        <div class="mobile-card"><div class="eyebrow">Ads</div><h3>Reserved positions</h3><p>Ad placements remain predictable during rollout.</p></div>
      </div></section>
    </div>` });
}

const pages = [
  ["00-style-guide", styleGuidePage],
  ["01-home", homePage],
  ["02-codes-light", () => codesPage("light")],
  ["02-codes-dark", () => codesPage("dark")],
  ["03-events", eventsPage],
  ["04-catalog", catalogPage],
  ["05-tools", toolsPage],
  ["06-wiki", wikiPage],
  ["07-checklist", checklistPage],
  ["08-quiz", quizPage],
  ["09-list", listPage],
  ["10-article", articlePage]
];

async function writeBrief() {
  const brief = `# Bloxodes Database UI Concept

This concept keeps production SEO/content untouched and explores a safer visual direction for a phased redesign.

## North Star

Bloxodes should feel like a fast Roblox database and utility product, not a traditional blog. The UI should support scanning, comparison, copying, filtering, tracking, and returning.

## Principles

- Keep URLs, H1 intent, metadata, canonical logic, schema, feeds, sitemaps, and ad contracts stable during rollout.
- Use short intro/outro copy around high-value data modules.
- Make the primary task visible above the fold: code table, event tracker, calculator, catalog table, checklist board, quiz runner, ranking table, or wiki record.
- Use neutral Vercel-like structure with Roblox-specific thumbnails and status colors.
- Preserve reserved ad spaces while testing so revenue behavior is measurable.
- Roll out by template family, starting with events, then tools/catalog, then lists/codes refinements.

## Page Family Shape

- Home: database command center and latest updates.
- Codes: code table first, redeem steps second, game facts and expired archive.
- Events: intro, upcoming, current, past archive, concise notes.
- Catalog: searchable/filterable dataset first, compact notes/FAQ.
- Tools: interactive UI first, explanation after the tool.
- Wiki: game record, systems, badges, media, developer, related pages.
- Checklists: progress board with compact controls.
- Quizzes: runner plus answer review and related learning links.
- Lists: rankings plus visible methodology.
- Articles: only genuinely editorial guides, with quick-answer blocks.
`;
  await fs.writeFile(path.join(outDir, "README.md"), brief, "utf8");
}

async function main() {
  await fs.mkdir(pagesDir, { recursive: true });
  await fs.mkdir(screenshotsDir, { recursive: true });
  await writeBrief();

  for (const [name, build] of pages) {
    await fs.writeFile(path.join(pagesDir, `${name}.html`), build(), "utf8");
  }

  const localChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await chromium.launch({
    executablePath: fsSync.existsSync(localChrome) ? localChrome : undefined
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 }, deviceScaleFactor: 1 });
  for (const [name] of pages) {
    const htmlPath = path.join(pagesDir, `${name}.html`);
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(screenshotsDir, `${name}.png`), fullPage: true });
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
