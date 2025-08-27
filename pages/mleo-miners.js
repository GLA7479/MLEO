// pages/mleo-miners.js
// v5.8 — Gifts & economy:
// • Regular Gift = 10% of current rock-break coins; Ad Gift = 50%.
// • Gift weights: Coins 70% • Dog (LVL-1) 20% • DPS +10% 5% • GOLD +10% 5%.
// • Diamond Chest (3×💎): 55% → ×1000% or Dog+3 • 30% → ×10000% or Dog+5 • 15% → ×100000% or Dog+7.
// • DPS/GOLD costs use anchored base (costBase) — no per-rock price jumps.
// • Keeps 3h gift cycle with adaptive intervals and offline cap 1 gift.

import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";

// ====== Config ======
const LANES = 4;
const SLOTS_PER_LANE = 4;
const MAX_MINERS = LANES * SLOTS_PER_LANE; // 16 cap
const PADDING = 6;
const LS_KEY = "mleoMiners_v5_81_reset1"; // bump key to force a fresh save for everyone


// Assets
const IMG_BG    = "/images/bg-cave.png";
const IMG_MINER = "/images/leo-miner-4x.png";
const IMG_ROCK  = "/images/rock.png";
const IMG_COIN  = "/images/silver.png";

// SFX
const S_CLICK = "/sounds/click.mp3";
const S_MERGE = "/sounds/merge.mp3";
const S_ROCK  = "/sounds/rock.mp3";
const S_GIFT  = "/sounds/gift.mp3"; // optional

// Balance
const BASE_DPS = 2;
const LEVEL_DPS_MUL = 1.9;
const ROCK_BASE_HP = 60;
const ROCK_HP_MUL = 2.15;
const GOLD_FACTOR = 0.12;

// ===== Diamond chest prize catalog (for UI) =====
const DIAMOND_PRIZES = [
  { key: "coins_x10",    label: "Coins ×1000% (×10 gift)" },
  { key: "dog+3",        label: "Dog +3 levels" },
  { key: "coins_x100",   label: "Coins ×10000% (×100 gift)" },
  { key: "dog+5",        label: "Dog +5 levels" },
  { key: "coins_x1000",  label: "Coins ×100000% (×1000 gift)" },
  { key: "dog+7",        label: "Dog +7 levels" },
];

// שכבות לפי שכיחות: 55% (×1000%/Dog+3), 30% (×10000%/Dog+5), 15% (×100000%/Dog+7)
function rollDiamondPrize() {
  const r = Math.random();
  if (r < 0.55)       return Math.random() < 0.5 ? "coins_x10"   : "dog+3";    // 1000% = ×10 gift
  if (r < 0.85)       return Math.random() < 0.5 ? "coins_x100"  : "dog+5";    // 10000% = ×100 gift
  /* 0.85..1 */       return Math.random() < 0.5 ? "coins_x1000" : "dog+7";    // 100000% = ×1000 gift
}

// ===== NEW: Gift schedule (3-hour cycle) =====
// 30m every 20s → 30m every 30s → 30m every 40s → 30m every 50s → 60m every 60s
const GIFT_PHASES = [
  { durSec: 30 * 60, intervalSec: 20 },
  { durSec: 30 * 60, intervalSec: 30 },
  { durSec: 30 * 60, intervalSec: 40 },
  { durSec: 30 * 60, intervalSec: 50 },
  { durSec: 60 * 60, intervalSec: 60 },
];
const GIFT_CYCLE_SEC = GIFT_PHASES.reduce((a, p) => a + p.durSec, 0); // 3 hours

// Auto-dog
const DOG_INTERVAL_SEC = 1800; // every 30 minutes
const DOG_BANK_CAP = 6;       // can accumulate up to 6

// Rail alignment (fractions of BG height)
const TRACK_Y_FRACS = [0.375, 0.525, 0.675, 0.815];
const LANE_H_FRAC_MOBILE = 0.175;
const LANE_H_FRAC_DESK   = 0.19;

// Offline cap
const OFFLINE_CAP_HOURS = 12;

// ====== *** PER-LANE KNOBS (EDIT HERE) *** ======
const ROCK_TOP_FRACS    = [0.06, 0.06, 0.06, 0.06];
const ROCK_BOTTOM_FRACS = [0.06, 0.06, 0.06, 0.06];

const MINER_Y_FRACS     = [0.56, 0.56, 0.56, 0.56];
const MINER_SIZE_FRACS  = [0.84, 0.84, 0.84, 0.84];
// =================================================

// ===== Formatting =====
const formatShort = (n) => {
  const abs = Math.abs(n || 0);
  if (abs >= 1e12) return (n / 1e12).toFixed(abs < 1e13 ? 1 : 0) + "T";
  if (abs >= 1e9)  return (n / 1e9 ).toFixed(abs < 1e10 ? 1 : 0) + "B";
  if (abs >= 1e6)  return (n / 1e6 ).toFixed(abs < 1e7  ? 1 : 0) + "M";
  if (abs >= 1e3)  return (n / 1e3 ).toFixed(abs < 1e4  ? 1 : 0) + "K";
  return String(Math.floor(n || 0));
};

// ===== Simple image cache =====
const IMG_CACHE = {};
function getImg(src) {
  if (!IMG_CACHE[src]) {
    const img = new Image();
    img.src = src;
    IMG_CACHE[src] = img;
  }
  return IMG_CACHE[src];
}

// ===== Helpers for the new gift schedule =====
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function clampDogBank(s) {
  s.autoDogBank = Math.max(0, Math.min(DOG_BANK_CAP, Math.floor(s.autoDogBank || 0)));
}
function processAutoDog(s, now = Date.now()) {
  const intervalMs = DOG_INTERVAL_SEC * 1000;
  if (!s.autoDogLastAt) { s.autoDogLastAt = now; return; }

  const elapsed = Math.max(0, now - s.autoDogLastAt);
  const intervals = Math.floor(elapsed / intervalMs);
  if (intervals <= 0) return;

  const room = Math.max(0, DOG_BANK_CAP - Math.floor(s.autoDogBank || 0));
  const add  = Math.min(intervals, room);
  if (add > 0) s.autoDogBank = Math.floor((s.autoDogBank || 0) + add);

  // תמיד “אוכלים” את הזמן שעבר – אין קרדיט נצבר כשהבנק מלא
  const remainder = elapsed % intervalMs;
  s.autoDogLastAt = now - remainder;

  clampDogBank(s);
}


function normalizeCycleStart(s, now) {
  if (!s.cycleStartAt) { s.cycleStartAt = now; return; }
  // advance forward so that (now - cycleStartAt) < cycle length
  const diffSec = Math.max(0, Math.floor((now - s.cycleStartAt) / 1000));
  if (diffSec >= GIFT_CYCLE_SEC) {
    const n = Math.floor(diffSec / GIFT_CYCLE_SEC);
    s.cycleStartAt += n * GIFT_CYCLE_SEC * 1000;
  }
}

function getCycleOffsetSec(s, now) {
  normalizeCycleStart(s, now);
  return Math.max(0, Math.floor((now - s.cycleStartAt) / 1000));
}

function currentGiftIntervalSec(s, now = Date.now()) {
  const off = getCycleOffsetSec(s, now);
  let acc = 0;
  for (const ph of GIFT_PHASES) {
    if (off < acc + ph.durSec) return ph.intervalSec;
    acc += ph.durSec;
  }
  // Fallback (shouldn't happen): last phase
  return GIFT_PHASES[GIFT_PHASES.length - 1].intervalSec;
}

function scheduleNextGiftFromNow(s, now = Date.now()) {
  const sec = currentGiftIntervalSec(s, now);
  s.giftNextAt = now + sec * 1000;
  s.lastGiftIntervalSec = sec; // store used interval for progress calc convenience
}

