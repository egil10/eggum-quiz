// Eggum Quiz — hyper-minimal trivia engine.
// Loads stats + (when present) bio/discography/chords/images, mixes question
// generators across categories, and runs the round.

const $ = (s, r = document) => r.querySelector(s);

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
};

const ICONS = {
  stats:    "bar-chart-3",
  trivia:   "sparkles",
  album:    "disc-3",
  year:     "calendar",
  chord:    "music",
  photo:    "image",
  song:     "music-4",
  theme:    "feather",
  count:    "hash",
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
  } catch {
    return null;
  }
}

function withCorrect(correctText, distractors, n = 3) {
  const pool = distractors.filter((d) => d !== correctText);
  const wrong = sample(pool, n);
  if (wrong.length < n) return null;
  return shuffle([
    { text: correctText, correct: true },
    ...wrong.map((t) => ({ text: t, correct: false })),
  ]);
}

// ---------- question generators ----------
// Each returns { category, icon, qmeta, q, options } or null when impossible.

function qStatsMostPlayed(d) {
  const songs = d.stats?.songs;
  if (!songs || songs.length < 8) return null;
  const four = sample(songs.slice(0, 80), 4);
  const correct = four.reduce((a, b) => (a.plays >= b.plays ? a : b));
  return {
    category: "stats",
    qmeta: "Your listening",
    icon: ICONS.stats,
    q: "Which one have you played most?",
    options: shuffle(four.map((s) => ({ text: s.title, correct: s === correct }))),
  };
}

function qStatsLeastPlayed(d) {
  const songs = d.stats?.songs;
  if (!songs || songs.length < 12) return null;
  const four = sample(songs.slice(0, 100), 4);
  const correct = four.reduce((a, b) => (a.plays <= b.plays ? a : b));
  return {
    category: "stats",
    qmeta: "Your listening",
    icon: ICONS.stats,
    q: "Which of these have you played least?",
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
    category: "stats",
    qmeta: "Your listening",
    icon: ICONS.year,
    q: `What year did you first play “${s.title}”?`,
    options: opts,
  };
}

function qStatsPlayRange(d) {
  const songs = d.stats?.songs?.filter((s) => s.plays >= 5) ?? [];
  if (songs.length < 8) return null;
  const s = pick(songs);
  // build 4 non-overlapping ranges, one of which contains s.plays
  const buckets = [
    [1, 10], [11, 25], [26, 50], [51, 100], [101, 200], [201, 400],
  ];
  const correct = buckets.find(([lo, hi]) => s.plays >= lo && s.plays <= hi);
  if (!correct) return null;
  const others = buckets.filter((b) => b !== correct);
  const opts = shuffle([
    correct,
    ...sample(others, 3),
  ]).map((b) => ({
    text: `${b[0]}–${b[1]} plays`,
    correct: b === correct,
  }));
  return {
    category: "stats",
    qmeta: "Your listening",
    icon: ICONS.count,
    q: `Roughly how many plays does “${s.title}” have?`,
    options: opts,
  };
}

function qStatsTopOverall(d) {
  const songs = d.stats?.songs;
  if (!songs || songs.length < 10) return null;
  const top = songs[0];
  const distractors = songs.slice(1, 40).map((s) => s.title);
  const opts = withCorrect(top.title, distractors);
  if (!opts) return null;
  return {
    category: "stats",
    qmeta: "Your listening",
    icon: ICONS.stats,
    q: "Which Eggum song have you played the most overall?",
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
    if (v !== real) distract.add(`${v} h`);
  }
  const opts = withCorrect(`${real} h`, [...distract]);
  if (!opts) return null;
  return {
    category: "stats",
    qmeta: "Your listening",
    icon: ICONS.stats,
    q: "About how many hours total have you spent on Eggum?",
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
    category: "stats",
    qmeta: "Your listening",
    icon: ICONS.stats,
    q: "How many distinct Eggum tracks have you played?",
    options: opts,
  };
}

