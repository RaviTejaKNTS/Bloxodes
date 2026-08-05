Evidence checked:
- Existing Bloxodes coverage:
  - Production `articles` query on `universe_id = 7529591378`: **0 published articles** for Practical Basketball.
  - Broader `articles` search for `dunk` in slug/title: **no overlap**.
  - Production wiki hub exists: `/wiki/practical-basketball` (`wiki_pages.slug = practical-basketball`, `universe_id = 7529591378`).
  - Production wiki collections exist: `/wiki/practical-basketball/badges`, `/wiki/practical-basketball/takeovers`.
  - No production `code_pages` row for `practical-basketball`.
  - Local datasets: `data/Practical Basketball/badges.json`, `data/Practical Basketball/takeovers.json`.
  - Companion article `how-to-lob-and-self-lob-in-practical-basketball` is being written in parallel and is **not** in production yet.
- Game universe_id (if game-specific): **7529591378** (matches `apps/web/src/lib/game-collections/games/practical-basketball.ts` and production `wiki_pages.universe_id`). Note: production `roblox_universes` also has other Practical Basketball stress-test universe rows (`9986138618`, `9908265961`, etc.), but the wiki and local game config use **7529591378**.
- Internal link candidates (existing same-game/related pages with slugs, 2+):
  - `/wiki/practical-basketball` — Practical Basketball wiki hub
  - `/wiki/practical-basketball/badges` — badge collection (link High Flyer, Traffic Finisher, Relentless Finisher when mentioning build help)
  - `/wiki/practical-basketball/takeovers` — takeover collection (link Highlight Reel for slashers, Diesel for big contact finishes)
  - Planned companion (not live yet): `/articles/how-to-lob-and-self-lob-in-practical-basketball`
- Source/competitor coverage:
  - Beebom lead (Aug 5, 2026): dedicated dunk guide with standing, driving, self lob dunk, contact dunk, E-vs-Space warning, timing meter, FAQ.
  - Beebom companion lob guide (Aug 5, 2026): self lob `Shift+F`, finish with `E` layup or `Space` dunk.
  - allthings.how Stress Test 3 controls (Aug 2026): authoritative-style PC keybind table; driving dunk `Shift+Spacebar`, standing dunk `Hold Spacebar`, layup `Hold E while running`, self lob `F`, jelly `Q after timing`, double clutch `F after timing`.
  - allthings.how full controls + lob/self-lob articles: same dunk inputs; contact dunk described as momentum + `Shift+Space`; self lob finish table matches Beebom (`E` layup / `Space` dunk); self lob throw listed as `Shift+F` in lob article but `F` in self-lob PC article and ST3 table.
  - TheSpike (Jan 18, 2026): standing/driving dunk basics, self alley-oop `F` while driving, shoot/layup on `E`.
  - Noleep controls/self-lob guides (Aug 2026): `Shift+Space` dunk, self lob timing meter; some wording differs on when to press `F`.
  - YouTube `xlzQ-7gaW8g` (ALL CONTROLS GUIDE): driving dunk `Shift` sprint + hold/release `Space` in green; lob dunk `Space+F` together; self lob `F`.
  - Treyexgaming beginner guide: `Shift+Space` driving dunk, `Hold Spacebar` standing dunk; lists jelly on `Q` and double clutch on `F` after timing — useful but secondary to dunk core.
  - gamestratwiki beginner guide: mostly dribble-focused; finishing section is vague and not strong for exact dunk inputs.
- Sources found:
  - https://beebom.com/how-to-dunk-in-practical-basketball/
  - https://beebom.com/how-to-lob-and-self-lob-in-practical-basketball/
  - https://allthings.how/practical-basketball-controls-full-pc-xbox-and-ps5-keybinds-stress-test-3/
  - https://allthings.how/practical-basketball-full-controls-guide-for-keyboard-and-controller-roblox/
  - https://allthings.how/practical-basketball-how-to-self-lob-on-pc-and-controller/
  - https://allthings.how/practical-basketball-how-to-throw-lobs-and-self-lobs/
  - https://allthings.how/practical-basketball-every-keyboard-and-mouse-keybind-pc/
  - https://www.thespike.gg/roblox/beginner-guides/roblox-practical-basketball-controls-guide
  - https://noleep.com/en/practical-basketball-simulator-roblox-controls-guide/
  - https://noleep.com/en/how-to-self-lob-practical-basketball-simulator-roblox/
  - https://www.youtube.com/watch?v=xlzQ-7gaW8g
  - Bloxodes local: `data/Practical Basketball/badges.json`, `data/Practical Basketball/takeovers.json`
- Sources used for exact facts:
  - **Standing dunk input + timing meter:** Beebom, allthings.how ST3, TheSpike, allthings.how full controls.
  - **Driving dunk input + timing meter:** Beebom, allthings.how ST3, TheSpike, Noleep, YouTube `xlzQ-7gaW8g`.
  - **E triggers layup / shooting, not dunk:** Beebom, allthings.how ST3, TheSpike, allthings.how full controls.
  - **Contact dunk = driving dunk input with momentum/matchup, not separate button:** Beebom, allthings.how full controls.
  - **Self lob dunk sequence (throw then finish with Space):** Beebom dunk article, Beebom lob article, allthings.how lob article, TheSpike self alley-oop section.
  - **Spacing/momentum requirements and common failure causes:** Beebom, allthings.how ST3, TheSpike.
  - **Badge/takeover support for contact/driving dunks (high level only):** Bloxodes local badges/takeovers datasets + allthings.how build articles for contextual support, not as universal stat gates.