export default function MleoMiners() {
  const wrapRef   = useRef(null);
  const canvasRef = useRef(null);
  const rafRef    = useRef(0);
  const dragRef   = useRef({ active:false });
  const stateRef  = useRef(null);

  const [ui, setUi] = useState({ gold: 0, spawnCost: 50, dpsMult: 1, goldMult: 1, muted: false });

  const [isPortrait, setIsPortrait] = useState(true);
  const [isDesktop,  setIsDesktop]  = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  const [showIntro, setShowIntro] = useState(true);
  const [playerName, setPlayerName] = useState("");
  const [gamePaused, setGamePaused] = useState(true);

  const [showHowTo, setShowHowTo] = useState(false);
  const [adWatching, setAdWatching] = useState(false);
// ✅ אתחול נטול-SSR; נטען מה-LS רק אחרי mount
const [adCooldownUntil, setAdCooldownUntil] = useState(0);



// Persist cooldown whenever it changes (skip first mount to avoid overwriting LS with 0)
const didInitCooldown = useRef(false);
useEffect(() => {
  if (!didInitCooldown.current) { didInitCooldown.current = true; return; }
  try {
    const raw = localStorage.getItem(LS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data.adCooldownUntil = adCooldownUntil;
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {}
}, [adCooldownUntil]);


  const [showAdModal, setShowAdModal] = useState(false);
  const [adVideoEnded, setAdVideoEnded] = useState(false);

    // Offline collect overlay
  const [showCollect, setShowCollect] = useState(false);
  useEffect(() => {
    theStateFix_maybeMigrateLocalStorage();
  }, []);

  // Gift UI
  const [giftReadyFlag, setGiftReadyFlag] = useState(false);
  const [giftToast, setGiftToast] = useState(null); // {text, id}
  // Diamonds info modal
  const [showDiamondInfo, setShowDiamondInfo] = useState(false);
// Reset confirm modal
const [showResetConfirm, setShowResetConfirm] = useState(false);
// --- SSR guard: becomes true only after LS init completes ---
const [mounted, setMounted] = useState(false);



  // UI pulse to keep timers smooth (re-render ~10Hz)
  const uiPulseAccumRef = useRef(0);
  const [, forceUiPulse] = useState(0);

  // ===== Sound helper =====
  const play = (src) => { if (ui.muted || !src) return; try { const a = new Audio(src); a.volume = 0.35; a.play().catch(()=>{}); } catch {} };

  const laneSafe = (arr, lane, fallback) =>
    Array.isArray(arr) && arr[lane] != null ? arr[lane] : (fallback ?? arr?.[0] ?? 0);

  const newRock = (lane, idx) => {
    const hp = Math.floor(ROCK_BASE_HP * Math.pow(ROCK_HP_MUL, idx));
    return { lane, idx, maxHp: hp, hp };
  };
  const minerDps = (lvl, mul) => BASE_DPS * Math.pow(LEVEL_DPS_MUL, lvl - 1) * mul;

  const countMiners = (s) => Object.keys(s.miners).length;

  const boardHasMergeablePair = (s) => {
    const seen = {};
    for (let l=0;l<LANES;l++){
      for (let k=0;k<SLOTS_PER_LANE;k++){
        const cell = s.lanes[l].slots[k];
        if (!cell) continue;
        const m = s.miners[cell.id]; if (!m) continue;
        seen[m.level] = (seen[m.level]||0)+1;
        if (seen[m.level] >= 2) return true;
      }
    }
    return false;
  };
  const lowestLevelOnBoard = (s) => {
    let min = Infinity;
    for (let l=0;l<LANES;l++){
      for (let k=0;k<SLOTS_PER_LANE;k++){
        const cell = s.lanes[l].slots[k];
        if (!cell) continue;
        const m = s.miners[cell.id]; if (!m) continue;
        if (m.level < min) min = m.level;
      }
    }
    return min === Infinity ? 1 : min;
  };

const newState = () => {
  const now = Date.now();
  return {
    lanes: Array.from({ length: LANES }, (_, lane) => ({
      slots: Array(SLOTS_PER_LANE).fill(null),
      rock: newRock(lane, 0),
      rockCount: 0,
      beltShift: 0,
    })),
    miners: {},
    nextId: 1,
    gold: 0,
    spawnCost: 50,
    dpsMult: 1,
    goldMult: 1,
    anim: { t: 0, coins: [], hint: 1, fx: [] },
    onceSpawned: false,
    portrait: false,
    paused: true,

    // Purchasing & levels
    totalPurchased: 0,
    spawnLevel: 1,

    // OFFLINE
    lastSeen: now,
    pendingOfflineGold: 0,

    // Gifts
    cycleStartAt: now,
    lastGiftIntervalSec: 20,
    giftNextAt: now + 20 * 1000, // first gift ~20s
    giftReady: false,

    // Diamonds
    diamonds: 0,
    nextDiamondPrize: rollDiamondPrize(),

    // Auto-dog
    autoDogLastAt: now,
    autoDogBank: 0,

    // UI pressed feedback
    pressedPill: null,
  };
};   // ← ← ← פה נסגר האובייקט וגם הפונקציה


const save = () => {
  const s = stateRef.current; if (!s) return;
  clampDogBank(s); // ודא שהבנק לא חורג לפני שמירה
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({

      // core
      lanes: s.lanes, miners: s.miners, nextId: s.nextId,
      gold: s.gold, spawnCost: s.spawnCost, dpsMult: s.dpsMult, goldMult: s.goldMult,
      onceSpawned: s.onceSpawned,
      // offline
      lastSeen: s.lastSeen, pendingOfflineGold: s.pendingOfflineGold || 0,
      // buy-level
      totalPurchased: s.totalPurchased, spawnLevel: s.spawnLevel,
      // gifts
      cycleStartAt: s.cycleStartAt,
      lastGiftIntervalSec: s.lastGiftIntervalSec,
      giftNextAt: s.giftNextAt, giftReady: s.giftReady,
      // diamonds
      diamonds: s.diamonds || 0,
      nextDiamondPrize: s.nextDiamondPrize,
      // auto-dog
      autoDogLastAt: s.autoDogLastAt, autoDogBank: s.autoDogBank,
      // ad  ✅ לשמור קולדאון בכל שמירה
      adCooldownUntil: adCooldownUntil,
      // pricing
      costBase: s.costBase,
    }));
  } catch {}
};




  const load = () => { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } };

  // ===== OFFLINE helpers =====
  const laneDpsSum = (s, laneIdx) => {
    let dps = 0;
    for (let k = 0; k < SLOTS_PER_LANE; k++) {
      const cell = s.lanes[laneIdx].slots[k];
      if (!cell) continue;
      const m = s.miners[cell.id];
      dps += BASE_DPS * Math.pow(LEVEL_DPS_MUL, m.level - 1) * s.dpsMult;
    }
    return dps;
  };

  // === Expected coin reward for the next rock break (scales with rock level) ===
  function expectedRockCoinReward(s) {
    if (!s) return 0;
    let bestLane = 0, bestDps = 0;
    for (let l = 0; l < LANES; l++) {
      const dps = laneDpsSum(s, l);
      if (dps > bestDps) { bestDps = dps; bestLane = l; }
    }
    // אם אין עדיין DPS על הלוח – קח ממוצע
    if (bestDps <= 0) {
      let sum = 0;
      for (let l = 0; l < LANES; l++) {
        const rk = s.lanes[l].rock;
        sum += Math.floor(rk.maxHp * GOLD_FACTOR * (s.goldMult || 1));
      }
      return Math.floor(sum / LANES);
    }
    const rock = s.lanes[bestLane].rock;
    return Math.floor(rock.maxHp * GOLD_FACTOR * (s.goldMult || 1));
  }

  const simulateOffline = (seconds, s) => {
    if (!s || seconds <= 0) return 0;
    const capSec = Math.min(seconds, OFFLINE_CAP_HOURS * 3600);
    let total = 0;

    for (let l = 0; l < LANES; l++) {
      const dps = laneDpsSum(s, l);
      if (dps <= 0) continue;
      let remain = capSec;

      while (remain > 0) {
        const rock = s.lanes[l].rock;
        const tToBreak = rock.hp / dps;
        if (tToBreak <= remain) {
          total += Math.floor(rock.maxHp * GOLD_FACTOR * s.goldMult);
          const idx = s.lanes[l].rockCount + 1;
          s.lanes[l].rockCount = idx;
          s.lanes[l].rock = newRock(l, idx);
          remain -= tToBreak;
        } else {
          rock.hp = Math.max(1, rock.hp - dps * remain);
          remain = 0;
        }
      }
    }
    return Math.floor(total);
  };

  const onOfflineCollect = () => {
    const s = stateRef.current; if (!s) return;
    const add = s.pendingOfflineGold || 0;
    if (add > 0) {
      s.gold += add;
      s.pendingOfflineGold = 0;
      setUi(u => ({ ...u, gold: s.gold }));
      save();
    }
    setShowCollect(false);
  };
