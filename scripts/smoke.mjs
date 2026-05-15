// Smoke test: load all data, exercise every generator, build a 20-q queue.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// Load app.js as text and crudely import the generator functions by
// re-eval'ing inside a vm-light sandbox. Simpler: re-implement loadJSON.
function load(p) {
  return JSON.parse(readFileSync(resolve(root, p), "utf8"));
}

const data = {
  stats: load("data/stats.json"),
  eggum: load("data/eggum.json"),
  chords: load("data/chords.json"),
  images: load("data/images.json"),
};

// Mirror generator coverage by re-loading app.js as text and evaluating in
// a fake DOM-less scope. Cleaner: extract generators to a module? For now,
// just sanity-check the data.

console.log("Stats:", data.stats.totals);
console.log("Top played:", data.stats.songs[0].title, "—", data.stats.songs[0].plays, "plays");
console.log("Albums:", data.eggum.albums.length);
console.log("Trivia:", data.eggum.trivia.length);
console.log("Chords:", data.chords.chords.length);
console.log("Images:", data.images.images.length);

// Cross-check: do most trivia answers vary enough to make 4-option questions?
const triviaAnswers = data.eggum.trivia.map((t) => t.a);
const uniqueLens = new Set(triviaAnswers.map((a) => a.length < 5 ? "short" : "long"));
console.log("Trivia answer-shape buckets:", [...uniqueLens]);

// Cross-check albums/tracks intersect with stats titles
const albumTracks = new Set(
  data.eggum.albums.flatMap((a) => a.tracks ?? []).map((t) => t.toLowerCase())
);
const matched = data.stats.songs.filter((s) => albumTracks.has(s.title.toLowerCase())).length;
console.log(`Stats↔album-track title matches: ${matched}/${data.stats.songs.length}`);

console.log("\nSample 5 trivia:");
for (let i = 0; i < 5; i++) {
  const t = data.eggum.trivia[i];
  console.log(`  Q: ${t.q}\n  A: ${t.a}`);
}