- Sources checked but not usable:
  - https://www.treyexgaming.com/practical-basketball-beginner-guide/ — useful secondary for jelly/double-clutch keys, but conflicts with ST3 on jelly key (`Q` vs `E`) and is not needed for core dunk steps.
  - https://gamestratwiki.com/practical-basketball-beginner-guide/ — thin/vague on dunk inputs; controller-centric phrasing.
  - https://trendsmask.com/how-post-up-in-practical-basketball-roblox-1154044.html — unreliable generic post-up copy with questionable keybinds (`X` for post-up).
  - Build-tier articles (allthings.how build tier list, LeBron build, 6'8 demigod, bloxrant 6'9 build) — good for optional “build helps dunk consistency” color, but not for universal minimum dunk requirements.
  - YouTube build showcases (`FMjPmW4YRgQ`, `FKqz3Kjd6C4`, `2ldYDZ1rvMI`) — gameplay proof only, not step-by-step dunk tutorials.
- Search limitations:
  - No direct access to in-game overlay, official Discord/Trello, or live Stress Test 3 build during research; keybind drift between stress-test builds is explicitly warned in allthings.how ST3.
  - Self lob throw input disagrees across otherwise reliable guides (`F` alone vs `Shift+F` vs `Space+F` together). Treat as **documented disagreement**, not a single confirmed binding.
  - Jelly/double-clutch finish keys disagree (`Q`, `E`, `C`, `F`) across secondary sources; do not teach them as core dunk facts unless parent wants a short optional sidebar with “check in-game overlay” wording.
  - No clean, rights-clear body images found without competitor branding or watermarks.
- Related page-type overlap:
  - **Wiki hub** (`/wiki/practical-basketball`) should stay broad game overview, not a dunk how-to.
  - **Wiki collections** cover badges/takeovers inventory, not input tutorials.
  - **Companion lob article** should own teammate lob + full self-lob setup/troubleshooting; this dunk article should keep self lob dunk to a short cross-linked subsection.
  - **Controls mega-guides** on competitor sites already list all keybinds; Bloxodes angle is a fast, scannable dunk-only guide with wiki links for build support.
- Useful uncovered angle:
  - Clear **Space vs E** framing: `E` is shoot/layup; dunks use `Space` (with `Shift` on drives). This directly answers the most common player mistake and is well supported.
  - Simple dunk-type table (standing, driving, self lob dunk, contact dunk) with one-line “when to use” beats repeating full controls lists.
  - Light wiki links to dunk-relevant badges/takeovers without turning the article into a build guide.
  - Short troubleshooting tied to spacing, momentum, meter timing, and wrong button — matches Beebom FAQ and multiple independent guides.

Media plan:
- YouTube match quality (perfect / near / none): **near**
- YouTube candidate URL and reason:
  - https://www.youtube.com/watch?v=xlzQ-7gaW8g — covers driving dunk (`Shift` + timed `Space`) and lob/self-lob dunk timing (`Space+F`), but it is a full controls guide, not dunk-only. Good research reference; **not a perfect embed** for a dunk-focused article.
- Image candidates (source URL, what it shows, clean yes/no, rights note):
  - No strong hosted candidates. allthings.how and Beebom use generic Roblox/competitor imagery; not safe to reuse without capture.
  - Optional in-game captures during local preview: timing meter at rim, standing position under basket, driving approach line — only if writing/preview can source Bloxodes-owned screenshots.
- Images to host (0-3, with planned file stems):
  - 0 by default. If parent approves capture during preview:
    - `dunk-timing-meter.webp` — green-zone timing meter at rim
    - `standing-dunk-position.webp` — player parked under basket before `Space`
- Cover image plan (null / generated / hosted cover.webp): **null** (import flow can generate from universe thumbnail)

