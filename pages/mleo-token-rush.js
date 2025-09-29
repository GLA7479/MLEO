// ============================================================================
// pages/mleo-token-rush.js
// MLEO Token Rush — enriched version (Combo, Modifiers, Quests, Tech Tree,
// Lucky Gift, Daily XP, Time Chest, Bank-Risk, Guild Wars, Referral & Squads).
// Language: code in English, comments & parts labels in Hebrew.
// Tailwind UI. Self-contained. Safe to paste into Next.js pages/.
// ============================================================================

/*
================================================================================
=                               PART 0 — OVERVIEW                              =
================================================================================
תוספות עיקריות:
• Quick Wins: Combo Heat, Modifiers (Weather mini-events), Lucky Gift, Daily XP bar, juice.
• Feature Layer: Quests (Daily/Weekly), Tech Tree (ללא Prestige), Bank-Risk mini-game, Time Chest.
• Meta/Live Ops: Guild Wars (דמו לוקאלי), Referral & Squads (לוקאלי).
• Anti-bot עדין + הוגנות. אין Seasons / Weekend Events / Achievements לפי בקשה.
*/

import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient   // ✅ עכשיו זה נכון
} from "wagmi";
import { useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";
import Link from "next/link";




// ============================================================================
// PART 1 — CONFIG & CONSTANTS
// ============================================================================
const LS_KEYS = {
  CORE: "mleo_token_rush_core_v2.1",
  SESSION: "mleo_token_rush_session_v2.1",
  LEADERBOARD: "mleo_token_rush_lb_v1.1",
  QUESTS: "mleo_token_rush_quests_v1.1",
  SOCIAL: "mleo_token_rush_social_v1.1",
  TECH: "mleo_token_rush_tech_v1.1",
  GUILDWARS: "mleo_token_rush_gw_v1.1",
};

// קובץ ה-Core של המשחק הישן (mleo-miners) ב-localStorage — לשימוש ה־Bridge
const OTHER_GAME_CORE_KEY = "mleo_miners_v6_core";

// ---- ENV ----
const ENV = {
  CLAIM_CHAIN_ID: Number(process.env.NEXT_PUBLIC_CLAIM_CHAIN_ID || 97),
  CLAIM_ADDRESS: process.env.NEXT_PUBLIC_CLAIM_ADDRESS,
  TOKEN_DECIMALS: Number(process.env.NEXT_PUBLIC_MLEO_DECIMALS || 18),
  CLAIM_FN: process.env.NEXT_PUBLIC_MLEO_CLAIM_FN || "claim",
  GAME_ID: Number(process.env.NEXT_PUBLIC_GAME_ID || 1),
};

// שתי וריאציות ABI נפוצות: claim(amount) או claim(gameId, amount)
const CLAIM_ABI_ONE_ARG = [
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: ENV.CLAIM_FN,
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];
const CLAIM_ABI_TWO_ARGS = [
  {
    inputs: [
      { internalType: "uint256", name: "gameId", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: ENV.CLAIM_FN,
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// ================== NEW CONFIG (ניתן להתאים בקלות) ==================
const CONFIG = {
  // בסיס קיים
  IDLE_TO_OFFLINE_MS: 5 * 60 * 1000,
  OFFLINE_MAX_HOURS: 12,
  ONLINE_BASE_RATE: 1200,
  OFFLINE_RATE_FACTOR: 0.6,
  BOOST_PER_CLICK: 0.02,
  BOOST_DECAY_MS: 60 * 1000,
  MAX_CLICKS_PER_SEC: 6,
  GIFT_COOLDOWN_SEC: 3600,
  DAILY_BONUS_TABLE: [50, 75, 100, 150, 200, 275, 400],
  UPGRADES: [
    { id: "drill",   name: "Auto-Drill",    baseCost: 1000,   mult: 0.08, maxLvl: 25 },
    { id: "helmet",  name: "Miner Helmet",  baseCost: 2500,   mult: 0.10, maxLvl: 20 },
    { id: "cart",    name: "Quantum Cart",  baseCost: 5000,   mult: 0.15, maxLvl: 15 },
    { id: "robot",   name: "Leo Bot",       baseCost: 20000,  mult: 0.30, maxLvl: 10 },
  ],
  GUILD_SAMPLES: [0.02, 0.03, 0.05, 0.08],

  // Quick Wins
  COMBO_DECAY_MS: 4000,
  COMBO_STEP: 0.06,
  GIFT_LUCK_CHANCE: 0.10,
  GIFT_LUCK_MULT: [2, 3],
  DAILY_XP_GOAL: 100,

  // Modifiers (mini-events)
  MODIFIER_ROTATE_EVERY_MIN: 12, // כל כמה דקות יתחלף
  MODIFIER_DURATION_MIN: 5,      // משך מודיפייר פעיל
  MODIFIERS_POOL: [
    { id: "GIFT_X2",   label: "Gifts x2",        mult: { gift: 2 } },
    { id: "ONLINE_P",  label: "+25% Online",     mult: { online: 1.25 } },
    { id: "OFFLINE_P", label: "+25% Offline",    mult: { offline: 1.25 } },
    { id: "SALE_20",   label: "-20% Upgrade",    mult: { upgradeCost: 0.8 } },
  ],

  // Time Chest
  CHEST_MINUTES_MIN: 20,
  CHEST_MINUTES_MAX: 40,
  CHEST_WINDOW_SEC: 60,
  CHEST_REWARD_RANGE: [500, 5000],

  // Bank-Risk
  RISK_ENABLED: true,
  RISK_DAILY_CAP: 3,     // פעמים ביום
  RISK_WIN_PROB: 0.48,   // יתרון קל לבית
  RISK_BOUNDS: [0.1, 0.3], // אחוז מה-VAULT שאפשר להמר

  // Quests (pools לדוגמה)
  QUESTS_DAILY_POOL: [
    { id:"d_gifts5",   label:"Claim 5 Gifts",          goal:5,   reward:120 },
    { id:"d_online12", label:"Stay Online 12 minutes", goal:12,  reward:150, type:"minutesOnline" },
    { id:"d_upg3",     label:"Buy 3 Upgrades",         goal:3,   reward:180, type:"upgrades" },
  ],
  QUESTS_WEEKLY_POOL: [
    { id:"w_total1m",  label:"Mine 1,000,000 total",   goal:1000000, reward:1500, type:"totalMined" },
    { id:"w_luck3",    label:"Trigger 3 Lucky Gifts",  goal:3,       reward:900,  type:"luckyGifts" },
  ],

  // Tech Tree (דוגמיות)
  TECH_NODES: [
    { id:"t_eff_1", branch:"Efficiency", cost: 1200,  req:[],           effect:{onlineMult:0.08} },
    { id:"t_eff_2", branch:"Efficiency", cost: 3500,  req:["t_eff_1"],  effect:{onlineMult:0.12} },
    { id:"t_util_gift", branch:"Utility", cost: 3000, req:[],           effect:{giftBoost:0.25} },
    { id:"t_ctrl_combo", branch:"Control", cost: 2800, req:[],          effect:{comboCap:0.2} },
    { id:"t_util_auto", branch:"Utility", cost: 5200, req:["t_util_gift"], effect:{autoGift:true} },
  ],
};

// ============================================================================
// PART 2 — STORAGE HELPERS (LocalStorage) — FIXED FOR SSR
// ============================================================================
function safeRead(key, fallback = {}) {
  if (typeof window === "undefined") return fallback;
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function safeWrite(key, val) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
function safeRemove(key) {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(key); } catch {}
}

// ============================================================================
// PART 3 — CORE STATE SHAPE & INIT
// ============================================================================
const initialCore = {
  // Balances
  balance: 0, vault: 0, totalMined: 0,

  // Presence
  mode: "online", offlineStart: 0, lastActiveAt: Date.now(),

  // Progression
  upgrades: {},

  // Timers
  lastGiftAt: 0, lastDailyAt: 0, dailyStreak: 0,

  // Social
  guild: { id: null, name: null, members: 0, bonus: 0 },

  // NEW — Daily XP & counters
  dailyXp: 0,       // 0..CONFIG.DAILY_XP_GOAL
  dailyResetsKey: "",

  // NEW — Counters for quests/analytics
  giftsClaimedToday: 0,
  upgradesBoughtToday: 0,
  minutesOnlineToday: 0,
  luckyGiftsToday: 0,
};

const initialSession = {
  boost: 0,
  clicksWindow: [],
  // NEW — combo, modifiers, chest, risk counter, minute tick
  combo: 0,
  modifier: null,           // {id,label,until,kindMult}
  chest: null,              // {expiresAt, reward}
  riskPlaysToday: 0,
  minuteAccumulator: 0,     // לספירת דקות אונליין
};

// ============================================================================
// PART 4 — UTILITIES
// ============================================================================
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function fmt(n) {
  if (n >= 1e9) return (n/1e9).toFixed(2)+"B";
  if (n >= 1e6) return (n/1e6).toFixed(2)+"M";
  if (n >= 1e3) return (n/1e3).toFixed(2)+"K";
  return Math.floor(n).toString();
}
const dayKey = (d = new Date()) => d.toISOString().slice(0,10);
const isNewDailyReset = (ts) => !ts || dayKey(new Date(ts)) !== dayKey(new Date());
function randInt(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function nowSec(){ return Math.floor(Date.now()/1000); }

// ============================================================================
// PART 5 — PRESENCE, ACCRUAL, COMBO & MODIFIERS
// ============================================================================
function usePresenceAndAccrual(getBaseMultiplier, hooks) {
  const [core, setCore] = useState(() => ({ ...initialCore, ...safeRead(LS_KEYS.CORE, initialCore) }));
  const [sess, setSess] = useState(() => ({ ...initialSession, ...safeRead(LS_KEYS.SESSION, initialSession) }));
  const idleTimerRef = useRef(null);
  const rafRef = useRef(0);
  const prevRef = useRef(typeof performance !== "undefined" ? performance.now() : Date.now());

  // persist
  useEffect(() => { safeWrite(LS_KEYS.CORE, core); }, [core]);
  useEffect(() => { safeWrite(LS_KEYS.SESSION, sess); }, [sess]);

  // daily reset housekeeping
  useEffect(() => {
    const dk = dayKey();
    if (core.dailyResetsKey !== dk) {
      setCore(c => ({
        ...c,
        dailyResetsKey: dk,
        giftsClaimedToday: 0,
        upgradesBoughtToday: 0,
        minutesOnlineToday: 0,
        luckyGiftsToday: 0,
        dailyXp: 0,
      }));
      setSess(s => ({ ...s, riskPlaysToday: 0 }));
      hooks?.resetDailyQuests?.();
    }
    // eslint-disable-next-line
  }, []);

  // init + schedule first modifier & optional chest
  useEffect(() => {
    if (core.offlineStart && core.offlineStart > 0) setCore(c => ({ ...c, mode: "offline" }));
    resetIdleTimer();
    scheduleNextModifier(setSess);
    maybeSpawnChest(setSess);
    // eslint-disable-next-line
  }, []);

  function resetIdleTimer() {
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setCore(c => {
        if (!c.offlineStart) return { ...c, mode: "offline", offlineStart: Date.now() };
        return { ...c, mode: "offline" };
      });
    }, CONFIG.IDLE_TO_OFFLINE_MS);
  }

  function liveModifierMult(kind) {
    const m = sess.modifier;
    if (!m || !m.until || m.until < Date.now()) return 1;
    if (kind === "online")      return m.mult?.online      || 1;
    if (kind === "offline")     return m.mult?.offline     || 1;
    if (kind === "gift")        return m.mult?.gift        || 1;
    if (kind === "upgradeCost") return m.mult?.upgradeCost || 1;
    return 1;
  }

  function settleOffline(c, mult) {
    const start = c.offlineStart || Date.now();
    const elapsedMs = Date.now() - start;
    const capped = Math.min(elapsedMs, CONFIG.OFFLINE_MAX_HOURS * 3600 * 1000);
    const hours = capped / 3600000;
    const perHour = CONFIG.ONLINE_BASE_RATE
      * CONFIG.OFFLINE_RATE_FACTOR
      * mult
      * liveModifierMult("offline");
    return Math.floor(perHour * hours);
  }

  function markActivity(ev) {
    if (ev && ev.isTrusted === false) return;
    const now = Date.now();

    // anti-bot: clicks window + combo & boost updates
    setSess(s => {
      const w = [...s.clicksWindow, now].filter(t => now - t <= 1000);
      if (w.length > CONFIG.MAX_CLICKS_PER_SEC) return { ...s, clicksWindow: w };

      // combo update (עם דעיכה)
      const comboDecay = s.lastComboTick ? clamp((now - s.lastComboTick) / CONFIG.COMBO_DECAY_MS, 0, 1) : 0;
      const nextCombo = clamp((s.combo * (1 - comboDecay)) + CONFIG.COMBO_STEP + (hooks?.comboCapBonus?.() || 0), 0, 1);

      // boost update (דחיפה רגעית + חותמת זמן לדעיכה פסיבית)
      const boostDecay = s.lastBoostTick ? clamp((now - s.lastBoostTick) / CONFIG.BOOST_DECAY_MS, 0, 1) : 0;
      const nextBoost = clamp((s.boost * (1 - boostDecay)) + CONFIG.BOOST_PER_CLICK, 0, 0.5);

      return {
        ...s,
        clicksWindow: w,
        combo: nextCombo,
        lastComboTick: now,
        boost: nextBoost,
        lastBoostTick: now,
      };
    });

    // OFFLINE→ONLINE (עם התחשבנות) או רק רענון activity
    setCore(c => {
      let next = { ...c, lastActiveAt: now };
      if (c.mode === "offline") {
        const mult = getBaseMultiplier() * (1 + (hooks?.permMult || 0));
        const earned = settleOffline(c, mult);
        next.vault += earned;
        next.totalMined += earned;
        next.mode = "online";
        next.offlineStart = 0;
      }
      return next;
    });

    resetIdleTimer();
  }

  // online accrual loop + minutesOnline counter + combo & boost decay (passive)
  useEffect(() => {
    function loop(t) {
      const prev = prevRef.current || t;
      const dt = (t - prev) / 1000;
      prevRef.current = t;

      // 1) הכנסה פסיבית אונליין
      setCore(c => {
        if (c.mode !== "online") return c;
        const baseMult = getBaseMultiplier() * (1 + (hooks?.permMult || 0));
        const perSec = (CONFIG.ONLINE_BASE_RATE * baseMult * liveModifierMult("online")) / 3600;
        const focusFactor = document?.hidden ? 0.5 : 1;
        const comboFactor = (1 + (sess.combo || 0) * 0.75) + (hooks?.comboExtra || 0);
        const gain = perSec * (1 + (sess.boost || 0)) * comboFactor * focusFactor * dt;
        if (gain <= 0) return c;
        return { ...c, vault: c.vault + gain, totalMined: c.totalMined + gain };
      });

      // 2) מונה דקות אונליין
      setSess(s => {
        const nextAcc = s.minuteAccumulator + dt * (document?.hidden ? 0.5 : 1);
        if (nextAcc >= 60) {
          hooks?.onOnlineMinute?.();
          return { ...s, minuteAccumulator: nextAcc - 60 };
        }
        return { ...s, minuteAccumulator: nextAcc };
      });

      // 3) דעיכת קומבו
      setSess(s => {
        if (!s.lastComboTick) return s;
        const dec = clamp((t - s.lastComboTick) / CONFIG.COMBO_DECAY_MS, 0, 1);
        const newCombo = clamp(s.combo * (1 - dec), 0, 1);
        return (newCombo === s.combo) ? s : { ...s, combo: newCombo, lastComboTick: t };
      });

      // 4) דעיכת בוסט
      setSess(s => {
        if (!s.lastBoostTick || s.boost <= 0) return s;
        const dec = clamp((t - s.lastBoostTick) / CONFIG.BOOST_DECAY_MS, 0, 1);
        const newBoost = clamp(s.boost * (1 - dec), 0, 0.5);
        return (newBoost === s.boost) ? s : { ...s, boost: newBoost, lastBoostTick: t };
      });

      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, [liveModifierMult]);

  // Utilities exposed
  return {
    core, setCore,
    sess, setSess,
    markActivity,
    wake: () => markActivity({ isTrusted: true }),
    liveModifierMult,
  };
}


// ============================================================================
// PART 6 — ECONOMY: UPGRADES, MULTIPLIERS, COSTS, LUCKY GIFT, DAILY XP
// ============================================================================
function calcUpgradeCost(baseCost, level, sess, liveModifierMult) {
  const sale = liveModifierMult?.("upgradeCost") || 1;
  return Math.floor(baseCost * Math.pow(1.35, level) * sale);
}
function upgradesMultiplier(upgrades = {}, guild = null, techEffects = null) {
  let mult = 1;
  for (const u of CONFIG.UPGRADES) {
    const lvl = upgrades[u.id] || 0;
    if (lvl > 0) mult += u.mult * lvl;
  }
  if (guild?.bonus) mult += guild.bonus;
  if (techEffects?.onlineMult) mult += techEffects.onlineMult; // סיכומים קטנים
  return mult;
}
function canClaimGift(core) {
  const now = Date.now();
  return !core.lastGiftAt || (now - core.lastGiftAt) >= CONFIG.GIFT_COOLDOWN_SEC * 1000;
}
function giftAmount(core, techEffects = null, liveGiftMult = 1) {
  const base = 200 + Math.floor(core.totalMined * 0.002);
  let amt = clamp(base, 100, 20000);
  if (techEffects?.giftBoost) amt = Math.floor(amt * (1 + techEffects.giftBoost));
  amt = Math.floor(amt * liveGiftMult);
  return amt;
}
function canClaimDaily(core) { return isNewDailyReset(core.lastDailyAt); }
function nextDailyAmount(core) {
  const idx = clamp(core.dailyStreak, 0, CONFIG.DAILY_BONUS_TABLE.length - 1);
  return CONFIG.DAILY_BONUS_TABLE[idx];
}
function luckyRoll() {
  return Math.random() < CONFIG.GIFT_LUCK_CHANCE ? pick(CONFIG.GIFT_LUCK_MULT) : 1;
}

// ============================================================================
// PART 7 — MODIFIER SCHEDULER & TIME CHEST SPAWNER
// ============================================================================
function scheduleNextModifier(setSess) {
  const nextInMs = CONFIG.MODIFIER_ROTATE_EVERY_MIN * 60000;
  setTimeout(() => {
    const mod = pick(CONFIG.MODIFIERS_POOL);
    const until = Date.now() + CONFIG.MODIFIER_DURATION_MIN * 60000;
    setSess(s => ({ ...s, modifier: { ...mod, until, mult: mod.mult } }));
    // schedule again after duration
    setTimeout(() => scheduleNextModifier(setSess), CONFIG.MODIFIER_DURATION_MIN * 60000);
  }, nextInMs);
}
function maybeSpawnChest(setSess) {
  const minutes = randInt(CONFIG.CHEST_MINUTES_MIN, CONFIG.CHEST_MINUTES_MAX);
  setTimeout(() => {
    const expiresAt = Date.now() + CONFIG.CHEST_WINDOW_SEC * 1000;
    const reward = randInt(CONFIG.CHEST_REWARD_RANGE[0], CONFIG.CHEST_REWARD_RANGE[1]);
    setSess(s => ({ ...s, chest: { expiresAt, reward } }));
    // schedule next chest after current window ends + 5–10 minutes cooldown
    setTimeout(() => {
      setSess(s => ({ ...s, chest: null }));
      setTimeout(() => maybeSpawnChest(setSess), randInt(5,10)*60000);
    }, CONFIG.CHEST_WINDOW_SEC * 1000);
  }, minutes * 60000);
}

// ============================================================================
// PART 8 — QUESTS (Daily/Weekly) — Local Demo
// ============================================================================
function initQuests() {
  const saved = safeRead(LS_KEYS.QUESTS, null);
  if (saved && saved.daily && saved.weekly) return saved;

  // בוחרים משימות ראשוניות (פשוט: כל הדיילי + כל הווד־לי)
  const daily = CONFIG.QUESTS_DAILY_POOL.map(q => ({ ...q, prog:0, claim:false }));
  const weekly = CONFIG.QUESTS_WEEKLY_POOL.map(q => ({ ...q, prog:0, claim:false }));
  const init = { daily, weekly, weeklyStart: dayKey(), weeklyDoneKey: "" };
  safeWrite(LS_KEYS.QUESTS, init);
  return init;
}
function useQuests() {
  const [quests, setQuests] = useState(initQuests());

  // reset helpers
  function resetDaily() {
    setQuests(q => {
      const daily = q.daily.map(x => ({ ...x, prog:0, claim:false }));
      const next = { ...q, daily };
      safeWrite(LS_KEYS.QUESTS, next);
      return next;
    });
  }
  function maybeWeeklyReset() {
    // כל יום ראשון נחדש (לוגיקה פשוטה – ניתן להחליף)
    const now = new Date();
    const isSunday = now.getDay() === 0;
    if (isSunday && quests.weeklyDoneKey !== dayKey()) {
      const weekly = CONFIG.QUESTS_WEEKLY_POOL.map(x => ({ ...x, prog:0, claim:false }));
      const next = { daily: quests.daily, weekly, weeklyStart: dayKey(), weeklyDoneKey: dayKey() };
      setQuests(next); safeWrite(LS_KEYS.QUESTS, next);
    }
  }

  // progress updaters
  function addProgress(typeOrId, val=1) {
    setQuests(q => {
      const upd = list => list.map(x => {
        if (x.type === typeOrId || x.id === typeOrId) {
          const prog = clamp((x.prog||0)+val, 0, x.goal);
          const claim = prog >= x.goal;
          return { ...x, prog, claim };
        }
        return x;
      });
      const daily = upd(q.daily);
      const weekly = upd(q.weekly);
      const next = { ...q, daily, weekly };
      safeWrite(LS_KEYS.QUESTS, next);
      return next;
    });
  }
  function claimQuest(id) {
    let reward = 0;
    setQuests(q => {
      const upd = list => list.map(x => {
        if (x.id === id && x.claim) { reward += x.reward; return { ...x, claim:false, claimed:true }; }
        return x;
      });
      const daily = upd(q.daily);
      const weekly = upd(q.weekly);
      const next = { ...q, daily, weekly };
      safeWrite(LS_KEYS.QUESTS, next);
      return next;
    });
    return reward;
  }

  useEffect(() => { maybeWeeklyReset(); /* eslint-disable-next-line */ }, []);

  return { quests, resetDaily, addProgress, claimQuest };
}

// ============================================================================
// PART 9 — TECH TREE (Local Demo)
// ============================================================================
function initTech() {
  const saved = safeRead(LS_KEYS.TECH, null);
  if (saved && saved.unlocked) return saved;
  const init = { unlocked: [] };
  safeWrite(LS_KEYS.TECH, init);
  return init;
}
function useTech() {
  const [tech, setTech] = useState(initTech());

  function isUnlocked(id){ return tech.unlocked.includes(id); }
  function reqsSatisfied(node){
    return (node.req||[]).every(r => isUnlocked(r));
  }
  function unlockNode(id){
    if (isUnlocked(id)) return false;
    const next = { unlocked: [...tech.unlocked, id] };
    setTech(next); safeWrite(LS_KEYS.TECH, next);
    return true;
  }

  function getEffects(){
    const eff = {};
    for (const n of CONFIG.TECH_NODES) {
      if (!isUnlocked(n.id)) continue;
      const e = n.effect||{};
      if (e.onlineMult) eff.onlineMult = (eff.onlineMult||0)+e.onlineMult;
      if (e.giftBoost)  eff.giftBoost  = Math.max(eff.giftBoost||0, e.giftBoost);
      if (e.comboCap)   eff.comboCap   = (eff.comboCap||0) + e.comboCap;
      if (e.autoGift)   eff.autoGift   = true;
    }
    return eff;
  }

  return { tech, isUnlocked, reqsSatisfied, unlockNode, getEffects };
}

// ============================================================================
// PART 10 — LEADERBOARD (Local demo) — (ללא שינוי מהגרסה שלך)
function getLeaderboard() { return safeRead(LS_KEYS.LEADERBOARD, { entries: [] }); }
function pushLeaderboard(username, amount) {
  const lb = getLeaderboard();
  const rec = { user: username || "Player", amount, ts: Date.now() };
  lb.entries = [...lb.entries, rec].sort((a,b)=>b.amount-a.amount).slice(0, 100);
  safeWrite(LS_KEYS.LEADERBOARD, lb);
  return lb;
}

// ============================================================================
// PART 11 — SOCIAL: Referral & Squads (Local demo)
// ============================================================================
function initSocial() {
  const saved = safeRead(LS_KEYS.SOCIAL, null);
  if (saved && saved.refCode) return saved;
  const ref = Math.random().toString(36).slice(2, 8);
  const init = { refCode: ref, squad: [] }; // squad: up to 5 codes
  safeWrite(LS_KEYS.SOCIAL, init);
  return init;
}
function useSocial() {
  const [social, setSocial] = useState(initSocial());
  function addToSquad(code) {
    if (!code) return false;
    if (social.squad.includes(code)) return false;
    if (social.squad.length >= 5) return false;
    const next = { ...social, squad: [...social.squad, code] };
    setSocial(next); safeWrite(LS_KEYS.SOCIAL, next);
    return true;
  }
  function squadMult() {
    // +2% לכל חבר עד 5 → עד +10%
    return 1 + (Math.min(social.squad.length, 5) * 0.02);
  }
  return { social, addToSquad, squadMult };
}

// ============================================================================
// PART 12 — GUILD ACTIONS + GUILD WARS (Local Demo)
// ============================================================================
function useGuildActions(setCore) {
  function joinRandomGuild() {
    const id = Math.floor(Math.random()*100000).toString(36);
    const bonus = CONFIG.GUILD_SAMPLES[Math.floor(Math.random()*CONFIG.GUILD_SAMPLES.length)];
    const members = 1 + Math.floor(Math.random()*20);
    setCore(c => ({ ...c, guild: { id, name: `Leo Guild ${id.toUpperCase()}`, members, bonus } }));
  }
  function leaveGuild() { setCore(c => ({ ...c, guild: { id:null, name:null, members:0, bonus:0 } })); }
  return { joinRandomGuild, leaveGuild };
}

function initGuildWars() {
  const saved = safeRead(LS_KEYS.GUILDWARS, null);
  if (saved && saved.boss) return saved;
  // Boss HP דמו
  const init = { boss: { hp: 50000, max: 50000 }, contributedToday: 0, lastReset: dayKey() };
  safeWrite(LS_KEYS.GUILDWARS, init);
  return init;
}
function useGuildWars(core) {
  const [gw, setGw] = useState(initGuildWars());
  useEffect(() => {
    if (gw.lastReset !== dayKey()) {
      const next = { boss: { hp: 50000, max: 50000 }, contributedToday: 0, lastReset: dayKey() };
      setGw(next); safeWrite(LS_KEYS.GUILDWARS, next);
    }
    // eslint-disable-next-line
  }, [core?.guild?.id, gw.lastReset]);

  function contribute(amount) {
    if (amount <= 0) return 0;
    const dmg = Math.min(amount, gw.boss.hp);
    const boss = { ...gw.boss, hp: gw.boss.hp - dmg };
    const next = { ...gw, boss, contributedToday: gw.contributedToday + dmg };
    setGw(next); safeWrite(LS_KEYS.GUILDWARS, next);
    return dmg;
  }
  const bossPct = 1 - (gw.boss.hp / gw.boss.max);
  const isDefeated = gw.boss.hp <= 0;
  return { gw, contribute, bossPct, isDefeated };
}

// ============================================================================
// PART 13 — UI Helpers
// ============================================================================
function Stat({ label, value, sub }) {
  return (
    <div className="rounded-2xl p-4 bg-white/5 border border-white/10 shadow-sm">
      <div className="text-xs uppercase opacity-70">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub ? <div className="text-xs opacity-60">{sub}</div> : null}
    </div>
  );
}
function Section({ title, children, right }) {
  return (
    <div className="rounded-2xl p-4 border border-white/10 bg-black/20">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}
function ActionButton({ children, onClick, disabled }) {
  return (
    <button
      className={`px-4 py-2 rounded-xl text-white ${disabled ? "bg-zinc-700 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500"}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Chip({ children }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs border border-white/15 bg-white/5">
      {children}
    </span>
  );
}

// ---- WalletStatus (RainbowKit modals + wagmi) ----
function WalletStatus() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const short = (a)=> a ? `${a.slice(0,6)}…${a.slice(-4)}` : "";
  const wrongNet = chainId !== ENV.CLAIM_CHAIN_ID;

  // לא מחובר — פותח חלון חיבור (מודל בחירת ארנק)
  if (!isConnected) {
    return (
      <ActionButton
        onClick={() => openConnectModal?.()}
      >
        Connect Wallet
      </ActionButton>
    );
  }

  // מחובר — לחיצה על הכתובת פותחת חלון סטטוס חשבון
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => openAccountModal?.()}
        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10"
        title="Account status"
      >
        {short(address)}{wrongNet ? " • Wrong Network" : ""}
      </button>

      {wrongNet ? (
        <ActionButton onClick={()=>switchChain({ chainId: ENV.CLAIM_CHAIN_ID })} disabled={isSwitching}>
          {isSwitching ? "Switching…" : "Switch to BSC Testnet"}
        </ActionButton>
      ) : null}

      <button
        onClick={()=>disconnect()}
        className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white text-sm"
        title="Disconnect"
      >
        Disconnect
      </button>
    </div>
  );
}


// ============================================================================
// PART 14 — HONEYPOT (anti-bot)
// ============================================================================
function HoneypotButton({ onTriggered }) {
  return (
    <button
      aria-hidden
      tabIndex={-1}
      onClick={() => onTriggered?.()}
      style={{ position:"absolute", left:"-9999px", top:"-9999px", opacity:0 }}
    >
      do-not-click
    </button>
  );
}

// ============================================================================
// PART 15 — MAIN PAGE COMPONENT
// ============================================================================
export default function MLEOTokenRushPage() {
  // --- mount gate ---
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ---- global tick for UI timers (1Hz) ----
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ---------- Hooks: Quests, Tech, Social, Presence ----------
  const { quests, resetDaily, addProgress, claimQuest } = useQuests();
  const { tech, isUnlocked, reqsSatisfied, unlockNode, getEffects } = useTech();
  const { social, addToSquad, squadMult } = useSocial();

  const techEffects = useMemo(() => getEffects(), [tech]);
  const permMult = 0; // אין Prestige לפי בקשה

  // presence + accrual
  const { core, setCore, sess, setSess, markActivity, wake, liveModifierMult } =
    usePresenceAndAccrual(
      () => upgradesMultiplier(core.upgrades, core.guild, techEffects) * squadMult(),
      {
        permMult,
        onOnlineMinute: () => {
          setCore(c => ({ ...c,
            minutesOnlineToday: (c.minutesOnlineToday||0)+1,
            dailyXp: clamp((c.dailyXp||0)+5, 0, CONFIG.DAILY_XP_GOAL)
          }));
          addProgress("minutesOnline", 1);
        },
        comboCapBonus: () => techEffects?.comboCap || 0,
      }
    );

  // ---------------- wagmi hooks (CLAIM on-chain) ----------------
    const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });
  const publicClient = usePublicClient(); // ✅ שימוש חדש


  // אחרי אישור טרנזאקציה — מאפסים BALANCE
  useEffect(() => {
    if (isConfirmed && core.balance > 0) setCore(c => ({ ...c, balance: 0 }));
    // eslint-disable-next-line
  }, [isConfirmed]);

  // --- helpers (units) ---
  function toUnits(amount) {
    const whole = Math.floor(amount || 0);
    const factor = 10n ** BigInt(ENV.TOKEN_DECIMALS);
    return BigInt(whole) * factor;
  }

  // Anti-bot: double click arm
  const claimArmRef = useRef(0);
  const [claimArmed, setClaimArmed] = useState(false);
  function armClaimOnce() {
    const now = Date.now();
    claimArmRef.current = now; setClaimArmed(true);
    setTimeout(() => { if (claimArmRef.current === now) setClaimArmed(false); }, 1500);
  }

  // ---------- Gifts / Daily ----------
  const canGift = canClaimGift(core);
  const canDaily = canClaimDaily(core);

  const nextGiftInSec = useMemo(() => {
    if (!core.lastGiftAt) return 0;
    const d = CONFIG.GIFT_COOLDOWN_SEC - Math.floor((nowTick - core.lastGiftAt) / 1000);
    return Math.max(0, d);
  }, [core.lastGiftAt, nowTick]);

  function claimGift() {
    if (!canGift) return;
    const luck = luckyRoll();
    const liveMult = liveModifierMult("gift");
    const amt = Math.floor(giftAmount(core, techEffects, liveMult) * luck);
    setCore(c => ({
      ...c,
      lastGiftAt: Date.now(),
      vault: c.vault + amt,
      totalMined: c.totalMined + amt,
      giftsClaimedToday: (c.giftsClaimedToday||0)+1,
      luckyGiftsToday: (c.luckyGiftsToday||0) + (luck>1 ? 1 : 0),
      dailyXp: clamp((c.dailyXp||0) + 10, 0, CONFIG.DAILY_XP_GOAL)
    }));
    if (luck>1) addProgress("luckyGifts", 1);
    addProgress("d_gifts5", 1);
  }

  function claimDaily() {
    if (!canDaily) return;
    const amt = nextDailyAmount(core);
    const streak = isNewDailyReset(core.lastDailyAt) ? (core.dailyStreak + 1) : core.dailyStreak;
    setCore(c => ({
      ...c,
      lastDailyAt: Date.now(),
      dailyStreak: clamp(streak, 0, CONFIG.DAILY_BONUS_TABLE.length),
      vault: c.vault + amt,
      totalMined: c.totalMined + amt,
    }));
  }

  // ---------- VAULT→BALANCE & BRIDGE ----------
  const claimVaultToBalance = () => {
    const amt = Math.floor(core.vault || 0);
    if (amt <= 0) return;
    setCore(c => ({ ...c, vault: 0, balance: (c.balance || 0) + amt }));
  };

  const [bridgeAmount, setBridgeAmount] = useState("");
  const [otherVault, setOtherVault] = useState(() => {
    const other = safeRead(OTHER_GAME_CORE_KEY, null);
    return other && typeof other.vault === "number" ? other.vault : 0;
  });
  const refreshOtherVault = () => {
    const other = safeRead(OTHER_GAME_CORE_KEY, null);
    setOtherVault(other && typeof other.vault === "number" ? other.vault : 0);
  };
  const bridgeFromOther = () => {
    const amt = Math.max(0, Math.floor(Number(bridgeAmount) || 0));
    if (amt <= 0) { alert("Enter a positive amount"); return; }
    const other = safeRead(OTHER_GAME_CORE_KEY, null);
    const available = other && typeof other.vault === "number" ? Math.floor(other.vault) : 0;
    if (amt > available) { alert("Not enough balance in MLEO-MINERS"); return; }
    const nextOther = { ...(other || {}), vault: available - amt };
    safeWrite(OTHER_GAME_CORE_KEY, nextOther);
    setCore(c => ({ ...c, balance: (c.balance || 0) + amt }));
    setBridgeAmount(""); setOtherVault(available - amt);
    alert(`Bridged ${amt} tokens from MLEO-MINERS → BALANCE`);
  };

  // ---------- On-chain CLAIM to wallet ----------
   const withdrawAllToWallet = async () => {
    try {
      const amount = Math.floor(core.balance || 0);
      if (!ENV.CLAIM_ADDRESS) { alert("CLAIM_ADDRESS env is missing"); return; }
      if (amount <= 0)        { alert("Nothing to claim"); return; }

      // anti-bot double click
      if (!claimArmed) { armClaimOnce(); return; }

      // network & wallet
      if (chainId !== ENV.CLAIM_CHAIN_ID) {
        try { await switchChain({ chainId: ENV.CLAIM_CHAIN_ID }); }
        catch { alert(`Switch network to chainId ${ENV.CLAIM_CHAIN_ID}`); }
        return;
      }
      if (!isConnected) { alert("Connect wallet first"); return; }

      const units = toUnits(amount); // BigInt

      // helper: simulate then write
      const tryClaim = async (abi, args) => {
        // 1) simulate
        await publicClient.simulateContract({
          address: ENV.CLAIM_ADDRESS,
          abi,
          functionName: ENV.CLAIM_FN,
          args,
          account: address, // ✅ required on mobile
        });
        // 2) send tx
        const hash = await writeContract({
          address: ENV.CLAIM_ADDRESS,
          abi,
          functionName: ENV.CLAIM_FN,
          args,
        });

        // 3) optimistic UI update + prevent double-claim
        setCore(c => {
          const nextBal = Math.max(0, Math.floor((c.balance || 0) - amount));
          return { ...c, balance: nextBal, lastTxHash: String(hash) };
        });

        alert(`⏳ Sent ${amount} MLEO to wallet…`);
        try { await publicClient.waitForTransactionReceipt({ hash }); } catch {}

        alert(`✅ Claimed ${amount} MLEO to wallet`);
      };

      try {
        await tryClaim(CLAIM_ABI_ONE_ARG, [units]);
      } catch (e1) {
        try {
          await tryClaim(CLAIM_ABI_TWO_ARGS, [BigInt(ENV.GAME_ID), units]);
        } catch (e2) {
          const msg =
            (e1?.shortMessage || e1?.cause?.shortMessage || e1?.message) ||
            (e2?.shortMessage || e2?.cause?.shortMessage || e2?.message) ||
            "TX rejected or reverted by contract";
          console.error("claim failed", e1, e2);
          alert(msg);
        }
      } finally {
        setClaimArmed(false); claimArmRef.current = 0;
      }
    } catch (err) {
      console.error(err);
      alert(err?.shortMessage || err?.message || "Unexpected error");
      setClaimArmed(false); claimArmRef.current = 0;
    }
  };


  // ---------- Upgrades ----------
  function buyUpgrade(id) {
    const u = CONFIG.UPGRADES.find(x => x.id === id);
    if (!u) return;
    const lvl = core.upgrades[id] || 0;
    if (lvl >= u.maxLvl) return;
    const cost = calcUpgradeCost(u.baseCost, lvl, sess, liveModifierMult);
    if (core.balance < cost) return;
    setCore(c => ({
      ...c,
      balance: c.balance - cost,
      upgrades: { ...c.upgrades, [id]: lvl + 1 },
      upgradesBoughtToday: (c.upgradesBoughtToday||0)+1,
      dailyXp: clamp((c.dailyXp||0) + 8, 0, CONFIG.DAILY_XP_GOAL)
    }));
    addProgress("upgrades", 1);
  }

  // ---------- Tech Tree Buy ----------
  function buyTechNode(id) {
    const node = CONFIG.TECH_NODES.find(n => n.id === id);
    if (!node || !reqsSatisfied(node) || isUnlocked(id)) return;
    const cost = Math.floor(node.cost * (liveModifierMult("upgradeCost") || 1));
    if (core.balance < cost) return;
    setCore(c => ({ ...c, balance: c.balance - cost }));
    unlockNode(id);
  }

  // ---------- Time Chest ----------
  function claimChest() {
    const ch = sess.chest;
    if (!ch || ch.expiresAt < Date.now()) return;
    setCore(c => ({
      ...c,
      vault: c.vault + ch.reward,
      totalMined: c.totalMined + ch.reward,
      dailyXp: clamp((c.dailyXp||0) + 12, 0, CONFIG.DAILY_XP_GOAL)
    }));
    setSess(s => ({ ...s, chest: null }));
  }

  // ---------- Bank-Risk mini-game ----------
  function playRisk(share=0.1) {
    if (!CONFIG.RISK_ENABLED) return;
    if ((sess.riskPlaysToday||0) >= CONFIG.RISK_DAILY_CAP) { alert("Risk daily cap reached"); return; }
    const frac = clamp(share, CONFIG.RISK_BOUNDS[0], CONFIG.RISK_BOUNDS[1]);
    const stake = Math.floor((core.vault||0) * frac);
    if (stake <= 0) return;
    const win = Math.random() < CONFIG.RISK_WIN_PROB;
    setCore(c => ({
      ...c,
      vault: Math.max(0, c.vault + (win ? +stake : -stake)),
      totalMined: c.totalMined + (win ? stake : 0)
    }));
    setSess(s => ({ ...s, riskPlaysToday: (s.riskPlaysToday||0)+1 }));
  }

  // ---------- Guild Wars contribution (from BALANCE demo) ----------
  const { gw, contribute, bossPct, isDefeated } = useGuildWars(core);
  function contributeToWar(amount) {
    const amt = Math.min(Math.floor(core.balance||0), Math.floor(amount||0));
    if (amt <= 0) return;
    const dmg = contribute(amt);
    setCore(c => ({ ...c, balance: c.balance - dmg }));
    if (isDefeated) setCore(c => ({ ...c, vault: c.vault + 500 }));
  }

  // ---------- Derived ----------
  const mult = useMemo(
    () => upgradesMultiplier(core.upgrades, core.guild, techEffects) * squadMult(),
    [core.upgrades, core.guild, techEffects, social.squad]
  );

  // ===== Mount gate =====
  if (!mounted) {
    return (
      <Layout>
        <main className="min-h-[100svh] bg-gradient-to-b from-zinc-950 to-black text-zinc-100">
          <div className="max-w-6xl mx-auto p-4">
            <h1 className="text-2xl font-bold">MLEO Token Rush</h1>
            <div className="opacity-60 text-sm">Loading…</div>
          </div>
        </main>
      </Layout>
    );
  }
 

    // ========================================================================
  // PART 16 — RENDER
  // ========================================================================
  return (
    <Layout>
      <main className="min-h-[100svh] bg-gradient-to-b from-zinc-950 to-black text-zinc-100">
        <div className="max-w-6xl mx-auto p-4">

{/* PART 16.1 — HEADER */}
<header className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
  {/* כפתור BACK למובייל — קבוע בפינה הימנית העליונה */}
  <Link
    href="/"
    className="sm:hidden absolute top-2 right-2 px-3 py-1.5 rounded-full text-xs font-bold
               bg-white/5 border border-white/10 hover:bg-white/10"
    aria-label="Back to Home"
  >
    BACK
  </Link>

  <div>
    <h1 className="text-2xl font-bold">MLEO Token Rush</h1>
    <div className="text-sm opacity-70">100B via gameplay only • idle→offline after 5m</div>
    <div className="mt-2 flex flex-wrap gap-2">
      <Chip>Combo: <b className="tabular-nums ml-1">{Math.round((sess.combo||0)*100)}%</b></Chip>
      {sess.modifier && sess.modifier.until > Date.now() ? (
        <Chip>Event: {sess.modifier.label}</Chip>
      ) : <Chip>Event: —</Chip>}
      {sess.chest && sess.chest.expiresAt > Date.now() ? (
        <Chip>Chest: <b className="tabular-nums ml-1">{Math.max(0, Math.ceil((sess.chest.expiresAt - Date.now())/1000))}s</b></Chip>
      ) : <Chip>Chest: —</Chip>}
      <Chip>Daily XP: <b className="tabular-nums ml-1">{core.dailyXp}/{CONFIG.DAILY_XP_GOAL}</b></Chip>
      <Chip>Squad: +{Math.round((squadMult()-1)*100)}%</Chip>
    </div>
  </div>

  {/* צד ימין בדסקטופ: Wallet + BACK */}
  <div className="hidden sm:flex items-center gap-2">
    <WalletStatus />
    <Link
      href="/"
      className="px-3 py-2 rounded-full text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10"
      aria-label="Back to Home"
    >
      BACK
    </Link>
  </div>
</header>


{/* PART 16.2 — TOP STATS */}
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
  {/* MODE with clear visual */}
  <Stat
    label="Mode"
    value={
      <span className={`inline-flex items-center gap-2 ${core.mode === "online" ? "text-emerald-400" : "text-amber-300"}`}>
        <span className={`w-2 h-2 rounded-full ${core.mode === "online" ? "bg-emerald-400" : "bg-amber-300"}`} />
        {core.mode.toUpperCase()}
      </span>
    }
    sub={core.mode === "online"
      ? "Auto online • 5m idle → offline"
      : `Offline • click WAKE to auto-claim (cap ${CONFIG.OFFLINE_MAX_HOURS}h)`}
  />

  <Stat label="VAULT" value={fmt(core.vault)} sub="Unclaimed pool" />
  <Stat label="Total mined" value={fmt(core.totalMined)} sub={`Mult ${mult.toFixed(2)}×`} />

{/* BOOST with bar — WAKE inline */}
<div className="rounded-2xl p-4 bg-white/5 border border-white/10 shadow-sm flex flex-col gap-2">
  {/* header line: label + % + WAKE */}
  <div className="flex items-center justify-between">
    <div className="flex items-baseline gap-2">
      <div className="text-xs uppercase opacity-70">BOOST</div>
      <div className="text-2xl font-semibold">{Math.round((sess.boost || 0) * 100)}%</div>
    </div>

    <button
      onClick={wake}
      aria-label={core.mode === "online" ? "Wake (ping activity)" : "Wake from offline and auto-claim"}
      className={[
        "px-3 py-1.5 rounded-lg text-white text-sm",
        core.mode === "online"
          ? "bg-emerald-600 hover:bg-emerald-500"
          : "bg-amber-600 hover:bg-amber-500"
      ].join(" ")}
      title={core.mode === "online" ? "Ping activity (+boost)" : "Wake from offline & auto-claim"}
    >
      WAKE
    </button>
  </div>

  {/* bar */}
  <div className="w-full h-2 rounded bg-white/10 overflow-hidden">
    <div className="h-full bg-emerald-500" style={{ width: `${(sess.boost || 0) * 100}%` }} />
  </div>
  <div className="text-xs opacity-60">Decays automatically</div>
</div>

</div>


{/* PART 16.3 — ACTIONS & BRIDGE & INFO */}
<div className="grid lg:grid-cols-3 gap-4 mb-6">
  {/* A) BALANCE & ACTIONS */}
  <Section title="Balance & Actions">
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center justify-between">
        <div className="text-sm opacity-70">BALANCE</div>
        <div className="text-3xl font-bold tabular-nums">{fmt(core.balance)}</div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <button onClick={claimVaultToBalance}
          className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
          CLAIM TO VAULT
        </button>
        <button onClick={withdrawAllToWallet} disabled={isPending || isMining}
          className={`w-full h-14 rounded-xl font-semibold text-white ${
            (isPending || isMining) ? "bg-zinc-700 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500"}`}>
          {isPending || isMining ? "Claiming…" : (claimArmed ? "Click again to CONFIRM" : "CLAIM TO WALLET")}
        </button>
      </div>

      <div className="flex items-center justify-between text-xs opacity-70">
        <span>Anti-bot: double-click within 600ms to confirm.</span>
        <span>VAULT: {fmt(core.vault)}</span>
      </div>

      {txHash && (
        <div className="text-xs opacity-80">
          TX: {txHash.slice(0, 8)}… {isConfirmed ? "✓ Confirmed" : "⏳ Pending"}
        </div>
      )}
    </div>
  </Section>

  {/* B) BRIDGE */}
  <Section title="Bridge from MLEO-MINERS"
    right={<div className="text-xs opacity-70">Other game vault: <b>{fmt(otherVault)}</b> <button className="underline" onClick={refreshOtherVault}>refresh</button></div>}
  >
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <input type="number" className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none w-40"
          value={bridgeAmount} onChange={e=>setBridgeAmount(e.target.value)} placeholder="Amount" min="0" />
        <button onClick={bridgeFromOther} disabled={(Number(bridgeAmount)||0) <= 0}
          className={`h-12 px-5 rounded-xl font-semibold text-white ${
            (Number(bridgeAmount)||0) <= 0 ? "bg-zinc-700 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-500"}`}>
          BRIDGE →
        </button>
      </div>
      <div className="text-sm opacity-70">Move tokens from your <b>MLEO-MINERS</b> local vault into your BALANCE for upgrades.</div>
    </div>
  </Section>

  {/* C) INFO / GIFTS / DAILY */}
  <Section title="Timers & Bonuses"
    right={<div className="text-xs opacity-70">Next gift in: <b className="tabular-nums">{nextGiftInSec}s</b></div>}
  >
    <div className="flex items-center gap-3 mb-3">
      <ActionButton onClick={claimGift} disabled={!canGift}>Claim Gift</ActionButton>
      <ActionButton onClick={claimDaily} disabled={!canDaily}>Daily Bonus</ActionButton>
      {sess.chest && sess.chest.expiresAt > Date.now() ? (
        <ActionButton onClick={claimChest}>Claim Chest (+{fmt(sess.chest.reward)})</ActionButton>
      ) : (
        <ActionButton disabled>Chest —</ActionButton>
      )}
    </div>
    <div className="w-full h-3 rounded-xl bg-white/10 overflow-hidden">
      <div className="h-full bg-emerald-500" style={{ width: `${(core.dailyXp/CONFIG.DAILY_XP_GOAL)*100}%` }} />
    </div>
    <div className="mt-2 text-xs opacity-70">Daily XP fills a bonus bar via actions (gifts, upgrades, online minutes).</div>
  </Section>
</div>

{/* PART 16.4 — UPGRADES */}
<Section title="Upgrades"
  right={<div className="text-xs opacity-70">Balance: <b className="tabular-nums">{fmt(core.balance)}</b></div>}
>
  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
    {CONFIG.UPGRADES.map(u => {
      const lvl = core.upgrades[u.id] || 0;
      const maxed = lvl >= u.maxLvl;
      const cost = calcUpgradeCost(u.baseCost, lvl, sess, liveModifierMult);
      const cantAfford = core.balance < cost;
      return (
        <div key={u.id} className="rounded-xl p-4 bg-white/5 border border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{u.name}</div>
            <div className="text-xs px-2 py-0.5 rounded bg-white/10 border border-white/10">Lv {lvl}/{u.maxLvl}</div>
          </div>
          <div className="text-xs opacity-70">+{Math.round(u.mult * 100)}% / level</div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="opacity-70">Cost</span>
            <span className="font-semibold tabular-nums">{fmt(cost)}</span>
          </div>
          <button onClick={() => buyUpgrade(u.id)} disabled={maxed || cantAfford}
            className={[
              "mt-2 w-full h-11 rounded-xl font-semibold text-white",
              (maxed || cantAfford) ? "bg-zinc-700 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500"
            ].join(" ")}>
            {maxed ? "MAXED" : cantAfford ? "Not enough BALANCE" : `Buy for ${fmt(cost)}`}
          </button>
        </div>
      );
    })}
  </div>
  <div className="mt-3 text-xs opacity-70">
    Upgrades are paid from <b>BALANCE</b>. Collect VAULT → BALANCE first, or Bridge from MLEO-MINERS.
    Active event may reduce upgrade cost.
  </div>
</Section>

{/* PART 16.5 — TECH TREE */}
<Section title="Tech Tree">
  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
    {CONFIG.TECH_NODES.map(n => {
      const unlocked = isUnlocked(n.id);
      const allowed = reqsSatisfied(n);
      const cost = Math.floor(n.cost * (liveModifierMult("upgradeCost") || 1));
      return (
        <div key={n.id} className="rounded-xl p-4 bg-white/5 border border-white/10">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{n.branch}: {n.id}</div>
            <span className="text-xs opacity-70">{unlocked ? "Unlocked" : allowed ? "Available" : "Locked"}</span>
          </div>
          <div className="text-xs opacity-70 mt-1">Cost: {fmt(cost)}</div>
          <button
            onClick={()=>buyTechNode(n.id)}
            disabled={unlocked || !allowed || core.balance < cost}
            className={`mt-2 w-full h-10 rounded-xl text-white font-semibold ${
              (unlocked || !allowed || core.balance < cost) ? "bg-zinc-700 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500"
            }`}
          >
            {unlocked ? "UNLOCKED" : core.balance < cost ? "Insufficient" : "Unlock"}
          </button>
        </div>
      );
    })}
  </div>
</Section>

{/* PART 16.6 — QUESTS */}
<Section title="Quests"
  right={<div className="text-xs opacity-70"><button className="underline" onClick={resetDaily}>reset daily</button></div>}
>
  <div className="grid md:grid-cols-2 gap-4">
    <div>
      <div className="font-semibold mb-2">Daily</div>
      <ul className="space-y-2">
        {quests.daily.map(q=>(
          <li key={q.id} className="rounded-xl p-3 bg-white/5 border border-white/10">
            <div className="text-sm">{q.label}</div>
            <div className="text-xs opacity-70">Progress: {q.prog}/{q.goal} • Reward: {fmt(q.reward)}</div>
            <button
              onClick={()=>{
                const r = claimQuest(q.id);
                if (r>0) setCore(c=>({ ...c, balance: c.balance + r }));
              }}
              disabled={!q.claim}
              className={`mt-2 w-full h-9 rounded-xl text-white ${q.claim? "bg-emerald-600 hover:bg-emerald-500":"bg-zinc-700 cursor-not-allowed"}`}>
              {q.claim ? "Claim" : "Not ready"}
            </button>
          </li>
        ))}
      </ul>
    </div>
    <div>
      <div className="font-semibold mb-2">Weekly</div>
      <ul className="space-y-2">
        {quests.weekly.map(q=>(
          <li key={q.id} className="rounded-xl p-3 bg-white/5 border border-white/10">
            <div className="text-sm">{q.label}</div>
            <div className="text-xs opacity-70">Progress: {q.prog}/{q.goal} • Reward: {fmt(q.reward)}</div>
            <button
              onClick={()=>{
                const r = claimQuest(q.id);
                if (r>0) setCore(c=>({ ...c, balance: c.balance + r }));
              }}
              disabled={!q.claim}
              className={`mt-2 w-full h-9 rounded-xl text-white ${q.claim? "bg-indigo-600 hover:bg-indigo-500":"bg-zinc-700 cursor-not-allowed"}`}>
              {q.claim ? "Claim" : "Not ready"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  </div>
</Section>

{/* PART 16.7 — BANK-RISK & GUILD WARS */}
<div className="grid md:grid-cols-2 gap-4">
  <Section title="Bank-Risk (mini)">
    <div className="text-sm opacity-80 mb-2">Wager 10–30% of VAULT with slight house edge.</div>
    <div className="flex gap-2">
      <ActionButton onClick={()=>playRisk(0.10)} disabled={!CONFIG.RISK_ENABLED}>Risk 10%</ActionButton>
      <ActionButton onClick={()=>playRisk(0.20)} disabled={!CONFIG.RISK_ENABLED}>Risk 20%</ActionButton>
      <ActionButton onClick={()=>playRisk(0.30)} disabled={!CONFIG.RISK_ENABLED}>Risk 30%</ActionButton>
    </div>
    <div className="text-xs opacity-60 mt-2">Daily plays: {sess.riskPlaysToday}/{CONFIG.RISK_DAILY_CAP}</div>
  </Section>

  <Section title="Guild Wars (demo)"
    right={<div className="text-xs opacity-70">Boss HP: {fmt(gw.boss.hp)} / {fmt(gw.boss.max)}</div>}
  >
    <div className="w-full h-3 rounded-xl bg-white/10 overflow-hidden mb-2">
      <div className="h-full bg-fuchsia-500" style={{ width: `${bossPct*100}%` }} />
    </div>
    <div className="flex items-center gap-2">
      <ActionButton onClick={()=>contributeToWar(250)} disabled={!core.guild?.id}>Contribute 250</ActionButton>
      <ActionButton onClick={()=>contributeToWar(1000)} disabled={!core.guild?.id}>Contribute 1,000</ActionButton>
    </div>
    <div className="text-xs opacity-60 mt-2">Defeat boss for small bonus to all guild members (local demo).</div>
  </Section>
</div>

{/* PART 16.8 — GUILD / SOCIAL */}
<Section
  title="Mining Guild"
  right={core.guild?.id ? <div className="text-xs opacity-70">Bonus: +{Math.round((core.guild.bonus||0)*100)}%</div> : null}
>
  <GuildBlock core={core} setCore={setCore} />
</Section>

<Section title="Referral & Squads">
  <div className="text-sm opacity-80">Your code: <b>{social.refCode}</b></div>
  <div className="flex gap-2 mt-2">
    <input className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none w-48" placeholder="Friend code" id="squadcode" />
    <ActionButton onClick={()=>{
      const el = document.getElementById("squadcode");
      const ok = addToSquad(el?.value?.trim());
      if (!ok) alert("Could not add (duplicate/max/empty).");
      else alert("Added to Squad!");
      el.value = "";
    }}>Add to Squad</ActionButton>
  </div>
  <div className="text-xs opacity-60 mt-2">Up to 5 friends • +2% Mult each.</div>
</Section>

{/* PART 16.9 — ECONOMY & LIMITS */}
<Section title="Economy & Limits">
  <ul className="list-disc pl-6 space-y-1 text-sm opacity-80">
    <li>All 100B tokens are distributed via gameplay only.</li>
    <li>Idle 5m → OFFLINE; wake by any real input. OFFLINE accrual capped at {CONFIG.OFFLINE_MAX_HOURS}h.</li>
    <li>Hourly Gifts (+Luck), Daily Bonus, Time-limited Chest events.</li>
    <li>On-chain Claim requires BSC Testnet (97) and double-click confirm.</li>
  </ul>
</Section>

{/* PART 16.10 — ANTI-BOT HONEYPOT */}
<HoneypotButton onTriggered={()=>alert("Suspicious activity detected. Rewards may be throttled.")} />

{/* PART 16.11 — FOOTER HELP */}
<div className="mt-6 text-xs opacity-60">
  Any real input (click/touch/key/focus) will <b>wake</b> from offline and auto-claim offline earnings
  up to {CONFIG.OFFLINE_MAX_HOURS}h cap. Staying idle for 5 minutes flips to offline.
  Gifts reset hourly. Daily bonus resets at local midnight.
</div>

        </div>
      </main>
    </Layout>
  );
}


// ============================================================================
// PART 17 — SMALL SUB-COMPONENTS
// ============================================================================
function GuildBlock({ core, setCore }) {
  const { joinRandomGuild, leaveGuild } = useGuildActions(setCore);
  if (!core.guild?.id) {
    return (
      <div className="flex items-center gap-3">
        <ActionButton onClick={joinRandomGuild}>Join Random Guild</ActionButton>
        <div className="text-sm opacity-70">Guilds add a global multiplier and social layer.</div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm">
        <div className="font-semibold">{core.guild.name}</div>
        <div className="opacity-70 text-xs">Members: {core.guild.members}</div>
      </div>
      <ActionButton onClick={leaveGuild}>Leave Guild</ActionButton>
    </div>
  );
}

// ============================================================================
// PART 18 — EXPORTED HELPERS (for tests/devtools)
// ============================================================================
export const __dev = {
  calcUpgradeCost,
  upgradesMultiplier,
  canClaimGift,
  giftAmount,
  canClaimDaily,
  nextDailyAmount,
};
