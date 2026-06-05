// Eggum Quiz — hyper-minimalistisk trivia.
// Loads every data file under ./data/, mixes question generators across
// categories, supports category filtering, manual + auto modes.

const $ = (s, r = document) => r.querySelector(s);

const CATS = [
  { id: "all",      label: "Alle",         icon: "shuffle" },
  { id: "plays",    label: "Mine plays",   icon: "bar-chart-3" },
  { id: "songs",    label: "Sanger",       icon: "music-4" },
  { id: "album",    label: "Album",        icon: "disc-3" },
  { id: "chords",   label: "Akkorder",     icon: "music" },
  { id: "trivia",   label: "Trivia",       icon: "sparkles" },
  { id: "collabs",  label: "Samarbeid",    icon: "users" },
  { id: "awards",   label: "Priser",       icon: "trophy" },
  { id: "photos",   label: "Bilder",       icon: "image" },
  { id: "lyrics",   label: "Lyrikk",       icon: "feather" },
];

const ICONS = {
  plays:   "bar-chart-3",
  trivia:  "sparkles",
  album:   "disc-3",
  chords:  "music",
  photos:  "image",
  songs:   "music-4",
  collabs: "users",
  awards:  "trophy",
  lyrics:  "feather",
};

const state = {
  data: {},
  queue: [],
  i: 0,
  correct: 0,
  answered: 0,
  total: 20,
  auto: false,
  autoTimer: null,
  current: null,
  locked: false,
  cat: "all",
};

