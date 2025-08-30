// === START PART 1 ===

// pages/mleo-miners.js
// v5.8
import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import { ConnectButton, useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";




// ====== Config ======
const LANES = 4;
const SLOTS_PER_LANE = 4;
const MAX_MINERS = LANES * SLOTS_PER_LANE;
const PADDING = 6;
const LS_KEY = "mleoMiners_v5_81_reset2";

// Assets
const IMG_BG    = "/images/bg-cave.png";
const IMG_MINER = "/images/leo-miner-4x.png";
const IMG_ROCK  = "/images/rock.png";
const IMG_COIN  = "/images/silver.png";

// SFX
const S_CLICK = "/sounds/click.mp3";
const S_MERGE = "/sounds/merge.mp3";
const S_ROCK  = "/sounds/rock.mp3";
const S_GIFT  = "/sounds/gift.mp3";

// Balance
const BASE_DPS = 2;
const LEVEL_DPS_MUL = 1.9;
const ROCK_BASE_HP = 60;
const ROCK_HP_MUL = 2.15;
const GOLD_FACTOR = 0.12;

// ===== Global gift phases (same for everyone) =====
const GIFT_PHASES = [
  { durSec: 30 * 60, intervalSec: 20 }, // 30m @ 20s
  { durSec: 30 * 60, intervalSec: 30 }, // 30m @ 30s
  { durSec: 30 * 60, intervalSec: 40 }, // 30m @ 40s
  { durSec: 30 * 60, intervalSec: 50 }, // 30m @ 50s
  { durSec: 60 * 60, intervalSec: 60 }, // 60m @ 60s
];
const GIFT_TOTAL_SEC = GIFT_PHASES.reduce((a, p) => a + p.durSec, 0);

// עוגן גלובלי קבוע (UTC) — כל הלקוחות מחשבים יחסית אליו
const GLOBAL_ANCHOR_MS = Date.UTC(2025, 0, 1, 0, 0, 0); // 2025-01-01 00:00:00Z

function phaseAtGlobal(nowMs = Date.now()) {
  const intoCycleSec = Math.floor((nowMs - GLOBAL_ANCHOR_MS) / 1000) % GIFT_TOTAL_SEC < 0
    ? (GIFT_TOTAL_SEC + (Math.floor((nowMs - GLOBAL_ANCHOR_MS) / 1000) % GIFT_TOTAL_SEC))
    : Math.floor((nowMs - GLOBAL_ANCHOR_MS) / 1000) % GIFT_TOTAL_SEC;

  let acc = 0;
  for (let i = 0; i < GIFT_PHASES.length; i++) {
    const ph = GIFT_PHASES[i];
    if (intoCycleSec < acc + ph.durSec) {
      const intoPhaseSec = intoCycleSec - acc;
      const step = ph.intervalSec;
      const mod = intoPhaseSec % step;
      const remainToNextGiftSec = mod === 0 ? step : (step - mod);
      return {
        index: i,
        intervalSec: step,
        into: intoPhaseSec,
        phaseRemainSec: ph.durSec - intoPhaseSec,
        remainToNextGiftSec,
      };
    }
    acc += ph.durSec;
  }
  // fallback
  const last = GIFT_PHASES[GIFT_PHASES.length - 1];
  return { index: GIFT_PHASES.length - 1, intervalSec: last.intervalSec, into: 0, phaseRemainSec: last.durSec, remainToNextGiftSec: last.intervalSec };
}


// פרסים
const DIAMOND_PRIZES = [
  { key: "coins_x10",   label: "Coins ×1000% (×10 gift)" },
  { key: "dog+3",       label: "Dog +3 levels" },
  { key: "coins_x100",  label: "Coins ×10000% (×100 gift)" },
  { key: "dog+5",       label: "Dog +5 levels" },
  { key: "coins_x1000", label: "Coins ×100000% (×1000 gift)" },
  { key: "dog+7",       label: "Dog +7 levels" },
];
function rollDiamondPrize() {
  const r = Math.random();
  if (r < 0.55) return Math.random() < 0.5 ? "coins_x10" : "dog+3";
  if (r < 0.85) return Math.random() < 0.5 ? "coins_x100" : "dog+5";
  return Math.random() < 0.5 ? "coins_x1000" : "dog+7";
}

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

// ===== Mining Economy Layer (safe, local-only) =====
const MINING_LS_KEY = "mleoMiningEconomy_v1";
const TOTAL_SUPPLY = 100_000_000_000; // 100B
const DAYS = 1825;                     // 5y
const DAILY_EMISSION = Math.floor(TOTAL_SUPPLY / DAYS);
const DAILY_CAP = Math.floor(DAILY_EMISSION * 0.02); // 2% per player/day

function getTodayKey(){ return new Date().toISOString().slice(0,10); }
function loadMiningState(){
  try {
    const raw = localStorage.getItem(MINING_LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { balance:0, minedToday:0, lastDay:getTodayKey(), scoreToday:0 };
}
function saveMiningState(st){
  try { localStorage.setItem(MINING_LS_KEY, JSON.stringify(st)); } catch {}
}
function addPlayerScorePoints(_s, baseGoldEarned){
  if(!baseGoldEarned || baseGoldEarned<=0) return;
  const st = loadMiningState();
  const today = getTodayKey();
  if(st.lastDay!==today){ st.minedToday=0; st.scoreToday=0; st.lastDay=today; }
  st.scoreToday += baseGoldEarned;
  saveMiningState(st);
}
function finalizeDailyRewardOncePerTick(){
  const st = loadMiningState();
  const today = getTodayKey();
  if(st.lastDay!==today) return;
  if(st.scoreToday>0){
    let reward = st.scoreToday;
    if(reward>DAILY_CAP) reward = DAILY_CAP;
    st.minedToday = reward;
    st.balance += reward;
    st.scoreToday = 0;
    st.lastDay = today;
    saveMiningState(st);
  }
}
function getMiningStats(){
  const st = loadMiningState();
  return { balance:st.balance, minedToday:st.minedToday, dailyCap:DAILY_CAP, dailyEmission:DAILY_EMISSION, lastDay:st.lastDay };
}
// === END PART 1 ===



// === START PART 2 ===
export default function MleoMiners() {
  const wrapRef   = useRef(null);
  const canvasRef = useRef(null);
  const rafRef    = useRef(0);
  const dragRef   = useRef({ active:false });
  const stateRef  = useRef(null);
const { openConnectModal } = useConnectModal();
const { openAccountModal } = useAccountModal();
const { isConnected } = useAccount();

const [hudInfo, setHudInfo] = useState(null); // {title, text} | null


  const [ui, setUi] = useState({
    gold: 0,
    spawnCost: 50,
    dpsMult: 1,
    goldMult: 1,
    muted: false,
  });

  const [isPortrait, setIsPortrait] = useState(true);
  const [isDesktop,  setIsDesktop]  = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  const [showIntro, setShowIntro] = useState(true);
  const [playerName, setPlayerName] = useState("");
  const [gamePaused, setGamePaused] = useState(true);

  const [showHowTo, setShowHowTo] = useState(false);
  const [adWatching, setAdWatching] = useState(false);
  const [adCooldownUntil, setAdCooldownUntil] = useState(0);
  const [showAdModal, setShowAdModal] = useState(false);
  const [adVideoEnded, setAdVideoEnded] = useState(false);

  const [showCollect, setShowCollect] = useState(false);

  const [giftReadyFlag, setGiftReadyFlag] = useState(false);
  const [giftToast, setGiftToast] = useState(null);

  const [showDiamondInfo, setShowDiamondInfo] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showMiningStats, setShowMiningStats] = useState(false);

  // פופאפ מרכזי (למתנות + שבירת סלע) — נסגר אוטומטית
  const [centerPopup, setCenterPopup] = useState(null);

  const [mounted, setMounted] = useState(false);

  const uiPulseAccumRef = useRef(0);
  const [, forceUiPulse] = useState(0);

  // סאונד
  const play = (src) => {
    if (ui.muted || !src) return;
    try { const a = new Audio(src); a.volume = 0.35; a.play().catch(()=>{}); } catch {}
  };

  // סגירת פופאפ אוטומטית
  useEffect(() => {
    if (!centerPopup) return;
    const id = setTimeout(() => setCenterPopup(null), 1800);
    return () => clearTimeout(id);
  }, [centerPopup]);

  // ── סטאבים/עזר ──
  function theStateFix_maybeMigrateLocalStorage(){ /* no-op safe */ }
function currentGiftIntervalSec(_s, now = Date.now()) {
  const ph = phaseAtGlobal(now);
  // אופציונלי: נשמור עקבות לשימושים קיימים
  if (_s) _s.lastGiftIntervalSec = ph.intervalSec;
  return ph.intervalSec;
}
function getPhaseInfo(_s, now = Date.now()) {
  return phaseAtGlobal(now);
}


  // איסוף מתנה (כפתור 🎁) — לפי חלוקה שביקשת
  function grantGift(){
    const s = stateRef.current; if (!s) return;
    const type = rollGiftType(); // PART 6

    if (type === "coins") {
      const base = Math.max(10, expectedGiftCoinReward(s));
      const gain = Math.round(base * 0.10);
      s.gold += gain;
      setUi(u => ({ ...u, gold: s.gold }));
      setCenterPopup({ text: `🎁 +${formatShort(gain)} coins`, id: Math.random() });
    } else if (type === "dog") {
      const lvl = chooseGiftDogLevelForRegularGift(s);
      const ok = trySpawnDogOrConvert(s, lvl);
      setCenterPopup({ text: ok ? `🎁 Free Dog (LV ${lvl})` : `🎁 Board full → converted to coins`, id: Math.random() });
    } else if (type === "dps") {
      s.dpsMult = +((s.dpsMult || 1) * 1.1).toFixed(3);
      setCenterPopup({ text: `🎁 DPS +10% (×${(s.dpsMult||1).toFixed(2)})`, id: Math.random() });
    } else if (type === "gold") {
      s.goldMult = +((s.goldMult || 1) * 1.1).toFixed(3);
      setCenterPopup({ text: `🎁 GOLD +10% (×${(s.goldMult||1).toFixed(2)})`, id: Math.random() });
    } else if (type === "diamond") {
      s.diamonds = (s.diamonds || 0) + 1;
      setCenterPopup({ text: `🎁 +1 💎 (Diamonds: ${s.diamonds})`, id: Math.random() });
    }

    s.giftReady = false;
    {
const now = Date.now();
const stepSec = currentGiftIntervalSec(s, now);
s.giftNextAt = now + stepSec * 1000; // מרווח מלא מה־claim
}

    setGiftReadyFlag(false);
    try { play(S_GIFT); } catch {}
    save?.();
  }
// === END PART 2 ===



// === START PART 3 ===
// Init state + קנבס + ציור + לולאת משחק (שיפור UX של גרירה)

useEffect(() => {
  theStateFix_maybeMigrateLocalStorage();

  // טען שמירה אם יש
  const loaded = loadSafe();
  const init = loaded ? { ...freshState(), ...loaded } : freshState();

  // אם אין minerScale/Width בשמירה – ברירות מחדל
  if (loaded && loaded.minerScale == null) init.minerScale = 1.25;
  if (loaded && loaded.minerWidth  == null) init.minerWidth  = 1.15;

  // עוגן עלות ראשוני
  if (init.costBase == null) {
    try { init.costBase = Math.max(80, expectedRockCoinReward(init)); }
    catch { init.costBase = 120; }
  }

  stateRef.current = init;
  setUi(u => ({ ...u,
    gold: init.gold, spawnCost: init.spawnCost,
    dpsMult: init.dpsMult, goldMult: init.goldMult,
  }));
// סנכרון מיידי של הדגל הוויזואלי עם מצב האמת מהשמירה
setGiftReadyFlag(!!init.giftReady);


  // אם המתנה כבר מוכנה/טיימר חסר – תקן
 try {
  const now = Date.now();
  const ph  = getPhaseInfo(null, now);

  // אם אין giftNextAt — עגן לנקודת הטיקט הקרובה לפי הפאזה הגלובלית
 if (!init.giftNextAt || Number.isNaN(init.giftNextAt)) {
  init.giftReady  = false;
  const stepSec = currentGiftIntervalSec(init, now);
  init.giftNextAt = now + stepSec * 1000; // התחלה תמיד במרווח מלא
  save();
}


  // אם היינו OFFLINE ועבר הטיקט — מתנה אחת מוכנה; הבאה תיושר ב-grantGift/heartbeat
  if ((init.giftNextAt || 0) <= now) {
    init.giftReady = true;
    setGiftReadyFlag(true);
  }
} catch {}


  // טען קירור מודעה
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (typeof data.adCooldownUntil === "number") {
        setAdCooldownUntil(data.adCooldownUntil);
        if (stateRef.current) stateRef.current.adCooldownUntil = data.adCooldownUntil;
      }
    }
  } catch {}

  // בדיקת OFFLINE כבר ב־mount
  try {
    const s = stateRef.current;
    const now  = Date.now();
    const last = s?.lastSeen || now;
    const elapsedMs = Math.max(0, now - last);
    if (elapsedMs > 1000) {
      const gained = handleOfflineAccrual(s, elapsedMs); // PART 6
      if (gained > 0) setShowCollect(true);
      s.lastSeen = now;
      save();
    }
  } catch {}

  setMounted(true);

  // הגדרות מסך
  const updateFlags = () => {
    const w = window.innerWidth, h = window.innerHeight;
    const portrait = h >= w, desktop = w >= 1024;
    setIsPortrait(portrait); setIsDesktop(desktop);
    setIsMobileLandscape(!portrait && !desktop);
    setGamePaused(p => (!portrait && !desktop) ? true : (showIntro ? true : false));
  };
  updateFlags();
  window.addEventListener("resize", updateFlags);
  window.addEventListener("orientationchange", updateFlags);
  document.addEventListener("fullscreenchange", updateFlags);

  // מנע גלילה כשגוררים על הקנבס
  const preventTouchScroll = (e) => { if (e.target.closest?.("#miners-canvas")) e.preventDefault(); };
  document.addEventListener("touchmove", preventTouchScroll, { passive:false });

  // אם הקנבס עדיין לא בהרכבה – נסה שוב פריים הבא
  const c0 = canvasRef.current;
  if (!c0) {
    const id = requestAnimationFrame(() => canvasRef.current && setupCanvasAndLoop(canvasRef.current));
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", updateFlags);
      window.removeEventListener("orientationchange", updateFlags);
      document.removeEventListener("fullscreenchange", updateFlags);
      document.removeEventListener("touchmove", preventTouchScroll);
    };
  }
  const cleanup = setupCanvasAndLoop(c0);

  // שמירת זמן יציאה / חזרה + צבירת OFFLINE
  const onVisibility = () => {
    const s = stateRef.current; if (!s) return;
    if (document.visibilityState === "hidden") {
      s.lastSeen = Date.now(); safeSave();
    } else {
      const now = Date.now();
      const elapsedMs = Math.max(0, now - (s.lastSeen || now));
      if (elapsedMs > 1000) {
        const gained = handleOfflineAccrual(s, elapsedMs); // PART 6
        if (gained > 0) setShowCollect(true);
        s.lastSeen = now;
      }
      safeSave();
    }
  };
  const onHide = () => { const s = stateRef.current; if (s) { s.lastSeen = Date.now(); safeSave(); } };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onHide);
  window.addEventListener("beforeunload", onHide);

  return () => {
    cleanup && cleanup();
    window.removeEventListener("resize", updateFlags);
    window.removeEventListener("orientationchange", updateFlags);
    document.removeEventListener("fullscreenchange", updateFlags);
    document.removeEventListener("touchmove", preventTouchScroll);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onHide);
    window.removeEventListener("beforeunload", onHide);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [showIntro]);

