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
const mobileVolume = document.getElementById("mobileVolume");
const modeButtons = [...document.querySelectorAll(".mode-btn")];
const mobileModeButtons = [...document.querySelectorAll(".mobile-mode")];
const mobilePads = document.getElementById("mobilePads");
const layoutSwitch = document.getElementById("layoutSwitch");
const mobileStage = document.getElementById("mobileStage");

const voices = new Map();
const heldButtons = [];
const heldKeys = new Set();
const heldUiKinds = new Set();
const pointerNotes = new Map();
const heldModeTouches = new Map();
let layout = "desktop";
let audioCtx = null;
let masterGain = null;
let volume = Number(volumeInput.value) / 100;
const pianoBuffers = new Map();
const rawSamples = new Map();
const SAMPLE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const PRIORITY_MIDIS = [60, 62, 64, 65, 67, 69, 71, 72, 48, 84];

function midiToSampleName(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${SAMPLE_NAMES[pc]}${octave}`;
}

function decoderContext() {
  const Ctor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  return new Ctor(2, 128, 44100);
}

function prefetchRawSamples() {
  for (let midi = 48; midi <= 96; midi += 1) {
    const job = fetch(`samples/piano/${midiToSampleName(midi)}.mp3`)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then(async (raw) => {
        if (!raw) return null;
        try {
          const buffer = await decoderContext().decodeAudioData(raw.slice(0));
          pianoBuffers.set(midi, buffer);
        } catch (error) {
          /* decode later on the playback context */
        }
        return raw;
      })
      .catch(() => null);
    rawSamples.set(midi, job);
  }
}

async function decodeMidi(midi) {
  if (pianoBuffers.has(midi)) return pianoBuffers.get(midi);
  const raw = await rawSamples.get(midi);
  if (!raw) return null;
  const ctx = audioCtx || decoderContext();
  const buffer = await ctx.decodeAudioData(raw.slice(0));
  pianoBuffers.set(midi, buffer);
  return buffer;
}

function lookupBuffer(midi) {
  if (pianoBuffers.has(midi)) return { buffer: pianoBuffers.get(midi), sourceMidi: midi };
  let best = null;
  let bestDist = 99;
  pianoBuffers.forEach((_, key) => {
    const dist = Math.abs(key - midi);
    if (dist < bestDist) {
      best = key;
      bestDist = dist;
    }
  });
  if (best != null && bestDist <= 4) return { buffer: pianoBuffers.get(best), sourceMidi: best };
  return null;
}

async function bufferForMidi(midi) {
  const exact = await decodeMidi(midi);
  if (exact) return { buffer: exact, sourceMidi: midi };
  const nearby = lookupBuffer(midi);
  if (nearby) return nearby;
  for (let dist = 1; dist <= 12; dist += 1) {
    for (const candidate of [midi - dist, midi + dist]) {
      const buffer = await decodeMidi(candidate);
      if (buffer) return { buffer, sourceMidi: candidate };
    }
  }
  return null;
}

function warmupAudio() {
  ensureAudio();
  PRIORITY_MIDIS.forEach(decodeMidi);
}

function ensureAudio() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    return;
  }
  audioCtx = new AudioContext({ latencyHint: "interactive" });
  masterGain = audioCtx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(audioCtx.destination);
}

function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
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

  mobileModeButtons.forEach((button) => {
    const kind = button.dataset.kind;
    if (kind === "natural") {
      button.classList.toggle("is-active", !kinds.has("flat") && !kinds.has("sharp"));
    } else {
      button.classList.toggle("is-active", kinds.has(kind));
    }
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
  const extraClass = classFromAccidental(midi - voice.baseMidi);
  voice.extraClass = extraClass;
  [voice.hole, padElementFor(voice.note)].forEach((el) => {
    if (!el) return;
    el.classList.remove("is-flat", "is-sharp");
    if (extraClass) el.classList.add(extraClass);
  });
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
  stopVoice(id, true);

  const baseMidi = note.midi;
  const accidental = followsModifier ? pitchOffsetFor(note) : 0;
  const midi = baseMidi + accidental;
  const extraClass = classFromAccidental(accidental);
  const token = Symbol(id);

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

  [hole, padElementFor(note)].forEach((el) => {
    if (!el) return;
    el.classList.add("is-on");
    if (extraClass) el.classList.add(extraClass);
  });
  setNoteReadout();

  const current = voices.get(id);
  const got = lookupBuffer(midi);
  if (got) {
    connectSample(current, midi, got);
    if (!options.retrigger && typeof window.onPlayedLabel === "function") {
      window.onPlayedLabel(current.label);
    }
    return;
  }

  connectTone(current, midi);
  bufferForMidi(midi).then((loaded) => {
    if (!loaded || voices.get(id) !== current || current.token !== token) return;
    if (id.startsWith("key-") && !heldKeys.has(note.key)) return;
    if (id.startsWith("ptr-") && !pointerNotes.has(Number(id.slice(4)))) return;
    connectSample(current, midi, loaded, true);
  });
  if (!options.retrigger && typeof window.onPlayedLabel === "function") {
    window.onPlayedLabel(current.label);
  }
}

function connectSample(voice, midi, got, replace = false) {
  const now = audioCtx.currentTime;
  if (replace && voice.gain) {
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
    voice.nodesToStop.forEach((node) => {
      try { node.stop(now + 0.03); } catch (error) { /* already stopped */ }
    });
  }

  const src = audioCtx.createBufferSource();
  src.buffer = got.buffer;
  src.playbackRate.value = 2 ** ((midi - got.sourceMidi) / 12);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.85, now);
  src.connect(gain);
  gain.connect(masterGain);
  src.start(now);
  voice.gain = gain;
  voice.nodesToStop = [src];
}

function connectTone(voice, midi) {
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = midiToFreq(midi);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.22, now);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  voice.gain = gain;
  voice.nodesToStop = [osc];
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

  [voice.hole, padElementFor(voice.note)].forEach((el) => {
    if (!el) return;
    el.classList.remove("is-on", "is-flat", "is-sharp");
  });
  voices.delete(id);
  setNoteReadout();
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || window.navigator.standalone === true;
}

function isFullscreen() {
  return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function syncFullscreenClass() {
  document.documentElement.classList.toggle("is-fullscreen", isStandaloneApp() || isFullscreen());
}

function enterFullscreen() {
  if (layout !== "mobile" || isStandaloneApp() || isFullscreen()) {
    syncFullscreenClass();
    return;
  }
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  const result = req.call(el, { navigationUI: "hide" });
  if (result && typeof result.catch === "function") result.catch(() => {});
}

function exitFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (exit && isFullscreen()) {
    exit.call(document).catch(() => {});
  }
}

function ignoreModifierTarget(target) {
  return Boolean(target.closest("input, textarea, .volume, .score, .text-btn, .file-btn, .layout-switch, .mobile-stage"));
}

function setLayout(next) {
  layout = next === "mobile" ? "mobile" : "desktop";
  document.documentElement.classList.toggle("layout-mobile", layout === "mobile");
  mobileStage.setAttribute("aria-hidden", layout === "mobile" ? "false" : "true");
  layoutSwitch.textContent = layout === "mobile" ? "电脑版" : "手机版";
  localStorage.setItem("harmonica-layout", layout);
  heldButtons.length = 0;
  heldUiKinds.clear();
  heldKeys.clear();
  pointerNotes.clear();
  heldModeTouches.clear();
  [...voices.keys()].forEach((id) => stopVoice(id, true));
  applyModifierChange();
  if (layout === "mobile") enterFullscreen();
  else exitFullscreen();
  syncFullscreenClass();
}

function padElementFor(note) {
  return mobilePads.querySelector(`[data-index="${NOTES.indexOf(note)}"]`);
}

function startPadVoice(pointerId, note, pad) {
  pointerNotes.set(pointerId, note.key);
  startVoice(`ptr-${pointerId}`, note, pad, true);
}

function stopPadVoice(pointerId) {
  pointerNotes.delete(pointerId);
  stopVoice(`ptr-${pointerId}`);
}

function rebuildHeldUiKinds() {
  heldUiKinds.clear();
  let forceNatural = false;
  heldModeTouches.forEach((kind) => {
    if (kind === "natural") forceNatural = true;
    else if (kind === "chromatic") heldUiKinds.add("chromatic");
    else if (kind === "sharp" || kind === "flat") heldUiKinds.add(kind);
  });
  if (forceNatural) {
    heldUiKinds.delete("flat");
    heldUiKinds.delete("sharp");
  }
  applyModifierChange();
}

function pressMobileMode(pointerId, kind) {
  heldModeTouches.set(pointerId, kind);
  rebuildHeldUiKinds();
}

function releaseMobileMode(pointerId) {
  if (!heldModeTouches.has(pointerId)) return;
  heldModeTouches.delete(pointerId);
  rebuildHeldUiKinds();
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

function renderMobilePads() {
  NOTES.forEach((note, index) => {
    const pad = document.createElement("div");
    pad.className = "pad-key";
    pad.role = "button";
    pad.dataset.key = note.key;
    pad.dataset.index = String(index);
    pad.innerHTML = note.octave > 0
      ? `<span>${note.degreeNum}</span><span class="oct">˙</span>`
      : String(note.degreeNum);
    mobilePads.appendChild(pad);
  });
}

function findNoteByKey(key) {
  const normalized = key.length === 1 ? key.toLowerCase() : key;
  return NOTES.find((note) => note.key === normalized);
}

function setVolume(value) {
  volume = Number(value) / 100;
  volumeInput.value = String(value);
  mobileVolume.value = String(value);
  if (masterGain) masterGain.gain.value = volume;
}

renderHoles();
renderMobilePads();
syncModeView();
prefetchRawSamples();

const savedLayout = localStorage.getItem("harmonica-layout");
if (savedLayout === "mobile" || (!savedLayout && window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 900)) {
  setLayout("mobile");
}

layoutSwitch.addEventListener("click", () => {
  setLayout(layout === "mobile" ? "desktop" : "mobile");
});

window.addEventListener("pointerdown", () => {
  warmupAudio();
  if (layout === "mobile") enterFullscreen();
}, { capture: true });

document.addEventListener("fullscreenchange", syncFullscreenClass);
document.addEventListener("webkitfullscreenchange", syncFullscreenClass);
syncFullscreenClass();

volumeInput.addEventListener("input", () => setVolume(volumeInput.value));
mobileVolume.addEventListener("input", () => setVolume(mobileVolume.value));

mobileModeButtons.forEach((button) => {
  button.addEventListener("touchstart", (event) => {
    event.preventDefault();
    warmupAudio();
    for (const touch of event.changedTouches) {
      pressMobileMode(touch.identifier, button.dataset.kind);
    }
  }, { passive: false });
  button.addEventListener("touchend", (event) => {
    event.preventDefault();
    for (const touch of event.changedTouches) releaseMobileMode(touch.identifier);
  }, { passive: false });
  button.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    pressMobileMode(event.pointerId, button.dataset.kind);
  });
  button.addEventListener("pointerup", (event) => {
    if (event.pointerType === "touch") return;
    releaseMobileMode(event.pointerId);
  });
});

mobilePads.addEventListener("touchstart", (event) => {
  event.preventDefault();
  warmupAudio();
  if (layout === "mobile") enterFullscreen();
  for (const touch of event.changedTouches) {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const pad = el && el.closest && el.closest(".pad-key");
    if (!pad) continue;
    const note = NOTES.find((item) => item.key === pad.dataset.key);
    if (!note) continue;
    startPadVoice(touch.identifier, note, pad);
  }
}, { passive: false });

mobilePads.addEventListener("touchmove", (event) => {
  event.preventDefault();
  for (const touch of event.changedTouches) {
    if (!pointerNotes.has(touch.identifier)) continue;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const pad = el && el.closest && el.closest(".pad-key");
    const nextKey = pad && pad.dataset.key;
    const currentKey = pointerNotes.get(touch.identifier);
    if (!nextKey || nextKey === currentKey) continue;
    stopPadVoice(touch.identifier);
    const note = NOTES.find((item) => item.key === nextKey);
    startPadVoice(touch.identifier, note, pad);
  }
}, { passive: false });

function endTouch(event) {
  for (const touch of event.changedTouches) {
    if (!pointerNotes.has(touch.identifier)) continue;
    stopPadVoice(touch.identifier);
  }
}

mobilePads.addEventListener("touchend", endTouch);

mobilePads.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") return;
  const pad = event.target.closest(".pad-key");
  if (!pad) return;
  event.preventDefault();
  pad.setPointerCapture(event.pointerId);
  const note = NOTES.find((item) => item.key === pad.dataset.key);
  if (!note) return;
  startPadVoice(event.pointerId, note, pad);
});

mobilePads.addEventListener("pointermove", (event) => {
  if (!pointerNotes.has(event.pointerId)) return;
  const el = document.elementFromPoint(event.clientX, event.clientY);
  const pad = el && el.closest && el.closest(".pad-key");
  const nextKey = pad && pad.dataset.key;
  const currentKey = pointerNotes.get(event.pointerId);
  if (!nextKey || nextKey === currentKey) return;
  stopPadVoice(event.pointerId);
  const note = NOTES.find((item) => item.key === nextKey);
  startPadVoice(event.pointerId, note, pad);
});

function endPointer(event) {
  if (!pointerNotes.has(event.pointerId)) return;
  stopPadVoice(event.pointerId);
}

mobilePads.addEventListener("pointerup", endPointer);

window.addEventListener("selectstart", (event) => event.preventDefault());
window.addEventListener("gesturestart", (event) => event.preventDefault());
document.addEventListener("touchend", (event) => {
  for (const touch of event.changedTouches) {
    releaseMobileMode(touch.identifier);
    stopPadVoice(touch.identifier);
  }
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
  if (layout === "mobile") return;
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
  pointerNotes.clear();
  heldModeTouches.clear();
  [...voices.keys()].forEach((id) => stopVoice(id, true));
  applyModifierChange();
});
