# Eggum Quiz — Blueprint

A reference for how this app is built, styled, and wired — enough to rebuild it
from scratch or port the design to another project.

> **One-line summary:** a zero-build, three-file static web app (`index.html` +
> `styles.css` + `app.js`) that generates a 20-question multiple-choice quiz about
> Jan Eggum from local JSON, with a warm light theme and Lucide icons.

---

## 1. Philosophy

- **Hyper-minimal, no build step.** Plain HTML/CSS/ES-module JS. No bundler, no
  framework, no `package.json` dependency tree. You can `python -m http.server`
  and play.
- **Data-driven.** All quiz content lives in `data/*.json`. The app never
  hard-codes a question — it runs *generators* over the data at runtime.
- **One screen, no scrolling.** The whole game fits a single `100dvh` grid. The
  layout is a four-row CSS grid that never overflows.
- **Fast by default.** No webfont download (system-font stack), tiny CSS,
  one CDN script (icons), prebuilt question queue so navigation is instant.

---

## 2. File map

```
index.html          # markup + meta + the two <script> tags
styles.css          # the entire design system (~260 lines, no preprocessor)
app.js              # quiz engine: data load → generators → render → input
data/*.json         # all content (see §6)
notes/eggum.txt     # raw listening export → source for stats.json
scripts/
  parse-stats.mjs   # notes/eggum.txt  →  data/stats.json
  test-generators.mjs # headless: runs every generator 60× + builds a queue
  smoke.mjs         # sanity-checks the data files
vercel.json         # cleanUrls + cache headers for static deploy
```

The "app" is only those three root files. Everything else is content or tooling.

---

## 3. Layout

The page is a single grid pinned to the viewport height:

```
.app  (grid, max-width 720px, centered)
├── header .bar--top      auto   — brand · score · auto-toggle · about
├── nav    .cats          auto   — horizontal scrolling category chips
├── section .card         1fr    — the question (grows to fill)
└── footer .bar--bottom   auto   — progress bar · skip / next / reset
```

- Grid template: `grid-template-rows: auto auto 1fr auto; height: 100dvh;`
- The **card** is itself a 3-row grid (`auto 1fr auto`): meta label, question
  body (grows), options pinned to the bottom (`align-content: end`).
- **Options** are a 2-column grid that collapses to 1 column under 520px.
- Spacing scales with the viewport via `clamp()` so it breathes on big screens
  and tightens on phones — e.g. `padding: clamp(14px, 2.2vh, 24px) …`.

### Responsive breakpoints
- `@media (max-width: 520px)` → options stack to a single column.
- `@media (prefers-reduced-motion: reduce)` → all animation/transition off.

---

## 4. Color & theme

Single light theme, defined as CSS custom properties on `:root`. `color-scheme:
light` is set so form controls/scrollbars stay light.

| Token            | Value     | Role                                    |
|------------------|-----------|-----------------------------------------|
| `--bg`           | `#faf7f1` | page background (warm paper)             |
| `--bg-2`         | `#ffffff` | cards, buttons, dialog surface          |
| `--line`         | `#e7decd` | default borders                          |
| `--line-soft`    | `#f1ead9` | progress track, image placeholder tint  |
| `--fg`           | `#1a1610` | primary text, "primary" button fill     |
| `--mute`         | `#837866` | secondary text, idle icons              |
| `--accent`       | `#8a5a2b` | brand accent (warm brown), links, focus |
| `--accent-soft`  | `#f3e8d3` | chord-badge background                   |
| `--ok`           | `#4d7a48` | correct answer (green)                   |
| `--bad`          | `#b15a4a` | wrong answer (terracotta red)           |

Theme is **warm/earthy** — paper background, brown accent, muted greens and reds
for feedback. `<meta name="theme-color" content="#faf7f1">` matches the bg.

To add a dark theme later: duplicate the tokens inside
`@media (prefers-color-scheme: dark)` and update `color-scheme` + `theme-color`.

---

## 5. Typography & shape