// Full reset (wipe save + go back to intro)
const resetGame = async () => {
  try { play?.(S_CLICK); } catch {}
  // remove persisted save
  try { localStorage.removeItem(LS_KEY); } catch {}

  // rebuild fresh state
  const s = newState();
  stateRef.current = s;

  // reset UI mirrors
  setUi((u) => ({
    ...u,
    gold: s.gold,
    spawnCost: s.spawnCost,
    dpsMult: s.dpsMult,
    goldMult: s.goldMult,
  }));

  // clear other UI flags
  setAdCooldownUntil(0);
  setGiftReadyFlag(false);
  setShowCollect(false);
  setShowAdModal(false);
  setShowDiamondInfo(false);
  setShowResetConfirm(false);

  // go back to intro / pause
  setShowIntro(true);
  setGamePaused(true);
  try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
};


  // ===== Fullscreen + Orientation lock (mobile only) =====
  const enterFullscreenAndLockMobile = async () => {
    try {
      const w = window.innerWidth, desktop = w >= 1024;
      if (desktop) return;
      const el = wrapRef.current;
      if (el?.requestFullscreen) await el.requestFullscreen();
      if (screen.orientation?.lock) { try { await screen.orientation.lock("portrait-primary"); } catch {} }
    } catch {}
  };
  const exitFullscreenIfAny = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {} };

  // ===== Init & Resize =====
  useEffect(() => {
    const loaded = load();
    const init = loaded ? { ...newState(), ...loaded, anim: { t: 0, coins: [], hint: loaded.onceSpawned ? 0 : 1, fx: [] } } : newState();
    // --- ad cooldown from LS on boot ---
    if (typeof loaded?.adCooldownUntil === "number") {
      setAdCooldownUntil(loaded.adCooldownUntil);
    }

    // offline on boot
    const now = Date.now();
    let reward = 0;
    if (loaded?.lastSeen) {
      const elapsedSec = Math.max(0, (now - loaded.lastSeen) / 1000);
      if (elapsedSec > 1) reward = simulateOffline(elapsedSec, init);
    }
    init.lastSeen = now;
    init.pendingOfflineGold = (init.pendingOfflineGold || 0) + reward;

    // normalize cycle & recompute current interval
    normalizeCycleStart(init, now);
    if (!init.lastGiftIntervalSec) init.lastGiftIntervalSec = currentGiftIntervalSec(init, now);

    // Gifts (max 1 ready offline)
    if (!init.giftReady && now >= (init.giftNextAt || now)) {
      init.giftReady = true;
    }

// Auto-dog offline bank
if (!init.autoDogLastAt) init.autoDogLastAt = now;
processAutoDog(init, now);



      // diamonds default
     if (init.diamonds == null) init.diamonds = 0;
     if (!init.nextDiamondPrize) init.nextDiamondPrize = rollDiamondPrize();

    // Anchor לבסיס עלויות שדרוג — מונע קפיצות מחיר בכל שבירת סלע
    if (init.costBase == null) {
      init.costBase = Math.max(80, expectedRockCoinReward(init));
    }

    stateRef.current = init;
setUi((u) => ({ ...u, gold: init.gold, spawnCost: init.spawnCost, dpsMult: init.dpsMult, goldMult: init.goldMult, muted: false }));
    setGiftReadyFlag(!!init.giftReady);
    if (reward > 0) setShowCollect(true);
setMounted(true); // ← מדליק את ה־mounted רק אחרי שה־LS נטען

    const updateViewportFlags = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const portrait = h >= w;
      const desktop  = w >= 1024;
      setIsPortrait(portrait);
      setIsDesktop(desktop);
      setIsMobileLandscape(!portrait && !desktop);
      setGamePaused((p) => (!portrait && !desktop) ? true : (showIntro ? true : false));
    };
    updateViewportFlags();
    window.addEventListener("resize", updateViewportFlags);
    window.addEventListener("orientationchange", updateViewportFlags);
    document.addEventListener("fullscreenchange", updateViewportFlags);

    const preventTouchScroll = (e) => { if (e.target.closest?.("#miners-canvas")) e.preventDefault(); };
    document.addEventListener("touchmove", preventTouchScroll, { passive: false });

    const c = canvasRef.current;
    if (!c) {
      const id = requestAnimationFrame(() => { const c2 = canvasRef.current; if (!c2) return; setupCanvasAndLoop(c2); });
      return () => {
        cancelAnimationFrame(id);
        window.removeEventListener("resize", updateViewportFlags);
        window.removeEventListener("orientationchange", updateViewportFlags);
        document.removeEventListener("fullscreenchange", updateViewportFlags);
        document.removeEventListener("touchmove", preventTouchScroll);
      };
    }
    const cleanup = setupCanvasAndLoop(c);

    // visibility handlers
    const onVisibility = () => {
      const s = stateRef.current; if (!s) return;
      if (document.visibilityState === "hidden") {
        s.lastSeen = Date.now();
        save();
      } else if (document.visibilityState === "visible") {
        const now2 = Date.now();

        // OFFLINE gold
        const elapsed = Math.max(0, (now2 - (s.lastSeen || now2)) / 1000);
        if (elapsed > 1) {
          const r = simulateOffline(elapsed, s);
          s.lastSeen = now2;
          if (r > 0) {
            s.pendingOfflineGold = (s.pendingOfflineGold || 0) + r;
            setShowCollect(true);
          }
        }

        // normalize cycle and check gift
        normalizeCycleStart(s, now2);
        if (!s.giftReady && now2 >= (s.giftNextAt || now2)) {
          s.giftReady = true;
          setGiftReadyFlag(true);
        }

// Auto-dog
if (!s.autoDogLastAt) s.autoDogLastAt = now2;
processAutoDog(s, now2);




        save();
      }
    };
    const onHide = () => { const s = stateRef.current; if (s) { s.lastSeen = Date.now(); save(); } };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);

    return () => {
      cleanup && cleanup();
      window.removeEventListener("resize", updateViewportFlags);
      window.removeEventListener("orientationchange", updateViewportFlags);
      document.removeEventListener("fullscreenchange", updateViewportFlags);
      document.removeEventListener("touchmove", preventTouchScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isMobileLandscape, gamePaused, isDesktop, isPortrait, showIntro]);

  function setupCanvasAndLoop(cnv) {
    const ctx = cnv.getContext("2d"); if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;

    const resize = () => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();

      if (!isDesktop && isPortrait) {
        const HUD_RESERVED = 160;
        const availableH = Math.max(320, window.innerHeight - HUD_RESERVED);

        const targetW = rect.width;
        const targetH = availableH;

        cnv.style.width  = "100%";
        cnv.style.height = `${targetH}px`;
        cnv.width  = Math.floor(targetW * DPR);
        cnv.height = Math.floor(targetH * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        stateRef.current.portrait = true;
        draw();
        return;
      }

      // Desktop / other
      const targetW = Math.min(rect.width, 1024);
      const targetH = Math.max(420, Math.min(rect.height - 150, 768));
      cnv.style.width  = `${targetW}px`;
      cnv.style.height = `${targetH}px`;
      cnv.width  = Math.floor(targetW * DPR);
      cnv.height = Math.floor(targetH * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      stateRef.current.portrait = isPortrait && !isDesktop;
      draw();
    };

    window.addEventListener("resize", resize);
    resize();

    // input
    const onDown = (e) => {
      if (isMobileLandscape || gamePaused || showIntro || showCollect) return;
      const p = pos(e);

      // 1) Drag miner?
      const hit = pickMiner(p.x, p.y);
      if (hit) {
        dragRef.current = { active:true, id:hit.id, ox:p.x-hit.x, oy:p.y-hit.y };
        stateRef.current.anim.hint = 0; play(S_CLICK);
        return;
      }

      // 2) Click empty-slot pill → try add miner at that slot
      const pill = pickPill(p.x, p.y);
      if (pill) {
        trySpawnAtSlot(pill.lane, pill.slot);
        return;
      }
    };
    const onMove = (e) => {
      if (!dragRef.current.active) return;
      const p = pos(e);
      dragRef.current.x = p.x - dragRef.current.ox;
      dragRef.current.y = p.y - dragRef.current.oy;
      draw();
    };
    const onUp = (e) => {
      if (!dragRef.current.active) return;
      const s2 = stateRef.current;
      const id = dragRef.current.id;
      const m = s2.miners[id];
      const p = pos(e);
      const drop = pickSlot(p.x, p.y);
      if (drop) {
        const { lane, slot } = drop;
        const cur = s2.lanes[m.lane];
        cur.slots[m.slot] = null;
        const target = s2.lanes[lane].slots[slot];
        if (!target) {
          m.lane = lane; m.slot = slot;
          s2.lanes[lane].slots[slot] = { id };
        } else if (target.id !== id) {
          const other = s2.miners[target.id];
          if (other && other.level === m.level) {
            cur.slots[m.slot] = null;
            s2.lanes[other.lane].slots[other.slot] = null;
            delete s2.miners[m.id]; delete s2.miners[other.id];
            const nid = s2.nextId++;
            const merged = { id: nid, level: m.level + 1, lane, slot, pop: 1 };
            s2.miners[nid] = merged;
            s2.lanes[lane].slots[slot] = { id: nid };
            play(S_MERGE);
          } else {
            cur.slots[m.slot] = { id: m.id };
          }
        }
        save();
      }
      dragRef.current = { active:false };
      draw();
    };

    cnv.addEventListener("mousedown", onDown);
    cnv.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    cnv.addEventListener("touchstart", (e)=>{ onDown(e.touches[0]); e.preventDefault(); }, {passive:false});
    cnv.addEventListener("touchmove",  (e)=>{ onMove(e.touches[0]); e.preventDefault(); }, {passive:false});
    cnv.addEventListener("touchend",   (e)=>{ onUp(e.changedTouches[0]); e.preventDefault(); }, {passive:false});

    // loop
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      tick(dt); draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      cnv.removeEventListener("mousedown", onDown);
      cnv.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      cnv.removeEventListener("touchstart", onDown);
      cnv.removeEventListener("touchmove", onMove);
      cnv.removeEventListener("touchend", onUp);
    };
  }
  // ===== Geometry aligned to background =====
  const boardRect = () => {
    const c = canvasRef.current;
    return { x:PADDING, y:PADDING, w:(c?.clientWidth||0)-PADDING*2, h:(c?.clientHeight||0)-PADDING*2 };
  };

  const laneHeight = () => {
    const b = boardRect();
    return b.h * (isDesktop ? LANE_H_FRAC_DESK : LANE_H_FRAC_MOBILE);
  };

  const laneRect = (lane) => {
    const b = boardRect();
    const h = laneHeight();
    const centerY = b.y + b.h * TRACK_Y_FRACS[lane];
    const y = Math.max(b.y, Math.min(centerY - h * 0.5, b.y + b.h - h));
    return { x:b.x, y, w:b.w, h };
  };

  const rockWidth = (L) => Math.min(L.w * 0.16, Math.max(50, L.h * 0.64));

  const slotRect = (lane, slot) => {
    const L = laneRect(lane);
    const rw = rockWidth(L);
    const cellW = (L.w - rw) / SLOTS_PER_LANE;
    return { x:L.x + slot * cellW, y:L.y, w:cellW - 4, h:L.h };
  };

  const rockRect = (lane) => {
    const L  = laneRect(lane);
    const rw = rockWidth(L);
    const top    = laneSafe(ROCK_TOP_FRACS, lane, 0.06);
    const bottom = laneSafe(ROCK_BOTTOM_FRACS, lane, 0.06);
    const y  = L.y + L.h * top;
    const h  = L.h * Math.max(0.0, 1 - top - bottom);
    return { x: L.x + L.w - rw - 4, y, w: rw, h };
  };

  const pos = (e) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left || 0), y: e.clientY - (r?.top || 0) };
  };

  const pickSlot = (x,y) => {
    for(let l=0;l<LANES;l++){
      for(let s=0;s<SLOTS_PER_LANE;s++){
        const r = slotRect(l,s);
        if (x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h) return {lane:l, slot:s};
      }
    }
    return null;
  };

  const pickMiner = (x,y) => {
    const st = stateRef.current; if (!st) return null;
    for(let l=0;l<LANES;l++){
      for(let s=0;s<SLOTS_PER_LANE;s++){
        const cell = st.lanes[l].slots[s]; if(!cell) continue;
        const r = slotRect(l,s);
        const cyFrac = laneSafe(MINER_Y_FRACS, l, 0.56);
        const cx = r.x + r.w*0.52, cy = r.y + r.h*cyFrac;
        const rad = Math.min(r.w,r.h)*0.33;
        const dx=x-cx, dy=y-cy;
        if (dx*dx + dy*dy < rad*rad) return { id:cell.id, x:cx, y:cy };
      }
    }
    return null;
  };

  // ===== Pill geometry + picking =====
  const pillRect = (lane, slot) => {
    const L = laneRect(lane);
    const r = slotRect(lane, slot);
    const padY = L.y + L.h * 0.5;
    const pw = r.w * 0.36;
    const ph = L.h * 0.18;
    const px = r.x + (r.w - pw) * 0.5;
    const py = padY - ph / 2;
    return { x: px, y: py, w: pw, h: ph };
  };
  const pointInRect = (x, y, rect) => (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h);

  const pickPill = (x, y) => {
    const s = stateRef.current; if (!s) return null;
    for (let l=0; l<LANES; l++) {
      for (let sl=0; sl<SLOTS_PER_LANE; sl++) {
        const cell = s.lanes[l].slots[sl];
        if (cell) continue;
        const pr = pillRect(l, sl);
        if (pointInRect(x, y, pr)) return { lane: l, slot: sl };
      }
    }
    return null;
  };

  // ===== Costs (dynamic; scale from expected next-rock reward) =====
