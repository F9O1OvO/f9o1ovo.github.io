const HIGH_DOT = "̇";
const LOW_DOT = "̣";

function normalizePitchToken(raw) {
  if (!raw || raw === "-" || raw === "0") return { kind: "rest", label: "—" };
  if (raw === "|") return { kind: "bar" };

  let token = raw.trim();
  let accidental = "";
  let octave = 0;

  if (token.startsWith("#") || token.startsWith("♯")) {
    accidental = "#";
    token = token.slice(1);
  } else if (token.startsWith("b") || token.startsWith("♭")) {
    accidental = "b";
    token = token.slice(1);
  }

  while (token.startsWith(".")) {
    octave += 1;
    token = token.slice(1);
  }
  while (token.endsWith(".")) {
    octave -= 1;
    token = token.slice(0, -1);
  }
  while (token.endsWith(HIGH_DOT) || token.endsWith("'")) {
    octave += 1;
    token = token.slice(0, -1);
  }
  while (token.endsWith(LOW_DOT) || token.endsWith(",")) {
    octave -= 1;
    token = token.slice(0, -1);
  }

  const degree = Number(token);
  if (![1, 2, 3, 4, 5, 6, 7].includes(degree)) return null;

  let label = `${accidental}${degree}`;
  if (octave > 0) label += HIGH_DOT.repeat(octave);
  if (octave < 0) label += LOW_DOT.repeat(-octave);
  return { kind: "note", label, degree, accidental, octave };
}

function fingeringFor(note) {
  if (note.kind !== "note") return "";
  const base = { 1: "Z", 2: "X", 3: "C", 4: "V", 5: "B", 6: "N", 7: "M" }[note.degree];
  const parts = [];
  if (note.octave > 0) parts.push("升调");
  if (note.octave < 0) parts.push("降调");
  if (note.accidental === "#") parts.push("半音");
  if (note.accidental === "b") return `降${base}`;
  if (note.degree === 1 && note.octave === 1 && !note.accidental) return ",";
  if (note.octave === 1 && !note.accidental) return `升调+${base}`;
  if (note.octave === -1 && !note.accidental) return `降调+${base}`;
  if (note.accidental === "#" && note.octave === 0) return `半音+${base}`;
  if (parts.length) return `${parts.join("+")}+${base}`;
  return base;
}

function makeNote(degree, accidental, octave) {
  let label = `${accidental}${degree}`;
  if (octave > 0) label += HIGH_DOT.repeat(octave);
  if (octave < 0) label += LOW_DOT.repeat(-octave);
  return { kind: "note", label, degree, accidental, octave };
}

function bumpOctave(note, delta) {
  if (!note || note.kind !== "note") return note;
  return makeNote(note.degree, note.accidental, note.octave + delta);
}

function isNoiseLine(line) {
  return /购琴|店铺|教学|tb店|b23\.tv|clock口琴|用琴：|用琴:|附谱|原曲谱|半音阶口琴谱|有兴趣的同学/.test(line);
}

function parseHarmonicaLine(line, state) {
  const notes = [];
  let sharp = false;
  let i = 0;
  const text = line;

  const pushDegree = (degree) => {
    const accidental = sharp ? "#" : "";
    sharp = false;
    notes.push(makeNote(degree, accidental, state.bracketOctave + state.ottava));
  };

  while (i < text.length) {
    const rest = text.slice(i);
    if (/^8va/i.test(rest)) {
      state.ottava = 1;
      i += 3;
      if (text[i] === ":" || text[i] === "：") i += 1;
      continue;
    }
    if (/^loco/i.test(rest)) {
      state.ottava = 0;
      i += 4;
      continue;
    }

    const ch = text[i];
    if (ch === "(" || ch === "（") {
      state.bracketOctave = -1;
      i += 1;
      continue;
    }
    if (ch === ")" || ch === "）") {
      state.bracketOctave = 0;
      i += 1;
      continue;
    }
    if (ch === "【" || ch === "[") {
      state.bracketOctave = 1;
      i += 1;
      continue;
    }
    if (ch === "】" || ch === "]") {
      state.bracketOctave = 0;
      i += 1;
      continue;
    }
    if (ch === "#" || ch === "♯") {
      sharp = true;
      i += 1;
      continue;
    }
    if (ch >= "1" && ch <= "7") {
      pushDegree(Number(ch));
      i += 1;
      continue;
    }
    if (ch === HIGH_DOT || ch === "'") {
      if (notes.length) notes[notes.length - 1] = bumpOctave(notes[notes.length - 1], 1);
      i += 1;
      continue;
    }
    if (ch === LOW_DOT) {
      if (notes.length) notes[notes.length - 1] = bumpOctave(notes[notes.length - 1], -1);
      i += 1;
      continue;
    }
    if (ch === "-" ) {
      notes.push({ kind: "rest", label: "—" });
      sharp = false;
      i += 1;
      continue;
    }
    sharp = false;
    i += 1;
  }
  return notes;
}

