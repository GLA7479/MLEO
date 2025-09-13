// === START PART 1 ===

// pages/mleo-miners.js
// v5.9-patches
import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import { useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect } from "wagmi";
import { useRouter } from "next/router";


// --- iOS 100vh fix (sets --app-100vh = window.innerHeight) ---
// --- iOS 100vh fix (sets --app-100vh = visual viewport height) ---
function useIOSViewportFix() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;

    const setVH = () => {
      const h = vv ? vv.height : window.innerHeight;
      root.style.setProperty("--app-100vh", `${Math.round(h)}px`);
    };

    // init + “התייצבות” אחרי שינוי אוריינטציה
    const onOrient = () => requestAnimationFrame(() => setTimeout(setVH, 250));

    setVH();
    if (vv) {
      vv.addEventListener("resize", setVH);
      vv.addEventListener("scroll", setVH); // URL bar collapse/expand
    }
    window.addEventListener("orientationchange", onOrient);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", setVH);
        vv.removeEventListener("scroll", setVH);
      }
      window.removeEventListener("orientationchange", onOrient);
    };
  }, []);
}



// ====== Config ======
const LANES = 4;
const SLOTS_PER_LANE = 4;
const MAX_MINERS = LANES * SLOTS_PER_LANE;
const PADDING = 6;
const LS_KEY = "mleoMiners_v5_83_reset5";
// First–play terms acceptance gate (global versioned)
const TERMS_VERSION = "v1.4"; // ⬅️ bump to force re-accept if text changes
const TERMS_KEY = `mleoMiners_termsAccepted_${TERMS_VERSION}`;

// Assets
const IMG_BG    = "/images/bg-cave.png";
const IMG_MINER = "/images/leo-miner-4x.png";
const IMG_ROCK  = "/images/rock.png";
const IMG_COIN  = "/images/silver.png";
const IMG_TOKEN = "/images/coin3.png";
const IMG_SPAWN_ICON = "/images/coin4.png";

// SFX
const S_CLICK = "/sounds/click.mp3";
const S_MERGE = "/sounds/merge.mp3";
const S_ROCK  = "/sounds/rock.mp3";
const S_GIFT  = "/sounds/gift.mp3";

// ===== Debug helpers =====
 const DEBUG_LS = "MLEO_DEBUG_UI";
 const DEBUG_HOSTS = ["localhost","127.0.0.1","0.0.0.0"];
 function getDebugFlag(){
   try { return localStorage.getItem(DEBUG_LS) === "1"; } catch { return false; }
 }
 function setDebugFlag(on){
   try { if(on) localStorage.setItem(DEBUG_LS,"1"); else localStorage.removeItem(DEBUG_LS); } catch {}
 }
 function isLocalHost(){
   try { return DEBUG_HOSTS.includes(location.hostname); } catch { return false; }
 }
 try {
   if (typeof window !== "undefined") {
     const z = localStorage.getItem("SPAWN_ICON_ZOOM");
     const y = localStorage.getItem("SPAWN_ICON_SHIFT_Y");
     if (z) window.SPAWN_ICON_ZOOM = parseFloat(z);
     if (y) window.SPAWN_ICON_SHIFT_Y = parseInt(y,10);
   }
 } catch {}
 

// ===== UI constants =====
const UI_BTN_H_PX = 48;         // גובה
// show/hide floating RESET button (bottom-left on canvas)
const SHOW_FLOATING_RESET = true; // ← שנה ל-false כדי להסתיר במהירות
const UI_BTN_MIN_W_PX = 150;    // רוחב מינימלי לכל כפתור (התאם מספר)
const UI_SPAWN_ICON_BOX = Math.round(UI_BTN_H_PX * 0.5);
const UI_SPAWN_ICON_ZOOM =
  (typeof window !== "undefined" && window.SPAWN_ICON_ZOOM) || 1.55;
const UI_SPAWN_ICON_SHIFT_Y =
  (typeof window !== "undefined" && window.SPAWN_ICON_SHIFT_Y) || 0;

// ==== ACTION BUTTON fixed size (ADD / DPS / GOLD) ====
const UI_ACTION_BTN_W_PX = 220; // רוחב אחיד לכל שלושת הכפתורים
const UI_ACTION_BTN_H_PX = 64;  // גובה מעט גבוה כדי להכיל 2 שורות טקסט

// מחלקות Tailwind (ערכים שרירותיים) מתוך הקבועים למעלה
const BTN_W_FIX = `w-[${UI_ACTION_BTN_W_PX}px]`;
const BTN_H_FIX = `h-[${UI_ACTION_BTN_H_PX}px]`;


// Balance
const BASE_DPS = 2;
const LEVEL_DPS_MUL = 1.9;
const ROCK_BASE_HP = 60;
const ROCK_HP_MUL = 2.15;
const GOLD_FACTOR = 0.12;

// ===== Global gift phases (same for everyone) =====
const GIFT_PHASES = [
  { durSec: 30 * 60, intervalSec: 20 },
  { durSec: 30 * 60, intervalSec: 30 },
  { durSec: 30 * 60, intervalSec: 40 },
  { durSec: 30 * 60, intervalSec: 50 },
  { durSec: 60 * 60, intervalSec: 60 },
];
const GIFT_TOTAL_SEC = GIFT_PHASES.reduce((a, p) => a + p.durSec, 0);
const GLOBAL_ANCHOR_MS = Date.UTC(2025, 0, 1, 0, 0, 0); // 2025-01-01 00:00:00Z

function phaseAtGlobal(nowMs = Date.now()) {
  const cyc = Math.floor((nowMs - GLOBAL_ANCHOR_MS) / 1000);
  const mod = ((cyc % GIFT_TOTAL_SEC) + GIFT_TOTAL_SEC) % GIFT_TOTAL_SEC;
  let acc = 0;
  for (let i = 0; i < GIFT_PHASES.length; i++) {
    const ph = GIFT_PHASES[i];
    if (mod < acc + ph.durSec) {
      const into = mod - acc;
      const step = ph.intervalSec;
      const remainToNextGiftSec = step - (into % step || step);
      return { index:i, intervalSec: step, into, phaseRemainSec: ph.durSec - into, remainToNextGiftSec };
    }
    acc += ph.durSec;
  }
  const last = GIFT_PHASES[GIFT_PHASES.length - 1];
  return { index: GIFT_PHASES.length - 1, intervalSec: last.intervalSec, into: 0, phaseRemainSec: last.durSec, remainToNextGiftSec: last.intervalSec };
}

// === Gift timing helpers (global-cycle based) ===
function getPhaseInfo(s, now = Date.now()) {
  const ph = phaseAtGlobal(now);
  return {
    index: ph.index,
    into: ph.into,
    remain: ph.remainToNextGiftSec,
    intervalSec: ph.intervalSec,
    phaseRemainSec: ph.phaseRemainSec,
  };
}

// Vault display — זהה ל־MLEO button (2 ספרות + קיצור באותיות)
function formatMleoVault(n) {
  return formatMleoShort(n);
}



