const NOTES = [
  { key: "z", degree: "1", degreeNum: 1, octave: 0, name: "C4", midi: 60 },
  { key: "x", degree: "2", degreeNum: 2, octave: 0, name: "D4", midi: 62 },
  { key: "c", degree: "3", degreeNum: 3, octave: 0, name: "E4", midi: 64 },
  { key: "v", degree: "4", degreeNum: 4, octave: 0, name: "F4", midi: 65 },
  { key: "b", degree: "5", degreeNum: 5, octave: 0, name: "G4", midi: 67 },
  { key: "n", degree: "6", degreeNum: 6, octave: 0, name: "A4", midi: 69 },
  { key: "m", degree: "7", degreeNum: 7, octave: 0, name: "B4", midi: 71 },
  { key: ",", degree: "1̇", degreeNum: 1, octave: 1, name: "C5", midi: 72 },
];

const MODE_META = {
  natural: { label: "自然音", className: "mode-natural", harmonicaClass: "", accidental: 0 },
  flat: { label: "降调", className: "mode-flat", harmonicaClass: "is-flat", accidental: -12 },
  chromatic: { label: "半音", className: "mode-sharp", harmonicaClass: "is-sharp", accidental: 1 },
  sharp: { label: "升调", className: "mode-sharp", harmonicaClass: "is-sharp", accidental: 12 },
};

const harmonica = document.getElementById("harmonica");
const comb = document.getElementById("comb");
const modeLabel = document.getElementById("modeLabel");
const noteLabel = document.getElementById("noteLabel");
const volumeInput = document.getElementById("volume");
const modeButtons = [...document.querySelectorAll(".mode-btn")];

const voices = new Map();
const heldButtons = [];
const heldKeys = new Set();
const heldUiKinds = new Set();
let audioCtx = null;
let masterGain = null;
let pianoReady = null;
let volume = Number(volumeInput.value) / 100;
const pianoBuffers = new Map();
const SAMPLE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function midiToSampleName(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${SAMPLE_NAMES[pc]}${octave}`;
}

function nearestSampleMidi(midi) {
  let best = 72;
  let bestDist = 99;
  pianoBuffers.forEach((_, key) => {
    const dist = Math.abs(key - midi);
    if (dist < bestDist) {
      best = key;
      bestDist = dist;
    }
  });
  return best;
}

async function loadPianoSamples() {
  const jobs = [];
  for (let midi = 48; midi <= 96; midi += 1) {
    const name = midiToSampleName(midi);
    jobs.push(
      fetch(`samples/piano/${name}.mp3`)
        .then((res) => {
          if (!res.ok) throw new Error(name);
          return res.arrayBuffer();
        })
        .then((raw) => audioCtx.decodeAudioData(raw))
        .then((buffer) => {
          pianoBuffers.set(midi, buffer);
        })
    );
  }
  await Promise.all(jobs);
}

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = volume;

  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 6;
  compressor.ratio.value = 1.8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.12;

  masterGain.connect(compressor);
  compressor.connect(audioCtx.destination);
  pianoReady = loadPianoSamples();
}

function labelForNote(note) {
  const kinds = activeKinds();
  let octave = note.octave;
  if (kinds.has("flat")) octave -= 1;
  if (kinds.has("sharp")) octave += 1;
  const sharpBlack = kinds.has("chromatic") && hasBlackKey(note.degreeNum);
  let text = sharpBlack ? `#${note.degreeNum}` : String(note.degreeNum);
  if (octave > 0) text += "̇".repeat(octave);
  if (octave < 0) text += "̣".repeat(-octave);
  return text;
}

function hasBlackKey(degreeNum) {
  return degreeNum !== 3 && degreeNum !== 7;
}

function kindFromButton(button) {
  if (button === 0) return "flat";
  if (button === 1) return "chromatic";
  if (button === 2) return "sharp";
  return "natural";
}