const getDpsCost = () => {
  const s = stateRef.current; if (!s) return 160;
  const base = Math.max(80, s.costBase || 120);
  const steps = Math.max(0, Math.round((s.dpsMult - 1) * 10)); // כל +10% = צעד
  return Math.ceil(base * 2.0 * Math.pow(1.18, steps));
};
const getGoldCost = () => {
  const s = stateRef.current; if (!s) return 160;
  const base = Math.max(80, s.costBase || 120);
  const steps = Math.max(0, Math.round((s.goldMult - 1) * 10));
  return Math.ceil(base * 2.2 * Math.pow(1.18, steps));
};

  // ===== Gift particles =====
  const spawnCoinBurst = (cx, cy, n = 24) => {
    const s = stateRef.current; if (!s) return;
    for (let i=0;i<n;i++){
      const a = (i / n) * Math.PI * 2 + Math.random()*0.2;
      const sp = 90 + Math.random()*120;
      s.anim.fx.push({
        type: "coin",
        x: cx, y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        t: 0,
        life: 0.9 + Math.random()*0.4,
        size: 18 + Math.random()*10,
      });
    }
  };

  const stepFx = (dt) => {
    const s = stateRef.current; if (!s) return;
    s.anim.fx = s.anim.fx.filter(p => {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt * 0.6;
      return p.t < p.life;
    });

    if (s.pressedPill) {
      s.pressedPill.t -= dt;
      if (s.pressedPill.t <= 0) s.pressedPill = null;
    }
  };

  // ===== Logic =====
  const spawnMiner = (s, level = 1) => {
// hard guard — never exceed board capacity
if (Object.keys(s.miners).length >= MAX_MINERS) return false;
    for(let l=0;l<LANES;l++){
      for(let slot=0; slot<SLOTS_PER_LANE; slot++){
        if(!s.lanes[l].slots[slot]){
          const id=s.nextId++; const m={id,level, lane:l,slot};
          s.miners[id]=m; s.lanes[l].slots[slot]={id};
          return true;
        }
      }
    }
    return false;
  };

  const spawnMinerAt = (s, lane, slot, level = 1) => {
    if (s.lanes[lane].slots[slot]) return false;
    const id = s.nextId++;
    const m = { id, level, lane, slot, pop: 1 };
    s.miners[id] = m;
    s.lanes[lane].slots[slot] = { id };
    return true;
  };

  const afterPurchaseBump = (s) => {
    s.totalPurchased = (s.totalPurchased || 0) + 1;
    s.spawnLevel = 1 + Math.floor((s.totalPurchased) / 30);
  };

  const trySpawnAtSlot = (lane, slot) => {
    const s = stateRef.current; if (!s) return;

    if (countMiners(s) >= MAX_MINERS) { play(S_CLICK); alert("Maximum 16 miners on the board."); return; }
    if (s.spawnCost == null || s.gold < s.spawnCost) { play(S_CLICK); return; }

    const ok = spawnMinerAt(s, lane, slot, s.spawnLevel);
    if (!ok) return;

    s.gold -= s.spawnCost;
    s.spawnCost = Math.ceil(s.spawnCost * 1.12);
    afterPurchaseBump(s);

    s.pressedPill = { lane, slot, t: 0.15 };

    s.anim.hint = 0;
    setUi(u=>({...u, gold:s.gold, spawnCost:s.spawnCost}));
    play(S_CLICK); save();
  };

  const addMiner = () => {
    const s = stateRef.current; if (!s) return;

    if (countMiners(s) >= MAX_MINERS) {
      play(S_CLICK);
      alert("Maximum 16 miners on the board.");
      return;
    }
    if (s.spawnCost == null || s.gold < s.spawnCost) return;

    const ok = spawnMiner(s, s.spawnLevel);
    if (!ok) return;

    s.gold -= s.spawnCost;
    s.spawnCost = Math.ceil(s.spawnCost*1.12);

    afterPurchaseBump(s);

    s.anim.hint = 0;
    setUi(u=>({...u, gold:s.gold, spawnCost:s.spawnCost}));
    play(S_CLICK); save();
  };

  const upgradeDps = () => {
    const s = stateRef.current; if (!s) return;
    const cost = getDpsCost(); if (s.gold < cost) return;
    s.gold -= cost; s.dpsMult = +(s.dpsMult * 1.1).toFixed(3);
    setUi(u=>({...u, gold:s.gold})); save();
  };

  const upgradeGold= () => {
    const s = stateRef.current; if (!s) return;
    const cost = getGoldCost(); if (s.gold < cost) return;
    s.gold -= cost; s.goldMult = +(s.goldMult * 1.1).toFixed(3);
    setUi(u=>({...u, gold:s.gold})); save();
  };

  const onAdd = () => {
    play(S_CLICK);
    const now = Date.now();
    if (now < adCooldownUntil) {
      const remain = Math.ceil((adCooldownUntil - now)/1000);
      const m = Math.floor(remain/60), sec = String(remain%60).padStart(2,"0");
      setGiftToastWithTTL(`Ad bonus in ${m}:${sec}`, 2000);
      return;
    }
    setAdVideoEnded(false);
    setShowAdModal(true);
  };

  const onCollect = () => { play(S_CLICK); alert("COLLECT (Digital wallet) — coming soon 🪙"); };

  // ===== GIFT LOGIC =====

  function grantDogOrCoins(s, targetLevel, cx, cy, reasonText) {
    if (spawnMiner(s, targetLevel)) {
      setGiftToastWithTTL(`🐶 ${reasonText}: Dog LV ${targetLevel}`, 3000);
      return;
    }
    const comp = Math.max(50, Math.round((s.spawnCost || 100) * 1.0));
    s.gold += comp; setUi(u=>({...u, gold:s.gold}));
    spawnCoinBurst(cx, cy, 26);
    setGiftToastWithTTL(`🐶 No space — converted to +${formatShort(comp)} coins`, 3200);
  }

  function setGiftToastWithTTL(text, ttl=3000) {
    const id = Math.random().toString(36).slice(2);
    setGiftToast({ text, id });
    setTimeout(() => { setGiftToast(cur => (cur && cur.id === id ? null : cur)); }, ttl);
  }

  function grantRareDiamondReward(s, cx, cy) {
    const prize = s.nextDiamondPrize || rollDiamondPrize();
    const rockGain = Math.max(20, expectedRockCoinReward(s));
    const giftCoin = Math.round(rockGain * 0.10); // בסיס מתנה רגילה

    const giveCoins = (multLabel, mult) => {
      const gain = Math.max(1, Math.round(giftCoin * mult));
      s.gold += gain; setUi(u=>({...u,gold:s.gold}));
      spawnCoinBurst(cx, cy, 34);
      play(S_GIFT);
      setGiftToastWithTTL(`💎 ${multLabel} +${formatShort(gain)} coins`, 3600);
    };

    switch (prize) {
      case "coins_x10":   giveCoins("1000% gift",   10);   break; // ×10
      case "coins_x100":  giveCoins("10000% gift",  100);  break; // ×100
      case "coins_x1000": giveCoins("100000% gift", 1000); break; // ×1000
      case "dog+3":       grantDogOrCoins(s, Math.max(1, (s.spawnLevel||1)+3), cx, cy, "Diamond Chest"); break;
      case "dog+5":       grantDogOrCoins(s, Math.max(1, (s.spawnLevel||1)+5), cx, cy, "Diamond Chest"); break;
      case "dog+7":       grantDogOrCoins(s, Math.max(1, (s.spawnLevel||1)+7), cx, cy, "Diamond Chest"); break;
      default:            giveCoins("1000% gift",   10);   break;
    }
    s.nextDiamondPrize = rollDiamondPrize();
    save();
  }

  const grantGift = () => {
    const s = stateRef.current; if (!s || !s.giftReady) return;

    const b = boardRect();
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;

    const rockGain = Math.max(20, expectedRockCoinReward(s));
    const giftCoin  = Math.round(rockGain * 0.10); // 10% מסכום השבירה

    // ---- 10% Diamond ----
    const rollTop = Math.random();
    if (rollTop < 0.10) {
      s.diamonds = (s.diamonds || 0) + 1;
      setUi(u => ({ ...u })); // רענון HUD
      play(S_GIFT);
      setGiftToastWithTTL(`💎 +1 Diamond (${s.diamonds}/3)`, 3200);

      if (s.diamonds >= 3) {
        s.diamonds -= 3;
        grantRareDiamondReward(s, cx, cy); // פותח תיבה
      }

    } else {
      // ---- 60/20/5/5 ----
      let r = Math.random();
      let outcome;
      if (r < 0.60)       outcome = "coins";
      else if (r < 0.80)  outcome = "dog";
      else if (r < 0.85)  outcome = "dps";
      else                outcome = "gold";

      // Anti-stuck רך: אם אין זוגות למיזוג, יש 40% להפוך לכלב
      if (!boardHasMergeablePair(s) && outcome !== "dog") {
        if (Math.random() < 0.40) outcome = "dog";
      }

      switch (outcome) {
        case "coins": {
          s.gold += giftCoin;
          setUi(u => ({ ...u, gold: s.gold }));
          spawnCoinBurst(cx, cy, 28);
          play(S_GIFT);
          setGiftToastWithTTL(`🎁 +${formatShort(giftCoin)} coins`, 3000);
          break;
        }
        case "dog": {
          const target = Math.max(1, (s.spawnLevel || 1) - 1);
          grantDogOrCoins(s, target, cx, cy, "Gift");
          break;
        }
        case "dps": {
          s.dpsMult = +(s.dpsMult * 1.1).toFixed(3);
          spawnCoinBurst(cx, cy, 16);
          play(S_GIFT);
          setGiftToastWithTTL(`🎁 DPS +10%`, 3000);
          break;
        }
        case "gold": {
          s.goldMult = +(s.goldMult * 1.1).toFixed(3);
          spawnCoinBurst(cx, cy, 16);
          play(S_GIFT);
          setGiftToastWithTTL(`🎁 Gold +10%`, 3000);
          break;
        }
      }
    }

    s.giftReady = false;
    scheduleNextGiftFromNow(s, Date.now());
    setGiftReadyFlag(false);
    save();
  };



