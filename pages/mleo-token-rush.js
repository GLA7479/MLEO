// ============================================================================
// pages/mleo-token-rush.js
// MLEO Token Rush — full single-file game page (Pages Router + Layout)
// Language: code in English, comments & parts labels in Hebrew.
// Tailwind UI. Self-contained. Safe to paste into Next.js pages/.
// ============================================================================

/*
================================================================================
=                               PART 0 — OVERVIEW                              =
================================================================================
MLEO Token Rush — כרייה פסיבית אונליין (ללא חובה ללחוץ), מעבר אוטומטי ל־OFFLINE
אחרי 5 דק' חוסר פעילות, חישוב רטרואקטיבי באוף־ליין (תקרה 12 שעות), Vault מקומי,
Gift Timer, Daily Bonus, Upgrades, Leaderboard (דמו לוקאלי), Guild (דמו),
ואנטי־בוט בסיסי. כל ה־100B מטבעות מחולקים דרך המשחק.
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
  useDisconnect
} from "wagmi";


// ============================================================================
// PART 1 — CONFIG & CONSTANTS
// ============================================================================
const LS_KEYS = {
  CORE: "mleo_token_rush_core_v1",
  SESSION: "mleo_token_rush_session_v1",
  LEADERBOARD: "mleo_token_rush_lb_v1",
};

// קובץ ה-Core של המשחק הישן (mleo-miners) ב-localStorage — לשימוש ה־Bridge
const OTHER_GAME_CORE_KEY = "mleo_miners_v6_core";


// ---- ENV ----
const ENV = {
  CLAIM_CHAIN_ID: Number(process.env.NEXT_PUBLIC_CLAIM_CHAIN_ID || 97),
  CLAIM_ADDRESS: process.env.NEXT_PUBLIC_CLAIM_ADDRESS,            // 0x6954...8293
  TOKEN_DECIMALS: Number(process.env.NEXT_PUBLIC_MLEO_DECIMALS || 18),
  CLAIM_FN: process.env.NEXT_PUBLIC_MLEO_CLAIM_FN || "claim",      // claim (ברירת מחדל)
  GAME_ID: Number(process.env.NEXT_PUBLIC_GAME_ID || 1),           // אופציונלי; בשימוש אם הפונקציה דורשת gameId
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

const CONFIG = {
  IDLE_TO_OFFLINE_MS: 5 * 60 * 1000, // 5 דקות ללא פעילות → OFFLINE
  OFFLINE_MAX_HOURS: 12,             // תקרת צבירת אוף־ליין
  ONLINE_BASE_RATE: 1200,            // טוקנים לשעה (בסיס אונליין)
  OFFLINE_RATE_FACTOR: 0.6,          // 60% בקצב אוף־ליין
  BOOST_PER_CLICK: 0.02,             // בוסט זמני לכל לחיצה אמיתית
  BOOST_DECAY_MS: 60 * 1000,         // דעיכת בוסט: דקה
  MAX_CLICKS_PER_SEC: 6,             // אנטי־בוט — תקרת קליקים
  GIFT_COOLDOWN_SEC: 3600,           // מתנה כל שעה
  DAILY_BONUS_TABLE: [50, 75, 100, 150, 200, 275, 400], // בונוס יומי לפי רצף

  // Anti-bot (לחיצה כפולה)
  DOUBLE_CLICK_WINDOW_MS: 600,       // חלון לאישור בלחיצה כפולה
  // Upgrades:
  UPGRADES: [
    { id: "drill",   name: "Auto-Drill",    baseCost: 1000,   mult: 0.08, maxLvl: 25 },
    { id: "helmet",  name: "Miner Helmet",  baseCost: 2500,   mult: 0.10, maxLvl: 20 },
    { id: "cart",    name: "Quantum Cart",  baseCost: 5000,   mult: 0.15, maxLvl: 15 },
    { id: "robot",   name: "Leo Bot",       baseCost: 20000,  mult: 0.30, maxLvl: 10 },
  ],
  GUILD_SAMPLES: [0.02, 0.03, 0.05, 0.08],
};

// ============================================================================
// PART 2 — STORAGE HELPERS (LocalStorage)  — FIXED FOR SSR
// ============================================================================
function safeRead(key, fallback = {}) {
  // בזמן SSR אין window → אל תקרא ל-localStorage
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key, val) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}


// ============================================================================
// PART 3 — CORE STATE SHAPE & INIT
// ============================================================================
const initialCore = {
  // Balances
  vault: 0,                // off-chain in-game balance
  totalMined: 0,           // lifetime mined (for stats)
  // Presence
  mode: "online",          // "online" | "offline"
  offlineStart: 0,         // timestamp ms when went offline
  lastActiveAt: Date.now(),
  // Progression
  upgrades: {},            // { drill: lvl, ... }
  // Timers
  lastGiftAt: 0,           // timestamp when last claimed gift
  lastDailyAt: 0,          // timestamp when last daily claimed
  dailyStreak: 0,          // consecutive days
  // Social
  guild: { id: null, name: null, members: 0, bonus: 0 }, // demo
};

const initialSession = {
  boost: 0,                // temporary online boost
  clicksWindow: [],        // timestamps for anti-bot
};

// ============================================================================
// PART 4 — UTILITIES (time, clamp, fmt)
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

// ============================================================================
// PART 5 — PRESENCE HOOK (online/offline, accrual, anti-bot)
// ============================================================================
function usePresenceAndAccrual(getMultiplier) {
  const [core, setCore] = useState(() => ({ ...initialCore, ...safeRead(LS_KEYS.CORE, initialCore) }));
  const [sess, setSess] = useState(() => ({ ...initialSession, ...safeRead(LS_KEYS.SESSION, initialSession) }));
  const idleTimerRef = useRef(null);
  const rafRef = useRef(0);
  const prevRef = useRef(performance.now());

  // persist
  useEffect(() => { safeWrite(LS_KEYS.CORE, core); }, [core]);
  useEffect(() => { safeWrite(LS_KEYS.SESSION, sess); }, [sess]);

  // init
  useEffect(() => {
    if (core.offlineStart && core.offlineStart > 0) setCore(c => ({ ...c, mode: "offline" }));
    resetIdleTimer();
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

  function settleOffline(c, mult) {
    const start = c.offlineStart || Date.now();
    const elapsedMs = Date.now() - start;
    const capped = Math.min(elapsedMs, CONFIG.OFFLINE_MAX_HOURS * 3600 * 1000);
    const hours = capped / 3600000;
    const perHour = CONFIG.ONLINE_BASE_RATE * CONFIG.OFFLINE_RATE_FACTOR * mult;
    return Math.floor(perHour * hours);
  }

  function markActivity(ev) {
    if (ev && ev.isTrusted === false) return; // ignore synthetic
    const now = Date.now();

    // anti-bot window
    setSess(s => {
      const w = [...s.clicksWindow, now].filter(t => now - t <= 1000);
      if (w.length > CONFIG.MAX_CLICKS_PER_SEC) return { ...s, clicksWindow: w }; // ignore too-fast
      return { ...s, clicksWindow: w };
    });

    setCore(c => {
      let next = { ...c, lastActiveAt: now };
      if (c.mode === "offline") {
        const mult = getMultiplier();
        const earned = settleOffline(c, mult);
        next.vault += earned;
        next.totalMined += earned;
        next.mode = "online";
        next.offlineStart = 0;
      } else {
        // online: add a small temporary boost with decay
        const decay = clamp((now - c.lastActiveAt) / CONFIG.BOOST_DECAY_MS, 0, 1);
        setSess(s => ({ ...s, boost: clamp(s.boost * (1 - decay) + CONFIG.BOOST_PER_CLICK, 0, 0.5) }));
      }
      return next;
    });

    resetIdleTimer();
  }

  // passive listeners
  useEffect(() => {
    const onVis = () => markActivity({ isTrusted: true });
    const onFocus = () => markActivity({ isTrusted: true });
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    const evs = ["pointerdown","keydown","touchstart"];
    evs.forEach(e => window.addEventListener(e, markActivity, { passive: true }));
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      evs.forEach(e => window.removeEventListener(e, markActivity));
    };
    // eslint-disable-next-line
  }, []);

  // online accrual loop
  useEffect(() => {
    function loop(t) {
      const dt = (t - prevRef.current) / 1000; prevRef.current = t;
      setCore(c => {
        if (c.mode !== "online") return c;
        const mult = getMultiplier();
        const perSec = (CONFIG.ONLINE_BASE_RATE * mult) / 3600;
        const focusFactor = document.hidden ? 0.5 : 1;
        const gain = perSec * (1 + (sess.boost || 0)) * focusFactor * dt;
        if (gain <= 0) return c;
        return { ...c, vault: c.vault + gain, totalMined: c.totalMined + gain };
      });
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line
  }, [sess.boost]);

  return {
    core, setCore,
    sess, setSess,
    markActivity,
    wake: () => markActivity({ isTrusted: true }),
  };
}

// ============================================================================
// PART 6 — MULTIPLIERS & COSTS
// ============================================================================
function calcUpgradeCost(baseCost, level) {
  return Math.floor(baseCost * Math.pow(1.35, level));
}
function upgradesMultiplier(upgrades = {}, guild = null) {
  let mult = 1;
  for (const u of CONFIG.UPGRADES) {
    const lvl = upgrades[u.id] || 0;
    if (lvl > 0) mult += u.mult * lvl;
  }
  if (guild?.bonus) mult += guild.bonus;
  return mult;
}

// ============================================================================
// PART 7 — GIFT & DAILY HELPERS
// ============================================================================
function canClaimGift(core) {
  const now = Date.now();
  return !core.lastGiftAt || (now - core.lastGiftAt) >= CONFIG.GIFT_COOLDOWN_SEC * 1000;
}
function giftAmount(core) {
  const base = 200 + Math.floor(core.totalMined * 0.002);
  return clamp(base, 100, 20000);
}
function canClaimDaily(core) {
  return isNewDailyReset(core.lastDailyAt);
}
function nextDailyAmount(core) {
  const idx = clamp(core.dailyStreak, 0, CONFIG.DAILY_BONUS_TABLE.length - 1);
  return CONFIG.DAILY_BONUS_TABLE[idx];
}

// ============================================================================
// PART 8 — LEADERBOARD (Local demo)
// ============================================================================
function getLeaderboard() {
  return safeRead(LS_KEYS.LEADERBOARD, { entries: [] });
}
function pushLeaderboard(username, amount) {
  const lb = getLeaderboard();
  const rec = { user: username || "Player", amount, ts: Date.now() };
  lb.entries = [...lb.entries, rec].sort((a,b)=>b.amount-a.amount).slice(0, 100);
  safeWrite(LS_KEYS.LEADERBOARD, lb);
  return lb;
}

// ============================================================================
// PART 9 — UI: small building blocks + WalletStatus
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

// ---- WalletStatus (wagmi) ----
function WalletStatus() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const short = (a)=> a ? `${a.slice(0,6)}…${a.slice(-4)}` : "";

  if (!isConnected) {
    return (
      <ActionButton
        onClick={()=> connect({ connector: connectors?.[0] })}
        disabled={isPending}
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </ActionButton>
    );
  }

  const wrongNet = chainId !== ENV.CLAIM_CHAIN_ID;

  return (
    <div className="flex items-center gap-2">
      <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm">
        {short(address)}{wrongNet ? " • Wrong Network" : ""}
      </div>
      {wrongNet ? (
        <ActionButton onClick={()=>switchChain({ chainId: ENV.CLAIM_CHAIN_ID })} disabled={isSwitching}>
          {isSwitching ? "Switching…" : "Switch to BSC Testnet"}
        </ActionButton>
      ) : null}
      <ActionButton onClick={()=>disconnect()}>Disconnect</ActionButton>
    </div>
  );
}

// ============================================================================
// PART 10 — HONEYPOT (anti-bot)
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
// PART 11 — GUILD DEMO (join/leave)
// ============================================================================
function useGuildActions(setCore) {
  function joinRandomGuild() {
    const id = Math.floor(Math.random()*100000).toString(36);
    const bonus = CONFIG.GUILD_SAMPLES[Math.floor(Math.random()*CONFIG.GUILD_SAMPLES.length)];
    const members = 1 + Math.floor(Math.random()*20);
    setCore(c => ({ ...c, guild: { id, name: `Leo Guild ${id.toUpperCase()}`, members, bonus } }));
  }
  function leaveGuild() {
    setCore(c => ({ ...c, guild: { id:null, name:null, members:0, bonus:0 } }));
  }
  return { joinRandomGuild, leaveGuild };
}

// ============================================================================
// PART 12 — MAIN PAGE COMPONENT
// ============================================================================
export default function MLEOTokenRushPage() {
  // --- mount gate to avoid hydration mismatch ---
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // presence + accrual
  const { core, setCore, sess, setSess, markActivity, wake } =
    usePresenceAndAccrual(() => upgradesMultiplier(core.upgrades, core.guild));

  // ---------------- wagmi hooks (CLAIM on-chain) ----------------
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  // אחרי אישור טרנזאקציה — מאפסים vault (תעדכן ללוגיקה שלך אם צריך)
  useEffect(() => {
    if (isConfirmed && core.vault > 0) {
      setCore(c => ({ ...c, vault: 0 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  // המרה ליחידות טוקן (wei)
  function toUnits(amount) {
    const whole = Math.floor(amount || 0);
    const factor = 10n ** BigInt(ENV.TOKEN_DECIMALS);
    return BigInt(whole) * factor;
  }

  // -------------- Anti-bot: לחיצה כפולה ל-Claim --------------
  const claimArmRef = useRef(0);
  const [claimArmed, setClaimArmed] = useState(false);
  function armClaimOnce() {
    const now = Date.now();
    claimArmRef.current = now;
    setClaimArmed(true);
    setTimeout(() => {
      if (claimArmRef.current === now) setClaimArmed(false);
    }, CONFIG.DOUBLE_CLICK_WINDOW_MS);
  }

  // ---------------- Gift / Daily ----------------
  const canGift = canClaimGift(core);
  const canDaily = canClaimDaily(core);
  const nextGiftInSec = useMemo(() => {
    if (!core.lastGiftAt) return 0;
    const d = CONFIG.GIFT_COOLDOWN_SEC - Math.floor((Date.now() - core.lastGiftAt) / 1000);
    return Math.max(0, d);
  }, [core.lastGiftAt]);

  function claimGift() {
    if (!canGift) return;
    const amt = giftAmount(core);
    setCore(c => ({ ...c, lastGiftAt: Date.now(), vault: c.vault + amt, totalMined: c.totalMined + amt }));
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

  // ---------------- Upgrades ----------------
  function buyUpgrade(id) {
    const u = CONFIG.UPGRADES.find(x => x.id === id);
    if (!u) return;
    const lvl = core.upgrades[id] || 0;
    if (lvl >= u.maxLvl) return;
    const cost = calcUpgradeCost(u.baseCost, lvl);
    if (core.vault < cost) return;
    setCore(c => ({ ...c, vault: c.vault - cost, upgrades: { ...c.upgrades, [id]: lvl + 1 } }));
  }

  // ---------------- Guild actions (demo) ----------------
  const { joinRandomGuild, leaveGuild } = useGuildActions(setCore);

  // ---------------- Anti-bot honeypot banner ----------------
  const [botFlag, setBotFlag] = useState(false);

  // ---------------- Derived ----------------
  const mult = useMemo(() => upgradesMultiplier(core.upgrades, core.guild), [core.upgrades, core.guild]);

  // ==== PART 12 — HELPERS (pure JS, before return) ====

  // איסוף OFFLINE מיד (מעיר את המנוע שמסדיר OFFLINE→Vault)
  const collectOfflineNow = () => {
    wake(); // wake כבר מסדיר את הרווחים האוף־ליינים לתוך ה־Vault
  };

  // BRIDGE מ־MLEO-MINERS → המשחק הנוכחי (דרך localStorage)
  const OTHER_GAME_CORE_KEY = "mleo_miners_v6_core";
  const [bridgeAmount, setBridgeAmount] = useState("");
  const [otherVault, setOtherVault] = useState(() => {
    const other = safeRead(OTHER_GAME_CORE_KEY, null);
    return other && typeof other.vault === "number" ? other.vault : 0;
    // אם המפתח שונה במשחק הישן – החלף כאן לשם העדכני
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

    // מחסירים במשחק הישן
    const nextOther = { ...(other || {}), vault: available - amt };
    safeWrite(OTHER_GAME_CORE_KEY, nextOther);

    // מוסיפים במשחק הנוכחי
    setCore(c => ({ ...c, vault: (c.vault || 0) + amt, totalMined: (c.totalMined || 0) + amt }));

    setBridgeAmount("");
    setOtherVault(available - amt);
    alert(`Bridged ${amt} tokens from MLEO-MINERS → this game`);
  };

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

  // ---------------- Render (opening) ----------------
  return (
    <Layout>
      <main className="min-h-[100svh] bg-gradient-to-b from-zinc-950 to-black text-zinc-100">
        <div className="max-w-6xl mx-auto p-4">

          {/* PART 13 — HEADER */}
          <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-2xl font-bold">MLEO Token Rush</h1>
              <div className="text-sm opacity-70">100B via gameplay only • idle→offline after 5m</div>
            </div>
            <div className="flex items-center gap-2">
              <WalletStatus />
              <ActionButton onClick={wake}>Wake</ActionButton>
            </div>
          </header>

          {/* PART 14 — TOP STATS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label="Mode" value={core.mode.toUpperCase()} sub="Auto online • 5m idle → offline" />
            <Stat label="Vault" value={fmt(core.vault)} sub="Tokens ready to claim" />
            <Stat label="Total mined" value={fmt(core.totalMined)} sub={`Mult ${mult.toFixed(2)}×`} />
            <Stat label="Boost" value={`${Math.round((sess.boost||0)*100)}%`} sub="Temporary online" />
          </div>


 {/* PART 15 — Vault & Wallet + Bridge (JSX only) */}