// רנדר/סנכרון מתנות — 500ms heartbeat (תיקון: בלי "יישור", רק בדיקה)
useEffect(() => {
  const id = setInterval(() => {
    const s = stateRef.current; 
    if (!s) return;
    const now = Date.now();

    // אם אין טיימר – אתחל מרווח מלא לפי הפאזה הנוכחית
    if (!s.giftNextAt || Number.isNaN(s.giftNextAt)) {
      const stepSec = currentGiftIntervalSec(s, now);
      s.giftReady  = false;
      s.giftNextAt = now + stepSec * 1000;
      save();
      return;
    }

    // אם הגיע הזמן – המתנה מוכנה; לא נוגעים ביעד עד Claim
    if (!s.giftReady && s.giftNextAt <= now) {
      s.giftReady = true;
      setGiftReadyFlag(true);
      save();
    }
  }, 500);

  return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);



// רנדר חלק לשעונים (מתנה/כלב/GAIN) — פולס UI כל 200ms
useEffect(() => {
  const id = setInterval(() => {
    // שומר רענון קל ל-HUD/טבעות
    uiPulseAccumRef.current += 0.2;
    forceUiPulse(v => (v + 1) % 1000000);

    // סנכרון בטוח: אם ה-ref השתנה מול ה-flag, עדכן את ה-flag
    const s = stateRef.current;
    if (s && giftReadyFlag !== !!s.giftReady) {
      setGiftReadyFlag(!!s.giftReady);
    }
  }, 200);
  return () => clearInterval(id);
  // בכוונה בלי giftReadyFlag כתלות — אנחנו קוראים מתוך closure ומתאפסים בכל רינדור ממילא
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);



// ---------- init/load/save ----------
function freshState(){
  const now = Date.now();
  return {
    lanes: Array.from({length:LANES},(_,lane)=>({
      slots: Array(SLOTS_PER_LANE).fill(null),
      rock: newRock(lane,0),
      rockCount: 0,
      beltShift: 0,
    })),
    miners:{}, nextId:1,

    gold:0, spawnCost:50, dpsMult:1, goldMult:1,

    // קנה מידה לכלב
    minerScale: 1.25, // גובה/סקייל כולל
    minerWidth: 1.15, // הרחבת רוחב בלבד

    anim:{ t:0, coins:[], hint:1, fx:[] },
    onceSpawned:false,
    totalPurchased:0, spawnLevel:1,
    lastSeen:now, pendingOfflineGold:0,

    // Gifts/diamonds
    cycleStartAt: now, lastGiftIntervalSec: 20,
    giftNextAt: now + 20000, giftReady:false,
    diamonds:0, nextDiamondPrize: rollDiamondPrize(),

    // Auto-dog (בנק)
    autoDogLastAt: now, autoDogBank: 0,

    // מודעות
    adCooldownUntil: 0,

    // תיבת יהלום מושהית אם אין מקום
    pendingDiamondDogLevel: null,
  };
}

function loadSafe(){
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function safeSave(){ try { save?.(); } catch {} }
// === END PART 3 ===



// === START PART 4 ===
// ---------- קנבס/ציור ----------
function setupCanvasAndLoop(cnv){
  const ctx = cnv.getContext("2d"); if (!ctx) return () => {};
  const DPR = window.devicePixelRatio || 1;

  const resize = () => {
    const isFS = !!document.fullscreenElement;

    let targetW, targetH;
    if (isFS) {
      targetW = Math.min(window.innerWidth || 360, 1024);
      targetH = Math.max(420, (window.innerHeight || 600) - 1);
      const wrap = cnv.parentElement;
      if (wrap) wrap.style.height = `${window.innerHeight}px`;
    } else {
      const wrap = cnv.parentElement;
      if (wrap) wrap.style.height = "";
      const rect = wrap?.getBoundingClientRect();
      const innerW = Math.max(320, Math.floor(wrap?.clientWidth  ?? rect?.width  ?? 360));
      const innerH = Math.max(420, Math.floor(wrap?.clientHeight ?? rect?.height ?? 600));
      targetW = Math.min(innerW, 1024);
      targetH = innerH;
    }

    cnv.style.width  = `${targetW}px`;
    cnv.style.height = `${targetH}px`;
    cnv.width  = Math.floor(targetW * DPR);
    cnv.height = Math.floor(targetH * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    draw();
  };

  const onFSResize = () => {
    resize();
    setTimeout(resize, 60);
  };

  window.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", onFSResize);
  resize();

  // קלט — גרירה ומיקום (UX משופר)
  const onDown = (e) => {
    if (isMobileLandscape || gamePaused || showIntro || showCollect) return;
    const p = pos(e);
    const hit = pickMiner(p.x,p.y);
    if (hit) {
      dragRef.current = {
        active:true,
        id: hit.id,
        ox: p.x - hit.x,
        oy: p.y - hit.y,
        x: p.x - (p.x - hit.x),
        y: p.y - (p.y - hit.y),
      };
      return;
    }
    const pill = pickPill(p.x,p.y);
    if (pill) trySpawnAtSlot(pill.lane, pill.slot);
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
    const s = stateRef.current; if (!s) return;
    const id = dragRef.current.id;
    const m = s.miners[id]; if (!m) { dragRef.current={active:false}; return; }
    const p = pos(e);
    const drop = pickSlot(p.x,p.y);
    const cur = s.lanes[m.lane];
    cur.slots[m.slot] = null;
    if (drop) {
      const {lane,slot} = drop;
      const target = s.lanes[lane].slots[slot];
      if (!target) {
        m.lane=lane; m.slot=slot; s.lanes[lane].slots[slot]={id};
      } else if (target.id!==id) {
        const other = s.miners[target.id];
        if (other && other.level===m.level) {
          delete s.miners[m.id]; delete s.miners[other.id];
          s.lanes[lane].slots[slot]=null;
          const nid = s.nextId++;
          s.miners[nid] = { id:nid, level:m.level+1, lane, slot, pop:1 };
          s.lanes[lane].slots[slot]={ id:nid };
          try { play?.(S_MERGE); } catch {}
        } else {
          cur.slots[m.slot] = { id:m.id };
        }
      }
      safeSave();
    } else {
      cur.slots[m.slot] = { id:m.id };
    }
    dragRef.current={active:false};
    draw();
  };

  cnv.addEventListener("mousedown", onDown);
  cnv.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  cnv.addEventListener("touchstart", (e)=>{ onDown(e.touches[0]); e.preventDefault(); }, {passive:false});
  cnv.addEventListener("touchmove",  (e)=>{ onMove(e.touches[0]); e.preventDefault(); }, {passive:false});
  cnv.addEventListener("touchend",   (e)=>{ onUp(e.changedTouches[0]); e.preventDefault(); }, {passive:false});

  // לולאה
  let last = performance.now();
  const loop = (t) => {
    const dt = Math.min(0.05, (t-last)/1000);
    last = t;
    tick(dt); draw();
    rafRef.current = requestAnimationFrame(loop);
  };
  rafRef.current = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(rafRef.current);
    window.removeEventListener("resize", resize);
    document.removeEventListener("fullscreenchange", onFSResize);
    cnv.removeEventListener("mousedown", onDown);
    cnv.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
}

// ----- גיאומטריה -----
const PILL_H = 36; // גובה כפתור ADD
function boardRect(){
  const c = canvasRef.current;
  return { x:PADDING, y:PADDING, w:(c?.clientWidth||0)-PADDING*2, h:(c?.clientHeight||0)-PADDING*2 };
}
function laneRect(lane){
  const b = boardRect();
  const h = b.h * 0.18;
  const centers = [0.375,0.525,0.675,0.815];
  const centerY = b.y + b.h * centers[lane];
  const y = Math.max(b.y, Math.min(centerY - h*0.5, b.y + b.h - h));
  return { x:b.x, y, w:b.w, h };
}
function rockWidth(L){
  return Math.min(L.w * 0.30, Math.max(80, L.h * 1.10));
}
function slotRect(lane,slot){
  const L = laneRect(lane);
  const rw = rockWidth(L);
  const cellW = (L.w - rw) / SLOTS_PER_LANE;
  return { x:L.x + slot*cellW, y:L.y, w:cellW - 4, h:L.h };
}
function rockRect(lane){
  const L = laneRect(lane);
  const rw = rockWidth(L);
  const y = L.y + L.h * 0.06;
  const h = L.h * 0.88;
  return { x:L.x + L.w - rw - 4, y, w:rw, h };
}
function pos(e){
  const r = canvasRef.current?.getBoundingClientRect();
  return { x: e.clientX - (r?.left||0), y: e.clientY - (r?.top||0) };
}
function pointInRect(x,y,r){ return x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h; }
function pillRect(lane,slot){
  const r = slotRect(lane,slot);
  const pw = r.w * 0.36;
  const ph = Math.min(PILL_H, r.h*0.22);
  const px = r.x + (r.w - pw)/2;
  const py = r.y + r.h*0.5 - ph/2;
  return { x:px, y:py, w:pw, h:ph };
}
function pickPill(x,y){
  const s = stateRef.current; if (!s) return null;
  for (let l=0; l<LANES; l++){
    for (let k=0; k<SLOTS_PER_LANE; k++){
      if (s.lanes[l].slots[k]) continue;
      const pr = pillRect(l,k);
      if (pointInRect(x,y,pr)) return { lane:l, slot:k };
    }
  }
  return null;
}
function pickSlot(x,y){
  for (let l=0; l<LANES; l++){
    for (let k=0; k<SLOTS_PER_LANE; k++){
      const r = slotRect(l,k);
      if (pointInRect(x,y,r)) return { lane:l, slot:k };
    }
  }
  return null;
}
function pickMiner(x,y){
  const s = stateRef.current; if (!s) return null;
  for (let l=0; l<LANES; l++){
    for (let k=0; k<SLOTS_PER_LANE; k++){
      const cell = s.lanes[l].slots[k]; if(!cell) continue;
      const r = slotRect(l,k);
      const cx = r.x + r.w*0.52;
      const cy = r.y + r.h*0.56;
      const rad = Math.min(r.w,r.h)*0.33;
      const dx=x-cx, dy=y-cy;
      if (dx*dx+dy*dy < rad*rad) return { id:cell.id, x:cx, y:cy };
    }
  }
  return null;
}
// === END PART 4 ===


// === START PART 5 ===
// ----- ציור -----
function drawBg(ctx,b){
  const img = getImg(IMG_BG);
  if (img.complete && img.naturalWidth>0) {
    const iw=img.naturalWidth, ih=img.naturalHeight;
    const ir=iw/ih, br=b.w/b.h;
    let dw,dh; if (br>ir){ dw=b.w; dh=b.w/ir; } else { dh=b.h; dw=b.h*ir; }
    const dx=b.x+(b.w-dw)/2, dy=b.y+(b.h-dh)/2;
    ctx.drawImage(img,dx,dy,dw,dh);
  } else {
    const g=ctx.createLinearGradient(0,b.y,0,b.y+b.h);
    g.addColorStop(0,"#0b1220"); g.addColorStop(1,"#0c1526");
    ctx.fillStyle=g; ctx.fillRect(b.x,b.y,b.w,b.h);
  }
}

function drawRock(ctx,rect,rock){
  ctx.shadowColor = "transparent";
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const pct   = Math.max(0, rock.hp/rock.maxHp);
  const scale = 0.35 + 0.65*pct;

  const img   = getImg(IMG_ROCK);
  const pad   = 6;
  const fullW = rect.w - pad*2;
  const fullH = rect.h - pad*2;

  const rw = fullW*scale, rh = fullH*scale;
  const cx = rect.x + rect.w/2, cy = rect.y + rect.h/2;
  const dx = cx - rw/2,           dy = cy - rh/2;

  if (img.complete && img.naturalWidth>0) ctx.drawImage(img,dx,dy,rw,rh);
  else { ctx.fillStyle="#6b7280"; ctx.fillRect(dx,dy,rw,rh); }

  const by   = rect.y + 4;
  const barW = fullW * 0.75;
  const bx   = rect.x + pad + (fullW - barW) / 2;
  const barH = 10;

  ctx.fillStyle   = "#0ea5e9";
  ctx.fillRect(bx,by,barW*pct,barH);
  ctx.strokeStyle = "#082f49";
  ctx.lineWidth   = 1;
  ctx.strokeRect(bx,by,barW,barH);

  ctx.fillStyle    = "#e5e7eb";
  ctx.font         = "bold 11px system-ui";
  ctx.textAlign    = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(`Rock ${rock.idx+1}`, bx + barW/2, by - 2);
}

function drawMiner(ctx,lane,slot,m){
  const r  = slotRect(lane,slot);
  const cx = r.x + r.w*0.52;
  const cy = r.y + r.h*0.56;

  // קנה מידה: גובה + רוחב
  const scaleH = (stateRef.current?.minerScale || 1);
  const base   = Math.min(r.w, r.h) * 0.84 * scaleH;
  const wH     = base;
  const wW     = base * (stateRef.current?.minerWidth || 1.15);

  ctx.shadowColor = "transparent";
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const img = getImg(IMG_MINER);
  if (img.complete && img.naturalWidth>0) {
    const frame = Math.floor(((stateRef.current?.anim?.t)||0)*8)%4;
    const sw = img.width/4, sh = img.height;
    ctx.drawImage(img, frame*sw, 0, sw, sh, cx - wW/2, cy - wH/2, wW, wH);
  } else {
    ctx.fillStyle="#22c55e";
    ctx.beginPath(); ctx.ellipse(cx, cy, (wW*0.35), (wH*0.35), 0, 0, Math.PI*2); ctx.fill();
  }

  const fontPx = Math.max(12, Math.floor(base*0.22));
  ctx.fillStyle    = "#ffffff";
  ctx.font         = `bold ${fontPx}px system-ui`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(m.level), cx, cy - base*0.20);
}

function drawPill(ctx,x,y,w,h,label,enabled=true){
  ctx.shadowColor = "transparent";
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  const g=ctx.createLinearGradient(x,y,x,y+h);
  if (enabled){ g.addColorStop(0,"#fef08a"); g.addColorStop(1,"#facc15"); }
  else{ g.addColorStop(0,"#475569"); g.addColorStop(1,"#334155"); }
  ctx.fillStyle=g; ctx.strokeStyle=enabled?"#a16207":"#475569"; ctx.lineWidth=1.5;
  roundRect(ctx,x,y,w,h,h/2); ctx.fill(); ctx.stroke();
  ctx.fillStyle=enabled?"#111827":"#cbd5e1";
  ctx.font=`bold ${Math.max(12, Math.floor(h*0.45))}px system-ui`; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(label, x+w/2, y+h/2);
}
function roundRect(ctx,x,y,w,h,r){
  const rr=Math.min(r,h/2,w/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);
  ctx.arcTo(x+w,y,x+w,y+h,rr);
  ctx.arcTo(x+w,y+h,x,y+h,rr);
  ctx.arcTo(x,y+h,x,y,rr);
  ctx.arcTo(x,y,x+w,y,rr);
  ctx.closePath();
}

function draw(){
  const c = canvasRef.current; if (!c) return;
  const ctx = c.getContext("2d"); if (!ctx) return;
  const s = stateRef.current;   if (!s) return;
  const b = boardRect();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  drawBg(ctx,b);

  // ADD → סלעים → כלבים
  for (let l=0; l<LANES; l++){
    for (let k=0; k<SLOTS_PER_LANE; k++){
      const cell = s.lanes[l].slots[k];
      if (!cell) {
        const pr = pillRect(l,k);
        const canAfford = (s.gold ?? 0) >= (s.spawnCost ?? 0) && countMiners(s) < MAX_MINERS;
        drawPill(ctx, pr.x, pr.y, pr.w, pr.h, "ADD", canAfford);
      }
    }
    drawRock(ctx, rockRect(l), s.lanes[l].rock);
    for (let k=0; k<SLOTS_PER_LANE; k++){
      const cell = s.lanes[l].slots[k]; if (!cell) continue;
      const m = s.miners[cell.id];      if (!m) continue;
      if (dragRef.current.active && dragRef.current.id === m.id) continue;
      drawMiner(ctx,l,k,m);
    }
  }

  // GHOST גרירה — ללא צל/הילה
  if (dragRef.current.active) {
    const id = dragRef.current.id;
    const m  = s.miners[id];
    if (m) {
      const gx = (dragRef.current.x ?? 0) + (dragRef.current.ox ?? 0);
      const gy = (dragRef.current.y ?? 0) + (dragRef.current.oy ?? 0);
      const r0 = slotRect(m.lane, m.slot);

      const baseW = Math.min(r0.w, r0.h) * 0.84;
      const scaleH = (stateRef.current?.minerScale || 1);
      const wH = baseW * scaleH;
      const wW = wH * (stateRef.current?.minerWidth || 1.15);

      const img=getImg(IMG_MINER);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur  = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      if (img.complete && img.naturalWidth>0) {
        const frame=Math.floor(((stateRef.current?.anim?.t)||0)*8)%4;
        const sw=img.width/4, sh=img.height;
        ctx.drawImage(img, frame*sw,0,sw,sh, gx-wW/2, gy-wH/2, wW, wH);
      } else {
        ctx.fillStyle="#22c55e";
        ctx.beginPath(); ctx.ellipse(gx,gy,(wW*0.35),(wH*0.35),0,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }
}

// ----- לוגיקת tick בסיסית -----
function tick(dt){
  const s = stateRef.current; if (!s) return;
  s.anim.t += dt;
  s.paused = gamePaused || showIntro || showCollect;
  const now = Date.now();
  if (s.paused){ s.lastSeen = now; return; }

  // שבירת סלעים + מטבעות
  for (let l=0; l<LANES; l++){
    let dps = 0;
    for (let k=0; k<SLOTS_PER_LANE; k++){
      const cell = s.lanes[l].slots[k]; if (!cell) continue;
      const m = s.miners[cell.id]; if (!m) continue;
      dps += minerDps(m.level, s.dpsMult||1);
    }
    const rock = s.lanes[l].rock;
    rock.hp -= dps * dt;
    if (rock.hp <= 0){
      const gain = Math.floor(rock.maxHp * GOLD_FACTOR * (s.goldMult||1));
      s.gold += gain; setUi(u => ({ ...u, gold:s.gold }));
      addPlayerScorePoints(s, gain);
      setCenterPopup({ text: `⛏️ +${formatShort(gain)} coins`, id: Math.random() });
      s.lanes[l].rockCount += 1;
      s.lanes[l].rock = newRock(l, s.lanes[l].rockCount);
      safeSave();
    }
  }

  // טיימר מתנות
  if (!s.giftReady) {
    if ((s.giftNextAt || 0) <= Date.now()) {
      s.giftReady = true;
      setGiftReadyFlag(true);
    }
  }

  // אם יש כלב יהלום מושהה ואין מקום – נחכה; אם התפנה מקום – נכניס ונאפס טיימר מתנה
  if (s.pendingDiamondDogLevel && countMiners(s) < MAX_MINERS) {
    const placed = spawnMiner(s, s.pendingDiamondDogLevel);
    if (placed) {
     const placedLvl = s.pendingDiamondDogLevel;
s.pendingDiamondDogLevel = null;
s.giftReady  = false;
s.giftNextAt = Date.now() + currentGiftIntervalSec(s) * 1000;
setGiftToastWithTTL(`💎 Dog (LV ${placedLvl}) placed`);
save?.();

    }
  }

  // אוטו־דוג:
  // 1) צבירה לבנק לפי הזמן (בלי חלוקה OFFLINE)
  // 2) אם יש בנק>0 ויש סלוט פנוי → מכניס, מאפס טיימר ומפחית מהבנק
  accrueBankDogsUpToNow(s);   // PART 6
  tryDistributeBankDog(s);    // PART 6

  finalizeDailyRewardOncePerTick();
  s.lastSeen = now;
}
// === END PART 5 ===



// === START PART 6 ===
// Helpers + save/load + purchases + reset + misc used by JSX

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function countMiners(s) { return s?.miners ? Object.keys(s.miners).length : 0; }
function minerDps(level, mul = 1) { return BASE_DPS * Math.pow(LEVEL_DPS_MUL, level - 1) * mul; }

function laneDpsSum(s, laneIdx) {
  if (!s) return 0;
  let dps = 0;
  for (let k = 0; k < SLOTS_PER_LANE; k++) {
    const cell = s.lanes?.[laneIdx]?.slots?.[k];
    if (!cell) continue;
    const m = s.miners[cell.id];
    if (!m) continue;
    dps += minerDps(m.level, s.dpsMult || 1);
  }
  return dps;
}

function newRock(lane, idx) {
  const hp = Math.floor(ROCK_BASE_HP * Math.pow(ROCK_HP_MUL, idx));
  return { lane, idx, maxHp: hp, hp };
}

function makeFreshState() { // (לשמירת תאימות אם קוראים לזה במקום freshState)
  return freshState();
}

// ── Save/Load ──
function save() {
  const s = stateRef.current; if (!s) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      lanes: s.lanes, miners: s.miners, nextId: s.nextId,
      gold: s.gold, spawnCost: s.spawnCost, dpsMult: s.dpsMult, goldMult: s.goldMult,
      onceSpawned: s.onceSpawned,

      // קני מידה של הכלב
      minerScale: s.minerScale || 1.25,
      minerWidth: s.minerWidth || 1.15,

      lastSeen: s.lastSeen, pendingOfflineGold: s.pendingOfflineGold || 0,
      totalPurchased: s.totalPurchased, spawnLevel: s.spawnLevel,

      cycleStartAt: s.cycleStartAt,
      lastGiftIntervalSec: s.lastGiftIntervalSec,
      giftNextAt: s.giftNextAt, giftReady: s.giftReady,

      diamonds: s.diamonds || 0,
      nextDiamondPrize: s.nextDiamondPrize,

      autoDogLastAt: s.autoDogLastAt, autoDogBank: s.autoDogBank,
      costBase: s.costBase,
      adCooldownUntil: s.adCooldownUntil || 0,

      pendingDiamondDogLevel: s.pendingDiamondDogLevel || null,
    }));
  } catch {}
}
function load() { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }

function _baseCost(s) { if (!s) return 160; return Math.max(80, s.costBase || 120); }
function _dpsCost(s)  { const base=_baseCost(s); const steps=Math.max(0, Math.round(((s?.dpsMult||1)-1)*10)); return Math.ceil(base*2.0*Math.pow(1.18,steps)); }
function _goldCost(s) { const base=_baseCost(s); const steps=Math.max(0, Math.round(((s?.goldMult||1)-1)*10)); return Math.ceil(base*2.2*Math.pow(1.18,steps)); }

function expectedRockCoinReward(s) {
  if (!s) return 0;
  let bestLane = 0, bestDps = 0;
  for (let l = 0; l < LANES; l++) {
    const dps = laneDpsSum(s, l);
    if (dps > bestDps) { bestDps = dps; bestLane = l; }
  }
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

function expectedGiftCoinReward(s) {
  if (!s) return 0;
  const mult = (s.goldMult || 1);
  const vals = [];
  for (let l = 0; l < LANES; l++) {
    const rk = s.lanes[l].rock;
    vals.push(Math.floor(rk.maxHp * GOLD_FACTOR * mult));
  }
  if (!vals.length) return 0;
  const max = Math.max(...vals);
  const sum = vals.reduce((a,b)=>a+b,0);
  const others = sum - max;
  return Math.floor(max + others * 0.5);
}

function setGiftToastWithTTL(text, ttl = 3000) {
  const id = Math.random().toString(36).slice(2);
  setGiftToast?.({ text, id });
  setTimeout(() => { setGiftToast?.(cur => (cur && cur.id === id ? null : cur)); }, ttl);
}

// === Spawn helpers ===
function spawnMiner(s, level = 1) {
  if (!s) return false;
  if (countMiners(s) >= MAX_MINERS) return false;
  for (let l = 0; l < LANES; l++) {
    for (let slot = 0; slot < SLOTS_PER_LANE; slot++) {
      if (!s.lanes[l].slots[slot]) {
        const id = s.nextId++;
        const m  = { id, level, lane: l, slot, pop: 1 };
        s.miners[id] = m;
        s.lanes[l].slots[slot] = { id };
        return true;
      }
    }
  }
  return false;
}
function spawnMinerAt(s, lane, slot, level = 1) {
  if (!s) return false;
  if (s.lanes[lane].slots[slot]) return false;
  const id = s.nextId++;
  const m  = { id, level, lane, slot, pop: 1 };
  s.miners[id] = m;
  s.lanes[lane].slots[slot] = { id };
  return true;
}

function afterPurchaseBump(s) {
  s.totalPurchased = (s.totalPurchased || 0) + 1;
  s.spawnLevel = 1 + Math.floor((s.totalPurchased) / 30);
}
function trySpawnAtSlot(lane, slot) {
  const s = stateRef.current; if (!s) return;
  if (countMiners(s) >= MAX_MINERS) { try{play?.(S_CLICK);}catch{}; alert("Maximum 16 miners on the board."); return; }
  if (s.spawnCost == null || s.gold < s.spawnCost) { try{play?.(S_CLICK);}catch{}; return; }
  const ok = spawnMinerAt(s, lane, slot, s.spawnLevel);
  if (!ok) return;
  s.gold -= s.spawnCost;
  s.spawnCost = Math.ceil(s.spawnCost * 1.12);
  afterPurchaseBump(s);
  s.pressedPill = { lane, slot, t: 0.15 };
  s.anim && (s.anim.hint = 0);
  setUi(u => ({ ...u, gold: s.gold, spawnCost: s.spawnCost }));
  try{play?.(S_CLICK);}catch{};
  save();
}
function addMiner() {
  const s = stateRef.current; if (!s) return;
  if (countMiners(s) >= MAX_MINERS) { try{play?.(S_CLICK);}catch{}; alert("Maximum 16 miners on the board."); return; }
  if (s.spawnCost == null || s.gold < s.spawnCost) return;
  const ok = spawnMiner(s, s.spawnLevel);
  if (!ok) return;
  s.gold -= s.spawnCost;
  s.spawnCost = Math.ceil(s.spawnCost * 1.12);
  afterPurchaseBump(s);
  s.anim && (s.anim.hint = 0);
  setUi(u => ({ ...u, gold: s.gold, spawnCost: s.spawnCost }));
  try{play?.(S_CLICK);}catch{};
  save();
}
function upgradeDps() {
  const s = stateRef.current; if (!s) return;
  const cost = _dpsCost(s); if (s.gold < cost) return;
  s.gold -= cost; s.dpsMult = +((s.dpsMult || 1) * 1.1).toFixed(3);
  setUi(u => ({ ...u, gold: s.gold })); save();
}
function upgradeGold() {
  const s = stateRef.current; if (!s) return;
  const cost = _goldCost(s); if (s.gold < cost) return;
  s.gold -= cost; s.goldMult = +((s.goldMult || 1) * 1.1).toFixed(3);
  setUi(u => ({ ...u, gold: s.gold })); save();
}

function onOfflineCollect() {
  const s = stateRef.current; if (!s) return;
  const add = s.pendingOfflineGold || 0;
  if (add > 0) {
    s.gold += add;
    s.pendingOfflineGold = 0;
    setUi(u => ({ ...u, gold: s.gold }));
    save();
  }
  setShowCollect(false);
}

// ===== לוגיקת אוטו־דוג והמתנות =====

// בחירת דרגת כלב (אוטומטי/מתנת כלב):
// אם יש על הלוח לפחות כלב אחד בדרגה spawnLevel-2 → נחזיר spawnLevel-2, אחרת spawnLevel.
function chooseAutoDogLevel(s) {
  const sl = Math.max(1, s.spawnLevel || 1);
  const target2 = Math.max(1, sl - 2);
  const existsLv2 = Object.values(s.miners || {}).some(m => m.level === target2);
  return existsLv2 ? target2 : sl;
}
function chooseGiftDogLevelForRegularGift(s) {
  return chooseAutoDogLevel(s);
}

// צבירת כלבים לבנק לפי זמן (לא מחלק OFFLINE; רק צובר עד קאפ)
function accrueBankDogsUpToNow(s) {
  if (!s) return;
  const intervalSec = (typeof DOG_INTERVAL_SEC !== "undefined" ? DOG_INTERVAL_SEC : 1800);
  const intervalMs  = intervalSec * 1000;
  const cap         = (typeof DOG_BANK_CAP !== "undefined" ? DOG_BANK_CAP : 6);
  const now         = Date.now();
  const last        = s.autoDogLastAt || now;

  if (now <= last) return;
  const diffMs = now - last;

  if ((s.autoDogBank || 0) >= cap) return;

  const made = Math.floor(diffMs / intervalMs);
  if (made <= 0) return;

  const room = Math.max(0, cap - (s.autoDogBank || 0));
  const add  = Math.min(made, room);
  if (add <= 0) return;

  s.autoDogBank = (s.autoDogBank || 0) + add;

  // שומרים את ה-remainder לטבעת; אם הגענו לקאפ — ננעל לזמן עכשיו
  if (s.autoDogBank >= cap) {
    s.autoDogLastAt = now;
  } else {
    const consumed  = add * intervalMs;
    const remainder = diffMs - consumed;
    s.autoDogLastAt = now - remainder;
  }
}

// מחלק כלב אחד מהבנק כשיש מקום פנוי. מאפס טיימר (autoDogLastAt = עכשיו).
function tryDistributeBankDog(s) {
  if (!s) return;
  if ((s.autoDogBank || 0) <= 0) return;

  // יש סלוט פנוי?
  if (countMiners(s) >= MAX_MINERS) return;

  const lvl = chooseAutoDogLevel(s);
  const ok  = spawnMiner(s, lvl);
  if (ok) {
    s.autoDogBank = Math.max(0, (s.autoDogBank || 0) - 1);
    s.autoDogLastAt = Date.now(); // אתחול הטיימר מחדש
    setGiftToastWithTTL(`🐶 Auto Dog (LV ${lvl})`);
    save?.();
  }
}

// אין המרה למטבעות כשאין מקום — החזרה false בלבד.
function trySpawnDogOrConvert(_s, _level) {
  const s = _s; const level = _level;
  if (!s) return false;
  if (countMiners(s) >= MAX_MINERS) return false;
  const ok = spawnMiner(s, level);
  if (ok) { save?.(); return true; }
  return false;
}

// OFFLINE: רק צבירת בנק; לא חלוקה
function handleOfflineAccrual(s, elapsedMs) {
  if (!s) return 0;

  // צבירת בנק בלבד (לא חלוקה)
  const intervalSec = (typeof DOG_INTERVAL_SEC !== "undefined" ? DOG_INTERVAL_SEC : 1800);
  const intervalMs  = intervalSec * 1000;
  const cap         = (typeof DOG_BANK_CAP !== "undefined" ? DOG_BANK_CAP : 6);

  let toAdd = Math.floor(elapsedMs / intervalMs);
  if (toAdd > 0) {
    const room = Math.max(0, cap - (s.autoDogBank || 0));
    const add  = Math.min(toAdd, room);
    if (add > 0) {
      s.autoDogBank = (s.autoDogBank || 0) + add;
      const consumed  = add * intervalMs;
      const remainder = Math.max(0, elapsedMs - consumed);
      s.autoDogLastAt = Date.now() - remainder;
    }
  }

  // סימולציית זהב OFFLINE
  const CAP_MS = 12 * 60 * 60 * 1000; // 12h
  const simMs = Math.min(elapsedMs, CAP_MS);
  let totalCoins = 0;

  for (let lane = 0; lane < LANES; lane++) {
    let dps = laneDpsSum(s, lane);
    if (dps <= 0) continue;

    let idx = s.lanes[lane].rock.idx;
    let hp  = s.lanes[lane].rock.hp;
    let maxHp = s.lanes[lane].rock.maxHp;
    let timeLeft = simMs / 1000;

    while (timeLeft > 0 && dps > 0) {
      const timeToBreak = hp / dps;
      if (timeToBreak > timeLeft) {
        hp -= dps * timeLeft;
        timeLeft = 0;
      } else {
        totalCoins += Math.floor(maxHp * GOLD_FACTOR * (s.goldMult || 1));
        timeLeft -= timeToBreak;
        idx += 1;
        const rk = newRock(lane, idx);
        hp = rk.hp; maxHp = rk.maxHp;
      }
    }

    s.lanes[lane].rock = { lane, idx, maxHp, hp: Math.max(1, Math.floor(hp)) };
    s.lanes[lane].rockCount = idx;
  }

  if (totalCoins > 0) s.pendingOfflineGold = (s.pendingOfflineGold || 0) + totalCoins;
  return totalCoins;
}

// ===== Gifts: weights & handlers =====
function rollGiftType() {
  const r = Math.random() * 100;
  if (r < 60) return "coins";
  if (r < 78) return "dog";
  if (r < 86) return "dps";
  if (r < 94) return "gold";
  return "diamond";
}

async function enterFullscreenAndLockMobile() { try {
  const w = window.innerWidth, desktop = w >= 1024;
  if (desktop) return;
  const el = wrapRef.current;
  if (el?.requestFullscreen) await el.requestFullscreen();
  if (screen.orientation?.lock) { try { await screen.orientation.lock("portrait-primary"); } catch {} }
} catch {} }
async function exitFullscreenIfAny() { try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {} }

async function resetGame() {
  try { play?.(S_CLICK); } catch {}
  try { localStorage.removeItem(LS_KEY); } catch {}

  const fresh = makeFreshState();
  fresh.costBase = Math.max(80, expectedRockCoinReward(fresh));
  stateRef.current = fresh;

  setUi(u => ({
    ...u,
    gold: fresh.gold,
    spawnCost: fresh.spawnCost,
    dpsMult: fresh.dpsMult,
    goldMult: fresh.goldMult,
  }));

  setAdCooldownUntil(0);
  setGiftReadyFlag(false);
  setShowCollect(false);
  setShowAdModal(false);
  setShowDiamondInfo(false);
  setShowResetConfirm(false);

  setShowIntro(true);
  setGamePaused(true);
  await exitFullscreenIfAny();

  save();
}
// === END PART 6 ===



// === START PART 7 ===
// ===== Diamonds chest (3×💎 to claim when you choose) =====
function grantDiamondPrize(s, key) {
  const base = Math.max(20, expectedGiftCoinReward(s));
  if (key === "coins_x10")   { const g = base * 10;   s.gold += Math.round(g); setGiftToastWithTTL(`💎 +${formatShort(g)} coins`); }
  else if (key === "coins_x100") { const g = base * 100; s.gold += Math.round(g); setGiftToastWithTTL(`💎 +${formatShort(g)} coins`); }
  else if (key === "coins_x1000"){ const g = base * 1000; s.gold += Math.round(g); setGiftToastWithTTL(`💎 +${formatShort(g)} coins`); }
  else if (key.startsWith("dog+")) {
    const delta = parseInt(key.split("+")[1] || "3", 10);
    const lvl = Math.max(1, (stateRef.current?.spawnLevel || 1) + delta);
    if (countMiners(s) < MAX_MINERS) {
      const placed = spawnMiner(s, lvl);
      if (placed) {
        setGiftToastWithTTL(`💎 Dog (LV ${lvl})`);
        // אתחול טיימר מתנות רק כשבאמת הונח
        s.giftReady  = false;
        s.giftNextAt = Date.now() + currentGiftIntervalSec(s) * 1000;
      }
    } else {
      // אין מקום כרגע ⇒ נניח אוטומטית כשיתפנה
      s.pendingDiamondDogLevel = lvl;
      setGiftToastWithTTL(`💎 Dog (LV ${lvl}) pending — free a slot`);
    }
  }
  setUi(u => ({ ...u, gold: s.gold }));
}
function openDiamondChestIfReady() {
  const s = stateRef.current; if (!s) return;
  if ((s.diamonds || 0) < 3) return;
  const prize = s.nextDiamondPrize || rollDiamondPrize();
  s.diamonds -= 3;
  grantDiamondPrize(s, prize);
  s.nextDiamondPrize = rollDiamondPrize();
  save();
}

// HUD computed values + Gift heartbeat + EARN cooldown

// לטובת טסטים מקומיים אפשר להגדיר window.DOG_INTERVAL_SEC; אחרת ברירת מחדל 1800s
const DOG_INTERVAL_SEC = (typeof window !== "undefined" && window.DOG_INTERVAL_SEC) || 600;
const DOG_BANK_CAP     = (typeof window !== "undefined" && window.DOG_BANK_CAP)     || 6;

const _currentGiftIntervalSec = typeof currentGiftIntervalSec==="function"?currentGiftIntervalSec:(s)=>Math.max(5,Math.floor(s?.lastGiftIntervalSec||20));
const _getPhaseInfo = typeof getPhaseInfo==="function"?getPhaseInfo:(s,now=Date.now())=>{ const sec=_currentGiftIntervalSec(s,now); return { index:0,into:0,remain:sec,intervalSec:sec }; };

// Phase label
const phaseNow = (() => {
  const s = stateRef.current; 
  if (!s) return { index:0, intervalSec:20, remain:20 };
  return _getPhaseInfo(s, Date.now());
})();
const phaseLabel = `⏳ ${phaseNow.intervalSec}s gifts`;

// progress rings — SINGLE definitions (בלי כפילויות)
const giftProgress = (() => { 
  const s = stateRef.current; if (!s) return 0; 
  if (s.giftReady) return 1; 
  const now = Date.now(); 
  const total = _currentGiftIntervalSec(s, now) * 1000; 
  const remain = Math.max(0, (s.giftNextAt || now) - now); 
  return Math.max(0, Math.min(1, 1 - remain / total)); 
})();

const dogProgress = (() => { 
  const s = stateRef.current; if (!s) return 0; 
  if ((s.autoDogBank || 0) >= DOG_BANK_CAP) return 1; 
  const now = Date.now(); 
  const total = DOG_INTERVAL_SEC * 1000; 
  const last = s.autoDogLastAt || now; 
  const elapsed = Math.max(0, now - last); 
  return Math.max(0, Math.min(1, elapsed / total)); 
})();

// READY flag for diamond chest glow/OPEN
const diamondsReady = (stateRef.current?.diamonds || 0) >= 3;


// טבעת — שכבת conic עם מסכה שמחוררת את המרכז (בלי רקע שחור)
function ringBg(progress){
  const p   = Math.max(0, Math.min(1, Number(progress) || 0));
  const deg = Math.round(360 * p);
  return {
    background: `conic-gradient(#facc15 ${deg}deg, transparent 0)`,
    WebkitMask: "radial-gradient(transparent 12px, #000 13px)",
    mask:       "radial-gradient(transparent 12px, #000 13px)",
    borderRadius: "9999px",
    transition: "background 0.2s linear",
  };
}

// (אופציונלי במקומות אחרים)
function circleStyle(progress){
  const p   = Math.max(0, Math.min(1, Number(progress) || 0));
  const deg = Math.round(360 * p);
  return {
    backgroundImage: `conic-gradient(#facc15 ${deg}deg, transparent 0)`,
    backgroundColor: "transparent",
    transition: "background-image 0.2s linear",
  };
}

// ADD cooldown + onAdd
const sNow=stateRef.current;
const nowMs=Date.now();
const cooldownUntil=sNow?.adCooldownUntil||0;
const addRemainMs=mounted?Math.max(0,cooldownUntil-nowMs):Number.POSITIVE_INFINITY;
const addProgress=mounted?1-Math.min(1,addRemainMs/(10*60*1000)):0;
const addRemainLabel=(()=>{ 
  if(!mounted) return "…"; 
  if(addRemainMs<=0) return "READY"; 
  const m=Math.floor(addRemainMs/60000); 
  const s=Math.floor((addRemainMs%60000)/1000); 
  return `${m}:${String(s).padStart(2,"0")}`;
})();
const addDisabled=addRemainMs>0||adWatching;

function onAdd(){ 
  try{play?.(S_CLICK);}catch{} 
  const s=stateRef.current;if(!s) return; 
  const now=Date.now(); 
  if(now<(s.adCooldownUntil||0)){ 
    const remain=Math.ceil(((s.adCooldownUntil||0)-now)/1000); 
    const m=Math.floor(remain/60),sec=String(remain%60).padStart(2,"0"); 
    if(typeof setGiftToast==="function"){ 
      const id=Math.random().toString(36).slice(2); 
      setGiftToast({text:`Ad bonus in ${m}:${sec}`,id}); 
      setTimeout(()=>{setGiftToast(cur=>(cur&&cur.id===id?null:cur));},2000);
    } 
    return; 
  } 
  setAdVideoEnded(false); 
  setShowAdModal(true); 
}

// ===== HUD Info modal state & content =====
const [hudModal, setHudModal] = useState(null); // 'coins'|'dps'|'gold'|'spawn'|'gifts'|'giftRing'|'dogRing'
function getHudModalTitle(k){
  switch(k){
    case 'coins': return 'Coins';
    case 'dps': return 'DPS Multiplier';
    case 'gold': return 'Gold Multiplier';
    case 'spawn': return 'Dog Spawn Level';
    case 'gifts': return 'Gift Phases';
    case 'giftRing': return 'Gift Timer';
    case 'dogRing': return 'Auto-Dog';
    default: return 'Info';
  }
}
function getHudModalText(k){
  switch(k){
    case 'coins':
      return 'Your total coins. Breaking rocks adds coins; bonuses: 🎁 regular gift (10%), video ad (50%), and diamonds grant large multipliers.';
    case 'dps':
      return '🪓 DPS xN increases the rate rocks lose HP by 10% per upgrade.';
    case 'gold':
      return '🟡 GOLD xN increases the coins gained from each rock by 10% per upgrade.';
    case 'spawn':
      return '🐶 LV shows the dog level that appears on purchase/bonus. Increases automatically after 30 purchases.';
    case 'gifts':
      return '⏳ Interval between gifts. Each time the timer ends you get a gift: coins/dog/boosts/diamond.';
    case 'giftRing':
      return 'The ring around 🎁 shows progress to the next gift, based on the displayed timings.';
    case 'dogRing':
      return 'The ring around 🐶 shows progress toward an auto-dog. When the bank is full (up to 6), it will deploy when a slot is free.';
    default:
      return '';
  }
}


// prices & יכולת קנייה לשורת הפעולות (Part 9 משתמש בזה)
const spawnCostNow=sNow?.spawnCost??ui.spawnCost;
const dpsCostNow=(typeof _dpsCost==="function")?_dpsCost(sNow):160;
const goldCostNow=(typeof _goldCost==="function")?_goldCost(sNow):160;
const canBuyMiner=!!sNow&&sNow.gold>=spawnCostNow&&Object.keys(sNow.miners||{}).length<(typeof MAX_MINERS==="number"?MAX_MINERS:16);
const canBuyDps=!!sNow&&sNow.gold>=dpsCostNow;
const canBuyGold=!!sNow&&sNow.gold>=goldCostNow;
const price=(n)=>formatShort(n??0);
// === END PART 7 ===




// === START PART 8 ===
  // ——— iOS detection ———
  const [isIOS, setIsIOS] = useState(false);

  // מרחק HUD מהחלק העליון: iOS = רק ה-safe-area, Android = הרבה יותר
  const HUD_TOP_IOS_PX = 0;     // לא לרדת בכלל (מעבר ל-safe-area)
  const HUD_TOP_ANDROID_PX = 5; // באנדרואיד לרדת הרבה (כוונן לפי הצורך)

  // ——— Track fullscreen state (משמש רק לעיצוב) ———
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    try {
      const ua = navigator.userAgent || "";
      const isiOS =
        /iP(hone|ad|od)/.test(ua) ||
        ((/Macintosh/.test(ua) || /Mac OS X/.test(ua)) && "ontouchend" in document);
      setIsIOS(isiOS);
    } catch {}

    const onFS = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFS);
    onFS(); // init
    return () => document.removeEventListener("fullscreenchange", onFS);
  }, []);

  // ===== Render =====
  return (
    <Layout>
      <div
        ref={wrapRef}
        className="
          flex flex-col items-center justify-start
          bg-gray-900 text-white
          min-h-[100dvh] w-full relative overflow-hidden select-none
          pt-[calc(env(safe-area-inset-top)+8px)]
          pb-[calc(env(safe-area-inset-bottom)+24px)]
        "
        // במסך מלא: מבטלים padding כדי שהקאנבס יישב הכי גבוה וימלא את כל הגובה
        style={{
          paddingTop: isFullscreen ? 0 : undefined,
          paddingBottom: isFullscreen ? 0 : undefined,
        }}
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

        {/* Intro Overlay */}
        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-start pt-10 bg-black/80 z-[50] text-center p-6">
            <img src="/images/leo-intro.png" alt="Leo" width={160} height={160} className="mb-4 rounded-full" />
            <h1 className="text-3xl sm:text-4xl font-extrabold text-yellow-400 mb-2">⛏️ MLEO Miners</h1>

            <p className="text-sm sm:text-base text-gray-200 mb-6">Merge miners, break rocks, earn gold.</p>

          <div className="flex gap-3 flex-wrap justify-center">
<button
  onClick={async () => {
    try { play?.(S_CLICK); } catch {}
    const s = stateRef.current;
    if (s && !s.onceSpawned) { spawnMiner(s, 1); s.onceSpawned = true; save(); }

    setShowIntro(false);
    setGamePaused(false);
    try { await enterFullscreenAndLockMobile(); } catch {}

    setTimeout(() => {
      if (isConnected) {
        openAccountModal?.();
      } else {
        openConnectModal?.();
      }
    }, 0);
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
      try { await enterFullscreenAndLockMobile(); } catch {}
    }}
    className="px-5 py-3 font-bold rounded-lg text-base shadow bg-yellow-400 hover:bg-yellow-300 text-black"
  >
    PLAY
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
{/* === END PART 8 === */}


{/* === START PART 9 === */}
               {/* ADD Ad Modal */}
        {showAdModal && (
          <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 max-w-md w-full rounded-2xl p-5">
              <h2 className="text-xl font-extrabold mb-3">Watch to Earn</h2>

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
                    const base = Math.max(20, expectedGiftCoinReward(s));
                    const gain = Math.round(base * 0.50); // 50%
                    s.gold += gain; setUi(u => ({ ...u, gold: s.gold }));

                    const until = Date.now() + 10*60*1000; // 10m cooldown
                    s.adCooldownUntil = until;
                    setAdCooldownUntil(until);
                    try {
                      const raw = localStorage.getItem(LS_KEY);
                      const data = raw ? JSON.parse(raw) : {};
                      data.adCooldownUntil = until;
                      localStorage.setItem(LS_KEY, JSON.stringify(data));
                    } catch {}

                    setGiftToastWithTTL(`🎬 Ad Reward +${formatShort(gain)} coins`, 3000);
                    save();
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

        {/* ===== Canvas wrapper ===== */}
        <div
          id="miners-canvas-wrap"
          className="relative w-full border border-slate-700 rounded-2xl overflow-hidden mt-1"
          style={{
            maxWidth: isDesktop ? "1024px" : "680px",
            height: isDesktop
              ? undefined
              : (isFullscreen
                  ? "100vh"
                  : `calc(100svh - 65px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`),
            aspectRatio: isDesktop ? "4 / 3" : undefined,
          }}
        >
          <canvas id="miners-canvas" ref={canvasRef} className="w-full h-full block touch-none select-none" />

{/* ==== TOP HUD ==== */}
<div
  className="absolute left-1/2 -translate-x-1/2 z-[30] w-[calc(100%-16px)] max-w-[980px]"
  style={{
    top: `calc(env(safe-area-inset-top, 0px) + ${(isIOS ? HUD_TOP_IOS_PX : HUD_TOP_ANDROID_PX)}px)`
  }}
>
  <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-center mb-2">
    MLEO - MINERS
  </h1>
<div className="absolute top-2 right-2 z-[40]">
  <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
</div>


  <div className="flex gap-2 flex-wrap justify-center items-center text-sm">
    {/* Coins + ad ring (clickable info) */}
    <button
      onClick={()=>setHudModal('coins')}
      className="px-2 py-1 rounded-lg flex items-center gap-2 hover:bg-white/10"
      aria-label="Coins info"
    >
      <div className="relative w-8 h-8 rounded-full grid place-items-center" title={addRemainMs > 0 ? `Next ad in ${addRemainLabel}` : "Ad bonus ready"}>
        <div className="absolute inset-0 rounded-full" style={ringBg(addProgress)} />
        <img src={IMG_COIN} alt="coin" className="w-7 h-7" />
      </div>
      <b>{formatShort(stateRef.current?.gold ?? 0)}</b>
    </button>

    {/* DPS */}
    <button onClick={()=>setHudModal('dps')} className="px-2 py-1 rounded-lg hover:bg-white/10">
      🪓 x<b>{(stateRef.current?.dpsMult || 1).toFixed(2)}</b>
    </button>

    {/* GOLD */}
    <button onClick={()=>setHudModal('gold')} className="px-2 py-1 rounded-lg hover:bg-white/10">
      🟡 x<b>{(stateRef.current?.goldMult || 1).toFixed(2)}</b>
    </button>

    {/* Spawn LV */}
    <button onClick={()=>setHudModal('spawn')} className="px-2 py-1 rounded-lg hover:bg-white/10">
      🐶 LV <b>{stateRef.current?.spawnLevel || 1}</b>
    </button>

    {/* Diamonds (נשאר המודאל הייעודי) */}
    <button
      onClick={() => setShowDiamondInfo(true)}
      className="relative px-2 py-1 rounded-lg flex items-center gap-1 active:scale-95 transition hover:bg-white/10"
      aria-label="Diamond rewards info"
      title="Tap to open Diamond chest"
    >
      {diamondsReady && (
        <>
          <span
            className="pointer-events-none absolute -inset-2 rounded-xl"
            style={{
              animation: "glowPulse 3.2s infinite",
              background: "radial-gradient(circle, rgba(250,204,21,0.35) 0%, rgba(250,204,21,0.18) 35%, transparent 60%)"
            }}
          />
          <span
            className="pointer-events-none absolute -inset-[6px] rounded-2xl"
            style={{
              animation: "glowRing 3.2s infinite",
              border: "2px solid rgba(250,204,21,0.55)"
            }}
          />
        </>
      )}
      <span>💎</span>
      <b>{stateRef.current?.diamonds ?? 0}</b>
      <span className="opacity-80">/3</span>
    </button>

    {/* Phase label */}
    <button onClick={()=>setHudModal('gifts')} className="px-2 py-1 rounded-lg hover:bg-white/10">{`⏳ ${(_getPhaseInfo(stateRef.current, Date.now()).intervalSec)}s gifts`}</button>

    <div className="flex items-center gap-3 ml-2">
      {/* 🎁 ring */}
      <button
        onClick={()=>setHudModal('giftRing')}
        className="relative w-8 h-8 rounded-full grid place-items-center hover:opacity-90 active:scale-95 transition"
        title={`⏳ ${(_getPhaseInfo(stateRef.current, Date.now()).intervalSec)}s gifts`}
        aria-label="Gift timer info"
      >
        <div className="absolute inset-0 rounded-full" style={ringBg(giftProgress)} />
        <div className="text-[22px] font-extrabold leading-none">🎁</div>
      </button>

      {/* 🐶 ring */}
      <button
        onClick={()=>setHudModal('dogRing')}
        className="relative w-8 h-8 rounded-full grid place-items-center hover:opacity-90 active:scale-95 transition"
        title="Auto-dog every 15m (bank up to 6)"
        aria-label="Auto-dog info"
      >
        <div className="absolute inset-0 rounded-full" style={ringBg(dogProgress)} />
        <div className="text-[22px] font-extrabold leading-none">🐶</div>
      </button>
    </div>
  </div>

  {/* Actions row */}
  <div className="flex gap-2 mt-2 flex-wrap justify-center text-sm">
    <button
      onClick={addMiner}
      disabled={!canBuyMiner}
      className={`px-3 py-1.5 rounded-xl text-slate-900 font-bold transition
        ${canBuyMiner
          ? "bg-emerald-500 hover:bg-emerald-400 ring-2 ring-emerald-300"
          : "bg-emerald-500 opacity-60 cursor-not-allowed"}`}
    >
      + 🐶 Miner (LV {stateRef.current?.spawnLevel || 1}) — {formatShort(spawnCostNow)}
    </button>

    <button
      onClick={upgradeDps}
      disabled={!canBuyDps}
      className={`h-8 px-2.5 rounded-lg text-[13px] leading-none inline-flex items-center
        text-slate-900 font-bold transition
        ${canBuyDps
          ? "bg-sky-500 hover:bg-sky-400 ring-2 ring-sky-300"
          : "bg-sky-500 opacity-60 cursor-not-allowed"}`}
    >
      🪓 +10% (Cost {formatShort(dpsCostNow)})
    </button>

    <button
      onClick={upgradeGold}
      disabled={!canBuyGold}
      className={`px-3 py-1.5 rounded-xl text-slate-900 font-bold transition
        ${canBuyGold
          ? "bg-amber-400 hover:bg-amber-300 ring-2 ring-amber-300"
          : "bg-amber-400 opacity-60 cursor-not-allowed"}`}
    >
      🟡 +10% (Cost {formatShort(goldCostNow)})
    </button>

    <button
      onClick={onAdd}
      disabled={addDisabled}
      className={`px-3 py-1.5 rounded-xl text-slate-900 font-bold transition
        ${addDisabled
          ? "bg-indigo-400 opacity-60 cursor-not-allowed"
          : "bg-indigo-400 hover:bg-indigo-300 ring-2 ring-indigo-300"}`}
      title={addRemainMs > 0 ? `Ad bonus in ${addRemainLabel}` : "Watch ad to earn"}
    >
      GAIN {addRemainMs > 0 ? `(${addRemainLabel})` : ""}
    </button>

    <button
      onClick={() => setShowResetConfirm(true)}
      className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold transition ring-2 ring-rose-300"
      title="Reset all progress"
    >
      RESET
    </button>
  </div>
</div>
{/* === END PART 9 === */}



{/* === START PART 10 === */}
         {/* Toast קטן (אופציונלי) */}
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

          {/* פופאפ מרכזי – בלי OK, נעלם אוטומטית */}
          {centerPopup && (
            <div className="absolute inset-0 z-[10001] flex items-center justify-center pointer-events-none">
              <div className="pointer-events-auto px-6 py-4 rounded-2xl font-extrabold text-black shadow-2xl bg-gradient-to-br from-yellow-300 to-amber-400 border border-yellow-200 text-center animate-[popfade_1.8s_ease-out_forwards]">
                <div className="text-lg">{centerPopup.text}</div>
              </div>
              <style jsx global>{`
                @keyframes popfade {
                  0% { opacity: 0; transform: translateY(6px) scale(0.96); }
                  15% { opacity: 1; transform: translateY(0) scale(1); }
                  75% { opacity: 1; }
                  100% { opacity: 0; transform: translateY(-6px) scale(0.98); }
                }
              `}</style>
            </div>
          )}

          {/* Center Gift Button */}
          {!showIntro && !gamePaused && !showCollect && (stateRef.current?.giftReady) && (
            <div className="absolute inset-0 z-[8] flex items-center justify-center pointer-events-none">
              <button
                onClick={grantGift}
                className="pointer-events-auto px-5 py-3 rounded-2xl font-extrabold text-black shadow-2xl bg-gradient-to-br from-yellow-300 to-amber-400 border border-yellow-200 hover:from-yellow-200 hover:to-amber-300 active:scale-95 relative"
              >
                🎁 Claim Gift
                <span className="absolute -inset-2 rounded-3xl blur-3xl bg-yellow-400/30 -z-10" />
              </button>
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
                <b className="text-yellow-300">{formatShort(stateRef.current?.pendingOfflineGold || 0)}</b>{" "}
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

        {/* Reset confirm */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 max-w-md w-full rounded-2xl p-6 shadow-2xl">
              <h2 className="text-2xl font-extrabold mb-2">Reset Progress?</h2>
              <p className="text-sm text-slate-700 mb-4">
                This will permanently delete your save and send you back to the start.
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
{showHowTo && (
  <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
    <div className="bg-white text-slate-900 max-w-md w-full rounded-2xl p-6 shadow-2xl">
      <h2 className="text-2xl font-extrabold mb-2">How to Play</h2>
      <ol className="list-decimal ml-5 text-sm text-slate-700 space-y-2 mb-4">
        <li>Tap <b>ADD</b> on an empty slot to place a dog (cost shown on the button).</li>
        <li>Drag two dogs of the same level together to merge and level up.</li>
        <li>Dogs deal DPS to rocks. When a rock breaks — you earn coins.</li>
        <li>Use coins to buy more dogs or upgrade <b>DPS</b> and <b>GOLD</b> multipliers.</li>
        <li>🎁 Gifts arrive on a global timer. Claim them for bonuses.</li>
        <li>🐶 Auto-dog fills a small bank over time and deploys when there’s a free slot.</li>
      </ol>
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setShowHowTo(false)}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}


        {/* Diamond Rewards Modal */}
        {showDiamondInfo && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 px-4">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/20 shadow-2xl max-w-sm w-[92%] sm:w-[420px] text-left overflow-auto max-h-[85vh]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">💎</span>
                  <h3 className="text-lg font-extrabold text-white">Diamond Chest</h3>
                </div>
                <button
                  onClick={() => setShowDiamondInfo(false)}
                  className="px-2 py-1 bg-yellow-400 text-black font-bold rounded-lg text-xs"
                >
                  Close
                </button>
              </div>

              <p className="text-gray-200 mb-2 text-sm">
                Diamonds: <b className="text-yellow-300">{stateRef.current?.diamonds ?? 0}</b>
              </p>

              <div className="rounded-lg p-3 bg-white/5 border border-white/10 mb-3 text-sm">
                <div className="text-gray-100 mb-1 font-semibold">Next reward:</div>
                <div className="text-gray-100">
                  {DIAMOND_PRIZES.find(p => p.key === (stateRef.current?.nextDiamondPrize))?.label || "Mystery reward"}
                </div>
              </div>

              <ul className="space-y-1 mb-4 text-sm">
                {DIAMOND_PRIZES.map(p => {
                  const isNext = (stateRef.current?.nextDiamondPrize === p.key);
                  return (
                    <li
                      key={p.key}
                      className={`flex items-center justify-between rounded-lg px-2 py-1
                        ${isNext ? "bg-yellow-400/15 border border-yellow-400/60" : "bg-white/5 border border-white/10"}`}
                    >
                      <span className="text-gray-100">{p.label}</span>
                      {isNext && <span className="text-[10px] font-extrabold text-yellow-300">NEXT</span>}
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-center justify-between">
                <p className="text-gray-300 text-xs">Open when you have 3💎.</p>
                <button
                  onClick={() => { openDiamondChestIfReady(); }}
                  disabled={(stateRef.current?.diamonds || 0) < 3}
                  className={`px-3 py-1.5 rounded-lg font-extrabold text-xs ${
                    (stateRef.current?.diamonds || 0) >= 3
                      ? "bg-yellow-400 hover:bg-yellow-300 text-black"
                      : "bg-slate-400 text-slate-800 opacity-60 cursor-not-allowed"
                  }`}
                >
                  OPEN (3💎)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HUD Info Modal (כל פריטי ה-HUD חוץ מהיהלום) */}
        {hudModal && (
          <div className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 max-w-md w-full rounded-2xl p-5 shadow-2xl">
              <h2 className="text-xl font-extrabold mb-2">{getHudModalTitle(hudModal)}</h2>
              <p className="text-sm text-slate-700 mb-4">{getHudModalText(hudModal)}</p>
              <div className="flex justify-end">
                <button
                  onClick={()=>setHudModal(null)}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {!showIntro && (
          <button
            onClick={async () => { setShowIntro(true); setGamePaused(true); try { await exitFullscreenIfAny(); } catch {} }}
            className="fixed top-3 right-3 px-4 py-2 bg-yellow-400 text-black font-bold rounded-lg text-sm z-[999]"
          >
            Exit
          </button>
        )}
      </div>
    </Layout>
  );
} 
// === END PART 10 ===
