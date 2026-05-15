import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = resolve(root, "notes/eggum.txt");
const outDir = resolve(root, "data");
mkdirSync(outDir, { recursive: true });

const raw = readFileSync(src, "utf8");
const lines = raw.split(/\r?\n/);

// Layout per song (4 logical lines, sometimes separated by blanks):
//   rankToken (e.g. "1245\t")
//   track title
//   artist (almost always "Jan Eggum" or "Silje Nergaard" exception)
//   "<artist>\t<H> hrs\t<minutes>\t<plays>\t<firstPlayed>"

const songs = [];
let i = 0;
while (i < lines.length) {
  const line = lines[i].trim();
  // Look for a number-only line (the rank/id)
  if (/^\d+$/.test(line)) {
    const rank = parseInt(line, 10);
    const title = (lines[i + 1] ?? "").trim();
    const artistLine = (lines[i + 2] ?? "").trim();
    const statsLine = (lines[i + 3] ?? "").trim();
    const parts = statsLine.split("\t").map((s) => s.trim());
    if (parts.length >= 5 && title) {
      const [statsArtist, hrsRaw, minRaw, playsRaw, firstRaw] = parts;
      const hrs = parseInt(String(hrsRaw).replace(/[^\d]/g, ""), 10) || 0;
      const minutes = parseFloat(String(minRaw).replace(",", ".")) || 0;
      const plays = parseInt(playsRaw, 10) || 0;
      const firstPlayed = parseInt(firstRaw, 10) || null;
      songs.push({
        rank,
        title,
        artist: artistLine || statsArtist,
        hrs,
        minutes,
        plays,
        firstPlayed,
      });
      i += 4;
      continue;
    }
  }
  i += 1;
}

// De-duplicate variants (capitalization, "Live", "Remastered"). We keep the
// canonical entry (highest plays) for matching, but expose total plays.
function canonicalize(t) {
  return t
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+-\s+(live|remastered|remaster|.*remastered.*)/gi, "")
    .replace(/\s+live$/i, "")
    .replace(/\bfeat\..*$/i, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

const map = new Map();
for (const s of songs) {
  const key = canonicalize(s.title);
  if (!key) continue;
  if (!map.has(key)) {
    map.set(key, {
      title: s.title,
      key,
      artist: s.artist,
      hrs: 0,
      minutes: 0,
      plays: 0,
      firstPlayed: s.firstPlayed,
      variants: [],
    });
  }
  const agg = map.get(key);
  agg.hrs += s.hrs;
  agg.minutes += s.minutes;
  agg.plays += s.plays;
  if (s.firstPlayed && (!agg.firstPlayed || s.firstPlayed < agg.firstPlayed)) {
    agg.firstPlayed = s.firstPlayed;
  }
  agg.variants.push({ title: s.title, plays: s.plays, minutes: s.minutes });
}

// Pick prettiest title (longest non-all-caps, prefer one without "Live"/"Remastered")
for (const agg of map.values()) {
  agg.variants.sort((a, b) => b.plays - a.plays);
  const pretty =
    agg.variants.find(
      (v) =>
        !/live|remaster/i.test(v.title) && !/\(.*\)/.test(v.title)
    ) ?? agg.variants[0];
  agg.title = pretty.title;
}

const aggregated = [...map.values()]
  .map((s) => ({
    title: s.title,
    artist: s.artist,
    hrs: s.hrs,
    minutes: Math.round(s.minutes * 10) / 10,
    plays: s.plays,
    firstPlayed: s.firstPlayed,
  }))
  .sort((a, b) => b.plays - a.plays);

const totals = aggregated.reduce(
  (acc, s) => {
    acc.songs += 1;
    acc.plays += s.plays;
    acc.minutes += s.minutes;
    return acc;
  },
  { songs: 0, plays: 0, minutes: 0 }
);
totals.minutes = Math.round(totals.minutes);
totals.hours = Math.round(totals.minutes / 60);

writeFileSync(
  resolve(outDir, "stats.json"),
  JSON.stringify({ totals, songs: aggregated }, null, 2),
  "utf8"
);

console.log(
  `Parsed ${songs.length} rows → ${aggregated.length} canonical songs, ${totals.plays} total plays, ${totals.hours}h listened.`
);
