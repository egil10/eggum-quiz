# eggum-quiz

A hyper-minimal trivia game about Norwegian troubadour **Jan Eggum** — his songs, albums, chords, and your own listening stats.

## Play

```bash
python -m http.server 5173
# → http://127.0.0.1:5173
```

Keyboard: <kbd>1</kbd>–<kbd>4</kbd> answer · <kbd>↵</kbd> next · <kbd>S</kbd> skip · <kbd>A</kbd> auto.

## What's in the round

A 20-question round mixes from:

- **Your listening** — most/least played, first-played year, play-count range, total hours.
- **Trivia** — bio, awards, supergroup history.
- **Albums** — which album is this song from? when was it released?
- **Chords** — which key is this song in? which song opens with these chords?
- **Photos** — Wikimedia Commons portraits.

All data is local JSON in `./data/`. Stats come from `notes/eggum.txt` via
`node scripts/parse-stats.mjs`.

## Deploying

Static site — Vercel zero-config works. Push to GitHub, then on
[vercel.com/new](https://vercel.com/new) import the repo. No build step.

## Files

- [`BLUEPRINT.md`](BLUEPRINT.md) — how it's built: layout, colours, fonts, data model, engine.
- `index.html` · `styles.css` · `app.js` — the whole app.
- `data/stats.json` — derived from your `notes/eggum.txt`.
- `data/eggum.json` — bio, trivia, discography.
- `data/chords.json` — key + opening chords for popular songs.
- `data/images.json` — Wikimedia photo URLs.
- `scripts/parse-stats.mjs` — regenerate stats.json.
- `scripts/test-generators.mjs` — headless smoke test.

Lucide icons via CDN (no build).