function activeKinds() {
  const kinds = new Set(heldUiKinds);
  heldButtons.forEach((button) => {
    const kind = kindFromButton(button);
    if (kind !== "natural") kinds.add(kind);
  });
  return kinds;
}

function currentAccidental() {
  let total = 0;
  activeKinds().forEach((kind) => {
    total += MODE_META[kind].accidental;
  });
  return total;
}

function pitchOffsetFor(note) {
  const kinds = activeKinds();
  let total = 0;
  if (kinds.has("flat")) total -= 12;
  if (kinds.has("sharp")) total += 12;
  if (kinds.has("chromatic") && hasBlackKey(note.degreeNum)) total += 1;
  return total;
}

function syncModeView() {
  const kinds = activeKinds();
  const order = ["flat", "chromatic", "sharp"];
  const labels = order.filter((kind) => kinds.has(kind)).map((kind) => MODE_META[kind].label);
  const net = currentAccidental();

  if (!labels.length) {
    modeLabel.textContent = MODE_META.natural.label;
    modeLabel.className = MODE_META.natural.className;
  } else {
    modeLabel.textContent = labels.join(" + ");
    modeLabel.className = net < 0 ? "mode-flat" : "mode-sharp";
  }

  harmonica.classList.remove("is-flat", "is-sharp");
  if (net < 0) harmonica.classList.add("is-flat");
  if (net > 0) harmonica.classList.add("is-sharp");

  modeButtons.forEach((button) => {
    const buttonKind = button.dataset.kind || (Number(button.dataset.accidental) < 0 ? "flat" : "sharp");
    button.classList.toggle("is-active", kinds.has(buttonKind));
  });
}

function setNoteReadout() {
  if (!voices.size) {
    noteLabel.textContent = "—";
    return;
  }
  const names = [...voices.values()].map((voice) => voice.label);
  noteLabel.textContent = names.join("  ");
}

function classFromAccidental(value) {
  if (value < 0) return "is-flat";
  if (value > 0) return "is-sharp";
  return "";
}

function applyHoleStyle(voice, midi) {
  voice.label = labelForNote(voice.note);
  if (!voice.hole) return;
  voice.hole.classList.remove("is-flat", "is-sharp");
  const extraClass = classFromAccidental(midi - voice.baseMidi);
  voice.extraClass = extraClass;
  if (extraClass) voice.hole.classList.add(extraClass);
}

function retuneFollowingVoices() {
  const playing = [...voices.entries()]
    .filter(([, voice]) => voice.followsModifier)
    .map(([id, voice]) => ({
      id,
      note: voice.note,
      hole: voice.hole,
      midi: voice.midi,
    }));

  playing.forEach(({ id, note, hole, midi }) => {
    const nextMidi = note.midi + pitchOffsetFor(note);
    const voice = voices.get(id);
    if (!voice) return;
    if (nextMidi === midi) {
      applyHoleStyle(voice, midi);
      return;
    }
    startVoice(id, note, hole, true, { retrigger: true });
  });
  setNoteReadout();
}

function applyModifierChange() {
  syncModeView();
  retuneFollowingVoices();
}

function startVoice(id, note, hole, followsModifier, options = {}) {
  ensureAudio();
  if (audioCtx.state === "suspended") audioCtx.resume();
  stopVoice(id, true);

  const baseMidi = note.midi;
  const accidental = followsModifier ? pitchOffsetFor(note) : 0;
  const midi = baseMidi + accidental;
  const extraClass = classFromAccidental(accidental);
  const token = Symbol(id);

  const play = () => {
    const current = voices.get(id);
    if (!current || current.token !== token) return;
    if (id.startsWith("key-") && !heldKeys.has(note.key)) return;

    const sourceMidi = pianoBuffers.has(midi) ? midi : nearestSampleMidi(midi);
    const buffer = pianoBuffers.get(sourceMidi);
    if (!buffer) return;

    const now = audioCtx.currentTime;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = 2 ** ((midi - sourceMidi) / 12);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.9, now + 0.008);

    src.connect(gain);
    gain.connect(masterGain);
    src.start(now);

    current.gain = gain;
    current.nodesToStop = [src];
    if (!options.retrigger && typeof window.onPlayedLabel === "function") {
      window.onPlayedLabel(current.label);
    }
  };

  voices.set(id, {
    token,
    gain: null,
    nodesToStop: [],
    baseMidi,
    midi,
    followsModifier,
    note,
    label: labelForNote(note),
    hole,
    extraClass,
  });

  if (hole) {
    hole.classList.add("is-on");
    if (extraClass) hole.classList.add(extraClass);
  }
  setNoteReadout();

  if (pianoBuffers.size) {
    play();
  } else {
    pianoReady.then(play);
  }
}