// ---------- trivia (needs eggum.json bio + trivia array) ----------
function qTrivia(d) {
  const t = d.eggum?.trivia;
  if (!t || !t.length) return null;
  const item = pick(t);
  if (!item?.q || !item?.a) return null;
  // build distractors from other trivia answers of similar shape
  const others = t.filter((x) => x !== item && x.a && x.a.length < 40).map((x) => x.a);
  const opts = withCorrect(item.a, others);
  if (!opts) return null;
  return {
    category: "trivia",
    qmeta: "Trivia",
    icon: ICONS.trivia,
    q: item.q,
    options: opts,
  };
}

// ---------- album questions (needs eggum.albums with tracks) ----------
function qAlbumOfSong(d) {
  const studio = d.eggum?.albums?.filter((a) => a.tracks?.length && a.kind !== "compilation") ?? [];
  if (studio.length < 4) return null;
  // map track (lowercased) → earliest studio album
  const trackToAlbum = new Map();
  for (const a of [...studio].sort((x, y) => x.year - y.year)) {
    for (const t of a.tracks) {
      const k = t.toLowerCase();
      if (!trackToAlbum.has(k)) trackToAlbum.set(k, { album: a, track: t });
    }
  }
  const album = pick(studio);
  const candidates = album.tracks.filter(
    (t) => trackToAlbum.get(t.toLowerCase())?.album === album
  );
  if (!candidates.length) return null;
  const track = pick(candidates);
  const distractors = sample(studio.filter((a) => a !== album), 8).map(
    (a) => `${a.title} (${a.year})`
  );
  const opts = withCorrect(`${album.title} (${album.year})`, distractors);
  if (!opts) return null;
  return {
    category: "album",
    qmeta: "Album",
    icon: ICONS.album,
    q: `Which album is “${track}” from?`,
    options: opts,
  };
}

function qAlbumYear(d) {
  const albums = d.eggum?.albums ?? [];
  if (albums.length < 4) return null;
  const album = pick(albums);
  const yrs = new Set(albums.map((a) => String(a.year)));
  const opts = withCorrect(String(album.year), [...yrs]);
  if (!opts) return null;
  return {
    category: "album",
    qmeta: "Album",
    icon: ICONS.year,
    q: `What year was the album “${album.title}” released?`,
    options: opts,
  };
}

// ---------- chord questions (needs chords.json) ----------
function qChordKey(d) {
  const chords = d.chords?.chords;
  if (!chords || chords.length < 4) return null;
  const song = pick(chords);
  if (!song.key) return null;
  const keys = ["C", "G", "D", "A", "E", "Am", "Em", "Dm", "F", "Bm"];
  const opts = withCorrect(song.key, keys);
  if (!opts) return null;
  return {
    category: "chord",
    qmeta: "Chords",
    icon: ICONS.chord,
    q: `What key is “${song.title}” in?`,
    options: opts,
  };
}

function qChordIntro(d) {
  const chords = d.chords?.chords?.filter((c) => c.intro_chords?.length >= 3) ?? [];
  if (chords.length < 4) return null;
  const song = pick(chords);
  const introText = song.intro_chords.slice(0, 4).join(" – ");
  const others = chords.filter((c) => c !== song).map((c) => c.title);
  const opts = withCorrect(song.title, others);
  if (!opts) return null;
  return {
    category: "chord",
    qmeta: "Chords",
    icon: ICONS.chord,
    q: `Which Eggum song opens with these chords: ${introText}?`,
    options: opts,
  };
}

// ---------- photo question ----------
function qPhotoEvent(d) {
  const imgs = d.images?.images;
  if (!imgs || imgs.length < 4) return null;
  // Use the caption-based question only when captions vary; otherwise skip.
  const img = pick(imgs);
  const events = imgs
    .map((i) => i.caption.split(",")[0])
    .filter((c, idx, arr) => arr.indexOf(c) === idx);
  if (events.length < 4) return null;
  const correctEvent = img.caption.split(",")[0];
  const opts = withCorrect(correctEvent, events);
  if (!opts) return null;
  return {
    category: "photo",
    qmeta: "Photo",
    icon: ICONS.photo,
    q: "(Photo) Where was this Jan Eggum picture taken?",
    photo: img.url,
    options: opts,
  };
}