const tryAutoDogSpawns = () => {
  const s = stateRef.current; if (!s) return;
  clampDogBank(s);

  // כמה סלוטים ריקים יש כרגע
  let empty = 0;
  for (let l = 0; l < LANES; l++) {
    for (let k = 0; k < SLOTS_PER_LANE; k++) {
      if (!s.lanes[l].slots[k]) empty++;
    }
  }
if (empty <= 0 || s.autoDogBank <= 0) return;

  const toSpawn = Math.max(0, Math.min(s.autoDogBank, empty));
  for (let i = 0; i < toSpawn; i++) {
    if (!spawnMiner(s, s.spawnLevel)) break;
  }

  s.autoDogBank -= toSpawn;
clampDogBank(s);
if (toSpawn > 0) save();
};


  const tick = (dt) => {
    const s = stateRef.current; if (!s) return;
    s.anim.t += dt;
    s.paused = gamePaused || showIntro || showCollect;

    // smooth UI
    uiPulseAccumRef.current += dt;
    if (uiPulseAccumRef.current >= 0.1) {
      uiPulseAccumRef.current = 0;
      forceUiPulse(x => (x + 1) % 1000000);
    }

    const now = Date.now();

    // normalize 3h cycle regularly
    normalizeCycleStart(s, now);

    // Gift timing
    if (!s.giftReady && now >= (s.giftNextAt || now)) {
      s.giftReady = true;
      setGiftReadyFlag(true);
    } else {
      const curInt = currentGiftIntervalSec(s, now);
      s.lastGiftIntervalSec = curInt;
    }

// Auto-dog timing
if (!s.autoDogLastAt) s.autoDogLastAt = now;
processAutoDog(s, now);





    if (!s.paused) tryAutoDogSpawns();

    if (s.paused) { s.lastSeen = now; return; }

    // Gameplay DPS & rocks
    for (let l=0; l<LANES; l++) {
      let dps=0;
      for (let k=0; k<SLOTS_PER_LANE; k++) {
        const cell=s.lanes[l].slots[k]; if(!cell) continue;
        const m=s.miners[cell.id]; dps += minerDps(m.level, s.dpsMult);
      }
      const rock=s.lanes[l].rock;
      rock.hp -= dps*dt;
      if (rock.hp<=0) {
        const gain=Math.floor(rock.maxHp*GOLD_FACTOR*s.goldMult);
        s.gold += gain; setUi(u=>({...u,gold:s.gold}));
        const rr=rockRect(l);
        s.anim.coins.push({ x: rr.x+rr.w*0.5, y: rr.y+rr.h*0.25, t:0, v:gain });
        const idx=s.lanes[l].rockCount+1; s.lanes[l].rockCount=idx; s.lanes[l].rock=newRock(l,idx);
        play(S_ROCK); save();
      }
    }

    s.anim.coins = s.anim.coins.filter(cn=>{ cn.t += dt*1.2; return cn.t < 1; });
    stepFx(dt);

    s.lastSeen = now;
  };

  // ===== Drawing helpers (MUST exist before draw()) =====
  function drawBgCover(ctx, b) {
    const img = getImg(IMG_BG);
    if (img.complete && img.naturalWidth > 0) {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const bw = b.w, bh = b.h;
      const ir = iw / ih, br = bw / bh;
      let dw, dh;
      if (br > ir) { dw = bw; dh = bw / ir; } else { dh = bh; dw = bh * ir; }
      const dx = b.x + (bw - dw)/2;
      const dy = b.y + (bh - dh)/2;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      const g1 = ctx.createLinearGradient(0,b.y,0,b.y+b.h);
      g1.addColorStop(0,"#0b1220"); g1.addColorStop(1,"#0c1526");
      ctx.fillStyle=g1; ctx.fillRect(b.x,b.y,b.w,b.h);
    }
  }

  function drawRock(ctx, rect, rock) {
    const pct = Math.max(0, rock.hp / rock.maxHp);
    const scale = 0.35 + 0.65 * pct;
    const img = getImg(IMG_ROCK);

    const pad = 6;
    const fullW = rect.w - pad*2;
    const fullH = rect.h - pad*2;
    const rw = fullW * scale;
    const rh = fullH * scale;
    const cx = rect.x + rect.w/2;
    const cy = rect.y + rect.h/2;
    const dx = cx - rw/2;
    const dy = cy - rh/2;

    if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, dx, dy, rw, rh);
    else { ctx.fillStyle="#6b7280"; ctx.fillRect(dx, dy, rw, rh); }

    // HP bar
    const bx = rect.x + pad, by = rect.y + 4, barW = fullW, barH = 6;
    ctx.fillStyle="#0ea5e9"; ctx.fillRect(bx, by, barW * pct, barH);
    const gloss = ctx.createLinearGradient(0,by,0,by+barH);
    gloss.addColorStop(0,"rgba(255,255,255,.45)"); gloss.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=gloss; ctx.fillRect(bx, by, barW*pct, barH);
    ctx.strokeStyle="#082f49"; ctx.lineWidth=1; ctx.strokeRect(bx, by, barW, barH);

    ctx.fillStyle="#e5e7eb"; ctx.font="bold 11px system-ui";
    ctx.fillText(`Rock ${rock.idx + 1}`, bx, by + 16);
  }

  function drawMiner(ctx, lane, slot, m) {
    const r  = slotRect(lane, slot);
    const cx = r.x + r.w*0.52;
    const cyFrac = laneSafe(MINER_Y_FRACS, lane, 0.56);
    const sizeF  = laneSafe(MINER_SIZE_FRACS, lane, 0.84);
    const cy = r.y + r.h*cyFrac;
    const w  = Math.min(r.w, r.h) * sizeF;

    const img = getImg(IMG_MINER);
    const frame = Math.floor((stateRef.current.anim.t * 8) % 4);

    if (img.complete && img.naturalWidth > 0) {
      const sw = img.width / 4, sh = img.height;
      ctx.drawImage(img, frame*sw, 0, sw, sh, cx - w/2, cy - w/2, w, w);
    } else {
      ctx.fillStyle="#22c55e"; ctx.beginPath(); ctx.arc(cx, cy, w*0.35, 0, Math.PI*2); ctx.fill();
    }

    // level tag
    ctx.fillStyle="rgba(0,0,0,.6)";
    ctx.fillRect(cx - w*0.5, cy - w*0.62, 30, 16);
    ctx.fillStyle="#fff"; ctx.font="bold 10px system-ui";
    ctx.fillText(m.level, cx - w*0.5 + 9, cy - w*0.62 + 12);

    if (m.pop) {
      const k = Math.max(0, 1 - (stateRef.current.anim.t % 1));
      ctx.globalAlpha = k; ctx.fillStyle="#34d399"; ctx.font="bold 15px system-ui";
      ctx.fillText(`LV ${m.level}`, cx - 14, cy - w*0.70); ctx.globalAlpha = 1;
      if (k <= 0.02) delete m.pop;
    }
  }

  function drawMinerGhost(ctx, x, y, lvl) {
    const w = 62; const img = getImg(IMG_MINER);
    ctx.globalAlpha = 0.75;
    if (img.complete && img.naturalWidth > 0) {
      const sw = img.width/4, sh = img.height;
      ctx.drawImage(img, 0, 0, sw, sh, x - w/2, y - w/2, w, w);
    } else {
      ctx.fillStyle="#22c55e"; ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1; ctx.fillStyle="#fff"; ctx.font="bold 12px system-ui";
    ctx.fillText(String(lvl), x - 6, y - 22);
  }

  function drawCoin(ctx, x, y, a) {
    const img = getImg(IMG_COIN); const s = 24;
    ctx.globalAlpha = 0.45 + 0.55 * a;
    if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, x - s/2, y - s/2, s, s);
    else { ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(x, y, s/2, 0, Math.PI*2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  function drawFx(ctx) {
    const s = stateRef.current; if (!s) return;
    for (const p of s.anim.fx) {
      const k = Math.min(1, p.t / p.life);
      const a = 1 - k;
      ctx.globalAlpha = 0.25 + 0.75 * a;

      if (p.type === "coin") {
        const img = getImg(IMG_COIN);
        const sz = p.size * (0.8 + 0.4 * Math.sin(p.t * 8));
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, p.x - sz/2, p.y - sz/2, sz, sz);
        } else {
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.arc(p.x, p.y, sz/2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
    }
  }

  // ===== Drawing helpers for pills =====
  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y,     x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x,     y + h, rr);
    ctx.arcTo(x,     y + h, x,     y,     rr);
    ctx.arcTo(x,     y,     x + w, y,     rr);
    ctx.closePath();
  }

  function drawPillButton(ctx, x, y, w, h, label, enabled = true, pulse = 0, pressed = false) {
    const scale = pressed ? 0.96 : 1.0;
    const cx = x + w / 2, cy = y + h / 2;
    const sw = w * scale, sh = h * scale;
    const sx = cx - sw / 2, sy = cy - sh / 2;

    const g = ctx.createLinearGradient(sx, sy, sx, sy + sh);
    if (enabled) { g.addColorStop(0, "#fef08a"); g.addColorStop(1, "#facc15"); }
    else         { g.addColorStop(0, "#475569"); g.addColorStop(1, "#334155"); }

    ctx.save();
    roundRectPath(ctx, sx, sy, sw, sh, sh / 2);
    ctx.fillStyle = g;
    ctx.shadowColor = enabled ? `rgba(250,204,21,${0.35 + 0.25 * pulse})` : "rgba(148,163,184,0.25)";
    ctx.shadowBlur = enabled ? 16 + 16 * pulse : 10;
    ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, sx, sy, sw, sh, sh / 2);
    ctx.strokeStyle = enabled ? "#a16207" : "#475569";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = enabled ? "#111827" : "#cbd5e1";
    ctx.font = `bold ${Math.max(12, Math.floor(sh * 0.45))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy);
    ctx.restore();
  }

  // ===== Drawing =====
  function draw() {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const s = stateRef.current; if (!s) return;
    const b = boardRect();

    const pulse = 0.5 + 0.5 * Math.sin((s.anim.t || 0) * 4.0);

    drawBgCover(ctx, b);

    for (let l=0; l<LANES; l++) {
      for (let sidx=0; sidx<SLOTS_PER_LANE; sidx++) {
        const cell = s.lanes[l].slots[sidx];
        if (!cell) {
          const { x, y, w, h } = pillRect(l, sidx);
          const canAfford = (s.gold ?? 0) >= (s.spawnCost ?? 0) && countMiners(s) < MAX_MINERS;
          const pressed = !!(s.pressedPill && s.pressedPill.lane === l && s.pressedPill.slot === sidx);
          drawPillButton(ctx, x, y, w, h, "ADD", canAfford, canAfford ? pulse : 0, pressed);
        }
      }

      const rk = s.lanes[l]?.rock;
      if (rk) drawRock(ctx, rockRect(l), rk);

      for (let sidx=0; sidx<SLOTS_PER_LANE; sidx++) {
        const cell = s.lanes[l].slots[sidx]; if (!cell) continue;
        const m = s.miners[cell.id]; if (m) drawMiner(ctx, l, sidx, m);
      }
    }

    if (dragRef.current.active) {
      const st = stateRef.current;
      const m = st.miners[dragRef.current.id];
      if (m) {
        const r = slotRect(m.lane, m.slot);
        const cyFrac = laneSafe(MINER_Y_FRACS, m.lane, 0.56);
        const x = dragRef.current.x ?? (r.x + r.w*0.52);
        const y = dragRef.current.y ?? (r.y + r.h*cyFrac);
        drawMinerGhost(ctx, x, y, m.level);
      }
    }

    for (const cn of s.anim.coins) {
      const k = cn.t, sx = cn.x, sy = cn.y, tx = 110, ty = 72;
      const x = sx + (tx - sx) * k, y = sy + (ty - sy) * k;
      drawCoin(ctx, x, y, 1 - k);
    }

    drawFx(ctx);

    if (!s.paused && s.anim.hint) {
      const r = slotRect(0, 0);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);
      ctx.setLineDash([]);
      ctx.fillStyle = "#c7f9cc";
      ctx.font = "bold 12px system-ui";
      ctx.fillText("Drag to merge", r.x + 10, r.y + 21);
    }
  } // end draw()

  // ===== Phase helpers (for HUD) =====
  function getPhaseInfo(s, now=Date.now()) {
    normalizeCycleStart(s, now);
    let off = getCycleOffsetSec(s, now);
    let acc = 0;
    for (let i=0; i<GIFT_PHASES.length; i++) {
      const ph = GIFT_PHASES[i];
      if (off < acc + ph.durSec) {
        const into = off - acc;
        const remain = ph.durSec - into;
        return { index: i, into, remain, intervalSec: ph.intervalSec };
      }
      acc += ph.durSec;
    }
    const last = GIFT_PHASES[GIFT_PHASES.length-1];
    return { index: GIFT_PHASES.length-1, into: last.durSec, remain: 0, intervalSec: last.intervalSec };
  }

  const phaseNow = (() => {
    const s = stateRef.current; if (!s) return { index:0, intervalSec:20, remain:GIFT_CYCLE_SEC };
    return getPhaseInfo(s, Date.now());
  })();

  // ===== UI progress helpers =====
  const giftProgress = (() => {
    const s = stateRef.current; if (!s) return 0;
    if (s.giftReady) return 1;
    const now = Date.now();
    const total = (s.lastGiftIntervalSec || currentGiftIntervalSec(s, now)) * 1000;
    const remain = Math.max(0, (s.giftNextAt || now) - now);
    return clamp01(1 - remain / total);
  })();

  const dogProgress = (() => {
    const s = stateRef.current; if (!s) return 0;
    if ((s.autoDogBank || 0) >= DOG_BANK_CAP) return 1;
    const now = Date.now();
    const total = DOG_INTERVAL_SEC * 1000;
    const last = s.autoDogLastAt || now;
    const elapsed = Math.max(0, now - last);
    return clamp01(elapsed / total);
  })();

  // ADD cooldown progress + label
// ברינדור הראשון (לפני mount) ננ鎝ל את הכפתור בכוונה
const addRemainMs = mounted
  ? Math.max(0, adCooldownUntil - Date.now())
  : Number.POSITIVE_INFINITY;

const addProgress = (() => {
  if (!mounted) return 0; // לפני mount, אל תדליק טבעת
  const total = 10 * 60 * 1000; // 10 דקות
  return 1 - Math.min(1, addRemainMs / total);
})();

 const addRemainLabel = (() => {
  if (!mounted) return "…";
  if (addRemainMs <= 0) return "READY";
  const m = Math.floor(addRemainMs / 60000);
  const s = Math.floor((addRemainMs % 60000) / 1000);
  return `${m}:${String(s).padStart(2,"0")}`;
})();

  const addDisabled = addRemainMs > 0 || adWatching;

  // ===== Render-time costs & availability =====
  const sNow = stateRef.current;
  const spawnCostNow = sNow?.spawnCost ?? ui.spawnCost;
  const dpsCostNow   = getDpsCost();
  const goldCostNow  = getGoldCost();

  const canBuyMiner = !!sNow && sNow.gold >= spawnCostNow && countMiners(sNow) < MAX_MINERS;
  const canBuyDps   = !!sNow && sNow.gold >= dpsCostNow;
  const canBuyGold  = !!sNow && sNow.gold >= goldCostNow;

  const price = (n) => formatShort(n ?? 0);
const phaseLabel = `⏳ ${phaseNow.intervalSec}s gifts`;

  // ===== Circle progress style helper =====
  function circleStyle(progress, withBg = true) {
    const p = Math.max(0, Math.min(1, Number(progress) || 0));
    const deg = Math.round(360 * p);
    const base = withBg ? "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.35) 55%, transparent 56%)" : "transparent";
    return {
      backgroundImage: `${base}, conic-gradient(#facc15 ${deg}deg, rgba(255,255,255,0.14) 0deg)`,
      transition: "background-image 0.2s linear",
    };
  }

  // ===== RETURN (JSX) =====
  return (
    <Layout>
 <div
   ref={wrapRef}
   className="flex flex-col items-center justify-start bg-gray-900 text-white min-h-screen w-full relative overflow-hidden select-none pt-0 -mt-0"
 >



        {/* Landscape overlay on mobile */}
        {isMobileLandscape && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black text-white text-center p-6">
            <div>
              <h2 className="text-2xl font-extrabold mb-3">Please rotate your device to portrait.</h2>
              <p className="opacity-80">Landscape is not supported.</p>
            </div>
          </div>
        )}

        {/* Intro Overlay + HOW TO */}
        <>
          {showIntro && (
            <div className="absolute inset-0 flex flex-col items-center justify-start pt-10 bg-black/80 z-[50] text-center p-6">
              <img src="/images/leo-intro.png" alt="Leo" width={160} height={160} className="mb-4 rounded-full" />
<h1 className="text-3xl sm:text-4xl font-extrabold text-yellow-400 mb-2">
 ⛏️ MLEO Miners
</h1>

              <p className="text-sm sm:text-base text-gray-200 mb-6">Merge miners, break rocks, earn gold.</p>

              <div className="flex gap-3 flex-wrap justify-center">
                <button
                  onClick={async () => {
                    try { play?.(S_CLICK); } catch {}
                    const s = stateRef.current;
                    if (s && !s.onceSpawned) { spawnMiner(s, 1); s.onceSpawned = true; save(); }
                    setShowIntro(false);
                    setGamePaused(false);
                    if (typeof enterFullscreenAndLockMobile === "function") { try { await enterFullscreenAndLockMobile(); } catch {} }
                  }}
                  className="px-5 py-3 font-bold rounded-lg text-base shadow bg-indigo-400 hover:bg-indigo-300 text-black"
                >
                  CONNECT WALLET
                </button>

                <button
                  onClick={async () => {
                    try { play?.(S_CLICK); } catch {}
                    const s = stateRef.current;
                    if (s && !s.onceSpawned) { spawnMiner(s, 1); s.onceSpawned = true; save(); }
                    setShowIntro(false);
                    setGamePaused(false);
                    if (typeof enterFullscreenAndLockMobile === "function") { try { await enterFullscreenAndLockMobile(); } catch {} }
                  }}
                  className="px-5 py-3 font-bold rounded-lg text-base shadow bg-yellow-400 hover:bg-yellow-300 text-black"
                >
                  SKIP
                </button>

                <button
                  onClick={() => setShowHowTo(true)}
                  className="px-5 py-3 font-bold rounded-lg text-base shadow bg-emerald-400 hover:bg-emerald-300 text-black"
                >
                  HOW TO PLAY
                </button>
              </div>
            </div>
          )}

          {showHowTo && (
            <div className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-4">
              <div className="bg-white text-slate-900 max-w-lg w-full rounded-2xl p-5 shadow-2xl">
                <h2 className="text-2xl font-extrabold mb-3">How to Play</h2>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li>Merge two same-level miners to upgrade.</li>
                  <li>Breaking rocks yields coins that scale with rock level.</li>
                  <li>Regular Gift = <b>10%</b> of the current rock-break coins.</li>
                  <li>Ad Gift (after video) = <b>50%</b> of the rock-break coins.</li>
<li>Gift weights: Coins 70% • Dog (LVL-1) 20% • DPS +10% 5% • GOLD +10% 5%.</li>
                  <li>Diamond Chest (3×💎): 55% ×1000% / Dog+3 • 30% ×10000% / Dog+5 • 15% ×100000% / Dog+7.</li>
                  <li>Upgrades (DPS/GOLD) costs scale with the expected next-rock reward.</li>
                </ul>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => setShowHowTo(false)}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          )}
        </>

        {/* ADD Ad Modal */}
        {showAdModal && (
          <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 max-w-lg w-full rounded-2xl p-5 shadow-2xl">
              <h2 className="text-2xl font-extrabold mb-3">Watch to Earn</h2>

              <video
                src="/ads/ad1.mp4"
                className="w-full rounded-lg bg-black"
                controls
                autoPlay
                onEnded={() => setAdVideoEnded(true)}
              />

              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => { setShowAdModal(false); setAdVideoEnded(false); }}
                  className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900"
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    const s = stateRef.current; if (!s) return;
                    const rockGain = Math.max(20, expectedRockCoinReward(s));
                    const gain = Math.round(rockGain * 0.50); // 50% משבירת סלע
                    s.gold += gain; setUi(u => ({ ...u, gold: s.gold }));

 const until = Date.now() + 10*60*1000; // 10 דקות קולדאון
setAdCooldownUntil(until);
// כתיבה מיידית ל-LS כדי שלא ילך לאיבוד בין רענונים
try {
  const raw = localStorage.getItem(LS_KEY);
  const data = raw ? JSON.parse(raw) : {};
  data.adCooldownUntil = until;
  localStorage.setItem(LS_KEY, JSON.stringify(data));
} catch {}
setGiftToastWithTTL(`🎬 Ad Reward +${formatShort(gain)} coins`, 3000);


                    setShowAdModal(false);
                    setAdVideoEnded(false);
                  }}
                  disabled={!adVideoEnded}
                  className={`px-4 py-2 rounded-lg font-bold ${
                    adVideoEnded ? "bg-yellow-400 hover:bg-yellow-300 text-black" : "bg-slate-300 text-slate-500 cursor-not-allowed"
                  }`}
                  title={adVideoEnded ? "Collect your reward" : "Watch until the end to unlock"}
                >
                  COLLECT
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Title */}
<h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-8 mb-8 leading-none">
          MLEO Miners — v5.8
        </h1>

        {/* ===== Canvas wrapper ===== */}