Article plan:
- Working title: How to Dunk in Practical Basketball (Roblox)
- Suggested slug: how-to-dunk-in-practical-basketball
- Title promise: Show every main dunk type in Practical Basketball on PC, the exact inputs, when to use each one, and why a finish turns into a layup or miss.
- Reader need: Player knows the game has dunks and a timing meter but keeps getting layups, misses, or wrong animations because they use `E`, start too far out, or mistime the green zone.
- Facts to use:
  - Dunks are **not automatic**; spacing, approach angle, and momentum matter.
  - **Standing dunk:** position very close under the basket with little/no movement; **hold `Space`**; release timing meter in the **green zone**.
  - **Driving dunk:** **sprint with `Shift`**, attack the rim with forward momentum; press **`Shift + Space`** as you reach the paint; release in the green zone. Best started just outside the restricted area, not from half court.
  - **Contact dunk:** same input as a driving dunk (`Shift + Space`); special animation can trigger when you have speed and favorable positioning against a defender. Higher dunk rating, vertical, and strength help; badges like Traffic Finisher / Relentless Finisher and takeovers like Highlight Reel or Diesel can improve contact finishes (link wiki collections, no stat thresholds required in body).
  - **Self lob dunk (short version):** throw a self lob while driving (`F`, with some guides listing `Shift+F` because sprint is already held), catch near the rim, then finish with **`Space`** for a dunk (or `E` for a layup). Best on open fast breaks. Defer full lob setup/troubleshooting to companion article.
  - **Avoid `E` near the basket when you want a dunk** — `E` is shoot/layup (`Hold E while running` = layup per ST3/TheSpike).
  - Tutorials often teach only standing dunk; driving and self lob dunks are the practical scoring tools once basics work.
  - Practice on an empty court/shootaround until the meter timing is consistent.
  - Most builds can dunk in the right spot, but taller builds and stronger finishing attributes make standing/driving/contact dunks more reliable (Beebom FAQ + ST3 build-threshold note — keep soft wording).
- Facts to avoid:
  - Exact minimum driving-dunk / vertical stat numbers as universal requirements (sources vary by build article and badge tier examples).
  - Treating jelly, double-clutch, or dunk-cancel keys as settled (`Q` vs `E` vs `C` vs `F` conflict across sources).
  - Claiming one definitive self-lob throw binding (`F` only vs `Shift+F` only vs simultaneous `Space+F`) without noting stress-test variance.
  - Full teammate lob tutorial (companion article territory).
  - Mobile/controller keybind tables unless parent expands scope; ST3 has controller mappings, but the lead and competitor dunk guides are PC-first.
  - Codes, patch dates, “latest/meta” claims, or active stress-test naming beyond a brief note that inputs can change between builds.
  - Copying Beebom’s Fisch comparison line or fluff analogies.
- FAQ opportunities:
  - Why does my dunk turn into a layup? (`E` instead of `Space`, bad angle, low momentum, defender directly under rim, early/late meter.)
  - Can every build dunk? (Most can in the right situation; taller/high-finishing builds are more consistent.)
  - What is the difference between a driving dunk and a contact dunk? (Same button; contact is a situational animation with momentum/matchup.)
  - Do I need a self lob to dunk? (No — standing and driving dunks are the baseline; self lob dunk is optional/advanced.)
- Open gaps or risks:
  - **Self lob throw input disagreement** is the biggest factual risk. Recommend safer copy: “While sprinting toward the rim, press `F` to self lob; some current guides also list `Shift+F` because sprint is held.” Link companion lob article instead of over-explaining.
  - **Companion article overlap:** Parent should keep self-lob setup/troubleshooting primarily in `how-to-lob-and-self-lob-in-practical-basketball` and limit this article to dunk finish inputs + one short self lob dunk paragraph/table row.
  - **PC-only vs multi-platform:** Brief assumes PC keyboard per lead; say so in intro or scope note unless parent wants controller table.
  - **Stress-test keybind drift:** Add one sentence telling readers to confirm bindings in the in-game overlay/Discord if a move fails after an update.
  - **Proceed?** Yes — topic is uncovered on Bloxodes, source coverage is adequate for core dunk facts (2+ independent sources), and the angle is distinct from the wiki hub and planned lob article.

Outline:
- **Intro (no H2):** Practical Basketball dunks use `Space`, not `E`; you need rim positioning, momentum on drives, and green-zone timing. One sentence that the game is still in stress-test and inputs should be checked in-game if something fails.

- **H2: Standing and driving dunks use Space and the green timing meter**
  - Explain `E` = shoot/layup, `Space` = dunk.
  - Standing dunk: park under the basket, hold `Space`, release in green zone; use when mostly unguarded.
  - Driving dunk: hold `Shift` to sprint, press `Shift + Space` at the rim with forward momentum; release in green zone.
  - Small table recommended:

    | Dunk type | Input | Best use |
    | --- | --- | --- |
    | Standing dunk | Hold `Space` near rim | Stationary finish under the basket |
    | Driving dunk | `Shift + Space` on approach | Sprinting lane to the rim |

  - Note white-line/paint positioning and not starting the gather from too far out.

- **H2: Self lob dunks and contact dunks need a clean lane and the right finish**
  - Self lob dunk: sprint with open lane → self lob (`F`, note `Shift+F` variant) → catch → `Space` to dunk. One line linking companion lob article for full setup.
  - Contact dunk: same `Shift + Space` as driving dunk; explain it as a momentum/contact animation, not a new button. Mention spacing and that stacked rim protectors often force a layup or block.
  - Optional short bullet list of when each is worth trying vs when to kick out/pass.
  - Light wiki links: High Flyer / Traffic Finisher badges; Highlight Reel / Diesel takeovers for players chasing contact finishes.

- **H2: If your dunk keeps failing, check the button, spacing, and timing**
  - Troubleshooting bullets: pressed `E`, no sprint/momentum, too crowded paint, released meter early/late, wrong approach angle.
  - FAQ block (2–4 questions from above).
  - Close with practice-court recommendation.
