// Headless generator smoke test — extracts the relevant logic from app.js
// without requiring a browser, then runs every generator 50 times and
// verifies each emits a sane 4-option question.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
function load(p) {
  return JSON.parse(readFileSync(resolve(root, p), "utf8"));
}
const data = {
  stats: load("data/stats.json"),
  eggum: load("data/eggum.json"),
  songs: load("data/songs.json"),
  chords: load("data/chords.json"),
  awards: load("data/awards.json"),
  personal: load("data/personal.json"),
  collabs: load("data/collabs.json"),
  culture: load("data/culture.json"),
  images: load("data/images.json"),
  lyrics: load("data/lyrics.json"),
};

// Load app.js as text, evaluate it in a dummy global with stubs.
const appSrc = readFileSync(resolve(root, "app.js"), "utf8");

// Stub the browser globals app.js touches at import time.
const stubs = `
const document = { querySelector: () => ({ addEventListener(){}, setAttribute(){}, classList:{add(){},remove(){}}, querySelector(){return this}, innerHTML:"", textContent:"", style:{}, hidden:true, focus(){}, dataset:{}, disabled:false }) , createElement: () => ({ classList:{add(){},remove(){}}, appendChild(){}, addEventListener(){}, setAttribute(){}, dataset:{}, style:{}, innerHTML:"", textContent:"" }), querySelectorAll: () => [] };
const window = { lucide: null, addEventListener(){} };
globalThis.fetch = async () => ({ ok: false });
`;

// Run the file's logic. The IIFE at bottom will fire fetch (no-op), then
// call startRound which won't do much without DOM — but generators are
// global and we can call them through a hack: append exports.
const wrapped = `${stubs}
${appSrc.replace(/^\(async function boot\(\)[\s\S]*$/m, "")}
return {
  qStatsMostPlayed, qStatsLeastPlayed, qStatsFirstYear, qStatsPlayRange,
  qStatsTopOverall, qStatsTotalHours, qStatsUniqueSongs,
  qAlbumOfSong, qAlbumYear,
  qSongTheme, qSongYear,
  qChordIntro, qChordChorus, qChordKey,
  qTrivia, qAwardTrivia, qCollabTrivia,
  qDuetPartner, qCoverArtist,
  qSpellemannFor, qOtherAward,
  qPhotoCity, qPhotoYear,
  qLyric,
  nextQuestion,
};
`;
const fn = new Function(wrapped);
const gens = fn();

function shapeOf(s) {
  if (!s) return "empty";
  if (s.length > 50) return "long";
  if (/^\d{4}$/.test(s)) return "year";
  if (/^\d+$/.test(s)) return "number";
  if (/^\d+[–-]\d+\s+\w+/.test(s)) return "range";   // "1–10 avspillinger"
  if (/^\d+\s*t$/.test(s)) return "hours";            // "526 t"
  if (/^(ja|nei)$/i.test(s)) return "yesno";
  return "other";
}

const names = Object.keys(gens).filter((k) => k.startsWith("q"));
let pass = 0, fail = 0;
for (const name of names) {
  let ok = 0, nulls = 0, bad = 0, mixed = 0;
  for (let i = 0; i < 60; i++) {
    const q = gens[name](data);
    if (q === null) { nulls += 1; continue; }
    if (!q.q || !Array.isArray(q.options) || q.options.length !== 4) {
      bad += 1; continue;
    }
    const correctCount = q.options.filter((o) => o.correct).length;
    if (correctCount !== 1) { bad += 1; continue; }
    const shapes = new Set(q.options.map((o) => shapeOf(o.text)));
    if (shapes.size > 1) { mixed += 1; continue; }
    ok += 1;
  }
  const status = bad + mixed > 0 ? "FAIL" : ok > 0 ? "ok" : "skip";
  console.log(`${status.padEnd(4)} ${name.padEnd(22)} ok=${ok} null=${nulls} bad=${bad} mixed=${mixed}`);
  if (bad + mixed > 0) fail += 1; else pass += 1;
}

// Build full queue
const seen = new Set();
let queueOk = 0;
for (let i = 0; i < 20; i++) {
  const q = gens.nextQuestion(data, seen);
  if (q) queueOk += 1;
}
console.log(`\nQueue: ${queueOk}/20 questions buildable`);
console.log(`\nGenerator results: ${pass} ok, ${fail} failing`);
process.exit(fail > 0 ? 1 : 0);