// ---------- master pool + balancing ----------
const GENERATORS = [
  qStatsMostPlayed,
  qStatsLeastPlayed,
  qStatsFirstYear,
  qStatsPlayRange,
  qStatsTopOverall,
  qStatsTotalHours,
  qStatsUniqueSongs,
  qTrivia,
  qTrivia,
  qTrivia,
  qAlbumOfSong,
  qAlbumOfSong,
  qAlbumYear,
  qChordKey,
  qChordIntro,
  qPhotoEvent,
];

function nextQuestion(d, seen) {
  for (let tries = 0; tries < 40; tries++) {
    const g = pick(GENERATORS);
    const q = g(d);
    if (!q) continue;
    const sig = q.q;
    if (seen.has(sig)) continue;
    seen.add(sig);
    return q;
  }
  return null;
}

// ---------- rendering ----------
function setIcons() {
  if (window.lucide?.createIcons) window.lucide.createIcons();
}

function setCategoryLabel(q) {
  const el = $("#catLabel");
  el.innerHTML = `<i data-lucide="${q.icon}"></i><span>${q.qmeta}</span>`;
  setIcons();
}

function render(q) {
  state.current = q;
  state.locked = false;
  setCategoryLabel(q);
  $("#qmeta").innerHTML = `<i data-lucide="${q.icon}"></i><span>${q.qmeta}</span>`;
  const qEl = $("#q");
  if (q.photo) {
    qEl.innerHTML = `<img class="qphoto" alt="" src="${q.photo}" /><span class="qphoto-text">${q.q}</span>`;
  } else {
    qEl.textContent = q.q;
  }

  const opts = $("#opts");
  opts.innerHTML = "";
  q.options.forEach((o, idx) => {
    const b = document.createElement("button");
    b.className = "opt";
    b.dataset.correct = o.correct ? "1" : "0";
    b.dataset.idx = idx;
    b.innerHTML = `<span class="badge">${idx + 1}</span><span>${o.text}</span>`;
    b.addEventListener("click", () => onAnswer(b));
    opts.appendChild(b);
  });
  $("#nextBtn").hidden = true;
  updateProgress();
  setIcons();
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
  if (!q || state.answered >= state.total) {
    finish();
  } else {
    render(q);
  }
}

function finish() {
  state.current = null;
  $("#q").textContent =
    `Done — ${state.correct} of ${state.answered} right.`;
  $("#qmeta").innerHTML = `<i data-lucide="check"></i><span>Round complete</span>`;
  const opts = $("#opts");
  opts.innerHTML = "";
  const b = document.createElement("button");
  b.className = "opt";
  b.innerHTML = `<span class="badge"><i data-lucide="rotate-ccw"></i></span><span>Play again</span>`;
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

// ---------- round lifecycle ----------
function buildQueue() {
  const seen = new Set();
  const queue = [];
  for (let i = 0; i < state.total; i++) {
    const q = nextQuestion(state.data, seen);
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
    $("#q").textContent = "No questions could be built — check data/ files.";
    return;
  }
  render(state.queue[0]);
}

// ---------- input + chrome ----------
function bindUI() {
  $("#autoBtn").addEventListener("click", (e) => {
    state.auto = !state.auto;
    e.currentTarget.setAttribute("aria-pressed", state.auto ? "true" : "false");
    e.currentTarget.querySelector("i").setAttribute(
      "data-lucide",
      state.auto ? "pause" : "play"
    );
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
  const [stats, eggum, chords, images] = await Promise.all([
    loadJSON("./data/stats.json"),
    loadJSON("./data/eggum.json"),
    loadJSON("./data/chords.json"),
    loadJSON("./data/images.json"),
  ]);
  state.data = { stats, eggum, chords, images };
  bindUI();
  setIcons();
  startRound();
})();