- **Font:** the stack lists `"Inter"` first but **no webfont is loaded** — in
  practice it falls back to the system UI font (`system-ui`, Segoe UI, Roboto,
  …). This is intentional: zero font requests, no FOUT, instant text. Drop in an
  `@font-face`/Google Fonts `<link>` only if you actually want Inter.
- **Monospace** (`ui-monospace, SFMono-Regular, Menlo`) for chord badges and
  `<kbd>` hints.
- **Tight tracking:** body `letter-spacing: -0.005em`, headings `-0.01em`.
  Eyebrow labels (brand, `.qmeta`) use *wide* tracking + uppercase + 11px.
- **Question size** scales: `font-size: clamp(20px, 3vw, 26px)`.
- **Tabular numerals** (`font-variant-numeric: tabular-nums`) on score/result so
  digits don't jitter.
- **Radii:** `--radius: 10px`, `--radius-lg: 14px`; pills (`chips`, `iconbtn`)
  use `border-radius: 999px`.

### Component cheatsheet
- `.chip` — pill category filter; `.chip.on` inverts to dark fill.
- `.iconbtn` — pill button; `.primary` = dark fill, `.ghost` = borderless,
  `[aria-pressed="true"]` = accent (used by the auto-play toggle).
- `.opt` — answer button; states `.correct` (green) / `.wrong` (red), each with
  a numbered `.badge`.
- `.chord-badge` — monospace accent-soft chip for chord progressions.
- `.result` — end-of-round score screen (big accent number + % + message).

### Motion
- Entrance: `@keyframes pop` (4px rise + fade) on the question and each option,
  staggered 25/50/75ms per option.
- Photos fade in via `@keyframes photo-in`.
- Progress bar width animates `240ms ease`.
- All of it is disabled under `prefers-reduced-motion`.

---

## 6. Data model (`data/*.json`)

Each file is an object with a top-level array. Generators read defensively with
optional chaining, so a missing/empty file just disables its question types.

| File            | Shape (key fields)                                              | Feeds category |
|-----------------|----------------------------------------------------------------|----------------|
| `stats.json`    | `{ totals:{songs,hours}, songs:[{title,plays,firstPlayed}] }`  | Mine plays     |
| `eggum.json`    | `{ albums:[{title,year,tracks[],kind}], trivia:[{q,a}] }`      | Album, Trivia  |
| `songs.json`    | `{ songs:[{title,year,theme}] }`                                | Sanger         |
| `chords.json`   | `{ chords:[{title,key,capo,intro_chords[],chorus_chords[]}] }` | Akkorder       |
| `awards.json`   | `{ spellemann:[{year,for,result}], other_honors:[{award,year}], trivia[] }` | Priser |
| `collabs.json`  | `{ duets:[{song,partner}], covers_of_eggum:[{song,covered_by}], trivia[] }` | Samarbeid |
| `personal.json` | `{ trivia:[{q,a}] }`                                            | Trivia         |
| `culture.json`  | `{ trivia:[{q,a}] }`                                            | Trivia         |
| `images.json`   | `{ images:[{url,caption,source,license}] }`                    | Bilder         |
| `lyrics.json`   | `{ lyrics:[{title,snippet}] }` (empty → category hidden)       | Lyrikk         |

`stats.json` is generated: `node scripts/parse-stats.mjs` reads
`notes/eggum.txt` (a personal listening export).

---

## 7. Quiz engine (`app.js`)

**Boot** (`boot()` IIFE, must stay last in the file — a test strips it by regex):
1. `Promise.all` fetch all ten `data/*.json` files in parallel.
2. `bindUI()` wires buttons, keyboard, and the delegated option-click listener.
3. `renderCats()` draws category chips (hides Lyrikk if `lyrics.json` is empty).
4. `startRound()` builds and renders the first question.

**Generators.** Each `qXxx(data)` returns either `null` (not enough data) or a
question object:

```js
{ cat, qmeta, icon, q, options:[{text,correct}], photo?, chordRow? }
```