// ---------- utilities ----------
const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
function sample(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
async function loadJSON(path) {
  try {
    const r = await fetch(path);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
function withCorrect(correctText, distractors, n = 3) {
  const pool = [...new Set(distractors.filter((d) => d && d !== correctText))];
  const wrong = sample(pool, n);
  if (wrong.length < n) return null;
  return shuffle([
    { text: correctText, correct: true },
    ...wrong.map((t) => ({ text: t, correct: false })),
  ]);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ---------- stats generators ----------
function qStatsMostPlayed(d) {
  const songs = d.stats?.songs;
  if (!songs || songs.length < 8) return null;
  const four = sample(songs.slice(0, 80), 4);
  const correct = four.reduce((a, b) => (a.plays >= b.plays ? a : b));
  return {
    cat: "plays",
    qmeta: "Mine plays",
    icon: ICONS.plays,
    q: "Hvilken av disse har du spilt mest?",
    options: shuffle(four.map((s) => ({ text: s.title, correct: s === correct }))),
  };
}
function qStatsLeastPlayed(d) {
  const songs = d.stats?.songs;
  if (!songs || songs.length < 12) return null;
  const four = sample(songs.slice(0, 100), 4);
  const correct = four.reduce((a, b) => (a.plays <= b.plays ? a : b));
  return {
    cat: "plays",
    qmeta: "Mine plays",
    icon: ICONS.plays,
    q: "Hvilken av disse har du spilt minst?",
    options: shuffle(four.map((s) => ({ text: s.title, correct: s === correct }))),
  };
}
function qStatsFirstYear(d) {
  const songs = d.stats?.songs?.filter((s) => s.firstPlayed && s.plays >= 10) ?? [];
  if (songs.length < 8) return null;
  const s = pick(songs);
  const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const opts = withCorrect(String(s.firstPlayed), years.map(String));
  if (!opts) return null;
  return {
    cat: "plays",
    qmeta: "Mine plays",
    icon: "calendar",
    q: `Hvilket år spilte du «${s.title}» første gang?`,
    options: opts,
  };
}
function qStatsPlayRange(d) {
  const songs = d.stats?.songs?.filter((s) => s.plays >= 5) ?? [];
  if (songs.length < 8) return null;
  const s = pick(songs);
  const buckets = [
    [1, 10], [11, 25], [26, 50], [51, 100], [101, 200], [201, 400],
  ];
  const correct = buckets.find(([lo, hi]) => s.plays >= lo && s.plays <= hi);
  if (!correct) return null;
  const others = buckets.filter((b) => b !== correct);
  const opts = shuffle([correct, ...sample(others, 3)]).map((b) => ({
    text: `${b[0]}–${b[1]} avspillinger`,
    correct: b === correct,
  }));
  return {
    cat: "plays",
    qmeta: "Mine plays",
    icon: "hash",
    q: `Omtrent hvor mange ganger har du spilt «${s.title}»?`,
    options: opts,
  };
}
function qStatsTopOverall(d) {
  const songs = d.stats?.songs;
  if (!songs || songs.length < 10) return null;
  const top = songs[0];
  const opts = withCorrect(top.title, songs.slice(1, 40).map((s) => s.title));
  if (!opts) return null;
  return {
    cat: "plays",
    qmeta: "Mine plays",
    icon: ICONS.plays,
    q: "Hvilken Eggum-sang har du spilt mest totalt?",
    options: opts,
  };
}
function qStatsTotalHours(d) {
  const t = d.stats?.totals;
  if (!t) return null;
  const real = t.hours;
  const distract = new Set();
  while (distract.size < 6) {
    const delta = (rand(8) + 2) * (Math.random() < 0.5 ? 1 : -1) * (real > 200 ? 60 : 10);
    const v = Math.max(1, real + delta);
    if (v !== real) distract.add(`${v} t`);
  }
  const opts = withCorrect(`${real} t`, [...distract]);
  if (!opts) return null;
  return {
    cat: "plays",
    qmeta: "Mine plays",
    icon: "clock",
    q: "Omtrent hvor mange timer har du brukt på Eggum totalt?",
    options: opts,
  };
}
function qStatsUniqueSongs(d) {
  const t = d.stats?.totals;
  if (!t) return null;
  const real = t.songs;
  const offsets = [-200, -150, -75, -25, 25, 75, 150, 200];
  const distract = shuffle(offsets).map((o) => String(Math.max(10, real + o)));
  const opts = withCorrect(String(real), distract);
  if (!opts) return null;
  return {
    cat: "plays",
    qmeta: "Mine plays",
    icon: ICONS.plays,
    q: "Hvor mange distinkte Eggum-låter har du spilt?",
    options: opts,
  };
}

// ---------- album generators ----------
function studioAlbums(d) {
  return d.eggum?.albums?.filter((a) => a.tracks?.length && a.kind !== "compilation") ?? [];
}
function qAlbumOfSong(d) {
  const albums = studioAlbums(d);
  if (albums.length < 4) return null;
  const map = new Map();
  for (const a of [...albums].sort((x, y) => x.year - y.year)) {
    for (const t of a.tracks) {
      const k = t.toLowerCase();
      if (!map.has(k)) map.set(k, { album: a, track: t });
    }
  }
  const album = pick(albums);
  const candidates = album.tracks.filter((t) => map.get(t.toLowerCase())?.album === album);
  if (!candidates.length) return null;
  const track = pick(candidates);
  const distractors = sample(albums.filter((a) => a !== album), 8).map(
    (a) => `${a.title} (${a.year})`
  );
  const opts = withCorrect(`${album.title} (${album.year})`, distractors);
  if (!opts) return null;
  return {
    cat: "album",
    qmeta: "Album",
    icon: ICONS.album,
    q: `Fra hvilket album er «${track}»?`,
    options: opts,
  };
}
function qAlbumYear(d) {
  const albums = d.eggum?.albums ?? [];
  if (albums.length < 4) return null;
  const album = pick(albums);
  const yrs = albums.map((a) => String(a.year));
  const opts = withCorrect(String(album.year), yrs);
  if (!opts) return null;
  return {
    cat: "album",
    qmeta: "Album",
    icon: "calendar",
    q: `Hvilket år kom albumet «${album.title}»?`,
    options: opts,
  };
}

// ---------- song / theme generators (songs.json) ----------
function qSongTheme(d) {
  const songs = d.songs?.songs?.filter((s) => s.theme && s.title) ?? [];
  if (songs.length < 6) return null;
  const s = pick(songs);
  const opts = withCorrect(s.title, songs.filter((x) => x !== s).map((x) => x.title));
  if (!opts) return null;
  return {
    cat: "songs",
    qmeta: "Sang og tema",
    icon: ICONS.songs,
    q: `Hvilken Eggum-sang handler om: ${s.theme.toLowerCase()}?`,
    options: opts,
  };
}
function qSongYear(d) {
  const songs = d.songs?.songs?.filter((s) => s.year) ?? [];
  if (songs.length < 6) return null;
  const s = pick(songs);
  const years = [...new Set(d.songs.songs.map((x) => String(x.year)))];
  const opts = withCorrect(String(s.year), years);
  if (!opts) return null;
  return {
    cat: "songs",
    qmeta: "Sang og tema",
    icon: "calendar",
    q: `Hvilket år kom «${s.title}» ut?`,
    options: opts,
  };
}

// ---------- chord generators (chords.json) ----------
function chordKey(c) {
  // best representative key: capo + chord
  if (c.capo && c.capo > 0) return `${c.key} (capo ${c.capo})`;
  return c.key;
}
function qChordIntro(d) {
  const list = d.chords?.chords?.filter((c) => c.intro_chords?.length >= 3) ?? [];
  if (list.length < 4) return null;
  const song = pick(list);
  const distractors = list.filter((c) => c !== song).map((c) => c.title);
  const opts = withCorrect(song.title, distractors);
  if (!opts) return null;
  return {
    cat: "chords",
    qmeta: "Akkorder",
    icon: ICONS.chords,
    chordRow: song.intro_chords.slice(0, 4),
    q: "Hvilken Eggum-sang åpner med disse akkordene?",
    options: opts,
  };
}
function qChordKey(d) {
  const list = d.chords?.chords?.filter((c) => c.key) ?? [];
  if (list.length < 4) return null;
  const song = pick(list);
  const keys = ["C", "G", "D", "A", "E", "H", "F", "Am", "Em", "Hm", "Dm", "Gm", "Fm", "Cm"];
  const opts = withCorrect(song.key, keys);
  if (!opts) return null;
  return {
    cat: "chords",
    qmeta: "Akkorder",
    icon: ICONS.chords,
    q: `I hvilken toneart står «${song.title}»?`,
    options: opts,
  };
}
function qChordChorus(d) {
  const list = d.chords?.chords?.filter((c) => c.chorus_chords?.length >= 3) ?? [];
  if (list.length < 4) return null;
  const song = pick(list);
  const opts = withCorrect(song.title, list.filter((c) => c !== song).map((c) => c.title));
  if (!opts) return null;
  return {
    cat: "chords",
    qmeta: "Akkorder",
    icon: ICONS.chords,
    chordRow: song.chorus_chords.slice(0, 4),
    q: "Hvilken Eggum-sang har dette refrenget (akkord-rekke)?",
    options: opts,
  };
}

// ---------- trivia generators (multi-source) ----------
function poolTrivia(d, sources) {
  return sources
    .flatMap((s) => s?.trivia ?? [])
    .filter((t) => t?.q && t?.a);
}
function answerShape(a) {
  if (!a) return "empty";
  if (a.length > 40) return "long";
  if (/^\d{4}$/.test(a)) return "year";
  if (/^\d+$/.test(a)) return "number";
  if (/^(ja|nei)$/i.test(a)) return "yesno";
  if (/^\d{1,2}\.\s*\w+\s+\d{4}/.test(a)) return "date";
  return "other";
}
function buildTriviaQ(cat, item, distractorPool, qmeta, icon) {
  // Skip answers that are too long for a 4-option button row.
  const shape = answerShape(item.a);
  if (shape === "long" || shape === "empty") return null;
  const sameShape = distractorPool.filter(
    (x) => answerShape(x) === shape && x !== item.a
  );
  // Need at least 3 same-shape distractors; otherwise the options would
  // mix years with album titles etc., which spoils the question.
  if (sameShape.length < 3) return null;
  const opts = withCorrect(item.a, sameShape);
  if (!opts) return null;
  return { cat, qmeta, icon, q: item.q, options: opts };
}
function qTrivia(d) {
  const pool = poolTrivia(d, [d.eggum, d.personal, d.culture]);
  if (pool.length < 6) return null;
  const item = pick(pool);
  return buildTriviaQ("trivia", item, pool.map((x) => x.a), "Trivia", ICONS.trivia);
}
function qAwardTrivia(d) {
  const pool = poolTrivia(d, [d.awards]);
  if (pool.length < 6) return null;
  const item = pick(pool);
  return buildTriviaQ("awards", item, pool.map((x) => x.a), "Priser", ICONS.awards);
}
function qCollabTrivia(d) {
  const pool = poolTrivia(d, [d.collabs]);
  if (pool.length < 6) return null;
  const item = pick(pool);
  return buildTriviaQ("collabs", item, pool.map((x) => x.a), "Samarbeid", ICONS.collabs);
}

// ---------- specialised collaboration generators ----------
function qDuetPartner(d) {
  const duets = d.collabs?.duets?.filter((x) => x.song && x.partner) ?? [];
  if (duets.length < 4) return null;
  const duet = pick(duets);
  const partners = duets.map((x) => x.partner);
  const opts = withCorrect(duet.partner, partners);
  if (!opts) return null;
  return {
    cat: "collabs",
    qmeta: "Samarbeid",
    icon: "users",
    q: `Hvem dueterer Jan Eggum med på «${duet.song}»?`,
    options: opts,
  };
}
function qCoverArtist(d) {
  const covers = d.collabs?.covers_of_eggum ?? [];
  if (covers.length < 4) return null;
  const cover = pick(covers);
  const artists = covers.map((x) => x.covered_by);
  const opts = withCorrect(cover.covered_by, artists);
  if (!opts) return null;
  return {
    cat: "collabs",
    qmeta: "Samarbeid",
    icon: "users",
    q: `Hvilken artist har coveret «${cover.song}»?`,
    options: opts,
  };
}

// ---------- specialised awards generators ----------
function qSpellemannFor(d) {
  const wins = d.awards?.spellemann?.filter((x) => x.result === "won" && x.for && x.for !== "Hederspris") ?? [];
  if (wins.length < 3) return null;
  const win = pick(wins);
  const years = d.awards.spellemann.map((x) => String(x.year));
  const opts = withCorrect(String(win.year), years);
  if (!opts) return null;
  return {
    cat: "awards",
    qmeta: "Priser",
    icon: ICONS.awards,
    q: `Hvilket år vant Eggum Spellemann for «${win.for}»?`,
    options: opts,
  };
}
function qOtherAward(d) {
  const honors = d.awards?.other_honors?.filter((x) => x.award && x.year) ?? [];
  if (honors.length < 4) return null;
  const honor = pick(honors);
  const years = honors.map((x) => String(x.year));
  const opts = withCorrect(String(honor.year), years);
  if (!opts) return null;
  return {
    cat: "awards",
    qmeta: "Priser",
    icon: ICONS.awards,
    q: `Hvilket år fikk Eggum ${honor.award}?`,
    options: opts,
  };
}

// ---------- photo generators ----------
function captionCity(c) {
  if (/Bergen/i.test(c)) return "Bergen";
  if (/Kongsberg/i.test(c)) return "Kongsberg";
  return null;
}
function captionYear(c) {
  const m = c.match(/(\d{4})/);
  return m ? m[1] : null;
}
function qPhotoCity(d) {
  const imgs = (d.images?.images ?? []).filter((i) => captionCity(i.caption));
  if (imgs.length < 3) return null;
  const img = pick(imgs);
  const city = captionCity(img.caption);
  const opts = withCorrect(city, ["Bergen", "Kongsberg", "Oslo", "Trondheim", "Stavanger", "Tromsø"]);
  if (!opts) return null;
  return {
    cat: "photos",
    qmeta: "Bilder",
    icon: ICONS.photos,
    photo: img.url,
    q: "I hvilken norsk by ble dette bildet tatt?",
    options: opts,
  };
}
function qPhotoYear(d) {
  const imgs = (d.images?.images ?? []).filter((i) => captionYear(i.caption));
  if (imgs.length < 3) return null;
  const img = pick(imgs);
  const yr = captionYear(img.caption);
  const opts = withCorrect(yr, ["2008", "2014", "2018", "2021", "2022", "2023", "2024"]);
  if (!opts) return null;
  return {
    cat: "photos",
    qmeta: "Bilder",
    icon: ICONS.photos,
    photo: img.url,
    q: "Hvilket år ble dette bildet tatt?",
    options: opts,
  };
}

// ---------- lyrics (activates only when data populated) ----------
function qLyric(d) {
  const items = d.lyrics?.lyrics?.filter((x) => x.title && x.snippet) ?? [];
  if (items.length < 4) return null;
  const item = pick(items);
  const titles = items.map((x) => x.title).concat(d.songs?.songs?.map((s) => s.title) ?? []);
  const opts = withCorrect(item.title, titles);
  if (!opts) return null;
  return {
    cat: "lyrics",
    qmeta: "Lyrikk",
    icon: ICONS.lyrics,
    q: `Hvilken Eggum-sang har denne linjen: «${item.snippet}»?`,
    options: opts,
  };
}

// ---------- master pool ----------
const GENERATORS = [
  qStatsMostPlayed, qStatsLeastPlayed, qStatsFirstYear, qStatsPlayRange,
  qStatsTopOverall, qStatsTotalHours, qStatsUniqueSongs,
  qAlbumOfSong, qAlbumOfSong, qAlbumYear,
  qSongTheme, qSongTheme, qSongYear,
  qChordIntro, qChordIntro, qChordChorus, qChordKey,
  qTrivia, qTrivia, qTrivia, qAwardTrivia, qCollabTrivia,
  qDuetPartner, qCoverArtist,
  qSpellemannFor, qOtherAward,
  qPhotoCity, qPhotoYear,
  qLyric,
];

function nextQuestion(d, seen, cat = "all") {
  const pool = cat === "all"
    ? GENERATORS
    : GENERATORS.filter((g) => generatorCat(g) === cat);
  if (!pool.length) return null;
  for (let tries = 0; tries < 80; tries++) {
    const g = pick(pool);
    const q = g(d);
    if (!q) continue;
    const sig = q.q + "|" + q.options.map((o) => o.text).join(",");
    if (seen.has(sig)) continue;
    seen.add(sig);
    return q;
  }
  return null;
}
function generatorCat(g) {
  // probe the generator with empty data to get its `cat` — fragile. Better
  // approach: explicitly tag generators. We rely on a name-prefix convention
  // mapped through this table:
  const t = {
    qStatsMostPlayed: "plays", qStatsLeastPlayed: "plays", qStatsFirstYear: "plays",
    qStatsPlayRange: "plays", qStatsTopOverall: "plays", qStatsTotalHours: "plays",
    qStatsUniqueSongs: "plays",
    qAlbumOfSong: "album", qAlbumYear: "album",
    qSongTheme: "songs", qSongYear: "songs",
    qChordIntro: "chords", qChordChorus: "chords", qChordKey: "chords",
    qTrivia: "trivia", qAwardTrivia: "awards", qCollabTrivia: "collabs",
    qDuetPartner: "collabs", qCoverArtist: "collabs",
    qSpellemannFor: "awards", qOtherAward: "awards",
    qPhotoCity: "photos", qPhotoYear: "photos",
    qLyric: "lyrics",
  };
  return t[g.name];
}

// ---------- rendering ----------
function setIcons() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
}
function render(q) {
  state.current = q;
  state.locked = false;
  $("#qmeta").innerHTML = `<i data-lucide="${q.icon}"></i><span>${escapeHtml(q.qmeta)}</span>`;

  const qEl = $("#q");
  let html = "";
  if (q.photo) {
    html += `<img class="qphoto" alt="" decoding="async" fetchpriority="high" src="${escapeHtml(q.photo)}" />`;
  }
  if (q.chordRow) {
    html += `<div class="chord-row">${q.chordRow
      .map((c) => `<span class="chord-badge">${escapeHtml(c)}</span>`)
      .join("")}</div>`;
  }
  html += `<span>${escapeHtml(q.q)}</span>`;
  qEl.innerHTML = html;
  // Hide a broken photo gracefully rather than showing a torn-image glyph.
  const img = qEl.querySelector(".qphoto");
  if (img) img.addEventListener("error", () => { img.style.display = "none"; }, { once: true });

  // Build all option buttons in one string → one reflow. Clicks are handled
  // by a single delegated listener bound once in bindUI().
  $("#opts").innerHTML = q.options
    .map(
      (o, idx) =>
        `<button class="opt" data-correct="${o.correct ? 1 : 0}" data-idx="${idx}">` +
        `<span class="badge">${idx + 1}</span><span>${escapeHtml(o.text)}</span></button>`
    )
    .join("");

  $("#nextBtn").hidden = true;
  updateProgress();
  setIcons();
  preloadNextPhoto();
}
// Warm the browser cache for the next question's photo so auto-play and
// manual "Neste" feel instant instead of flashing a placeholder.
function preloadNextPhoto() {
  const next = state.queue[state.i + 1];
  if (next?.photo) new Image().src = next.photo;
}
function updateProgress() {
  const pct = Math.min(100, Math.round((state.answered / state.total) * 100));
  $("#progress > span").style.width = pct + "%";
  $("#scoreText").textContent = `${state.correct}/${state.answered}`;
}
function onAnswer(btn) {
  if (state.locked) return;
  state.locked = true;
  const right = btn.dataset.correct === "1";
  const opts = [...document.querySelectorAll(".opt")];
  opts.forEach((o) => {
    o.disabled = true;
    if (o.dataset.correct === "1") o.classList.add("correct");
  });
  if (!right) btn.classList.add("wrong");
  state.answered += 1;
  if (right) state.correct += 1;
  updateProgress();
  if (state.auto) {
    state.autoTimer = setTimeout(advance, 1600);
    $("#nextBtn").hidden = true;
  } else {
    $("#nextBtn").hidden = false;
    $("#nextBtn").focus();
  }
}
function advance() {
  clearTimeout(state.autoTimer);
  state.autoTimer = null;
  state.i += 1;
  const q = state.queue[state.i];
  if (!q || state.answered >= state.total) finish();
  else render(q);
}
function roundMessage(pct) {
  if (pct === 100) return "Plettfritt — ekte Eggum-kjenner!";
  if (pct >= 80) return "Sterkt spilt.";
  if (pct >= 50) return "Godt jobba.";
  if (pct > 0) return "På vei — prøv igjen.";
  return "Ny runde venter.";
}
function finish() {
  state.current = null;
  const pct = state.answered ? Math.round((state.correct / state.answered) * 100) : 0;
  $("#qmeta").innerHTML = `<i data-lucide="check"></i><span>Runde fullført</span>`;
  $("#q").innerHTML =
    `<div class="result">` +
    `<div class="result__score">${state.correct}/${state.answered}</div>` +
    `<div class="result__pct">${pct}% rett</div>` +
    `<div class="result__msg">${escapeHtml(roundMessage(pct))}</div>` +
    `</div>`;
  const opts = $("#opts");
  opts.innerHTML = "";
  const b = document.createElement("button");
  b.className = "opt";
  b.innerHTML = `<span class="badge"><i data-lucide="rotate-ccw"></i></span><span>Spill igjen</span>`;
  b.addEventListener("click", startRound);
  opts.appendChild(b);
  $("#nextBtn").hidden = true;
  setIcons();
}
function skip() {
  if (state.locked) advance();
  else {
    state.answered += 1;
    state.locked = true;
    updateProgress();
    advance();
  }
}

// ---------- round + category ----------
function buildQueue() {
  const seen = new Set();
  const queue = [];
  for (let i = 0; i < state.total; i++) {
    const q = nextQuestion(state.data, seen, state.cat);
    if (!q) break;
    queue.push(q);
  }
  return queue;
}
function startRound() {
  state.queue = buildQueue();
  state.i = 0;
  state.correct = 0;
  state.answered = 0;
  if (!state.queue.length) {
    $("#q").textContent = "Ingen spørsmål kunne lages for denne kategorien.";
    $("#opts").innerHTML = "";
    return;
  }
  render(state.queue[0]);
}

function renderCats() {
  const wrap = $("#cats");
  wrap.innerHTML = "";
  const lyricsOk = (state.data.lyrics?.lyrics?.length ?? 0) > 0;
  for (const c of CATS) {
    if (c.id === "lyrics" && !lyricsOk) continue;
    const b = document.createElement("button");
    b.className = "chip" + (state.cat === c.id ? " on" : "");
    b.dataset.cat = c.id;
    b.textContent = c.label;
    b.addEventListener("click", () => {
      state.cat = c.id;
      renderCats();
      startRound();
    });
    wrap.appendChild(b);
  }
}

// ---------- UI bindings ----------
function bindUI() {
  // Single delegated listener for the option grid (rebuilt every question).
  $("#opts").addEventListener("click", (e) => {
    const btn = e.target.closest(".opt");
    if (!btn || btn.dataset.idx === undefined) return;
    onAnswer(btn);
  });

  $("#autoBtn").addEventListener("click", (e) => {
    state.auto = !state.auto;
    e.currentTarget.setAttribute("aria-pressed", state.auto ? "true" : "false");
    e.currentTarget.querySelector("i").setAttribute("data-lucide", state.auto ? "pause" : "play");
    setIcons();
    if (state.auto && state.locked && state.current) advance();
  });
  $("#nextBtn").addEventListener("click", advance);
  $("#skipBtn").addEventListener("click", skip);
  $("#resetBtn").addEventListener("click", startRound);
  $("#aboutBtn").addEventListener("click", () => $("#about").showModal());

  window.addEventListener("keydown", (e) => {
    if (e.key >= "1" && e.key <= "4") {
      const btn = document.querySelectorAll(".opt")[Number(e.key) - 1];
      if (btn && !btn.disabled) btn.click();
    } else if (e.key === "Enter") {
      if (!$("#nextBtn").hidden) advance();
      else if (!state.current) startRound();
    } else if (e.key.toLowerCase() === "s") {
      skip();
    } else if (e.key.toLowerCase() === "a") {
      $("#autoBtn").click();
    }
  });
}

// ---------- boot ----------
(async function boot() {
  const files = ["stats", "eggum", "songs", "chords", "awards", "personal", "collabs", "culture", "images", "lyrics"];
  const results = await Promise.all(files.map((f) => loadJSON(`./data/${f}.json`)));
  state.data = Object.fromEntries(files.map((f, i) => [f, results[i]]));
  bindUI();
  renderCats();
  setIcons();
  startRound();
})();