function parseScore(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  let title = "未命名";
  const body = [];
  const meta = [];
  const state = { bracketOctave: 0, ottava: 0 };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      body.push({ blank: true });
      return;
    }
    if (isNoiseLine(trimmed)) return;
    const titleMatch = trimmed.match(/^(标题|title)\s*[:：]\s*(.+)$/i);
    if (titleMatch) {
      title = titleMatch[2].trim();
      return;
    }
    if (/^(说明|备注)\s*[:：]/.test(trimmed)) {
      meta.push(trimmed.replace(/^(说明|备注)\s*[:：]\s*/, ""));
      return;
    }
    body.push({ text: trimmed });
  });

  if (title === "未命名") {
    const named = body.find((row) => row.text && !/[1-7]/.test(row.text) && row.text.length <= 20);
    if (named) title = named.text;
  }

  const scoreLines = [];
  for (let i = 0; i < body.length; i += 1) {
    const row = body[i];
    if (row.blank) {
      state.ottava = 0;
      state.bracketOctave = 0;
      continue;
    }
    if (!/[1-7]/.test(row.text)) continue;

    const harmonicaNotes = parseHarmonicaLine(row.text, state);
    const spaced = row.text.split(/\s+/).filter(Boolean);
    const spacedNotes = spaced.map((tok) => normalizePitchToken(tok)).filter(Boolean);
    const useHarmonica =
      harmonicaNotes.filter((note) => note.kind === "note").length >
      spacedNotes.filter((note) => note && note.kind === "note").length;
    const notes = useHarmonica ? harmonicaNotes : spacedNotes;
    if (!notes.some((note) => note.kind === "note")) continue;

    let lyrics = [];
    const next = body[i + 1];
    if (next && !next.blank && !/[1-7]/.test(next.text)) {
      lyrics = next.text.split(/\s+/).filter(Boolean);
      i += 1;
    }
    scoreLines.push({ notes, lyrics });
  }

  const flat = [];
  scoreLines.forEach((line, lineIndex) => {
    line.notes.forEach((note, noteIndex) => {
      if (note.kind === "bar") return;
      flat.push({
        ...note,
        lineIndex,
        noteIndex,
        lyric: line.lyrics[noteIndex] || "",
      });
    });
  });

  return { title, meta, scoreLines, flat };
}

function renderScore(score) {
  const view = document.getElementById("scoreView");
  const titleEl = document.getElementById("scoreTitle");
  titleEl.textContent = score.flat.length
    ? `${score.title} · ${score.flat.filter((n) => n.kind === "note").length} 个音`
    : "没有识别到音高，请检查格式。";
  view.hidden = !score.scoreLines.length;
  view.innerHTML = "";

  score.scoreLines.forEach((line, lineIndex) => {
    const row = document.createElement("div");
    row.className = "score-line";
    const notes = document.createElement("div");
    notes.className = "score-notes";
    line.notes.forEach((note, noteIndex) => {
      if (note.kind === "bar") {
        const bar = document.createElement("div");
        bar.className = "score-bar";
        notes.appendChild(bar);
        return;
      }
      const cell = document.createElement("div");
      cell.className = `score-note${note.kind === "rest" ? " is-rest" : ""}`;
      cell.dataset.line = String(lineIndex);
      cell.dataset.index = String(noteIndex);
      const lyric = line.lyrics[noteIndex] || "";
      cell.innerHTML = `
        <span class="pitch">${note.label}</span>
        <span class="finger">${fingeringFor(note)}</span>
        <span class="lyric">${lyric}</span>
      `;
      notes.appendChild(cell);
    });
    row.appendChild(notes);
    view.appendChild(row);
  });
}

let loadedScore = null;
let scoreCursor = 0;

function playableNotes() {
  return loadedScore ? loadedScore.flat.filter((item) => item.kind === "note" || item.kind === "rest") : [];
}

function setScoreCursor(index) {
  const playable = playableNotes();
  scoreCursor = Math.max(0, Math.min(index, playable.length));
  while (scoreCursor < playable.length && playable[scoreCursor].kind === "rest") {
    scoreCursor += 1;
  }
  document.querySelectorAll(".score-note").forEach((cell) => {
    cell.classList.remove("is-current", "is-done");
  });
  playable.forEach((item, i) => {
    const cell = document.querySelector(`.score-note[data-line="${item.lineIndex}"][data-index="${item.noteIndex}"]`);
    if (!cell) return;
    if (i < scoreCursor) cell.classList.add("is-done");
    if (i === scoreCursor) cell.classList.add("is-current");
  });
  const current = document.querySelector(".score-note.is-current");
  if (current) current.scrollIntoView({ block: "nearest", inline: "center" });
}

function loadScoreText(text) {
  document.getElementById("scoreSource").value = text;
  loadedScore = parseScore(text);
  renderScore(loadedScore);
  setScoreCursor(0);
}

window.onPlayedLabel = function onPlayedLabel(label) {
  if (!loadedScore) return;
  const playable = playableNotes();
  const expected = playable[scoreCursor];
  if (!expected || expected.kind !== "note") return;
  if (label === expected.label) setScoreCursor(scoreCursor + 1);
};

document.getElementById("scoreApply").addEventListener("click", () => {
  loadScoreText(document.getElementById("scoreSource").value);
});

document.getElementById("scoreReset").addEventListener("click", () => {
  if (loadedScore) setScoreCursor(0);
});

document.getElementById("scoreFile").addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadScoreText(String(reader.result || ""));
  reader.readAsText(file, "utf-8");
  event.target.value = "";
});

document.getElementById("scoreDemo").addEventListener("click", () => {
  fetch("scores/scale.txt")
    .then((res) => res.text())
    .then(loadScoreText)
    .catch(() => {
      document.getElementById("scoreTitle").textContent = "示例文件读取失败。";
    });
});