`options` is always exactly 4 entries with exactly one `correct: true`.
Helpers:
- `withCorrect(answer, distractors, n=3)` — dedupes, samples wrong answers,
  shuffles; returns `null` if it can't find enough distinct distractors.
- `answerShape(a)` / `buildTriviaQ(...)` — keeps trivia options *type-consistent*
  (all years, or all numbers, …) so a question never mixes a year with an album
  title.

**Generator registry.** `GENERATORS` is a flat array; some functions appear
twice to weight them higher. `generatorCat(g)` maps each function name → category
id (used to filter the pool when a chip is selected). To add a question type:
write a `qXxx`, push it into `GENERATORS`, and add it to the `generatorCat` table
(and to the export list in `scripts/test-generators.mjs`).

**Round flow.** `buildQueue()` calls `nextQuestion()` up to `state.total` (20)
times, deduping on a `question|options` signature. The whole queue is prebuilt,
so Next/auto-advance is instant. `render → onAnswer → advance → finish`.

**State** lives in one `state` object (queue, index, score, `auto`, `locked`,
`cat`). No framework, no reactivity — render is called explicitly.

**Modes.** Manual waits for **Neste** / `↵`; **Auto** (`▶`/`⏸` toggle) advances
1.6s after each answer.

**Keyboard.** `1–4` pick an answer · `↵` next · `S` skip · `A` toggle auto.

---

## 8. Icons

[Lucide](https://lucide.dev) UMD build via `unpkg` CDN (pinned `0.469.0`). Icons
are declared as `<i data-lucide="name">` and hydrated by
`lucide.createIcons()` (wrapped in `setIcons()`), re-run after each render
because the question meta icon is rebuilt each time. To self-host and drop the
CDN, vendor the UMD file locally and update the `<script src>`.

---

## 9. Performance notes

- **Parallel data load** — all JSON fetched with one `Promise.all`.
- **Prebuilt queue** — no per-question generation cost during play.
- **`preconnect`/`dns-prefetch`** to `unpkg.com` (icons) and
  `upload.wikimedia.org` (photos); the icon script is also `preload`ed.
- **Next-photo preload** — `preloadNextPhoto()` warms the cache for the upcoming
  question's image so auto-play doesn't flash a placeholder.
- **Single-reflow option render** — options are built as one HTML string and
  handled by one **delegated** click listener, not N per-button listeners.
- **Image robustness** — photos use `decoding="async"`, a placeholder tint while
  loading, fade-in, and an `error` handler that hides a broken image.
- **No webfont** — system-font stack means zero blocking font requests.
- **Mobile polish** — `touch-action: manipulation`, no tap-highlight, no
  text-selection on controls, `overscroll-behavior: none`.

---

## 10. Accessibility

- The question card is the live region (`role="region"` + `aria-live="polite"`),
  so screen readers announce each new question — not the whole chrome.
- `:focus-visible` shows a 2px accent outline; mouse focus is suppressed.
- Buttons have `title`/`aria-label`; the auto toggle uses `aria-pressed`.
- `<noscript>` explains the app needs JavaScript.
- Honors `prefers-reduced-motion`.

---

## 11. Deploy

Static, zero-config. `vercel.json` enables `cleanUrls` and sets a 5-minute
`Cache-Control` on `styles.css`, `app.js`, and `data/*.json`. Push to GitHub →
import on Vercel → no build step. Any static host works the same way.

---

## 12. Rebuild checklist

1. `index.html` shell: grid `main#app` with the four regions in §3.
2. Paste the `:root` tokens (§4) and the component classes (§5).
3. Drop JSON into `data/` matching the shapes in §6.
4. Write generators returning the §7 question shape; register them.
5. Wire input + render loop; prebuild the queue.
6. Add Lucide (or any icon set) and the meta/preconnect tags.
7. `node scripts/test-generators.mjs` should print all generators `ok`/`skip`,
   `0 failing`, and `Queue: 20/20`.