function stopVoice(id, immediate = false) {
  const voice = voices.get(id);
  if (!voice) return;

  const now = audioCtx ? audioCtx.currentTime : 0;
  const fade = immediate ? 0.02 : 0.28;
  if (voice.gain) {
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
  }
  voice.nodesToStop.forEach((node) => {
    try {
      node.stop(now + fade + 0.02);
    } catch (error) {
      /* already stopped */
    }
  });

  if (voice.hole) {
    voice.hole.classList.remove("is-on", "is-flat", "is-sharp");
  }
  voices.delete(id);
  setNoteReadout();
}

function ignoreModifierTarget(target) {
  return Boolean(target.closest("input, textarea, .volume, .score, .text-btn, .file-btn"));
}

function mouseButtonsFromEvent(event) {
  const next = [];
  if (event.buttons & 1) next.push(0);
  if (event.buttons & 4) next.push(1);
  if (event.buttons & 2) next.push(2);
  return next;
}

function syncHeldButtons(next) {
  const changed =
    next.length !== heldButtons.length || next.some((button, index) => button !== heldButtons[index]);
  if (!changed) return;
  heldButtons.length = 0;
  heldButtons.push(...next);
  applyModifierChange();
}

function renderHoles() {
  NOTES.forEach((note, index) => {
    const hole = document.createElement("div");
    hole.className = "hole";
    hole.dataset.index = String(index);
    hole.innerHTML = `
      <kbd>${note.key === "," ? "," : note.key.toUpperCase()}</kbd>
      <span class="solfege">${note.degree}</span>
      <span class="pitch">${note.name}</span>
    `;
    comb.appendChild(hole);
  });
}

function findNoteByKey(key) {
  const normalized = key.length === 1 ? key.toLowerCase() : key;
  return NOTES.find((note) => note.key === normalized);
}

renderHoles();
syncModeView();

volumeInput.addEventListener("input", () => {
  volume = Number(volumeInput.value) / 100;
  if (masterGain) masterGain.gain.value = volume;
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.target.closest("textarea, input")) return;
  const note = findNoteByKey(event.key);
  if (!note) return;
  event.preventDefault();
  heldKeys.add(note.key);
  const hole = comb.children[NOTES.indexOf(note)];
  startVoice(`key-${note.key}`, note, hole, true);
});

window.addEventListener("keyup", (event) => {
  const note = findNoteByKey(event.key);
  if (!note) return;
  heldKeys.delete(note.key);
  stopVoice(`key-${note.key}`);
});

window.addEventListener("mousedown", (event) => {
  if (event.button === 1) event.preventDefault();
  if (ignoreModifierTarget(event.target)) return;
  syncHeldButtons(mouseButtonsFromEvent(event));
});

window.addEventListener("mouseup", (event) => {
  syncHeldButtons(mouseButtonsFromEvent(event));
});

window.addEventListener("auxclick", (event) => {
  event.preventDefault();
});

window.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

window.addEventListener("blur", () => {
  heldButtons.length = 0;
  heldUiKinds.clear();
  heldKeys.clear();
  [...voices.keys()].forEach((id) => stopVoice(id, true));
  applyModifierChange();
});