<div className="grid lg:grid-cols-3 gap-4 mb-6">

  {/* A) BALANCE & PRIMARY ACTIONS */}
  <Section title="Balance & Actions">
    <div className="flex flex-col gap-4">
      {/* היתרה הזמינה לשדרוגים */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center justify-between">
        <div className="text-sm opacity-70">Vault (available for upgrades)</div>
        <div className="text-3xl font-bold tabular-nums">{fmt(core.vault)}</div>
      </div>

      {/* 2 כפתורים ראשיים בגובה/רוחב זהים */}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* איסוף OFFLINE → Vault */}
        <button
          onClick={collectOfflineNow}
          className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
        >
         CLAIM TO VALUT
        </button>

        {/* Claim All — לארנק (on-chain + אישור כפול) */}
        <button
          onClick={async () => {
            const amount = Math.floor(core.vault);
            if (amount <= 0) { alert("Nothing to claim"); return; }
            if (!claimArmed) { armClaimOnce(); return; } // anti-bot double-click

            if (chainId !== ENV.CLAIM_CHAIN_ID) {
              try { await switchChain({ chainId: ENV.CLAIM_CHAIN_ID }); return; }
              catch { alert("Switch network to BSC Testnet (97)"); return; }
            }
            if (!isConnected) { alert("Connect wallet first"); return; }

            const units = toUnits(amount);
            try {
              await writeContract({
                address: ENV.CLAIM_ADDRESS,
                abi: CLAIM_ABI_ONE_ARG,
                functionName: ENV.CLAIM_FN,
                args: [units],
              });
            } catch (e1) {
              try {
                await writeContract({
                  address: ENV.CLAIM_ADDRESS,
                  abi: CLAIM_ABI_TWO_ARGS,
                  functionName: ENV.CLAIM_FN,
                  args: [BigInt(ENV.GAME_ID), units],
                });
              } catch (e2) {
                console.error("claim failed", e1, e2);
                alert("TX rejected or failed");
              }
            } finally {
              setClaimArmed(false);
              claimArmRef.current = 0;
            }
          }}
          disabled={isPending || isMining}
          className={`w-full h-14 rounded-xl font-semibold text-white ${
            (isPending || isMining) ? "bg-zinc-700 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500"
          }`}
        >
          {isPending || isMining ? "Claiming…" : (claimArmed ? "Click again to CONFIRM" : "CLAIM TO WALLET")}
        </button>
      </div>

      {/* סטטוסים קלים */}
      <div className="text-xs opacity-70">
        Anti-bot: double-click within {CONFIG.DOUBLE_CLICK_WINDOW_MS}ms to confirm.&nbsp;
        {txHash && (
          <span className="ml-1">
            TX: {txHash.slice(0, 8)}… {isConfirmed ? "✓ Confirmed" : "⏳ Pending"}
          </span>
        )}
      </div>
    </div>
  </Section>

  {/* B) BRIDGE — משיכת מטבעות מהמשחק MLEO-MINERS */}
  <Section
    title="Bridge from MLEO-MINERS"
    right={
      <div className="text-xs opacity-70">
        Other game vault: <b>{fmt(otherVault)}</b>&nbsp;
        <button className="underline" onClick={refreshOtherVault}>refresh</button>
      </div>
    }
  >
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <input
          type="number"
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none w-40"
          value={bridgeAmount}
          onChange={e=>setBridgeAmount(e.target.value)}
          placeholder="Amount"
          min="0"
        />
        <button
          onClick={bridgeFromOther}
          disabled={(Number(bridgeAmount)||0) <= 0}
          className={`h-12 px-5 rounded-xl font-semibold text-white ${
            (Number(bridgeAmount)||0) <= 0 ? "bg-zinc-700 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-500"
          }`}
        >
          BRIDGE → VALUT
        </button>
      </div>
      <div className="text-sm opacity-70">
        Move tokens from your <b>MLEO-MINERS</b> local vault for upgrades here.
      </div>
    </div>
  </Section>

  {/* C) INFO */}
  <Section title="Info">
    <ul className="list-disc pl-5 space-y-1 text-sm opacity-80">
      <li>Gifts every {CONFIG.GIFT_COOLDOWN_SEC/3600}h; Daily bonus resets at local midnight.</li>
      <li>Idle 5m → OFFLINE; OFFLINE accrual capped at {CONFIG.OFFLINE_MAX_HOURS}h.</li>
      <li>On-chain Claim requires BSC Testnet (97).</li>
    </ul>
  </Section>

