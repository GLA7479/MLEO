// lib/mleo-engine.js
// Independent MLEO accrual engine (no touch to Coins logic)

const LS_KEY = "MLEO_ENGINE_V1";

let CONFIG = {
  v1: 0.5,
  blocks: [
    { start: 1,  end: 10,  r: 1.6 },
    { start: 11, end: 20,  r: 1.4 },
    { start: 21, end: 30,  r: 1.3 },
    { start: 31, end: 40,  r: 1.1 },
    { start: 41, end: 50,  r: 1.05 },
    { start: 51, end: 100, r: 1.001 },
    { start: 101,end: 150, r: 1.001 },
    { start: 151,end: 200, r: 1.001 },
    { start: 201,end: 250, r: 1.001 },
    { start: 251,end: 300, r: 1.001 },
    { start: 301,end: 350, r: 1.001 },
    { start: 351,end: 400, r: 1.001 },
    { start: 401,end: 450, r: 1.001 },
    { start: 451,end: 500, r: 1.001 },
    { start: 501,end: 550, r: 1.001 },
    { start: 551,end: 600, r: 1.001 },
    { start: 601,end: 650, r: 1.001 },
    { start: 651,end: 700, r: 1.001 },
    { start: 701,end: 750, r: 1.001 },
    { start: 751,end: 800, r: 1.001 },
    { start: 801,end: 850, r: 1.001 },
    { start: 851,end: 900, r: 1.001 },
    { start: 901,end: 950, r: 1.001 },
    { start: 951,end: 1000,r: 1.001 },
  ],
};

function loadLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveLS(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

function getStageFromBreakCount(breakCount) {
  return Math.min(1000, Math.max(1, breakCount + 1)); // 1-based
}

function findBlockMultiplier(stage) {
  for (let i = 0; i < CONFIG.blocks.length; i++) {
    const b = CONFIG.blocks[i];
    if (stage >= b.start && stage <= b.end) return b.r;
  }
  return CONFIG.blocks[CONFIG.blocks.length - 1].r;
}

function defaultState() {
  return {
    breakCount: 0,
    currentStage: 1,
    currentPerBreakValue: CONFIG.v1, // starts at v1
    balance: 0,
  };
}

export function initMleoEngine(externalConfigJson) {
  if (externalConfigJson && externalConfigJson.blocks && externalConfigJson.v1) {
    CONFIG = externalConfigJson;
  }
  let s = loadLS();
  if (!s) {
    s = defaultState();
    saveLS(s);
  } else {
    s.currentStage = Math.min(1000, Math.max(1, s.currentStage || 1));
    if (typeof s.currentPerBreakValue !== "number") s.currentPerBreakValue = CONFIG.v1;
  }
  return getSnapshot();
}

/**
 * Call once on successful rock-break (no Coins involvement).
 * Returns awarded MLEO for this break.
 */
export function onRockBreakSuccess() {
  let s = loadLS();
  if (!s) s = defaultState();

  const stage = getStageFromBreakCount(s.breakCount);
  const r = findBlockMultiplier(stage);

  const awarded = s.currentPerBreakValue;  // award for THIS break
  s.currentPerBreakValue = s.currentPerBreakValue * r; // prep next break
  s.breakCount += 1;
  s.currentStage = getStageFromBreakCount(s.breakCount);
  s.balance = round6((s.balance || 0) + awarded);

  saveLS(s);
  return awarded;
}

export function getSnapshot() {
  const s = loadLS() || defaultState();
  return { ...s, rCurrent: findBlockMultiplier(s.currentStage) };
}

export function setConfig(configJson) {
  if (!configJson || !configJson.blocks || !configJson.v1) return false;
  CONFIG = configJson;
  return true;
}

export function resetMleoEngine() {
  const s = defaultState();
  saveLS(s);
  return getSnapshot();
}

function round6(x) { return Math.round((x + Number.EPSILON) * 1e6) / 1e6; }