<div id="miners-canvas-wrap" className="relative w-full border border-slate-700 rounded-2xl overflow-hidden shadow-2xl mt-1"
  style={{ maxWidth: isDesktop ? "1024px" : "680px", aspectRatio: isDesktop ? "4 / 3" : undefined }}
>

          <canvas id="miners-canvas" ref={canvasRef} className="w-full h-full block touch-none select-none" />

          {/* ==== TOP HUD ==== */}
<div className="absolute left-1/2 -translate-x-1/2 top-1 z-[30] w-[calc(100%-16px)] max-w-[980px]">
<div className="flex gap-2 flex-wrap justify-center items-center text-sm">
              <div className="px-2 py-1 bg-black/60 rounded-lg shadow flex items-center gap-2">
                <div
                  className="relative w-8 h-8 rounded-full grid place-items-center"
                  style={circleStyle(addProgress, true)}
                  title={addRemainMs > 0 ? `Next in ${addRemainLabel}` : "Ready"}
                >
                  <div className="w-6 h-6 rounded-full bg-black/70 grid place-items-center">
                    <img src={IMG_COIN} alt="coin" className="w-4 h-4" />
                  </div>
                </div>
                <b>{formatShort(stateRef.current?.gold ?? 0)}</b>
              </div>

              <div className="px-2 py-1 bg-black/60 rounded-lg shadow">🪓 x<b>{(stateRef.current?.dpsMult || 1).toFixed(2)}</b></div>
              <div className="px-2 py-1 bg-black/60 rounded-lg shadow">🟡  x<b>{(stateRef.current?.goldMult || 1).toFixed(2)}</b></div>
              <div className="px-2 py-1 bg-black/60 rounded-lg shadow">🐶  LV <b>{stateRef.current?.spawnLevel || 1}</b></div>

              {/* Diamonds counter (clickable) */}
              <button
                onClick={() => setShowDiamondInfo(true)}
                className="px-2 py-1 bg-black/70 rounded-lg shadow flex items-center gap-1 hover:bg-black/60 active:scale-95 transition cursor-pointer"
                aria-label="Diamond rewards info"
                title="Tap to see Diamond chest rewards"
              >
                <span>💎</span>
                <b>{stateRef.current?.diamonds ?? 0}</b>
                <span className="opacity-80">/3</span>
              </button>

              <div className="px-2 py-1 bg-black/60 rounded-lg shadow">{phaseLabel}</div>

              <div className="flex items-center gap-3 ml-2">
                <div
                  className="relative w-8 h-8 rounded-full grid place-items-center"
                  style={circleStyle(giftProgress, true)}
                  title={phaseLabel}
                >
                  <div className="w-6 h-6 rounded-full bg-black/70 grid place-items-center text-[10px] font-extrabold">🎁</div>
                </div>
                <div
                  className="relative w-8 h-8 rounded-full grid place-items-center"
                  style={circleStyle(dogProgress, true)}
                  title="Auto-dog every 30m (bank up to 6)"
                >
                  <div className="w-6 h-6 rounded-full bg-black/70 grid place-items-center text-[10px] font-extrabold">🐶</div>
                </div>
              </div>

 
            </div>

            {/* Actions row */}
            <div className="flex gap-2 mt-2 flex-wrap justify-center text-sm">
              <button
                onClick={addMiner}
                disabled={!canBuyMiner}
                className={`px-3 py-1.5 rounded-xl text-slate-900 font-bold shadow transition
                  ${
                    canBuyMiner
                      ? "bg-emerald-500 hover:bg-emerald-400 ring-2 ring-emerald-300 shadow-[0_0_18px_rgba(16,185,129,.55)]"
                      : "bg-emerald-500 opacity-60 cursor-not-allowed"
                  }`}
              >
                + 🐶 Miner (LV {sNow?.spawnLevel || 1}) — {price(spawnCostNow)}
              </button>

              <button
                onClick={upgradeDps}
                disabled={!canBuyDps}
 className={`h-8 px-2.5 rounded-lg text-[13px] leading-none inline-flex items-center
  text-slate-900 font-bold shadow-sm transition
  text-slate-900 font-bold shadow-sm transition
                  ${
                    canBuyDps
                      ? "bg-sky-500 hover:bg-sky-400 ring-2 ring-sky-300 shadow-[0_0_18px_rgba(56,189,248,.55)]"
                      : "bg-sky-500 opacity-60 cursor-not-allowed"
                  }`}
              >
                🪓 +10% (Cost {price(dpsCostNow)})
              </button>

              <button
                onClick={upgradeGold}
                disabled={!canBuyGold}
                className={`px-3 py-1.5 rounded-xl text-slate-900 font-bold shadow transition
                  ${
                    canBuyGold
                      ? "bg-amber-400 hover:bg-amber-300 ring-2 ring-amber-300 shadow-[0_0_18px_rgba(251,191,36,.6)]"
                      : "bg-amber-400 opacity-60 cursor-not-allowed"
                  }`}
              >
                🟡 +10% (Cost {price(goldCostNow)})
              </button>