</div>

          {/* PART 16 — UPGRADES */}
          <Section title="Upgrades">
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
              {CONFIG.UPGRADES.map(u => {
                const lvl = core.upgrades[u.id] || 0;
                const maxed = lvl >= u.maxLvl;
                const cost = calcUpgradeCost(u.baseCost, lvl);
                return (
                  <div key={u.id} className="rounded-xl p-3 bg-white/5 border border-white/10">
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-xs opacity-70">Level: {lvl}/{u.maxLvl}</div>
                    <div className="text-xs opacity-70 mb-2">+{Math.round(u.mult*100)}% / level</div>
                    <ActionButton onClick={()=>buyUpgrade(u.id)} disabled={maxed || core.vault < cost}>
                      {maxed ? "MAX" : `Buy (${fmt(cost)})`}
                    </ActionButton>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* PART 17 — GUILD (demo) */}
          <Section
            title="Mining Guild"
            right={core.guild?.id ? <div className="text-xs opacity-70">Bonus: +{Math.round((core.guild.bonus||0)*100)}%</div> : null}
          >
            {!core.guild?.id ? (
              <div className="flex items-center gap-3">
                <ActionButton onClick={joinRandomGuild}>Join Random Guild</ActionButton>
                <div className="text-sm opacity-70">Guilds add a global multiplier and social layer.</div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <div className="font-semibold">{core.guild.name}</div>
                  <div className="opacity-70 text-xs">Members: {core.guild.members}</div>
                </div>
                <ActionButton onClick={leaveGuild}>Leave Guild</ActionButton>
              </div>
            )}
          </Section>

{/* PART 18 — הוחלף (אין טבלה) */}

<Section title="Economy & Limits">
  <ul className="list-disc pl-6 space-y-1 text-sm opacity-80">
    <li>All 100B tokens are distributed via gameplay only.</li>
    <li>Idle 5m → OFFLINE; wake by any real input. OFFLINE accrual capped at {CONFIG.OFFLINE_MAX_HOURS}h.</li>
    <li>Gifts every {CONFIG.GIFT_COOLDOWN_SEC/3600}h; Daily resets at local midnight.</li>
    <li>On-chain Claim requires BSC Testnet (97) and double-click confirm.</li>
  </ul>
</Section>


          {/* PART 19 — ANTI-BOT HONEYPOT */}
          <HoneypotButton onTriggered={()=>setBotFlag(true)} />
          {botFlag && (
            <div className="mt-4 p-3 rounded-xl bg-amber-900/30 border border-amber-500/20 text-amber-200 text-sm">
              Suspicious activity detected. Rewards may be throttled.
            </div>
          )}

          {/* PART 20 — FOOTER HELP */}
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
// PART 21 — OPTIONAL: EXPORTED HELPERS (for tests/devtools)
// ============================================================================
export const __dev = {
  calcUpgradeCost,
  upgradesMultiplier,
  canClaimGift,
  giftAmount,
  canClaimDaily,
  nextDailyAmount,
};

// ============================================================================
// PART 22 — HOW TO WIRE ON-CHAIN CLAIM (notes)
// ============================================================================
// 1) חיבור wagmi/RainbowKit כמו במשחק שעובד לך (mleo-miners).
// 2) צור פונקציה במקום ה-Claim (Local Demo) שמבצעת writeContract לחוזה ה-claim.
// 3) לאחר TX מוצלחת, הפחת את סכום ה-vault המקומי כדי לשקף שהוטען לארנק.
// 4) ל-anti-bot בצד שרת: בצעו אימות חתימה לפני זיכוי on-chain אם הזרימה דרך backend.