function currentGiftIntervalSec(s, now = Date.now()) {
  const ph = phaseAtGlobal(now);
  if (s) s.lastGiftIntervalSec = ph.intervalSec; // לשמירה לשכבת ה־HUD בלבד
  return ph.intervalSec;
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

// בסיס קיצורים (אלפים עד טריליון)
const SUFFIXES_BASE = ["", "K", "M", "B", "T"];


// קיצור עם ספרה אחת אחרי הנקודה (חיתוך, לא עיגול) — לשימוש HUD/כפתורים בלבד
function formatAbbrevInt1(n) {
  const sign = (n || 0) < 0 ? "-" : "";
  const abs  = Math.abs(Number(n) || 0);
  const p = 10; // ספרה אחת
  if (abs < 1000) {
    const t = Math.trunc(abs * p) / p;
    return sign + t.toFixed(1);
  }
  let tier = Math.floor(Math.log10(abs) / 3);
  let div  = Math.pow(1000, tier);
  let val  = abs / div;
  let trimmed = Math.trunc(val * p) / p;
  if (trimmed >= 1000) { tier += 1; trimmed = 1; }
  return sign + trimmed.toFixed(1) + suffixFromTier(tier);
}
const formatShort1 = formatAbbrevInt1;     // מטבעות/עלויות ב-HUD
function formatMleoShort1(n){ return formatAbbrevInt1(n); } // MLEO ב-HUD


// ממפה דרגת אלפים לסיומת: 0→"" , 1→K, 2→M, 3→B, 4→T, 5→AA, 6→AB, ... עד אינסוף
function suffixFromTier(tier) {
  if (tier < SUFFIXES_BASE.length) return SUFFIXES_BASE[tier];
  const idx = tier - SUFFIXES_BASE.length; // 0→AA, 1→AB ...
  // ממיר למחרוזת אותיות בסגנון גיליון (A..Z, AA..), ומבריח ל-2+ אותיות
  let n = idx + 26; // 26→"AA"
  let s = "";
  while (n >= 0) {
    const q = Math.floor(n / 26) - 1;
    const r = n - (q + 1) * 26;
    s = String.fromCharCode(65 + r) + s;
    n = q;
  }
  if (s.length === 1) s = "A" + s; // הבטח מינימום 2 תווים
  return s;
}

// קיצור מספרים כללי עם 2 ספרות אחרי הנקודה (חיתוך, לא עיגול)
function formatAbbrevInt(n) {
  const sign = (n || 0) < 0 ? "-" : "";
  const abs  = Math.abs(Number(n) || 0);
  const p = 100; // 2 ספרות

  if (abs < 1000) {
    const t = Math.trunc(abs * p) / p;
    return sign + t.toFixed(2);
  }

  let tier = Math.floor(Math.log10(abs) / 3); // 1=K, 2=M...
  let div  = Math.pow(1000, tier);
  let val  = abs / div;

  // חיתוך ל-2 ספרות
  let trimmed = Math.trunc(val * p) / p;

  // נרמול קצה: 1000.00 → קפיצה לדרגה הבאה
  if (trimmed >= 1000) {
    tier += 1;
    trimmed = 1;
  }

  return sign + trimmed.toFixed(2) + suffixFromTier(tier);
}


// שמירה על השם הקיים בקוד
const formatShort = formatAbbrevInt;

// MLEO — 3 ספרות אחרי הנקודה בכל טווח (בלי קיצור), חיתוך לא עיגול
function formatMleo(n) {
  const num = Number(n || 0);
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  const p = 1000; // 3 ספרות
  const t = Math.trunc(abs * p) / p;
  return sign + t.toFixed(3);
}

// --- helper: shorten wallet address for UI ---
function shortAddr(a) {
  if (!a) return "";
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}


// MLEO קצר — קיצור עם 2 ספרות (ל-HUD/טוסטים/פופאפים)
function formatMleoShort(n) {
  return formatAbbrevInt(n);
}

// MLEO — 2 ספרות אחרי הנקודה (חיתוך, לא עיגול)
function formatMleo2(n) {
  const num = Number(n || 0);
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  const p = 100; // 2 ספרות
  const t = Math.trunc(abs * p) / p;
  return sign + t.toFixed(2);
}

// === OFFLINE SESSION CLOCK (12h per session) ===
const OFFLINE_SESSION_MAX_HOURS = 12;
const OFFLINE_SESSION_MAX_MS = OFFLINE_SESSION_MAX_HOURS * 3600000;

// Tiers (per session cumulated time)
const OFFLINE_EFF_TIERS_SESSION = [
  { upToHours: 2,  eff: 0.50 },
  { upToHours: 6,  eff: 0.30 },
  { upToHours: 12, eff: 0.10 },
]; // >12h => 0

function offlineSessionEffAt(consumedMs) {
  const h = consumedMs / 3600000;
  if (h < 2)  return 0.50;
  if (h < 6)  return 0.30;
  if (h < 12) return 0.10;
  return 0;
}
function getOfflineSessionLeftMs(s) {
  const used = Math.max(0, s.offlineConsumedMsInSession || 0);
  return Math.max(0, OFFLINE_SESSION_MAX_MS - used);
}
function ensureOfflineSessionStart(s, now = Date.now()) {
  if (!s.offlineSessionStartAt) s.offlineSessionStartAt = now;
}
function resetOfflineSession(s) {
  s.offlineSessionStartAt = null;
  s.offlineConsumedMsInSession = 0;
}
/** Consume elapsedMs from current session by tiered efficiency.
 * Returns { consumedMs, effectiveMs } and updates s.offlineConsumedMsInSession. */
function takeFromOfflineSession(s, elapsedMs) {
  if (!elapsedMs || elapsedMs <= 0) return { consumedMs: 0, effectiveMs: 0 };
  const left = getOfflineSessionLeftMs(s);
  if (left <= 0) return { consumedMs: 0, effectiveMs: 0 };

  let toConsume = Math.min(left, elapsedMs);
  let effectiveMs = 0, consumed = 0;
  let usedSoFar   = s.offlineConsumedMsInSession || 0;

  while (toConsume > 0) {
    const eff = offlineSessionEffAt(usedSoFar);
    if (eff <= 0) break;

    let tierEndMs;
    const h = usedSoFar / 3600000;
    if (h < 2)       tierEndMs = 2  * 3600000;
    else if (h < 6)  tierEndMs = 6  * 3600000;
    else if (h < 12) tierEndMs = 12 * 3600000;
    else break;

    const roomInTier = Math.max(0, tierEndMs - usedSoFar);
    const chunk = Math.min(toConsume, roomInTier);

    effectiveMs += chunk * eff;
    consumed    += chunk;
    usedSoFar   += chunk;
    toConsume   -= chunk;
  }

  s.offlineConsumedMsInSession = usedSoFar;
  return { consumedMs: consumed, effectiveMs };
}




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
const MINING_LS_KEY = "mleoMiningEconomy_v2.1";

// —— Token & schedule (editable) ——
const PRESALE_START_MS = null;               
const PRESALE_DURATION_DAYS = 0;             
const TGE_MS = null;                          

const TOKEN_LIVE = false; // דמו: כבוי. הפוך ל-true רק כשהחוזה וה-ABI מחוברים

// Claim unlock schedule (מצטבר): חודש 1=10%, 2=30%, 3=50%, 4=70%, 5=90%, 6+=100%
const CLAIM_SCHEDULE = [
  { monthFromTGE: 1, pct: 0.10 },
  { monthFromTGE: 2, pct: 0.30 },
  { monthFromTGE: 3, pct: 0.50 },
  { monthFromTGE: 4, pct: 0.70 },
  { monthFromTGE: 5, pct: 0.90 },
  { monthFromTGE: 6, pct: 1.00 },
];

// —— Conversion & daily limit (editable) ——
const MLEO_FROM_COINS_PCT = 0; // legacy disabled – now we use per-break engine



const SOFTCUT = [
  { upto: 0.80, factor: 1.00 },
  { upto: 1.00, factor: 0.50 },
  { upto: 1.20, factor: 0.25 },
  { upto: 9.99, factor: 0.10 },
];

const OFFLINE_DPS_FACTOR = 0.5;
const IDLE_OFFLINE_MS = 5 * 60 * 1000; // 5 minutes without claiming gift => idle-offli

const TOTAL_SUPPLY = 100_000_000_000; // 100B
const DAYS = 1825;                     // 5y
const DAILY_EMISSION = Math.floor(TOTAL_SUPPLY / DAYS);
const DAILY_CAP = Math.floor(DAILY_EMISSION * 0.02);


// ——— State I/O ———
function getTodayKey(){ return new Date().toISOString().slice(0,10); }
function loadMiningState(){
  try {
    const raw = localStorage.getItem(MINING_LS_KEY);
    if (raw) {
      const st = JSON.parse(raw);
      st.claimedTotal = st.claimedTotal || 0;
      st.history = Array.isArray(st.history) ? st.history : [];
      st.vault = st.vault || 0;
      st.claimedToWallet = st.claimedToWallet || 0; // מצטבר ל־Wallet
      return st;
    }
  } catch {}
  return { balance:0, minedToday:0, lastDay:getTodayKey(), scoreToday:0, claimedTotal:0, history:[], vault:0, claimedToWallet:0 };
}
function saveMiningState(st){
  try { localStorage.setItem(MINING_LS_KEY, JSON.stringify(st)); } catch {}
}

// ——— Terms helpers ———
function isTermsAccepted() {
  try { return localStorage.getItem(TERMS_KEY) === "yes"; } catch { return false; }
}
function acceptTerms() {
  try { localStorage.setItem(TERMS_KEY, "yes"); } catch {}
}

// ——— Softcut helpers ———
function softcutFactor(minedToday, dailyCap){
  const used = dailyCap>0 ? minedToday / dailyCap : 0;
  for (const seg of SOFTCUT){
    if (used <= seg.upto) return seg.factor;
  }
  return 0.10;
}


// === MLEO Accrual Engine (inline) ===
// נטען טבלת multipliers לפי הקובץ שהעברת (mleo-multipliers.json)
const MLEO_ENGINE_LS_KEY = "MLEO_ENGINE_V1";
const MLEO_TABLE = {
  v1: 0.5,
  blocks: [
    { start: 1,   end: 10,   r: 1.6  },
    { start: 11,  end: 20,   r: 1.4  },
    { start: 21,  end: 30,   r: 1.3  },
    { start: 31,  end: 40,   r: 1.1  },
    { start: 41,  end: 50,   r: 1.05 },
    { start: 51,  end: 100,  r: 1.001 },
    { start: 101, end: 150,  r: 1.001 },
    { start: 151, end: 200,  r: 1.001 },
    { start: 201, end: 250,  r: 1.001 },
    { start: 251, end: 300,  r: 1.001 },
    { start: 301, end: 350,  r: 1.001 },
    { start: 351, end: 400,  r: 1.001 },
    { start: 401, end: 450,  r: 1.001 },
    { start: 451, end: 500,  r: 1.001 },
    { start: 501, end: 550,  r: 1.001 },
    { start: 551, end: 600,  r: 1.001 },
    { start: 601, end: 650,  r: 1.001 },
    { start: 651, end: 700,  r: 1.001 },
    { start: 701, end: 750,  r: 1.001 },
    { start: 751, end: 800,  r: 1.001 },
    { start: 801, end: 850,  r: 1.001 },
    { start: 851, end: 900,  r: 1.001 },
    { start: 901, end: 950,  r: 1.001 },
    { start: 951, end: 1000, r: 1.001 },
  ],
};

// === STAGE-BASED MLEO (per-rock stage; no global break counter) ===
// stage 1 → v1
// stage 2 → v1 * r(1)
// stage n → v1 * Π_{i=1}^{n-1} r(i)   (r(i) נקבע לפי הבלוק בטבלה)
const MLEO_STAGE_CACHE = { 1: MLEO_TABLE.v1 || 0.5 };

function mleoBaseForStage(stage) {
  const s = Math.max(1, Math.floor(stage || 1));
  if (MLEO_STAGE_CACHE[s] != null) return MLEO_STAGE_CACHE[s];
  const prev = mleoBaseForStage(s - 1);
  const r    = engineRForStage(s - 1);        // הריישו של השלב הקודם
  const val  = r6(prev * r);                   // חיתוך/עיגול קטן ליציבות
  MLEO_STAGE_CACHE[s] = val;
  return val;
}

function rockStageNow(rock) {
  return ((rock?.idx ?? 0) + 1);               // idx מתחיל מ-0 ⇒ שלב = idx+1
}


// כמה שבירות יש בכל "שלב" של MLEO לפני שמתקדמים לשלב הבא
const BREAKS_PER_STAGE = 10;

const r6 = (x) => Math.round((x + Number.EPSILON) * 1e6) / 1e6;
function engineLoad(){
  try { const raw = localStorage.getItem(MLEO_ENGINE_LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function engineSave(st){
  try { localStorage.setItem(MLEO_ENGINE_LS_KEY, JSON.stringify(st)); } catch {}
}
function engineDefault(){
  return { breakCount: 0, currentStage: 1, currentPerBreakValue: MLEO_TABLE.v1 || 0.5 };
}
function engineInitOnce(){
  const s = engineLoad();
  if (!s) engineSave(engineDefault());
}
function engineHardReset(){
  // Hard reset for per-break MLEO engine (breakCount/stage/perBreakValue)
  try { localStorage.removeItem(MLEO_ENGINE_LS_KEY); } catch {}
  // Re-seed with defaults so next award starts from baseline (v1=0.5)
  engineSave(engineDefault());
}
function engineRForStage(stage){
  const b = (MLEO_TABLE.blocks || []).find(b => stage >= b.start && stage <= b.end);
  return b ? (b.r || 1) : 1.001;
}
/** מעניק MLEO עבור שבירה אחת – ומקדם את ה־stage וה־perBreak לפעם הבאה. מחזיר את ה־MLEO הגולמי (לפני softcut/cap). */
function engineAwardOnce(){
  const s = engineLoad() || engineDefault();
  const award = Number(s.currentPerBreakValue || (MLEO_TABLE.v1 || 0.5));

  // מגדילים מונה שבירות כולל
  s.breakCount = (s.breakCount || 0) + 1;

  // מתקדמים שלב *רק אחרי* שסיימנו שלב מלא (ברירת מחדל: 10 שבירות)
  const stageNow = s.currentStage || 1;
  if ((s.breakCount % BREAKS_PER_STAGE) === 0) {
    // מכפלה עבור השלב שזה עתה הסתיים → ערך הבסיס לשלב הבא
    const r = engineRForStage(stageNow);
    s.currentPerBreakValue = r6(s.currentPerBreakValue * r);
    s.currentStage = Math.min(1000, stageNow + 1);
  }

  engineSave(s);
  return award;
}
// אתחול חד-פעמי כשהמסך נטען
if (typeof window !== "undefined") { try { engineInitOnce(); } catch {} }

// === REPLACE: previewMleoFromCoins / addPlayerScorePoints / finalizeDailyRewardOncePerTick ===
const PREC = 2;
const round3 = (x) => Number((x || 0).toFixed(PREC));

function previewMleoFromCoins(coins){
  if (!coins || coins<=0) return 0;
  const st = loadMiningState();
  const base   = (coins * MLEO_FROM_COINS_PCT);
  const factor = softcutFactor(st.minedToday||0, DAILY_CAP);
  let eff = base * factor;
  const room = Math.max(0, (DAILY_CAP - (st.minedToday||0)));
  eff = Math.min(eff, room);
  return round3(eff);
}

function addPlayerScorePoints(_s, amount, isEngineBase = false){
  if(!amount || amount<=0) return 0;

  const st = loadMiningState();
  const today = getTodayKey();
  if(st.lastDay!==today){ st.minedToday=0; st.scoreToday=0; st.lastDay=today; }

  // אם מגיעים מהמנוע – amount הוא הבסיס הגולמי לשבירה אחת.
  // אם לא, זה המודל הישן (Coins→MLEO) – מכובה כבר (MLEO_FROM_COINS_PCT=0).
  const baseMleo = isEngineBase ? Number(amount) : (Number(amount) * MLEO_FROM_COINS_PCT);

  const factor = softcutFactor(st.minedToday||0, DAILY_CAP);
  let eff = baseMleo * factor;

  // הגבלת DAILY_CAP
  const room = Math.max(0, DAILY_CAP - (st.minedToday||0));
  eff = Math.min(eff, room);

  eff = Number(eff.toFixed(2));

  st.minedToday = Number(((st.minedToday||0) + eff).toFixed(2));
  st.balance    = Number(((st.balance||0)    + eff).toFixed(2));
  saveMiningState(st);

  return eff; // מחזיר כמה באמת נכנס כדי להציג ב־POP
}


function finalizeDailyRewardOncePerTick(){
  const st = loadMiningState();
  const today = getTodayKey();
  if(st.lastDay!==today) return;
  if((st.minedToday||0) > DAILY_CAP) {
    const diff = round3((st.minedToday||0) - DAILY_CAP);
    st.minedToday = round3(DAILY_CAP);
    st.balance    = round3(Math.max(0, (st.balance||0) - diff));
    saveMiningState(st);
  }
}



// ——— Claim schedule logic ———
function monthsSinceTGE(now=Date.now()){
  if (!TGE_MS) return null;
  if (now < TGE_MS) return -1;
  const diff = now - TGE_MS;
  return Math.floor(diff / (30*24*60*60*1000)); // חודש=30 יום
}
function currentClaimPct(now=Date.now()){
  const m = monthsSinceTGE(now);
  if (m===null || m<0) return 0;
  let pct = 0;
  for (const step of CLAIM_SCHEDULE){
    if (m >= step.monthFromTGE) pct = Math.max(pct, step.pct);
  }
  return pct;
}
function walletClaimEnabled(now=Date.now()){
  const m = monthsSinceTGE(now);
  return TOKEN_LIVE && m!==null && m>=1; // מותר מחודש אחרי TGE
}
function remainingWalletClaimRoom(){
  const st = loadMiningState();
  const totalAccrued = (st.claimedTotal||0) + (st.vault||0) + (st.balance||0);
  const pct = currentClaimPct();
  const maxCumulative = Math.floor(totalAccrued * pct);
  const already = st.claimedToWallet || 0;
  return Math.max(0, maxCumulative - already);
}

// === helper components: TGE countdown + release bar ===

function TgeCountdown() {
  const [ts, setTs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!TGE_MS) return <div className="text-xs">TGE date not set.</div>;

  const remain = Math.max(0, TGE_MS - ts);
  if (remain === 0) return <div className="text-xs">TGE has started.</div>;

  const d = Math.floor(remain / (24*3600*1000));
  const h = Math.floor((remain % (24*3600*1000)) / (3600*1000));
  const m = Math.floor((remain % (3600*1000)) / (60*1000));
  const s = Math.floor((remain % (60*1000)) / 1000);
  return <div className="text-sm">{d}d {h}h {m}m {s}s</div>;
}

function WalletReleaseBar() {
  const pct = Math.round(currentClaimPct(Date.now()) * 100);
  return (
    <div className="w-full h-2 bg-white/60 rounded overflow-hidden mb-1">
      <div className="h-2 bg-amber-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

// === END PART 1 ===


// === START PART 2 ===

export default function MleoMiners() {
  useIOSViewportFix();
const router = useRouter();
  const wrapRef   = useRef(null);
  const canvasRef = useRef(null);
  const rafRef    = useRef(0);
  const dragRef   = useRef({ active:false });
  const stateRef  = useRef(null);
  const flagsRef = useRef({ isMobileLandscape: false, paused: true });
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { address, isConnected } = useAccount();
const { disconnect } = useDisconnect();

  const [ui, setUi] = useState({
    gold: 0,
    spawnCost: 50,
    dpsMult: 1,
    goldMult: 1,
    muted: false, // קיים — לא נוגעים במשחק
  });

  const [isDesktop,  setIsDesktop]  = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  const [showIntro, setShowIntro] = useState(true);
  const [gamePaused, setGamePaused] = useState(true);
  const [showTerms, setShowTerms] = useState(false);
  const [firstTimeNeedsTerms, setFirstTimeNeedsTerms] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);

  const [showHowTo, setShowHowTo] = useState(false);
  const [showMiningInfo, setShowMiningInfo] = useState(false);
  const [adCooldownUntil, setAdCooldownUntil] = useState(0);
  const [showAdModal, setShowAdModal] = useState(false);
  const [adVideoEnded, setAdVideoEnded] = useState(false);
  const [showMleoModal, setShowMleoModal] = useState(false);

  const [showCollect, setShowCollect] = useState(false);

  const [giftReadyFlag, setGiftReadyFlag] = useState(false);
  const [giftToast, setGiftToast] = useState(null);

  const [showDiamondInfo, setShowDiamondInfo] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [debugUI, setDebugUI] = useState(false); // ← קיים

// Wallet address copy feedback
  const [copiedAddr, setCopiedAddr] = useState(false);

  // === Mining HUD state (CLAIM) ===
  const [mining, setMining] = useState({
    balance: 0, minedToday: 0, lastDay: "", scoreToday: 0,
    vault: 0, claimedTotal: 0, history: []
  });
  const [claiming, setClaiming] = useState(false);

  // ====== SFX / MUSIC (נוסף — לא מחליף את ui.muted הקיים של המשחק) ======
  const [sfxMuted, setSfxMuted] = useState(() => {
    try { return localStorage.getItem("mleo_sfx_muted") === "1"; } catch { return false; }
  });
  const [musicMuted, setMusicMuted] = useState(() => {
    try { return localStorage.getItem("mleo_music_muted") === "1"; } catch { return true; }
  });
  const bgMusicRef = useRef(null); // נטען ב-PART 8 ב-<audio/>

  useEffect(() => {
    try { localStorage.setItem("mleo_sfx_muted", sfxMuted ? "1" : "0"); } catch {}
  }, [sfxMuted]);

  useEffect(() => {
    try { localStorage.setItem("mleo_music_muted", musicMuted ? "1" : "0"); } catch {}
    const a = bgMusicRef.current;
    if (!a) return;
    a.muted = musicMuted;
    if (!musicMuted) {
      a.loop = true;
      a.play().catch(()=>{});
    } else {
      try { a.pause(); } catch {}
    }
  }, [musicMuted]);

  // נגן אפקטים עבור HUD בלבד — מכבד רק SFX mute (לא נוגע ב-play של המשחק)
  const playSfx = (src) => {
    if (!src || sfxMuted) return;
    try { const a = new Audio(src); a.volume = 0.35; a.play().catch(()=>{}); } catch {}
  };

  // === PATCH: auto-open "How it works" פעם לסשן ===
  useEffect(() => {
    if (showIntro) return;
    try {
      const K = "mleo_howitworks_seen";
      if (sessionStorage.getItem(K) !== "1") {
        setShowMiningInfo(true);
        sessionStorage.setItem(K, "1");
      }
    } catch {}
  }, [showIntro]);

  // Check terms status on mount
  useEffect(() => {
    const accepted = isTermsAccepted();
    setFirstTimeNeedsTerms(!accepted);
  }, []);

  // ===== Debug UI bootstrap =====
  useEffect(() => {
    let on = false;
    try {
      const qs = new URLSearchParams(window.location.search);
      if (qs.get("debug") === "1") on = true;
    } catch {}
    if (!on) on = getDebugFlag();
    if (!on && isLocalHost()) on = true; // auto-enable on localhost
    setDebugUI(on);
    if (on) setDebugFlag(true);

    // Shift+D toggle
    const onKey = (e) => {
      if (!e) return;
      const k = (e.key || "").toLowerCase();
      if (k === "d" && e.shiftKey) {
        setDebugUI(v => { const nv = !v; setDebugFlag(nv); return nv; });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // === [GAIN] state & helpers (קיים אצלך — לא שיניתי) ===
  const [showGainModal, setShowGainModal] = useState(false);
  const [gainWatchEnabled, setGainWatchEnabled] = useState(false);
  const gainReady = !!(stateRef.current && stateRef.current.gainReady);
  const gainRingClass = gainReady
    ? "animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400/40"
    : "absolute inline-flex h-full w-full rounded-full border border-white/20";
  function toggleGainWatch() {
    setGainWatchEnabled(v => !v);
    try { localStorage.setItem("mleo_gain_watch", (!gainWatchEnabled).toString()); } catch {}
  }
  useEffect(() => {
    try {
      const v = localStorage.getItem("mleo_gain_watch");
      if (v === "true") setGainWatchEnabled(true);
    } catch {}
  }, []);

  // טוען/מרענן סטטוס ה־Mining
  useEffect(() => {
    if (!mounted) return;
    try { setMining(loadMiningState()); } catch {}
    const id = setInterval(() => {
      try { setMining(loadMiningState()); } catch {}
    }, 1000);
    return () => clearInterval(id);
  }, [mounted]);

  // === DEMO handlers for Mining ===
  function claimBalanceToVaultDemo() {
    try { play?.(S_CLICK); } catch {}
    const st  = loadMiningState();
    const amt = Number((st?.balance || 0).toFixed(2));
    if (!amt) { setGiftToastWithTTL("No tokens to claim"); return; }

    st.vault        = Number(((st.vault || 0) + amt).toFixed(2));
    st.claimedTotal = Number(((st.claimedTotal || 0) + amt).toFixed(2));
    st.history      = Array.isArray(st.history) ? st.history : [];
    st.history.unshift({ ts: Date.now(), amt, type: "to_vault" });
    st.balance = 0;

    saveMiningState(st);
    setMining(st);
    setGiftToastWithTTL(`Moved ${formatMleoShort(amt)} MLEO to Vault`);
  }

  // === Unified Wallet Modal Opener (מחובר/לא מחובר) + Terms gate ===
  function openWalletModalUnified() {
    try { playSfx(S_CLICK); } catch {}
    // שער תנאים
    if (firstTimeNeedsTerms) {
      setShowTerms(true);
      return;
    }
    // סגירת שכבות שיכולות לכסות את RainbowKit
    setMenuOpen(false);
    setShowHowTo(false);
    setShowMiningInfo(false);
    setShowAdModal(false);
    // פתיחת המודל הנכון
    if (isConnected) {
      openAccountModal?.();   // סטטוס + ניתוק
    } else {
      openConnectModal?.();   // חיבור
    }
  }

// טוגל פשוט לחיבור/ניתוק — בלי לפתוח מודלים
  function toggleWallet() {
    try { playSfx(S_CLICK); } catch {}
    if (isConnected) {
      try { disconnect(); } catch {}
    } else {
      openConnectModal?.();
    }
  }

// ניתוק ישיר (גיבוי) — לא משנה UI במשחק
  function hardDisconnect() {
    try { disconnect(); } catch {}
    setMenuOpen(false);
  }

  // כפתור CLAIM — דמו: תמיד Vault
  async function onClaimMined() {
    claimBalanceToVaultDemo();
    return;
  }

  // Debug live values (קיים אצלך — לא נוגע)
  const [debugVals, setDebugVals] = useState({
    minerScale: stateRef.current?.minerScale ?? 1.60,
    minerWidth: stateRef.current?.minerWidth ?? 0.8,
    spawnIconZoom:
      (typeof window !== "undefined" && (window.SPAWN_ICON_ZOOM ?? Number(localStorage.getItem("SPAWN_ICON_ZOOM")))) || 1.5,
    spawnIconShiftY:
      (typeof window !== "undefined" && (window.SPAWN_ICON_SHIFT_Y ?? Number(localStorage.getItem("SPAWN_ICON_SHIFT_Y")))) || 0,
  });

  useEffect(() => {
    if (!debugUI) return;
    const s = stateRef.current || {};
    const zoom = (typeof window !== "undefined" && (window.SPAWN_ICON_ZOOM ?? Number(localStorage.getItem("SPAWN_ICON_ZOOM")))) || 2.2;
    const shift = (typeof window !== "undefined" && (window.SPAWN_ICON_SHIFT_Y ?? Number(localStorage.getItem("SPAWN_ICON_SHIFT_Y")))) || 0;
    setDebugVals({
      minerScale: s.minerScale ?? 1.6,
      minerWidth: s.minerWidth ?? 0.8,
      spawnIconZoom: Number(zoom) || 2.2,
      spawnIconShiftY: Number(shift) || 0,
    });
  }, [debugUI]);

  const [centerPopup, setCenterPopup] = useState(null);

  const uiPulseAccumRef = useRef(0);
  const rockSfxCooldownRef = useRef(0);
  const [, forceUiPulse] = useState(0);

  useEffect(() => {
    flagsRef.current = {
      isMobileLandscape,
      paused: (gamePaused || showIntro || showCollect),
    };
  }, [isMobileLandscape, gamePaused, showIntro, showCollect]);

  // נגן המשחק הקיים — נשאר כמו שהוא
  const play = (src) => {
    if (ui.muted || !src) return;
    try { const a = new Audio(src); a.volume = 0.35; a.play().catch(()=>{}); } catch {}
  };

  useEffect(() => {
    if (!centerPopup) return;
    const id = setTimeout(() => setCenterPopup(null), 1800);
    return () => clearTimeout(id);
  }, [centerPopup]);

  // ── מיגרציית שמירה קיימת ──
  function theStateFix_maybeMigrateLocalStorage(){
    try {
      const K = LS_KEY;
      const raw = localStorage.getItem(K);

      const zLS = localStorage.getItem("SPAWN_ICON_ZOOM");
      if (zLS === null || Number(zLS) !== 1.55) {
        localStorage.setItem("SPAWN_ICON_ZOOM", "1.55");
        if (typeof window !== "undefined") window.SPAWN_ICON_ZOOM = 1.55;
      }

      if (!raw) return;

      const s = JSON.parse(raw);
      let changed = false;

      if (typeof s.minerScale !== "number" || s.minerScale !== 1.6) {
        s.minerScale = 1.6; changed = true;
      }
      if (typeof s.minerWidth !== "number" || s.minerWidth !== 0.8) {
        s.minerWidth = 0.8; changed = true;
      }

      if (changed) localStorage.setItem(K, JSON.stringify(s));
    } catch {}
  }

  function grantGift(){
    const s = stateRef.current; if (!s) return;
    const type = rollGiftType();

    if (type === "coins20") {
      const base = Math.max(10, expectedGiftCoinReward(s));
      const gain = Math.round(base * 0.20);
      s.gold += gain;
      setUi(u => ({ ...u, gold: s.gold }));
      setCenterPopup({ text: `🎁 +${formatShort(gain)} coins`, id: Math.random() });

    } else if (type === "coins40") {
      const base = Math.max(10, expectedGiftCoinReward(s));
      const gain = Math.round(base * 0.40);
      s.gold += gain;
      setUi(u => ({ ...u, gold: s.gold }));
      setCenterPopup({ text: `🎁 +${formatShort(gain)} coins`, id: Math.random() });

    } else if (type === "dps") {
      s.dpsMult = +((s.dpsMult || 1) * 1.1).toFixed(2);
      setCenterPopup({ text: `🎁 DPS +10% (×${(s.dpsMult||1).toFixed(2)})`, id: Math.random() });

    } else if (type === "gold") {
      s.goldMult = +((s.goldMult || 1) * 1.1).toFixed(2);
      setCenterPopup({ text: `🎁 GOLD +10% (×${(s.goldMult||1).toFixed(2)})`, id: Math.random() });

    } else if (type === "diamond") {
      s.diamonds = (s.diamonds || 0) + 1;
      setCenterPopup({ text: `🎁 +1 💎 (Diamonds: ${s.diamonds})`, id: Math.random() });
    }

    s.giftReady = false;
    {
      const now = Date.now();
      const stepSec = currentGiftIntervalSec(s, now);
      s.giftNextAt = now + stepSec * 1000;
    }

    s.giftFirstReadyAt = null;
    s.isIdleOffline = false;
    resetOfflineSession(s);


    setGiftReadyFlag(false);
    try { play(S_GIFT); } catch {}
    save?.();
  }

  // ====== מסך מלא + Back (נוסף) ======
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFS = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFS);
    onFS();
    return () => document.removeEventListener("fullscreenchange", onFS);
  }, []);

  function toggleFullscreen() {
    try { playSfx(S_CLICK); } catch {}
    const el = wrapRef.current || document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(()=>setIsFullscreen(true)).catch(()=>{});
    } else {
      document.exitFullscreen?.().then(()=>setIsFullscreen(false)).catch(()=>{});
    }
  }


 // Back יציאה מפול-סקין + חזרה, עם fallback ל-root
   function backSafe() {
     try { playSfx(S_CLICK); } catch {}
     const p = document.fullscreenElement
       ? document.exitFullscreen?.()
       : Promise.resolve();
     Promise.resolve(p).finally(() => {
       // תן לרגע לדפדפן להשתחרר מפול-סקין לפני ניווט
       setTimeout(() => {
         if (window.history.length > 1) {
           try { router.back(); } catch { window.history.back(); }
         } else {
           try { router.push("/"); } catch { window.location.href = "/"; }
         }
       }, 0);
     });
   }
   // שמירה על תאימות אם יש קריאות ישנות ל-onBack()
   function onBack(){ backSafe(); }

  // דגל לתפריט (☰) — JSX ב-PART 8
  const [menuOpen, setMenuOpen] = useState(false);

// === END PART 2 ===


// === START PART 3 ===

/// Init state + קנבס + ציור + לולאת משחק (שיפור UX של גרירה)

useEffect(() => {
  theStateFix_maybeMigrateLocalStorage();

// --- Engine sanity guard: reset inflated per-break state after reloads ---
  try {
    const e = engineLoad();
    const bad =
      !e ||
      typeof e.currentPerBreakValue !== "number" ||
      e.currentPerBreakValue > 10 ||        // conservative cap
      (e.currentStage || 1) > 60;           // conservative cap
    if (bad) engineHardReset();
  } catch {}

  const loaded = loadSafe();
  const init = loaded ? { ...freshState(), ...loaded } : freshState();

  if (loaded && loaded.minerScale == null) init.minerScale = 1.60;
  if (loaded && loaded.minerWidth  == null) init.minerWidth  = 0.8;

  if (init.costBase == null) {
    try { init.costBase = Math.max(80, expectedRockCoinReward(init)); }
    catch { init.costBase = 120; }
  }

  stateRef.current = init;
  setUi(u => ({ ...u,
    gold: init.gold, spawnCost: init.spawnCost,
    dpsMult: init.dpsMult, goldMult: init.goldMult,
  }));
  setGiftReadyFlag(!!init.giftReady);

  try {
// ← החלף את הקטע הכפול בגרסה התקינה:
const now = Date.now();
if (!init.giftNextAt || Number.isNaN(init.giftNextAt)) {
  init.giftReady  = false;
  const stepSec = currentGiftIntervalSec(init, now);
  init.giftNextAt = now + stepSec * 1000;
  save();
}
if ((init.giftNextAt || 0) <= now) {
  init.giftReady = true;
  // העיקר: זמן אמיתי של ה־READY, לא now
  init.giftFirstReadyAt = init.giftFirstReadyAt || init.giftNextAt;
  setGiftReadyFlag(true);
}

  } catch {}

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

  try {
    const s = stateRef.current;
     const now  = Date.now();
  const last = s?.lastSeen || now;
  const elapsedMs = Math.max(0, now - last);
  if (elapsedMs > 1000) {
    ensureOfflineSessionStart(s, last);
    const gate = takeFromOfflineSession(s, elapsedMs);
    const gained = gate.effectiveMs > 0 ? handleOfflineAccrual(s, gate.effectiveMs) : 0;
    if (gained > 0) setShowCollect(true);
    s.lastSeen = now;
    resetOfflineSession(s); // חזרנו למשחק ⇒ איפוס הסשן
    save();
  }

  } catch {}

  setMounted(true);

  const updateFlags = () => {
    const w = window.innerWidth, h = window.innerHeight;
    const portrait = h >= w, desktop = w >= 1024;
    setIsDesktop(desktop);
    setIsMobileLandscape(!portrait && !desktop);
    setGamePaused(p => (!portrait && !desktop) ? true : (showIntro ? true : false));
  };
  updateFlags();
  window.addEventListener("resize", updateFlags);
  window.addEventListener("orientationchange", updateFlags);
  document.addEventListener("fullscreenchange", updateFlags);

  const preventTouchScroll = (e) => { if (e.target.closest?.("#miners-canvas")) e.preventDefault(); };
  document.addEventListener("touchmove", preventTouchScroll, { passive:false });

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

  const onVisibility = () => {
    const s = stateRef.current; if (!s) return;
    const now = Date.now();
    if (document.visibilityState === "hidden") {
      s.lastSeen = now;
      ensureOfflineSessionStart(s, now); // התחלת סשן
      safeSave();
    } else {
      const elapsedMs = Math.max(0, now - (s.lastSeen || now));
      if (elapsedMs > 1000) {
        ensureOfflineSessionStart(s, s.lastSeen || now);
        const gate = takeFromOfflineSession(s, elapsedMs);
        const gained = gate.effectiveMs > 0 ? handleOfflineAccrual(s, gate.effectiveMs) : 0;
        if (gained > 0) setShowCollect(true);
        s.lastSeen = now;
        resetOfflineSession(s); // חזרנו ⇒ איפוס הסשן
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
}, [showIntro]);

useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  // התאמת קאנבס מידית לפי ה-wrapper
  fitCanvasToWrapper(canvas);

  // רענון על שינוי גודל/אוריינטציה/visualViewport (iOS)
  const vv = window.visualViewport;
  let t;
  const onResize = () => {
    clearTimeout(t);
    t = setTimeout(() => fitCanvasToWrapper(canvas), 60);
  };

  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  vv && vv.addEventListener("resize", onResize);

  // אם יש לך לולאת ציור/engine שמחשב מחדש מטריקות — שמור
  // ההוספה כאן רק מבטיחה שהקאנבס עצמו תמיד תפור לגובה העטיפה.

  return () => {
    clearTimeout(t);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    vv && vv.removeEventListener("resize", onResize);
  };
}, []);


// רנדר/סנכרון מתנות — 500ms heartbeat
useEffect(() => {
  const id = setInterval(() => {
    const s = stateRef.current;
    if (!s) return;
    const now = Date.now();

    if (!s.giftNextAt || Number.isNaN(s.giftNextAt)) {
      const stepSec = currentGiftIntervalSec(s, now);
      s.giftReady  = false;
      s.giftNextAt = now + stepSec * 1000;
      save();
      return;
    }

    if (!s.giftReady && s.giftNextAt <= now) {
      s.giftReady = true;
      // חשוב: לא מאבדים את זמן ה־ready האמיתי
      s.giftFirstReadyAt = s.giftFirstReadyAt || s.giftNextAt;
      setGiftReadyFlag(true);
      save();
    }
  }, 500);

  return () => clearInterval(id);
}, []);

// פולס UI כל 200ms
useEffect(() => {
  const id = setInterval(() => {
    uiPulseAccumRef.current += 0.2;
    forceUiPulse(v => (v + 1) % 1000000);
   }, 200);
  return () => clearInterval(id);
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

    minerScale: 1.6,
    minerWidth: 0.8,

    anim:{ t:0, coins:[], hint:1, fx:[] },
    onceSpawned:false,
    totalPurchased:0, spawnLevel:1,
    lastSeen:now, pendingOfflineGold:0,
    pendingOfflineMleo:0,

    cycleStartAt: now, lastGiftIntervalSec: 20,
    giftNextAt: now + 20000, giftReady:false,
    diamonds:0, nextDiamondPrize: rollDiamondPrize(),
    giftFirstReadyAt: null,       // first time current gift became ready
    isIdleOffline: false,         // force "offline-like" efficiency when idle
    offlineSessionStartAt: null,
    offlineConsumedMsInSession: 0,



    autoDogLastAt: now,
autoDogNextAt: now + DOG_INTERVAL_SEC * 1000,
    autoDogBank: 0,
    autoDogPending: false,

    adCooldownUntil: 0,

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

  const onDown = (e) => {
    const { isMobileLandscape: iml, paused } = flagsRef.current || {};
    if (iml || paused) return;
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
  const onTouchStart = (e) => { onDown(e.touches[0]); e.preventDefault(); };
  const onTouchMove  = (e) => { onMove(e.touches[0]); e.preventDefault(); };
  const onTouchEnd   = (e) => { onUp(e.changedTouches[0]); e.preventDefault(); };
  cnv.addEventListener("touchstart", onTouchStart, { passive:false });
  cnv.addEventListener("touchmove",  onTouchMove,  { passive:false });
  cnv.addEventListener("touchend",   onTouchEnd,   { passive:false });

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
    cnv.removeEventListener("touchstart", onTouchStart);
    cnv.removeEventListener("touchmove",  onTouchMove);
    cnv.removeEventListener("touchend",   onTouchEnd);
  };
}

// ----- גיאומטריה -----
const PILL_H = UI_BTN_H_PX;
function boardRect(){
  const c = canvasRef.current;
  return { x:PADDING, y:PADDING, w:(c?.clientWidth||0)-PADDING*2, h:(c?.clientHeight||0)-PADDING*2 };
}
function laneRect(lane){
  const b = boardRect();
  const h = b.h * 0.18;
  const centers = [0.380,0.530,0.680,0.825];
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
  const y = L.y + L.h * 0.05;
  const h = L.h * 0.90;
  return { x:L.x + L.w - rw - 4, y, w:rw, h };
}
function pos(e){
  const r = canvasRef.current?.getBoundingClientRect();
  return { x: e.clientX - (r?.left||0), y: e.clientY - (r?.top||0) };
}

// Fit canvas to its wrapper with DPR (no lanes changes)
function fitCanvasToWrapper(canvas) {
  const wrap = canvas?.parentElement;
  if (!canvas || !wrap) return;
  const rect = wrap.getBoundingClientRect();

  // DPI scaling for sharp rendering (cap to 2 for performance)
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Set internal buffer size
  canvas.width  = Math.round(rect.width  * dpr);
  canvas.height = Math.round(rect.height * dpr);

  // CSS size to match wrapper
  canvas.style.width  = `${Math.round(rect.width)}px`;
  canvas.style.height = `${Math.round(rect.height)}px`;

  // Scale context so all existing drawing uses CSS pixels
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

function drawRock(ctx, rect, rock){
  // בלי צללים
  ctx.shadowColor = "transparent";
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // מצב הסלע
  const pct   = Math.max(0, rock.hp / rock.maxHp);
  const scale = 0.35 + 0.65 * pct;

  // מסגרות ומידות
  const img   = getImg(IMG_ROCK);
  const pad   = 6;
  const fullW = rect.w - pad*2;
  const fullH = rect.h - pad*2;

  // גודל/מיקום הסלע (אותו חישוב כמו קודם)
  const rw = fullW * scale;
  const rh = fullH * scale;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = cx - rw / 2;
  const dy = cy - rh / 2;

  // ציור הסלע
  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, dx, dy, rw, rh);
  } else {
    ctx.fillStyle = "#6b7280";
    ctx.fillRect(dx, dy, rw, rh);
  }

  // === מיקומים קבועים בתוך הסלע ===
  const INNER_PAD = 6;              // רווח פנימי מהשוליים
  const BAR_H = 18;                           // ↑ בר גבוה יותר (במקום 10)
  const BAR_W = Math.min(fullW * 0.75, rw - 12);
  const BAR_X = dx + (rw - BAR_W) / 2;
 const BAR_Y = dy + rh - (BAR_H / 2);

 



  // רקע הבר
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(BAR_X, BAR_Y, BAR_W, BAR_H);

  // מילוי הבר
  ctx.fillStyle = "#0ea5e9";
  ctx.fillRect(BAR_X, BAR_Y, Math.max(0, BAR_W * pct), BAR_H);

  // מסגרת
  ctx.strokeStyle = "#082f49";
  ctx.lineWidth   = 1;
  ctx.strokeRect(BAR_X, BAR_Y, BAR_W, BAR_H);

  // === טקסט בתוך הבר ===
  const TXT = `ROCK ${rock.idx + 1}`;
  ctx.font         = "bold 12px system-ui";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle    = "#ffffff"; // לבן
  ctx.fillText(TXT, BAR_X + BAR_W / 2, BAR_Y + BAR_H / 2);
}



function drawMiner(ctx,lane,slot,m){
  const r  = slotRect(lane,slot);
  const cx = r.x + r.w*0.52;
  const cy = r.y + r.h*0.45;

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
  s.paused = !!(flagsRef.current && flagsRef.current.paused);
  const now = Date.now();
  if (s.paused){ s.lastSeen = now; return; }

  // אם 🎁 מוכנה מעל 5 דק' ולא נלקחה — עוברים ל־idle-offline
if (s.giftReady && (s.giftFirstReadyAt || s.giftNextAt)) {
  const readySince = s.giftFirstReadyAt || s.giftNextAt;   // ← עוגן הזמן
  if ((now - readySince) >= IDLE_OFFLINE_MS && !s.isIdleOffline) {
    s.isIdleOffline = true;
    save?.();
  }
}


  // עדכון סלעים/מטבעות
  for (let l = 0; l < LANES; l++){
    let dps = 0;
    for (let k = 0; k < SLOTS_PER_LANE; k++){
      const cell = s.lanes[l].slots[k]; if (!cell) continue;
      const m = s.miners[cell.id];      if (!m) continue;
      const onlineEff = s.isIdleOffline ? OFFLINE_DPS_FACTOR : 1;
      dps += minerDps(m.level, (s.dpsMult||1)) * onlineEff;
    }
    const rock = s.lanes[l].rock;
    rock.hp -= dps * dt;
    if (rock.hp <= 0) {
      const nowT = Date.now();
      if (nowT - (rockSfxCooldownRef.current || 0) > 200) {
        rockSfxCooldownRef.current = nowT;
        try { play?.(S_ROCK); } catch {}
      }
      const coinsGain = Math.floor(rock.maxHp * GOLD_FACTOR * (s.goldMult || 1));
// נשמור מצב לפני – כדי לוודא POP לפי תוצאה אמיתית
const before = loadMiningState();
const balBefore = Number(before?.balance || 0);

// GOLD כרגיל
s.gold += coinsGain;
setUi(u => ({ ...u, gold: s.gold }));

// מעניקים MLEO לפי שלב הסלע עצמו (בלתי תלוי בסלעים אחרים)
const stageNow = rockStageNow(rock);
const baseForBreak = mleoBaseForStage(stageNow);
const eff = addPlayerScorePoints(s, baseForBreak, /*isEngineBase*/ true);
finalizeDailyRewardOncePerTick();


// מציגים ב־POP את מה שבאמת נכנס (eff), לא Preview
const after = loadMiningState();
const balAfter = Number(after?.balance || 0);
const delta = Math.max(0, +(balAfter - balBefore).toFixed(2)); // גיבוי אם eff==null
const mleoTxt = formatMleoShort(eff || delta || 0);
setCenterPopup({ text: `⛏️ +${formatShort(coinsGain)} coins • +${mleoTxt} MLEO`, id: Math.random() });


      s.lanes[l].rockCount += 1;
      s.lanes[l].rock = newRock(l, s.lanes[l].rockCount);
      safeSave();
    }
  }

  // עדכון טיימר מתנות
  if (!s.giftReady && (s.giftNextAt || 0) <= now) {
    s.giftReady = true;
    setGiftReadyFlag(true);
  }

  // הנחת כלב יהלום ממתין
  if (s.pendingDiamondDogLevel && countMiners(s) < MAX_MINERS) {
    const placed = spawnMiner(s, s.pendingDiamondDogLevel);
    if (placed) {
      const placedLvl = s.pendingDiamondDogLevel;
      s.pendingDiamondDogLevel = null;
      s.giftReady  = false;
      s.giftNextAt = now + currentGiftIntervalSec(s) * 1000;
      setGiftToastWithTTL(`💎 Dog (LV ${placedLvl}) placed`);
      save?.();
    }
  }

  // אוטו־דוג + חיתוך יומי ל-MLEO
  accrueBankDogsUpToNow(s);
  tryDistributeBankDog(s);
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

function makeFreshState() { return freshState(); }

// ── Save/Load ──
function save() {
  const s = stateRef.current; if (!s) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      lanes: s.lanes, miners: s.miners, nextId: s.nextId,
      gold: s.gold, spawnCost: s.spawnCost, dpsMult: s.dpsMult, goldMult: s.goldMult,
      onceSpawned: s.onceSpawned,

      offlineSessionStartAt: s.offlineSessionStartAt || null,
      offlineConsumedMsInSession: s.offlineConsumedMsInSession || 0,

      minerScale: s.minerScale || 1.6,
      minerWidth: s.minerWidth || 0.8,

      lastSeen: s.lastSeen,
      pendingOfflineGold: s.pendingOfflineGold || 0,
      pendingOfflineMleo: s.pendingOfflineMleo || 0,
      totalPurchased: s.totalPurchased, spawnLevel: s.spawnLevel,

      cycleStartAt: s.cycleStartAt,
      lastGiftIntervalSec: s.lastGiftIntervalSec,
      giftNextAt: s.giftNextAt,
      giftReady: s.giftReady,
      giftFirstReadyAt: s.giftFirstReadyAt || null,
      isIdleOffline: !!s.isIdleOffline,

      diamonds: s.diamonds || 0,
      nextDiamondPrize: s.nextDiamondPrize,

      autoDogLastAt: s.autoDogLastAt,
      autoDogNextAt: s.autoDogNextAt,
      autoDogBank: s.autoDogBank,
      autoDogPending: !!s.autoDogPending,

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
  s.gold -= cost; s.goldMult = +((s.goldMult || 1) * 1.1).toFixed(2);
  setUi(u => ({ ...u, gold: s.gold })); save();
}

function onOfflineCollect() {
  const s = stateRef.current; if (!s) return;
  const addCoins = s.pendingOfflineGold || 0;
  const addMleo  = Number(s.pendingOfflineMleo || 0);

  if (addCoins > 0) {
    s.gold += addCoins;
    s.pendingOfflineGold = 0;
    setUi(u => ({ ...u, gold: s.gold }));
  }
  s.pendingOfflineMleo = 0;

  save();

  if (addCoins > 0 || addMleo > 0) {
  setCenterPopup({
  text: `⛏️ +${formatShort(addCoins)} coins • +${formatMleoShort(addMleo)} MLEO`,

  id: Math.random()
});

  }
  setShowCollect(false);
}

// ===== אוטו־דוג/אופליין/מתנות =====

function chooseAutoDogLevel(s) {
  const sl = Math.max(1, s.spawnLevel || 1);
  const target2 = Math.max(1, sl - 2);
  const existsLv2 = Object.values(s.miners || {}).some(m => m.level === target2);
  return existsLv2 ? target2 : sl;
}

function chooseGiftDogLevelForRegularGift(s) {
  // Gift dog (REGULAR) = buy level by default; if no merge is possible at buy level → lowest existing level on board
  return chooseGiftDogPlacementLevel(s);
}


function accrueBankDogsUpToNow(s) {
  if (!s) return;
  const period = DOG_INTERVAL_SEC * 1000;
  const now = Date.now();

  if (!s.autoDogNextAt || Number.isNaN(s.autoDogNextAt)) {
    s.autoDogNextAt = now + period;
  }

  // cap bank by AVAILABLE FREE SLOTS (pause when full)
  const freeSlots = Math.max(0, MAX_MINERS - countMiners(s));
  const bankCapNow = Math.min(DOG_BANK_CAP, freeSlots);

  if (now >= s.autoDogNextAt) {
    const intervals = Math.floor((now - s.autoDogNextAt) / period) + 1;
    const cur = (s.autoDogBank || 0);
    s.autoDogBank = Math.min(bankCapNow, cur + intervals);
    s.autoDogNextAt += intervals * period;
    save?.();
  }
}

// --- helpers for gift-dog placement (buy-level vs lowest-existing) ---
function lowestExistingLevelOnBoard(s) {
  const levels = Object.values(s.miners || {})
    .filter(Boolean)
    .map(m => m.level)
    .filter(v => typeof v === "number" && v >= 1);
  if (!levels.length) return null;
  levels.sort((a,b)=>a-b);
  return levels[0]; // lowest existing level
}

// "can merge at buy level" = יש לפחות כלב אחד ברמת הקנייה על הלוח (אפשרות לזוג/מיזוג)
function canMergeAtBuyLevel(s) {
  const bl = Math.max(1, s.spawnLevel || 1);
  return Object.values(s.miners || {}).some(m => m && m.level === bl);
}

// בחירת דרגה למתנה רגילה: ברירת־מחדל דרגת קנייה; אם אין שום אפשרות מיזוג — הדרגה הנמוכה ביותר שקיימת על הלוח
function chooseGiftDogPlacementLevel(s) {
  const buyLevel = Math.max(1, s.spawnLevel || 1);
  if (canMergeAtBuyLevel(s)) return buyLevel;
  const low = lowestExistingLevelOnBoard(s);
  return low || buyLevel; // אם הלוח ריק—נשארים עם דרגת הקנייה
}


function tryDistributeBankDog(s) {
  if (!s) return;
  if (!hasFreeSlot(s)) return;
  if ((s.autoDogBank || 0) <= 0) return;

  const lvl = chooseAutoDogLevel(s);
  const ok = spawnMiner(s, lvl);
  if (ok) {
    s.autoDogBank = Math.max(0, (s.autoDogBank || 0) - 1);
    setCenterPopup?.({ text: `🦊 Auto Dog (LV ${lvl})`, id: Math.random() });
    save?.();
  }
}

function handleOfflineAccrual(s, elapsedMs) {
  if (!s) return 0;

  // --- Auto-dog accrual (נשאר כמו אצלך) ---
  {
    const period = DOG_INTERVAL_SEC * 1000;
    const now = Date.now();

    if (!s.autoDogNextAt || Number.isNaN(s.autoDogNextAt)) {
      s.autoDogNextAt = now + period;
    }

    const freeSlots0 = Math.max(0, MAX_MINERS - countMiners(s));
    let bankCapNow = Math.min(DOG_BANK_CAP, freeSlots0);

    if (now >= s.autoDogNextAt) {
      const intervals = Math.floor((now - s.autoDogNextAt) / period) + 1;
      const cur = (s.autoDogBank || 0);
      s.autoDogBank = Math.min(bankCapNow, cur + intervals);
      s.autoDogNextAt += intervals * period;
    }

    while ((s.autoDogBank || 0) > 0 && hasFreeSlot(s)) {
      const lvl = chooseAutoDogLevel(s);
      const ok = spawnMiner(s, lvl);
      if (!ok) break;
      s.autoDogBank -= 1;

      const freeNow = Math.max(0, MAX_MINERS - countMiners(s));
      bankCapNow = Math.min(DOG_BANK_CAP, freeNow);
      if (bankCapNow <= 0) break;
    }
  }

  // --- סימולציית אופליין לשבירות ---
  const CAP_MS = 12 * 60 * 60 * 1000;
  const simMs = Math.min(elapsedMs, CAP_MS);

  let totalCoins = 0;
  let offlineAddedMleo = 0;

  for (let lane = 0; lane < LANES; lane++) {
    let dps = laneDpsSum(s, lane) * OFFLINE_DPS_FACTOR;
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
        // שבירה מתרחשת:
        totalCoins += Math.floor(maxHp * GOLD_FACTOR * (s.goldMult || 1));

        // ערך MLEO לפי שלב הסלע בנתיב זה ברגע השבירה
        const stageNow = (idx + 1);
        const baseForBreak = mleoBaseForStage(stageNow);
        const eff = addPlayerScorePoints(s, baseForBreak, /*isEngineBase*/ true);
        offlineAddedMleo += eff;
        finalizeDailyRewardOncePerTick();

        // מעבר לסלע הבא בנתיב
        timeLeft -= timeToBreak;
        idx += 1;
        const rk = newRock(lane, idx);
        hp = rk.hp; maxHp = rk.maxHp;
      }
    }

    s.lanes[lane].rock = { lane, idx, maxHp, hp: Math.max(1, Math.floor(hp)) };
    s.lanes[lane].rockCount = idx;
  }

  // מצטברים למסך ה-COLLECT (האיזון של ה-Mining עודכן תוך כדי)
  if (totalCoins > 0) {
    s.pendingOfflineGold = (s.pendingOfflineGold || 0) + totalCoins;
  }
  if (offlineAddedMleo > 0) {
    s.pendingOfflineMleo = +((s.pendingOfflineMleo || 0) + offlineAddedMleo).toFixed(2);
  }

  return totalCoins;
}

function hasFreeSlot(s) {
  return countMiners(s) < MAX_MINERS;
}

function rollGiftType() {
  const r = Math.random() * 100;
  if (r < 70) return "coins20";
  if (r < 78) return "dps";
  if (r < 86) return "gold";
  if (r < 92) return "diamond";
  return "coins40";
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

  try {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(MINING_LS_KEY);
// Also reset the per-break MLEO engine so new session starts from baseline
    localStorage.removeItem(MLEO_ENGINE_LS_KEY);
  } catch {}

// Ensure engine is re-seeded (v1=0.5, stage=1, breakCount=0)
  try { engineHardReset(); } catch {}

  setMining({
    balance: 0, minedToday: 0, lastDay: getTodayKey(),
    scoreToday: 0, vault: 0, claimedTotal: 0, history: []
  });

  const fresh = makeFreshState();
  fresh.costBase = Math.max(80, expectedRockCoinReward(fresh));
  stateRef.current = fresh;

  setUi(u => ({
    ...u,
    gold: fresh.gold, spawnCost: fresh.spawnCost,
    dpsMult: fresh.dpsMult, goldMult: fresh.goldMult,
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
        s.giftReady  = false;
        s.giftNextAt = Date.now() + currentGiftIntervalSec(s) * 1000;
      }
    } else {
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
const DOG_INTERVAL_SEC = (typeof window !== "undefined" && window.DOG_INTERVAL_SEC) || 600;
const DOG_BANK_CAP     = (typeof window !== "undefined" && window.DOG_BANK_CAP)     || 6;

const _currentGiftIntervalSec = typeof currentGiftIntervalSec==="function"?currentGiftIntervalSec:(s)=>Math.max(5,Math.floor(s?.lastGiftIntervalSec||20));
const _getPhaseInfo = typeof getPhaseInfo==="function"?getPhaseInfo:(s,now=Date.now())=>{ const sec=_currentGiftIntervalSec(s,now); return { index:0,into:0,remain:sec,intervalSec:sec }; };

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
  const remain = Math.max(0, (s.autoDogNextAt || (now + total)) - now);
  return Math.max(0, Math.min(1, 1 - remain / total));
})();


const diamondsReady = (stateRef.current?.diamonds || 0) >= 3;

// --- ONLINE/OFFLINE HUD status (derived) ---
const onlineMode = (() => {
  const s = stateRef.current;
  const paused = !!(flagsRef.current && flagsRef.current.paused);
  const hidden = (typeof document !== "undefined") && document.visibilityState === "hidden";
  if (!s) return "offline";
  if (s.isIdleOffline) return "idle";          // gift ready >5m → reduced efficiency
  if (paused || hidden) return "offline";      // intro/paused/hidden
  return "online";
})();
const isOnline = onlineMode === "online";
const onlineDotTitle = isOnline ? "Online" : (stateRef.current?.isIdleOffline ? "Idle (reduced)" : "Offline");


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
const addDisabled = addRemainMs > 0;

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

// Coins modal (details + claim-to-mining)
const [showCoinsModal, setShowCoinsModal] = useState(false);

function claimCoinsToMining() {
  try { play?.(S_CLICK); } catch {}

  const s = stateRef.current; 
  if (!s) return;

  const coins = Number(s.gold || 0);
  if (!coins) { setGiftToastWithTTL("No coins to claim"); return; }

  const eff = previewMleoFromCoins(coins);
  if (!eff) { setGiftToastWithTTL("Daily cap reached or nothing to add"); return; }

  const mst = loadMiningState();
  const today = getTodayKey();
  if (mst.lastDay !== today) { mst.minedToday = 0; mst.scoreToday = 0; mst.lastDay = today; }

  const room = Math.max(0, DAILY_CAP - (mst.minedToday || 0));
  const add  = Math.min(eff, room);

  mst.minedToday += add;
  mst.balance    += add;

  saveMiningState(mst);
  setMining(mst);

  setGiftToastWithTTL(`Claimed ${formatMleoShort(add)} MLEO from coins`);

}

// ===== HUD Info modal state & content =====
const [hudModal, setHudModal] = useState(null);
function getHudModalTitle(k){
  switch(k){
    case 'coins': return 'Coins';
    case 'dps': return 'DPS Multiplier';
    case 'gold': return 'Gold Multiplier';
    case 'spawn': return 'Dog Spawn Level';
    case 'lvCounter': return 'Spawn LV Counter';
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
      return `🦊 LV shows the dog level that appears on purchase/bonus. 
Increases automatically after 30 purchases.

Purchases left to the next level: ${toNextLv}.`;
    case 'gifts':
      return '⏳ Interval between gifts. Each time the timer ends you get a gift: coins/dog/boosts/diamond.';
    case 'giftRing':
      return 'The ring around 🎁 shows progress to the next gift, based on the displayed timings.';
    case 'dogRing':
      return 'The ring around 🦊 shows progress toward an auto-dog. When the bank is full (up to 6), it will deploy when a slot is free.';
    default:
      return '';
  }
}

// prices & יכולת קנייה לשורת הפעולות
const spawnCostNow=sNow?.spawnCost??ui.spawnCost;
const dpsCostNow=(typeof _dpsCost==="function")?_dpsCost(sNow):160;
const goldCostNow=(typeof _goldCost==="function")?_goldCost(sNow):160;
const canBuyMiner=!!sNow&&sNow.gold>=spawnCostNow&&Object.keys(sNow.miners||{}).length<(typeof MAX_MINERS==="number"?MAX_MINERS:16);
const canBuyDps=!!sNow&&sNow.gold>=dpsCostNow;
const canBuyGold=!!sNow&&sNow.gold>=goldCostNow;
const boughtCount = sNow?.totalPurchased || 0;
const toNextLv    = 30 - (boughtCount % 30);
const BTN_H = `h-[${UI_BTN_H_PX}px]`;             // כבר קיים אצלך – ודא שזה טמפלייט סטרינג
const BTN_W = `min-w-[${UI_BTN_MIN_W_PX}px]`;     // חדש: רוחב מינימלי
const RING_SZ = "w-[60px] h-[60px]";
const BTN_BASE =
  "appearance-none inline-flex items-center justify-center gap-1 px-3 !py-0 rounded-xl font-extrabold text-[16px] md:text-[18px] leading-none whitespace-nowrap transition ring-2";

const BTN_DIS  = "opacity-60 cursor-not-allowed";

// === END PART 7 ===


// === START PART 8 ===

  // ——— iOS detection ———
  const [isIOS, setIsIOS] = useState(false);
  const HUD_TOP_IOS_PX = 10;
  const HUD_TOP_ANDROID_PX = 15;

  // ——— Track fullscreen state (מתחבר ל-PART 2) ———
  // יש לנו כבר isFullscreen + מאזין ב-PART 2

  useEffect(() => {
    try {
      const ua = navigator.userAgent || "";
      const isiOS =
        /iP(hone|ad|od)/.test(ua) ||
        ((/Macintosh/.test(ua) || /Mac OS X/.test(ua)) && "ontouchend" in document);
      setIsIOS(isiOS);
    } catch {}
  }, []);

  const hudTop = `calc(env(safe-area-inset-top, 0px) + ${(isIOS ? HUD_TOP_IOS_PX : HUD_TOP_ANDROID_PX)}px)`;

  // ==== אל תסגור את הקומפוננטה ב-PART 8! המשך PART 9/10 יושב באותו return ====
  return (
    <Layout>
      <div
        ref={wrapRef}
        className="
          relative flex flex-col items-center justify-start
          bg-gray-900 text-white
          w-full min-h-[var(--app-100vh,100svh)]
          overflow-hidden select-none
          pt-[calc(env(safe-area-inset-top,0px)+8px)]
          pb-[calc(env(safe-area-inset-bottom,0px)+16px)]
        "
        style={{
          paddingTop: isFullscreen ? 0 : undefined,
          paddingBottom: isFullscreen ? 0 : undefined,
        }}
      >
        

        {/* מוזיקת רקע (אופציונלי) – לא מפריעה אם אין קובץ */}
        <audio ref={bgMusicRef} src="/sounds/bg-music.mp3" muted className="hidden" />



        {/* Top bar (Back / Full / Menu) – תמיד מעל הקנבס */}
         <div
           className="pointer-events-none absolute inset-x-0"
           style={{ top: hudTop, zIndex: 4000 }}
           data-layer="topbar"
         >
          <div className="mx-auto max-w-[1024px] relative">
            {/* שמאל: Back */}
            <div className="absolute left-2 top-0 flex gap-2 pointer-events-auto">
              <button
               onClick={backSafe}
                aria-label="Back"
                className="h-10 w-10 rounded-xl bg-black/40 hover:bg-black/60 text-white grid place-items-center shadow"
                title="Back"
              >
                ←
              </button>
            </div>

            {/* ימין: Fullscreen + Menu */}
            <div className="absolute right-2 top-0 flex gap-2 pointer-events-auto">
              <button
                onClick={() => {
                  try { playSfx(S_CLICK); } catch {}
                  const el = wrapRef.current || document.documentElement;
                  if (!document.fullscreenElement) {
                    el.requestFullscreen?.().catch(()=>{});
                  } else {
                    document.exitFullscreen?.().catch(()=>{});
                  }
                }}
                aria-label="Fullscreen"
                className="h-10 px-3 rounded-xl bg-black/40 hover:bg-black/60 text-white flex items-center gap-2 shadow"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                <span className="text-base">⤢</span>
                <span className="text-xs opacity-80">{isFullscreen ? "Exit" : "Full"}</span>
              </button>

              <button
                onClick={() => { try { playSfx(S_CLICK); } catch {}; setMenuOpen(true); }}
                aria-label="Menu"
                className="h-10 w-10 rounded-xl bg-black/40 hover:bg-black/60 text-white grid place-items-center shadow"
                title="Menu"
              >
                ≡
              </button>
            </div>
          </div>
        </div>

        {/* ==== חלון תפריט (צד ימין) ==== */}
      {menuOpen && (
  <div
    className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-3"
    onClick={() => setMenuOpen(false)}
  >
    <div
      className="
        w-[86vw] max-w-[250px]   /* רוחב מקס' */
        max-h-[70vh]             /* גובה מקס' */
        bg-[#0b1220] text-white
        shadow-2xl rounded-2xl
        p-4 md:p-5               /* ריווח קטן יותר */
        overflow-y-auto
      "
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <h2 className="text-xl font-extrabold">Settings</h2>
        <button
          onClick={() => setMenuOpen(false)}
          className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 grid place-items-center"
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Wallet */}
      <div className="mb-3 space-y-2">
        <h3 className="text-sm font-semibold opacity-80">Wallet</h3>
        <div className="flex items-center gap-2">
  <button
    onClick={openWalletModalUnified}
    className={`px-3 py-2 rounded-md text-sm font-semibold ${
      isConnected
        ? "bg-emerald-500/90 hover:bg-emerald-500 text-white"  // Connected = ירוק
        : "bg-rose-500/90 hover:bg-rose-500 text-white"        // Disconnected = אדום
    }`}
  >
    {isConnected ? "Connected" : "Disconnected"}
  </button>

  {isConnected && (
    <button
      onClick={hardDisconnect}
      className="px-3 py-2 rounded-md text-sm font-semibold bg-rose-500/90 hover:bg-rose-500 text-white"
      title="Disconnect wallet"
    >
      Disconnect
    </button>
  )}
</div>

 {/* Connected address + copy */}
        {isConnected && address && (
          <button
            onClick={() => {
              try {
                navigator.clipboard.writeText(address).then(() => {
                  setCopiedAddr(true);
                  setTimeout(() => setCopiedAddr(false), 1500);
                });
              } catch {}
            }}
            className="mt-1 text-xs text-gray-300 hover:text-white transition underline underline-offset-2"
            title="Click to copy full address"
            aria-label="Copy wallet address"
          >
            {shortAddr(address)}
            {copiedAddr && <span className="ml-2 text-emerald-400 font-semibold">Copied!</span>}
          </button>
        )}
       </div>
      

      {/* Sound */}
      <div className="mb-4 space-y-2">
  <h3 className="text-sm font-semibold opacity-80">Sound</h3>
  <div className="flex items-center gap-2">
    <button
      onClick={() => setSfxMuted(v => !v)}
      className={`px-3 py-2 rounded-lg text-sm font-semibold ${
        sfxMuted
          ? "bg-rose-500/90 hover:bg-rose-500 text-white"      // OFF = אדום
          : "bg-emerald-500/90 hover:bg-emerald-500 text-white"// ON = ירוק
      }`}
    >
      SFX: {sfxMuted ? "Off" : "On"}
    </button>
    <button
      onClick={() => setMusicMuted(v => !v)}
      className={`px-3 py-2 rounded-lg text-sm font-semibold ${
        musicMuted
          ? "bg-rose-500/90 hover:bg-rose-500 text-white"      // OFF = אדום
          : "bg-emerald-500/90 hover:bg-emerald-500 text-white"// ON = ירוק
      }`}
    >
      Music: {musicMuted ? "Off" : "On"}
    </button>
  </div>
</div>


      <div className="mt-4 text-xs opacity-70">
        <p>HUD Overlay v1.0</p>
      </div>
    </div>
  </div>
)}



        {/* ===== Intro Overlay ===== */}
        {isMobileLandscape && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black text-white text-center p-6">
            <div>
              <h2 className="text-2xl font-extrabold mb-3">Please rotate your device to portrait.</h2>
              <p className="opacity-80">Landscape is not supported.</p>
            </div>
          </div>
        )}

        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-start pt-10 bg-black/80 z-[50] text-center p-6">
            <img src="/images/leo-intro.png" alt="Leo" width={160} height={160} className="mb-4 rounded-full" />
            <h1 className="text-3xl sm:text-4xl font-extrabold text-yellow-400 mb-2">⛏️ MLEO Miners</h1>

            <p className="text-sm sm:text-base text-gray-200 mb-4">Merge miners, break rocks, earn gold.</p>

            {firstTimeNeedsTerms && (
              <div className="mb-4 w-full max-w-md">
                <div className="px-3 py-2 rounded-lg bg-yellow-300/20 text-yellow-200 border border-yellow-300/40 text-xs sm:text-sm">
                  You must read and accept the <b>Terms &amp; Conditions</b> before playing for the first time.
                </div>
              </div>
            )}

            <div className="flex gap-3 flex-wrap justify-center">
              {/* במסך פתיחה: טוגל חיבור/ניתוק */}
              <button
                onClick={toggleWallet}
                className="px-5 py-3 font-bold rounded-lg text-base shadow bg-indigo-400 hover:bg-indigo-300 text-black"
              >
                {isConnected ? "DISCONNECT" : "CONNECT WALLET"}
              </button>

              <button
                onClick={async () => {
                  try { play?.(S_CLICK); } catch {}
                  if (firstTimeNeedsTerms) { setShowTerms(true); return; }
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

              <button
                onClick={() => setShowMiningInfo(true)}
                className="px-5 py-3 font-bold rounded-lg text-base shadow bg-cyan-400 hover:bg-cyan-300 text-black"
              >
                MINING
              </button>

              <button
                onClick={() => setShowTerms(true)}
                className="px-5 py-3 font-bold rounded-lg text-base shadow bg-teal-400 hover:bg-teal-300 text-black"
              >
                TERMS
              </button>
            </div>
          </div>
        )}

        {/* --- אל תסגור כאן את </div> / </Layout> / );  ---
             המשך PART 9/10 נכנס ישר אחרי זה בתוך אותו wrapper */}
        
{/* === END PART 8 (OPEN) === */}




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
                  const gain = Math.round(base * 0.50);
                  s.gold += gain; setUi(u => ({ ...u, gold: s.gold }));

                  const until = Date.now() + 10*60*1000;
                  s.adCooldownUntil = until;
                  setAdCooldownUntil(until);
                  try {
                    const raw = localStorage.getItem(LS_KEY);
                    const data = raw ? JSON.parse(raw) : {};
                    data.adCooldownUntil = until;
                    localStorage.setItem(LS_KEY, JSON.stringify(data));
                  } catch {}

                  setCenterPopup({ text: `🎬 +${formatShort(gain)} coins`, id: Math.random() });
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

{/* ===== Unified Canvas wrapper (no lanes changes) ===== */}
<div
  id="miners-canvas-wrap"
    className="relative z-[0] w-full rounded-2xl overflow-hidden mt-1 mx-auto border border-slate-700"

  style={{
    maxWidth: isDesktop ? "1024px" : "680px",
    // שמירה על גובה מלא-מסך גם ב-iOS (עם פולבאקים בטוחים)
    height: "calc(var(--app-100vh, 100svh) - var(--header-h, 0px))",
    minHeight: "min(100vh, var(--app-100vh, 100svh))",
    // בדסקטופ יחס קלאסי; במובייל מחזירים 9/16 כמו בגרסה היציבה
    aspectRatio: isDesktop ? "4 / 3" : "9 / 16",
  }}
>
  <canvas
    id="miners-canvas"
    ref={canvasRef}
    className="relative z-[0] w-full h-full block touch-none select-none"
  />

{SHOW_FLOATING_RESET && (
  <div
    className="absolute left-2 sm:left-3 z-[40]"
    style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
  >
    <button
      onClick={() => setShowResetConfirm(true)}
      className="px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 ring-2 ring-rose-300 text-white font-extrabold text-xs shadow-md active:scale-95"
      title="Reset all progress"
    >
      RESET
    </button>
  </div>
)}


         {/* ==== TOP HUD ==== */}
         {!showIntro && (
         <div
         className="absolute left-1/2 -translate-x-1/2 z-[3000] w-[calc(100%-16px)] max-w-[980px]"
           style={{ top: hudTop }}
         >
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-center mb-2">
            MLEO — MINERS
          </h1>


        {/* Wallet status (clickable) — טוגל */}
<div
  className="absolute z-[40]"
  style={{ top: "0rem", left: "calc(env(safe-area-inset-left, 0px) + 36px)" }}
>
<button
  onClick={toggleWallet}
  className={[
    "inline-flex items-center gap-1",
    "h-4 px-1 rounded font-normal text-[9px] leading-none",
    "backdrop-blur-sm ring-1 shadow-sm",
    isConnected
      ? "bg-emerald-500/20 ring-emerald-300/40 text-emerald-200"
      : "bg-rose-500/20 ring-rose-300/40 text-rose-200"
  ].join(" ")}
>
  {isConnected ? (
    <span className="w-1 h-1 rounded-full bg-emerald-400" />
  ) : (
    <span className="w-1 h-1 rounded-full border border-rose-500" />
  )}
  <span>{isConnected ? "Connected" : "Not connected"}</span>
</button>

</div>



          {/* keep glow keyframes for diamonds + global UI pulses */}
          <style jsx global>{`
            @keyframes glowPulse {
              0% { opacity: .55; transform: scale(.98); }
              50% { opacity: 1; transform: scale(1); }
              100% { opacity: .55; transform: scale(.98); }
            }
            @keyframes glowRing {
              0% { opacity: .6; }
              50% { opacity: 1; }
              100% { opacity: .6; }
            }
            /* === added for CLAIM glow === */
            @keyframes btnPulse {
              0%   { box-shadow:0 0 0 0 rgba(250,204,21,.45); }
              70%  { box-shadow:0 0 0 10px rgba(250,204,21,0); }
              100% { box-shadow:0 0 0 0 rgba(250,204,21,0); }
            }
            /* === added for digits nudge === */
            @keyframes nudge {
              0%,100% { transform: translateY(0); }
              50%     { transform: translateY(-1px); }
            }
          `}</style>

          <div className="flex gap-2 flex-wrap justify-center items-center text-sm">
            {/* Coins + status dot + ad ring */}
            <button
              onClick={()=>setHudModal('coins')}
              className="px-2 py-1 rounded-lg flex items-center gap-2 hover:bg-white/10"
              aria-label="Coins info"
            >

{/* ONLINE/OFFLINE dot — placed to the LEFT of the coin */}
              <div
                className="w-2.5 h-2.5 rounded-full ring-2 ring-black/40"
                title={onlineDotTitle}
                style={{ backgroundColor: isOnline ? "#22c55e" : (stateRef.current?.isIdleOffline ? "#f59e0b" : "#94a3b8") }}
              />
              <div className="relative w-8 h-8 rounded-full grid place-items-center" title={addRemainMs > 0 ? `Next ad in ${addRemainLabel}` : "Ad bonus ready"}>
                <div className="absolute inset-0 rounded-full" style={ringBg(addProgress)} />
                <img src={IMG_COIN} alt="coin" className="w-7 h-7" />
              </div>
              <b>{formatShort1(stateRef.current?.gold ?? 0)}</b>
            </button>

            {/* DPS */}
            <button onClick={()=>setHudModal('dps')} className="px-2 py-1 rounded-lg hover:bg-white/10">
              🪓 x<b>{(stateRef.current?.dpsMult || 1).toFixed(1)}</b>
            </button>

            {/* GOLD */}
            <button onClick={()=>setHudModal('gold')} className="px-2 py-1 rounded-lg hover:bg-white/10">
              🟡 x<b>{(stateRef.current?.goldMult || 1).toFixed(1)}</b>
            </button>

            {/* Spawn LV (with inline counter) */}
            <button
              onClick={()=>setHudModal('spawn')}
              className="px-2 py-1 rounded-lg hover:bg-white/10"
              title={`Next Spawn Level in ${toNextLv} purchases`}
            >
              <span className="inline-flex items-baseline gap-1 leading-none">
                <span>🦊 LV</span>
                <b className="leading-none">{stateRef.current?.spawnLevel || 1}</b>
                <span className="text-[11px] leading-none opacity-80 relative -top-[1px]">
                  ({toNextLv})
                </span>
              </span>
            </button>

            {/* Diamonds */}
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
            <button onClick={()=>setHudModal('gifts')} className="px-2 py-1 rounded-lg hover:bg-white/10">
              {`⏳ ${(_getPhaseInfo(stateRef.current, Date.now()).intervalSec)}s `}
            </button>

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

              {/* 🦊 ring */}
              <button
                onClick={()=>setHudModal('dogRing')}
                className="relative w-8 h-8 rounded-full grid place-items-center hover:opacity-90 active:scale-95 transition"
                title={`Auto-dog every ${Math.round(DOG_INTERVAL_SEC/60)}m (bank up to ${DOG_BANK_CAP})`}
                aria-label="Auto-dog info"
              >
                <div className="absolute inset-0 rounded-full" style={ringBg(dogProgress)} />
                <div className="text-[22px] font-extrabold leading-none">🦊</div>
              </button>

{/* === [GAIN] button (RING like 🎁/🦊, same size) === */}
<button
  onClick={() => setShowGainModal(true)}
  className="relative w-8 h-8 rounded-full grid place-items-center hover:opacity-90 active:scale-95 transition"
  title={`GAIN ${addRemainMs > 0 ? `in ${addRemainLabel}` : "ready"}`}
  aria-label="GAIN info"
>
  {/* טבעת ספירה בדיוק כמו 🎁/🦊 */}
  <div className="absolute inset-0 rounded-full" style={ringBg(addProgress)} />
  {/* האייקון עצמו */}
  <div className="text-[20px] font-extrabold leading-none">▶️</div>
</button>
{/* === END GAIN button === */}



            </div>
          </div>

          {/* Actions row */}
          <div className="flex gap-2 mt-2 flex-wrap justify-center text-sm">

          {/* ADD (spawn) — שורה 1: + [אייקון] (LV N) ; שורה 2: מחיר בלבד */}
<button
  onClick={addMiner}
  disabled={!canBuyMiner}
  className={`${BTN_BASE} ${BTN_H_FIX} ${BTN_W_FIX} ${
    canBuyMiner
      ? "bg-emerald-500 hover:bg-emerald-400 ring-emerald-300 text-slate-900"
      : `bg-emerald-500 ring-emerald-300 text-slate-900 ${BTN_DIS}`
  }`}
>
<div className="flex flex-col items-center justify-center leading-tight">
  {/* שורה ראשונה */}
  <div className="flex items-center gap-1">
    {/* האייקון קודם */}
   <span
  className="relative inline-grid place-items-center"
  style={{
    width: UI_SPAWN_ICON_BOX * 2.0,
    height: UI_SPAWN_ICON_BOX * 1.0,
    marginLeft: -8,            // <<< הזזה שמאלה ~8px
  }}
>

      <img
        src={IMG_SPAWN_ICON}
        alt="dog"
        className="pointer-events-none object-cover block"
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${((typeof window!=="undefined" && window.SPAWN_ICON_ZOOM) || UI_SPAWN_ICON_ZOOM)}) translateY(${((typeof window!=="undefined" && window.SPAWN_ICON_SHIFT_Y) || UI_SPAWN_ICON_SHIFT_Y)}px)`,
          transformOrigin: "center",
        }}
      />
    </span>

    {/* ואז סימן הפלוס */}
    <span className="font-extrabold">+</span>

    <b className="tracking-tight">(LV {stateRef.current?.spawnLevel || 1})</b>
  </div>

{/* שורה שנייה – רק המחיר, ממוקם בקצה הימני */}
<div className="!text-[14px] md:!text-[16px] mt-0.5 tabular-nums font-extrabold leading-tight self-end mr-1">
  {formatShort1(spawnCostNow)}
</div>


</div>

</button>

{/* DPS — שורה 1: 🪓 +10% ; שורה 2: מחיר בלבד */}
<button
  onClick={upgradeDps}
  disabled={!canBuyDps}
  className={`${BTN_BASE} ${BTN_H_FIX} ${BTN_W_FIX} ${
        canBuyDps
      ? "bg-sky-500 hover:bg-sky-400 ring-sky-300 text-slate-900"
      : `bg-sky-500 ring-sky-300 text-slate-900 ${BTN_DIS}`
  }`}
>
  <div className="flex flex-col items-center justify-center leading-tight">
    <div className="flex items-center gap-1">
      <span>🪓</span>
      <span className="font-extrabold">+10%</span>
    </div>
    <div className="!text-[14px] md:!text-[16px] mt-0.5 tabular-nums font-extrabold leading-tight self-end mr-1">
      {formatShort1(dpsCostNow)}
    </div>
  </div>
</button>

{/* GOLD — שורה 1: 🟡 +10% ; שורה 2: מחיר בלבד */}
<button
  onClick={upgradeGold}
  disabled={!canBuyGold}
  className={`${BTN_BASE} ${BTN_H_FIX} ${BTN_W_FIX} ${
    canBuyGold
      ? "bg-amber-400 hover:bg-amber-300 ring-amber-300 text-slate-900"
      : `bg-amber-400 ring-amber-300 text-slate-900 ${BTN_DIS}`
  }`}
>
  <div className="flex flex-col items-center justify-center leading-tight">
    <div className="flex items-center gap-1">
      <span>🟡</span>
      <span className="font-extrabold">+10%</span>
    </div>
    <div className="!text-[14px] md:!text-[16px] mt-0.5 tabular-nums font-extrabold leading-tight self-end mr-1">
      {formatShort1(goldCostNow)}
    </div>
  </div>
</button>

                </div>

          {/* Mining status + CLAIM */}
          <div className="w-full flex justify-center mt-1">
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
              {/* Icon button */}
              {/* MLEO (icon + number) — both clickable */}
<button
  onClick={() => setShowMleoModal(true)}
  className={`relative inline-flex items-center gap-2 px-2 py-1 rounded-md transition
    ${(mining?.balance || 0) > 0 ? "hover:bg-white/10 active:scale-95 cursor-pointer" : "opacity-90"}`}
  aria-label="Open MLEO details"
  title="Open MLEO details"
>
  <div className="relative w-6 h-6 rounded-full grid place-items-center">
    {(mining?.balance || 0) > 0 && (
      <span
        aria-hidden
        className="absolute -inset-px rounded-full"
        style={{
          animation: "glowPulse 1.2s infinite",
          border: "2px solid rgba(250,204,21,.8)",
          boxShadow: "0 0 10px rgba(250,204,21,.55), 0 0 20px rgba(250,204,21,.35)"
        }}
      />
    )}
    <img src={IMG_TOKEN} alt="MLEO" className="w-6 h-6 rounded-full pointer-events-none" />
  </div>

  <span
    className={`text-yellow-300 font-extrabold tabular-nums ${
      (mining?.balance || 0) > 0 ? "inline-block" : ""
    }`}
    style={(mining?.balance || 0) > 0 ? { animation: "nudge 1.8s ease-in-out infinite" } : undefined}
  >
    {formatMleoShort1(mining?.balance || 0)} MLEO

  </span>
</button>


              <button
                onClick={onClaimMined}
                disabled={claiming || (mining?.balance || 0) <= 0}
                className={`relative px-2.5 py-1 rounded-md font-extrabold transition active:scale-95
                  ${(mining?.balance || 0) > 0 && !claiming
                    ? "bg-yellow-400 hover:bg-yellow-300 text-black cursor-pointer"
                    : "bg-slate-500 text-white/70 cursor-not-allowed"
                  }`}
                title={(mining?.balance || 0) > 0 ? "Claim" : "No tokens to claim"}
              >
                {(mining?.balance || 0) > 0 && !claiming && (
                  <span
                    aria-hidden
                    className="absolute -inset-1 rounded-lg"
                    style={{ animation: "btnPulse 1.8s ease-in-out infinite" }}
                  />
                )}
                CLAIM
              </button>

              {/* VAULT */}
              <button
                onClick={() => setShowMiningInfo(true)}
                className="ml-2 text-gray-300 hover:text-white underline-offset-2 hover:underline"
                title="Open Mining"
              >
Vault: <b className="text-cyan-300 tabular-nums">{formatMleoShort1(mining?.vault || 0)}</b> MLEO


              </button>
            </div>
          </div>

        </div>
)}

        {/* === END PART 9 === */}


{/* === START PART 10 === */}
        {/* Toast ממורכז ומעל ה-HUD */}
        {giftToast && (
          <div className="fixed inset-0 z-[10002] flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto px-6 py-4 rounded-2xl font-extrabold text-black shadow-2xl bg-gradient-to-br from-yellow-300 to-amber-400 border border-yellow-200 text-center animate-[popfade_1.8s_ease-out_forwards]">
              {giftToast.text}
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
              <b className="text-yellow-300">
                {formatShort(stateRef.current?.pendingOfflineGold || 0)}
              </b>{" "}
              coins and{" "}
             <b className="text-yellow-300">
  {formatMleoShort(stateRef.current?.pendingOfflineMleo || 0)}

</b>{" "}
MLEO

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

      {/* How to Play modal */}
      {showHowTo && (
        <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 max-w-md w-full rounded-2xl p-6 shadow-2xl overflow-auto max-h-[85vh]">
            <h2 className="text-2xl font-extrabold mb-3">How to Play</h2>

            <div className="space-y-4 text-sm text-slate-700">
              <section>
                <h3 className="font-bold text-slate-900 mb-1">Goal</h3>
                <p>
                  Merge dogs (miners), break rocks, and earn <b>Coins</b>. Coins are an in-game
                  resource used for upgrades and buying more miners. Some activity in the
                  game can also accrue <b>MLEO</b> (see “Mining &amp; Tokens” below).
                </p>
              </section>

              <section>
                <h3 className="font-bold text-slate-900 mb-1">Board &amp; Merging</h3>
                <ol className="list-decimal ml-5 space-y-1">
                  <li>Tap <b>ADD</b> on an empty slot to place a dog. Cost rises over time.</li>
                  <li>Drag two dogs of the same level together to merge into a higher level.</li>
                  <li>Each dog adds damage per second (DPS) to its lane. When a rock breaks you receive Coins.</li>
                </ol>
              </section>

              <section>
                <h3 className="font-bold text-slate-900 mb-1">Upgrades &amp; Bonuses</h3>
                <ul className="list-disc ml-5 space-y-1">
                  <li><b>DPS</b> upgrades make rocks break faster.</li>
                  <li><b>GOLD</b> upgrades increase the Coins you receive from each rock by 10% per upgrade.</li>
                  <li>Gifts, auto-dogs and other bonuses may appear from time to time. Exact timings, drop types and balance values are dynamic and may change without notice.</li>
                  <li>Diamonds can be collected and spent for special rewards. Availability and rewards are not guaranteed.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-slate-900 mb-1">Mining &amp; Tokens (MLEO)</h3>
                <ul className="list-disc ml-5 space-y-1">
                  <li><b>How MLEO is accrued:</b> Only breaking rocks can generate MLEO. A portion of the Coins you earn from rock breaks may convert into MLEO at a variable rate that is subject to in-game balancing, daily limits and anti-abuse protections.</li>
                  <li><b>Daily limits &amp; tapering:</b> To keep things fair, daily accrual may taper as you approach your personal limit for the day. Limits and calculations are internal and can change.</li>
                  <li><b>Offline progress:</b> Limited offline progress is simulated at a reduced efficiency compared to active play. Exact values are internal and may change.</li>
                  <li><b>CLAIM:</b> Your accrued MLEO appears as a balance. Claiming moves it into your in-game <b>Vault</b>. If/when on-chain claims become available, additional unlock windows and restrictions may apply.</li>
                  <li><b>No value promise:</b> MLEO in this game is a <u>utility token for entertainment</u>. It has no intrinsic or guaranteed monetary value. Nothing here is an offer, solicitation, or promise of future value.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-slate-900 mb-1">Good to Know</h3>
                <ul className="list-disc ml-5 space-y-1">
                  <li>Game balance, drop rates, limits and schedules are dynamic and may be changed, paused or reset at any time for stability, fairness or maintenance.</li>
                  <li>Progress may be adjusted to address bugs, exploits or abuse.</li>
                  <li>This is a casual game for fun. It is not financial advice and not an investment product.</li>
                </ul>
              </section>
            </div>

            <div className="flex justify-end gap-2 mt-4">
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

      {/* Terms modal */}
      {showTerms && (
        <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 max-w-md w-full rounded-2xl p-6 shadow-2xl overflow-auto max-h-[85vh]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-extrabold">Terms &amp; Conditions</h2>
              <button onClick={() => setShowTerms(false)} className="px-3 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-sm font-extrabold">Close</button>
            </div>

           <div className="text-sm text-slate-700 space-y-4 text-left">
  <section>
    <h3 className="font-bold text-slate-900 mb-1">1) Acceptance of Terms</h3>
    <p>By accessing or using the game, you agree to these Terms &amp; Conditions (“Terms”). We may update them in-app; continued use is acceptance.</p>
  </section>

  <section>
    <h3 className="font-bold text-slate-900 mb-1">2) Entertainment-Only; No Monetary Value</h3>
    <p>Coins and “MLEO” are utility features for gameplay. They are not money, securities, or financial instruments, and carry no promise of price, liquidity, profit or future value.</p>
  </section>

  <section>
    <h3 className="font-bold text-slate-900 mb-1">3) No Financial Advice</h3>
    <p>Nothing here is investment, legal, accounting or tax advice. You are solely responsible for your decisions.</p>
  </section>

  <section>
    <h3 className="font-bold text-slate-900 mb-1">4) Gameplay, Balancing &amp; Progress</h3>
    <ul className="list-disc ml-5 space-y-1">
      <li>Rates/limits/drop tables/schedules/offline behavior are internal and may change, pause or reset at any time.</li>
      <li>We may adjust/rollback progress to address bugs, exploits or irregular activity.</li>
      <li>Feature availability may depend on time, region, device or account status.</li>
    </ul>
  </section>

  <section>
    <h3 className="font-bold text-slate-900 mb-1">5) Mining, Vault &amp; Claims</h3>
    <ul className="list-disc ml-5 space-y-1">
      <li>Only certain actions (e.g., breaking rocks) may accrue MLEO under variable, capped rules.</li>
      <li>“CLAIM” moves accrued MLEO to your in-game <b>Vault</b>. If on-chain claims open later, they may be subject to unlock windows, rate limits, eligibility checks and other restrictions.</li>
      <li>We may change, delay or discontinue vaulting and/or on-chain claiming at any time.</li>
    </ul>
  </section>

  <section>
    <h3 className="font-bold text-slate-900 mb-1">6) Wallets &amp; Third-Party Services</h3>
    <ul className="list-disc ml-5 space-y-1">
      <li>Wallet connection is optional and via third parties outside our control. Keep your devices, keys and wallets secure.</li>
      <li>Blockchain transactions are irreversible and may incur network fees. We are not responsible for losses due to user error, phishing, gas volatility, forks/reorgs, downtime or smart-contract risks.</li>
    </ul>
  </section>

  <section>
    <h3 className="font-bold text-slate-900 mb-1">7) Fair Play &amp; Prohibited Conduct</h3>
    <ul className="list-disc ml-5 space-y-1">
      <li>No bots, automation, multi-account abuse, exploits, reverse engineering or service interference.</li>
      <li>We may suspend, reset or terminate access and remove balances obtained through prohibited behavior.</li>
    </ul>
  </section>

  <section>
    <h3 className="font-bold text-slate-900 mb-1">8) Availability, Data &amp; Updates</h3>
    <ul className="list-disc ml-5 space-y-1">
      <li>Service may be unavailable, interrupted or updated at any time.</li>
      <li>We may modify/discontinue features, wipe test data or migrate saves.</li>
    </ul>
  </section>

  <section>
    <h3 className="font-bold text-slate-900 mb-1">9) Airdrops, Promotions &amp; Rewards</h3>
    <p>Any events or rewards are discretionary, may change, and can have eligibility requirements. Participation does not guarantee receipt or value.</p>
  </section>

  <section>
    <h3 className="font-bold text-slate-900 mb-1">10) Taxes</h3>
    <p>You are solely responsible for any taxes related to your use of the game and any rewards you may receive.</p>
  </section>

  <section>
    <h3 className="font-bold text-slate-900 mb-1">11) Limitation of Liability</h3>
    <p>To the maximum extent permitted by law, we are not liable for indirect/special/consequential damages or loss of data/tokens/profits/opportunities.</p>
  </section>

  <section>
    <h3 className="font-bold text-slate-900 mb-1">12) Indemnity</h3>
    <p>You agree to indemnify and hold us harmless from claims or expenses arising from your use of the game or violation of these Terms.</p>
  </section>

  <section>
    <h3 className="font-bold text-slate-900 mb-1">13) Governing Law &amp; Disputes</h3>
    <p>These Terms are governed by the laws of <b>[insert jurisdiction]</b>. Disputes resolved exclusively in <b>[insert venue]</b>.</p>
  </section>

  <section>
    <h3 className="font-bold text-slate-900 mb-1">14) Contact</h3>
    <p>Questions? <b>[insert contact email]</b>.</p>
  </section>
</div>


            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  acceptTerms();
                  setFirstTimeNeedsTerms(false);
                  setShowTerms(false);
                }}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 font-bold"
              >
                I Agree
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HUD Info modal (Coins/DPS/GOLD/Spawn/Gifts/🎁/🦊) */}
      {hudModal && (
        <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 max-w-sm w-full rounded-2xl p-6 shadow-2xl overflow-auto max-h-[85vh]">
            <h2 className="text-xl font-extrabold mb-2">{getHudModalTitle(hudModal)}</h2>
            <p className="text-sm text-slate-700 whitespace-pre-line">
              {getHudModalText(hudModal)}
            </p>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setHudModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-extrabold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

{/* === [GAIN] Modal (ADD) === */}
{showGainModal && (
  <div className="fixed inset-0 z-[10060] bg-black/60 backdrop-blur-sm grid place-items-center p-4">
    <div className="w-full max-w-md rounded-2xl bg-zinc-900 text-white border border-white/10 shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="text-lg font-semibold">GAIN — How it works</h3>
        <button
          onClick={() => setShowGainModal(false)}
          className="px-2 py-1 rounded hover:bg-white/10"
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-4 space-y-3 text-sm leading-6">
        <p>
          GAIN is a special reward. Follow the steps to enable it and receive the bonus.
        </p>

        {/* Dynamic status bar */}
        <div className="rounded-lg bg-black/40 border border-white/10 p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Status</span>
            <span className={`px-2 py-0.5 rounded text-xs ${!addDisabled ? "bg-green-500 text-black" : "bg-zinc-700 text-white/80"}`}>
  {!addDisabled ? "Available" : "Not available"}
</span>

          </div>
          <p className="mt-2 text-white/80">
            {!addDisabled
  ? "Your GAIN is ready. Press WATCH to proceed and claim it."
  : `GAIN will become available in ${addRemainLabel}.`}

          </p>
        </div>

        {/* Instructions — replace copy with your exact flow */}
        <ul className="list-disc list-inside space-y-1 text-white/80">
          <li>Complete the required action to enable GAIN.</li>
          <li>When ready, press WATCH to activate it and receive the reward.</li>
          <li>If disabled, please wait until conditions are met.</li>
        </ul>
      </div>

      <div className="px-4 pb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => setShowGainModal(false)}
          className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10"
        >
          Close
        </button>

<button
  onClick={() => {
    if (addDisabled) return;   // עדיין בהמתנה
    setShowGainModal(false);   // סגור את מודאל ההסבר
    onAdd();                   // 👈 אותו אקשן שהיה על כפתור GAIN הישן
  }}
  disabled={addDisabled}
  className={`px-4 py-2 rounded-lg font-semibold border ${
    !addDisabled
      ? "bg-emerald-500 text-black border-emerald-400"
      : "bg-zinc-700 text-white/50 border-white/10 cursor-not-allowed"
  }`}
  title={!addDisabled ? "Watch and claim" : "Not available yet"}
>
  {!addDisabled ? "WATCH" : "WATCH (disabled)"}
</button>


      </div>
    </div>
  </div>
)}
{/* === [GAIN] END Modal === */}


         {/* Diamonds modal */}
      {showDiamondInfo && (() => {
        const s = stateRef.current || {};
        const diamonds = Number(s.diamonds || 0);

        const prizeLabel = (() => {
          switch (s.nextDiamondPrize) {
            case "coins_x10":   return "10x gift";
            case "coins_x100":  return "100x gift";
            case "coins_x1000": return "1000x gift";
            case "dog+3":       return "Dog +3 levels";
            case "dog+5":       return "Dog +5 levels";
            case "dog+7":       return "Dog +7 levels";
            default:            return s.nextDiamondPrize || "";
          }
        })();

        const ready = diamonds >= 3;

        return (
          <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 max-w-sm w-full rounded-2xl p-6 shadow-2xl overflow-auto max-h-[85vh]">
              <h2 className="text-xl font-extrabold mb-1">Diamonds</h2>

              <p className="text-xs text-slate-600 mb-3">
                Collect <b>3</b> diamonds to open a chest. You can hold more than 3 and open rewards whenever you choose.
                Possible rewards: <b>10x</b>/<b>100x</b>/<b>1000x</b> coin gifts or a <b>Dog</b> boost (+3/+5/+7 levels).
              </p>

              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div className="p-3 rounded-xl bg-slate-100">
                  <div className="text-slate-500 text-xs">Diamonds</div>
                  <div className="font-extrabold text-slate-900">{diamonds} / 3</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-100">
                  <div className="text-slate-500 text-xs">Next Prize</div>
                  <div className="font-extrabold text-slate-900">{prizeLabel}</div>
                </div>
              </div>

              <div className="flex justify-between gap-2">
                <button
                  onClick={() => setShowDiamondInfo(false)}
                  className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 font-extrabold"
                >
                  Close
                </button>
                <button
                  onClick={() => { openDiamondChestIfReady(); }}
                  disabled={!ready}
                  className={`px-4 py-2 rounded-lg font-extrabold ${ready ? "bg-yellow-400 hover:bg-yellow-300 text-black" : "bg-slate-300 text-slate-500 cursor-not-allowed"}`}
                  title={ready ? "Open chest" : "Need 3 diamonds"}
                >
                  OPEN CHEST
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MLEO quick modal (נפתח מלחיצה על אייקון ה-MLEO ב-HUD) + כפתור CLAIM */}
      {showMleoModal && (
        <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 max-w-sm w-full rounded-2xl p-6 shadow-2xl overflow-auto max-h-[85vh]">
            <h2 className="text-xl font-extrabold mb-3">MLEO</h2>

            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="p-3 rounded-xl bg-slate-100">
                <div className="text-slate-500 text-xs">Balance</div>
                <div className="font-extrabold text-slate-900 tabular-nums">
                  {formatMleo2(Number(mining?.balance || 0))} MLEO
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-100">
                <div className="text-slate-500 text-xs">Mined Today</div>
                <div className="font-extrabold text-slate-900 tabular-nums">
                  {formatMleo2(Number(mining?.minedToday || 0))} / {formatShort(DAILY_CAP)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-100">
                <div className="text-slate-500 text-xs">Vault</div>
                <div className="font-extrabold text-slate-900 tabular-nums">
                  {formatMleo2(Number(mining?.vault || 0))} MLEO
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-100">
                <div className="text-slate-500 text-xs">Claimed (Total)</div>
                <div className="font-extrabold text-slate-900 tabular-nums">
                  {formatMleo2(Number(mining?.claimedTotal || 0))} MLEO
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-2">
              <button
                onClick={() => setShowMleoModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 font-extrabold"
              >
                Close
              </button>
              <button
                onClick={onClaimMined}
                disabled={claiming || (Number(mining?.balance || 0) <= 0)}
                className={`px-4 py-2 rounded-lg font-extrabold ${
                  (Number(mining?.balance || 0) > 0) && !claiming
                    ? "bg-yellow-400 hover:bg-yellow-300 text-black"
                    : "bg-slate-300 text-slate-500 cursor-not-allowed"
                }`}
                title={(Number(mining?.balance || 0) > 0) ? "Claim" : "No tokens to claim"}
              >
                CLAIM
              </button>
            </div>
          </div>
        </div>
      )}


           {/* Mining modal (Wallet connect + Claim UI) */}
      {showMiningInfo && (() => {
        const vault   = Number(mining?.vault || 0);
        const bal     = Number(mining?.balance || 0);
        const mined   = Number(mining?.minedToday || 0);
        const claimed = Number(mining?.claimedTotal || 0);

        const pct100   = Math.round(currentClaimPct(Date.now()) * 100);
        const canWallet = TOKEN_LIVE && walletClaimEnabled(Date.now());
        const room      = remainingWalletClaimRoom();
        const hasRoom   = room > 0;

        return (
          <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white text-slate-900 max-w-md w-full rounded-2xl p-6 shadow-2xl overflow-auto max-h-[85vh]">
              <h2 className="text-2xl font-extrabold mb-1">Mining &amp; Tokens</h2>
              <div className="text-xs text-slate-600 mb-4">Local demo accrual and vaulting.</div>

              {/* Release bar + TGE countdown */}
              <div className="mb-3">
                <WalletReleaseBar />
                <div className="flex items-center justify-between text-xs">
                  <span>Unlock progress: <b>{pct100}%</b></span>
                  <TgeCountdown />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                <div className="p-3 rounded-xl bg-slate-100">
                  <div className="text-slate-500 text-xs">Balance</div>
                  <div className="font-extrabold text-slate-900 tabular-nums">
                    {formatMleo2(bal)} MLEO
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-100">
                  <div className="text-slate-500 text-xs">Mined Today</div>
                  <div className="font-extrabold text-slate-900 tabular-nums">
                    {formatMleo2(mined)} / {formatShort(DAILY_CAP)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-100">
                  <div className="text-slate-500 text-xs">Vault</div>
                  <div className="font-extrabold text-slate-900 tabular-nums">
                    {formatMleo2(vault)} MLEO
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-100">
                  <div className="text-slate-500 text-xs">Claimed (Total)</div>
                  <div className="font-extrabold text-slate-900 tabular-nums">
                    {formatMleo2(claimed)} MLEO
                  </div>
                </div>
              </div>

              {/* Wallet actions */}
              <div className="mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      if (!isConnected) {
                        openConnectModal?.();
                      } else {
                        // פותח חלון ארנק ואז מודיע "COMING SOON"
                        openAccountModal?.();
                        setGiftToastWithTTL("COMING SOON");
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg font-extrabold text-xs active:scale-95 ${
                      isConnected
                        ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                        : "bg-indigo-500 hover:bg-indigo-400 text-white"
                    }`}
                  >
                    {isConnected ? "WALLET" : "CONNECT WALLET"}
                  </button>

                  <button
                    onClick={onClaimMined}
                    disabled={
                      claiming ||
                      bal <= 0 ||
                      (TOKEN_LIVE && (!canWallet || !hasRoom))
                    }
                    className={`px-3 py-1.5 rounded-lg font-extrabold text-xs active:scale-95 ${
                      (!TOKEN_LIVE || (canWallet && hasRoom && bal > 0)) && !claiming
                        ? "bg-yellow-400 hover:bg-yellow-300 text-black"
                        : "bg-slate-300 text-slate-500 cursor-not-allowed"
                    }`}
                    title={
                      !TOKEN_LIVE
                        ? "Claim to Vault (demo)"
                        : canWallet
                          ? (hasRoom ? "Claim to Wallet" : "No wallet claim room yet")
                          : "Wallet claim locked"
                    }
                  >
                    {TOKEN_LIVE ? "CLAIM TO WALLET" : "CLAIM TO VAULT"}
                  </button>
                </div>

                {TOKEN_LIVE && (
                  <p className="text-[11px] text-slate-600 mt-2">
                    Wallet claims unlock gradually after TGE.
                    Available now: <b>{formatMleo(room)}</b> MLEO.
                  </p>
                )}
              </div>

              {/* Notes */}
              <div className="text-xs text-slate-600 border-t pt-3">
                <p>
                  In demo mode, <b>CLAIM</b> moves your MLEO to the in-game <b>Vault</b>.
                  When on-chain claims go live, this button will switch to wallet claiming
                  with unlock rules.
                </p>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowMiningInfo(false)}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-extrabold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}


    </div>
  </Layout>
);
}
// === END PART 10 ===