{/* EARN – same style as DPS/GOLD */}
<button
  onClick={onAdd}
  disabled={addDisabled}
  className={`px-3 py-1.5 rounded-xl text-slate-900 font-bold shadow transition
    ${
      addDisabled
        ? "bg-indigo-400 opacity-60 cursor-not-allowed"
        : "bg-indigo-400 hover:bg-indigo-300 ring-2 ring-indigo-300 shadow-[0_0_18px_rgba(129,140,248,.45)]"
    }`}
  title={addRemainMs > 0 ? `Ad bonus in ${addRemainLabel}` : "Watch ad to earn"}
>
  GAIN {addRemainMs > 0 ? `(${addRemainLabel})` : ""}
</button>


<button
  onClick={() => setShowResetConfirm(true)}
  className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold shadow transition ring-2 ring-rose-300"
  title="Reset all progress"
>
  RESET
</button>

            </div>
          </div>

          {/* Toast (gift result) */}
          {giftToast && (
            <div className="absolute left-1/2 -translate-x-1/2 z-[7]" style={{ top: "200px" }}>
              <div className="px-4 py-2 rounded-xl bg-emerald-400 text-black font-extrabold shadow-lg animate-[fadeOut_3s_ease-out_forwards]">
                {giftToast.text}
              </div>
              <style jsx global>{`
                @keyframes fadeOut {
                  0% { opacity: 0; transform: translateY(-6px) scale(0.96); }
                  15% { opacity: 1; transform: translateY(0) scale(1); }
                  80% { opacity: 1; }
                  100% { opacity: 0; transform: translateY(-10px) scale(0.98); }
                }
              `}</style>
            </div>
          )}

          {/* Center Gift Button */}
          {!showIntro && !gamePaused && !showCollect && giftReadyFlag && (
            <div className="absolute inset-0 z-[8] flex items-center justify-center pointer-events-none">
              <button
                onClick={grantGift}
                className="pointer-events-auto px-6 py-4 rounded-2xl font-extrabold text-black shadow-2xl bg-gradient-to-br from-yellow-300 to-amber-400 border border-yellow-200 hover:from-yellow-200 hover:to-amber-300 active:scale-95
                           animate-[pop_1.2s_ease-in-out_infinite] relative"
              >
                🎁 Claim Gift
                <span className="absolute -inset-2 rounded-3xl blur-3xl bg-yellow-400/30 -z-10" />
              </button>
              <style jsx global>{`
                @keyframes pop {
                  0%   { transform: translateZ(0) scale(1);    box-shadow: 0 8px 30px rgba(251,191,36,0.25); }
                  50%  { transform: translateZ(0) scale(1.04); box-shadow: 0 10px 45px rgba(251,191,36,0.35); }
                  100% { transform: translateZ(0) scale(1);    box-shadow: 0 8px 30px rgba(251,191,36,0.25); }
                }
              `}</style>
            </div>
          )}
        </div>

 
        {/* Offline COLLECT overlay */}
        {showCollect && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/85 px-6 text-center">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20 shadow-2xl max-w-sm w-full">
              <div className="flex items-center justify-center gap-2 mb-3">
                <img src={IMG_COIN} alt="coin" className="w-6 h-6" />
                <h3 className="text-xl font-extrabold text-white">While you were away…</h3>
              </div>
              <p className="text-gray-200 mb-4">
                Earned{" "}
                <b className="text-yellow-300">
                  {formatShort(stateRef.current?.pendingOfflineGold || 0)}
                </b>{" "}
                coins in the background.
              </p>
              <button
                onClick={onOfflineCollect}
                className="mx-auto px-6 py-3 rounded-xl bg-yellow-400 text-black font-extrabold text-lg shadow active:scale-95"
              >
                COLLECT
              </button>
            </div>
          </div>
        )}
{showResetConfirm && (
  <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
    <div className="bg-white text-slate-900 max-w-md w-full rounded-2xl p-6 shadow-2xl">
      <h2 className="text-2xl font-extrabold mb-2">Reset Progress?</h2>
      <p className="text-sm text-slate-700 mb-4">
        This will permanently delete your save and send you back to the start.
        You will lose all miners, coins, upgrades, gifts and diamonds.
      </p>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setShowResetConfirm(false)}
          className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold"
        >
          Cancel
        </button>
        <button
          onClick={resetGame}
          className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-extrabold"
        >
          Yes, reset
        </button>
      </div>
    </div>
  </div>
)}

        {/* Diamond Rewards Modal */}
        {showDiamondInfo && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 px-6 text-center">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20 shadow-2xl max-w-md w-full text-left">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">💎</span>
                  <h3 className="text-xl font-extrabold text-white">Diamond Chest rewards (3×💎)</h3>
                </div>
                <button
                  onClick={() => setShowDiamondInfo(false)}
                  className="px-3 py-1.5 bg-yellow-400 text-black font-bold rounded-lg text-sm"
                >
                  Close
                </button>
              </div>

              <p className="text-gray-200 mb-4">
                Collect <b className="text-yellow-300">3 diamonds</b> to open a chest with one of these rewards:
              </p>

              <ul className="space-y-2">
                {DIAMOND_PRIZES.map(p => {
                  const isNext = (stateRef.current?.nextDiamondPrize === p.key);
                  return (
                    <li
                      key={p.key}
                      className={`flex items-center justify-between rounded-lg px-3 py-2
                        ${isNext ? "bg-yellow-400/15 border border-yellow-400/60" : "bg-white/5 border border-white/10"}`}
                    >
                      <span className="text-gray-100 font-medium">{p.label}</span>
                      {isNext && <span className="text-xs font-extrabold text-yellow-300">NEXT</span>}
                    </li>
                  );
                })}
              </ul>

              <p className="text-gray-300 mt-4 text-sm">
                If the board is full when a “Dog” reward is granted, it is automatically converted to coins based on the current buy cost.
              </p>
            </div>
          </div>
        )}

        {!showIntro && (
          <button
            onClick={async () => { setShowIntro(true); setGamePaused(true); await exitFullscreenIfAny(); }}
            className="fixed top-3 right-3 px-4 py-2 bg-yellow-400 text-black font-bold rounded-lg text-sm z-[999]"
          >
            Exit
          </button>
        )}
      </div>
    </Layout>
  );
} // <-- end component

/** ===== Migration helper (v5.8) ===== */
function theStateFix_maybeMigrateLocalStorage() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return; // ⬅️ SSR guard
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    let changed = false;

    if (s.cycleStartAt == null) { s.cycleStartAt = Date.now(); changed = true; }
    if (s.lastGiftIntervalSec == null) {
      s.lastGiftIntervalSec = currentGiftIntervalSec(s, Date.now());
      changed = true;
    }
    if (s.giftNextAt == null) {
      s.giftNextAt = Date.now() + (s.lastGiftIntervalSec || 20) * 1000;
      changed = true;
    }
    if (typeof s.adCooldownUntil !== "number") { s.adCooldownUntil = 0; changed = true; }

    // דוג-בנק – ודאות סוג והגבלה
    if (typeof s.autoDogBank !== "number") { s.autoDogBank = 0; changed = true; }
    clampDogBank(s); // יחתוך ל-0..DOG_BANK_CAP

    // עוגן עלות
    if (s.costBase == null) {
      try { s.costBase = Math.max(80, expectedRockCoinReward(s)); }
      catch { s.costBase = 120; }
      changed = true;
    }

    if (changed) localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {}
}

