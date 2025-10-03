// ============================================================================
// pages/mleo-miner-hybrid.js
// New Hybrid Mining Game (Single-core + Shared Layer hooks)
// Language: code in English, section labels & notes in Hebrew.
// Tech: Next.js (pages/), React, Tailwind, wagmi/RainbowKit, viem utils.
// IMPORTANT: No backend required to run; Bridge uses stubbed signed-receipt flow.
// ============================================================================

/*
================================================================================
=                               PART 0 — OVERVIEW                              =
================================================================================
מטרה:
- משחק כרייה היברידי: ליבה אישית (Single) + שכבת אירועים משותפת (Shared hooks).
- כלכלה בשליטה מלאה בקוד: קובץ יחיד עם GameConfig שניתן להחלפה בזמן אמת.
- תמיכה ב: Deposit (ארנק→משחק), Bridge (Minner→משחק, כרגע סטאב חתום), Claim (משחק→ארנק).
- אנטי רענון/כפל למובייל: Nonce, Queue, Reconcile onFocus.
- אופליין: 12 שעות מקסימום; 0–6 שעות 50%, 6–12 שעות ליניארי ל־10%; כניסה אחרי 5 דקות חוסר פעילות.
- תקרת Claim יומית: 5,000,000 (יישור ל-On-chain, אך כאן מוגדר בקונפיג כדי לשלוט ב-UX).

איך לעבוד:
- הדבק/י את הקובץ לתיקיית pages/.
- ודא/י שה-Wallet + wagmi מחוברים ב-_app.
- התאמות ENV בסוף PART 2.
- שינויי כלכלה/תקרות/אירועים—ב-PART 1 (GameConfig) בלבד.
*/

// ============================================================================
// PART 1 — CENTRAL GAME CONFIG (שליטה מוחלטת בקצב, תקרות, אופליין, אירועים)
// ============================================================================
const GameConfig = {
  version: "1.0.0",
  chain: {
    id: Number(process.env.NEXT_PUBLIC_CLAIM_CHAIN_ID || 97),
    tokenDecimals: Number(process.env.NEXT_PUBLIC_MLEO_DECIMALS || 18),
    gameId: Number(process.env.NEXT_PUBLIC_GAME_ID || 3), // ← קנפג לפי המשחק החדש
  },
  contracts: {
    token: process.env.NEXT_PUBLIC_MLEO_TOKEN_ADDRESS || "",
    gameClaim: process.env.NEXT_PUBLIC_MLEO_CLAIM_ADDRESS || "",
  },
  caps: {
    claimPerDay: 5_000_000,           // תקרת Claim יומית לשחקן
    earnInGamePerDay: 20_000,         // קאפ פנימי לצבירה במשחק (לכיוון UX)
    bridgeFromMinnerPerDay: 50_000,   // אם תרצה להגביל גישור יומי
    depositFromWalletPerDay: 0,       // 0 = אין תקרה ב-UX
  },
  offline: {
    maxHours: 12,
    idleTimeoutMs: 5 * 60 * 1000, // 5 דקות
    efficiency: {
      firstHours: 6,
      firstRate: 0.5, // 50%
      tailEndRate: 0.1, // 10% בסוף 12ש׳
    },
    resetOnFocus: true,
  },
  economy: {
    baseEarnRatePerMinute: 120, // קצב צבירה אונליין (MLEO/min) — שמרני
    energy: {
      costPerAction: 1,
      regenPerMin: 5,
      max: 100,
    },
    carryCapacity: { base: 500, perTier: 250 },
    autoBots: { max: 3, ratePerBotPerMin: 15 },
    crit: { chance: 0.05, multiplier: 2.0 },
  },
  upgrades: {
    // עלויות/תגמולים לדוגמה — התאם חופשי
    tiers: {
      // כל Tier הוא קטגוריה → דרגות
      drillSpeed: [1000, 5000, 20000, 80000],
      carry: [1000, 3000, 9000, 27000],
      energyEff: [1500, 6000, 24000],
      autoBots: [5000, 20000, 80000],
      crit: [10000, 40000],
      offlineVault: [7500, 30000],
    },
    // איך העלות עולה אם נוסיף דרגות מעבר למוגדר למעלה
    costCurve: "linear", // או "exp"
    refundPolicy: 0.0,
    },
    // תיאורי שדרוגים לתצוגה במודאלים קטנים
    info: {
      drillSpeed: "Increases mining speed per action. Higher tiers reduce time to accumulate MLEO.",
      carry: "Raises the maximum MLEO you can carry per run before banking to the Vault.",
      energyEff: "Each action costs less energy, enabling longer online sessions.",
      autoBots: "Adds autonomous bots that mine passively every minute (capped by bots max).",
      crit: "Adds a chance for critical strikes that multiply MLEO gained per action.",
      offlineVault: "Extends or boosts the safe offline accrual storage window.",
    },
  events: {
    seasonDays: 14,
    quarry: { enabled: true, durationMin: 30, multiplier: 2 },
    boss: { enabled: true, entry: 1000 },
  },
  ops: {
    reconcileIntervalMsMobile: 10_000,
    nonceExpiryMs: 60_000,
    blockUIUntilTxHashMs: 8_000,
    maxOpenActions: 1,
    showQueue: true,
  },
};

// ============================================================================
// PART 2 — ENV & ADDRESSES (קריאה מסודרת + בדיקות בסיסיות)
// ============================================================================
const ENV = {
  CHAIN_ID: Number(process.env.NEXT_PUBLIC_CLAIM_CHAIN_ID || 97),
  TOKEN: process.env.NEXT_PUBLIC_MLEO_TOKEN_ADDRESS || "",
  GAMECLAIM: process.env.NEXT_PUBLIC_MLEO_CLAIM_ADDRESS || "",
  GAME_ID: Number(process.env.NEXT_PUBLIC_GAME_ID || 3),
  DECIMALS: Number(process.env.NEXT_PUBLIC_MLEO_DECIMALS || 18),
};

function validateEnv() {
  const errors = [];
  if (!ENV.GAMECLAIM) errors.push("Missing NEXT_PUBLIC_MLEO_CLAIM_ADDRESS");
  if (ENV.CHAIN_ID !== GameConfig.chain.id) errors.push("CHAIN_ID mismatch");
  if (ENV.DECIMALS !== GameConfig.chain.tokenDecimals) errors.push("DECIMALS mismatch");
  // TOKEN optional for this page; used for display only
  return errors;
}

// ============================================================================
// PART 3 — UTILS (פורמטרים, זמן, שמירה מקומית, RNG)
// ============================================================================
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Head from "next/head";
import { formatUnits, parseUnits } from "viem";

const fmtNum = (n, d=2) => {
  if (typeof n !== "number" || !isFinite(n)) return "0";
  if (Math.abs(n) >= 1e9) return (n/1e9).toFixed(d)+"B";
  if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(d)+"M";
  if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(d)+"K";
  return n.toFixed(d);
};
const sleep = (ms) => new Promise(res => setTimeout(res, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nowSec = () => Math.floor(Date.now()/1000);

function lsGet(key, def){ try{ const v=localStorage.getItem(key); return v? JSON.parse(v):def;}catch{ return def; } }
function lsSet(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch{} }

// ============================================================================
// PART 4 — WALLET & WAGMI WIRING (קריאה/כתיבה לחוזה Claim)
// ============================================================================
import { useAccount, useChainId, useSwitchChain, useWriteContract, useWaitForTransactionReceipt } from "wagmi";

// ABI מינימלי ל-GameClaim: נשתמש רק ב-claim(gameId, amount)
const ABI_GAMECLAIM_MIN = [
  { type:"function", name:"claim", stateMutability:"nonpayable", inputs:[{name:"gameId",type:"uint256"},{name:"amount",type:"uint256"}], outputs:[] }
];

// hook קטן לכתיבה ל-claim
function useClaimAction(){
  const { writeContractAsync } = useWriteContract();
  return useCallback(async ({ gameId, amountRaw }) => {
    if (!ENV.GAMECLAIM) throw new Error("GameClaim address missing");
    return await writeContractAsync({
      address: ENV.GAMECLAIM,
      abi: ABI_GAMECLAIM_MIN,
      functionName: "claim",
      args: [ BigInt(gameId), BigInt(amountRaw) ],
      chainId: ENV.CHAIN_ID,
    });
  },[]);
}

// ============================================================================
// PART 5 — OFFLINE ENGINE (אינאקטיביות 5 דק׳ → אופליין עד 12ש׳ עם יעילות יורדת)
// ============================================================================
function useOfflineEngine(){
  const [isOffline, setIsOffline] = useState(false);
  const [offlineStartSec, setOfflineStartSec] = useState(0);
  const idleRef = useRef(null);

  const resetOffline = useCallback(() => {
    setIsOffline(false);
    setOfflineStartSec(0);
  },[]);

  const markOffline = useCallback(() => {
    setIsOffline(true);
    setOfflineStartSec(nowSec());
  },[]);

  // Inactivity → offline after idleTimeoutMs unless user interacts
  useEffect(() => {
    let timer = null;
    const bump = () => {
      if (GameConfig.offline.resetOnFocus) resetOffline();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => markOffline(), GameConfig.offline.idleTimeoutMs);
    };

    // interactions considered as activity (buttons/canvas clicks)
    const events = ["pointerdown","keydown","touchstart"]; 
    events.forEach(ev => window.addEventListener(ev, bump, { passive:true }));
    bump();
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(ev => window.removeEventListener(ev, bump));
    };
  },[resetOffline, markOffline]);

  // Focus/visibility → reset timer + optionally resetOffline
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible"){
        // כניסה מרעננת מצב אופליין
        if (GameConfig.offline.resetOnFocus) resetOffline();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  },[resetOffline]);

  const efficiency = useMemo(() => {
    if (!isOffline) return 0; // 0 = לא מחשבים בונוס אופליין בזמן אונליין
    const elapsedH = (nowSec() - offlineStartSec) / 3600;
    const capped = clamp(elapsedH, 0, GameConfig.offline.maxHours);
    const { firstHours, firstRate, tailEndRate } = GameConfig.offline.efficiency;
    if (capped <= 0) return 0;
    if (capped <= firstHours) return firstRate; // 0–6h → 0.5
    const tailSpan = GameConfig.offline.maxHours - firstHours; // 6h
    const t = (capped - firstHours) / tailSpan; // 0..1
    return clamp(firstRate - (firstRate - tailEndRate) * t, tailEndRate, firstRate);
  }, [isOffline, offlineStartSec]);

  return { isOffline, offlineStartSec, efficiency, resetOffline };
}

// ============================================================================
// PART 6 — ECONOMY CORE (קצב אונליין/אופליין, אנרגיה, Vault פנימי, Carry & Collect)
// ============================================================================
function useEconomyCore(){
  const [energy, setEnergy] = useState(GameConfig.economy.energy.max);
  const [vault, setVault] = useState(() => lsGet("GAME_VAULT", 0)); // in-game bank
  const [carry, setCarry] = useState(() => lsGet("GAME_CARRY", 0)); // pocket before banking
  const [todayClaimed, setTodayClaimed] = useState(() => lsGet("GAME_CLAIMED_TODAY", 0));
  const [todayKey, setTodayKey] = useState(() => new Date().toDateString());

  // Player upgrade levels
  const [levels, setLevels] = useState(() => lsGet("GAME_LEVELS", {drillSpeed:0, carry:0, energyEff:0, autoBots:0, crit:0, offlineVault:0}));

  const derived = useMemo(() => {
    // derive effective stats from levels
    const cap = GameConfig.economy.carryCapacity.base + GameConfig.economy.carryCapacity.perTier * levels.carry;
    const energyCost = Math.max(1, GameConfig.economy.energy.costPerAction - levels.energyEff);
    const base = GameConfig.economy.baseEarnRatePerMinute * (1 + 0.25*levels.drillSpeed);
    const bots = Math.min(levels.autoBots, GameConfig.economy.autoBots.max);
    const botRate = GameConfig.economy.autoBots.ratePerBotPerMin * bots;
    const critC = GameConfig.economy.crit.chance + 0.02*levels.crit;
    const critM = GameConfig.economy.crit.multiplier;
    return { cap, energyCost, basePerMin: base, botPerMin: botRate, critChance: critC, critMult: critM };
  },[levels]);

  const resetDailyIfNeeded = useCallback(() => {
    const key = new Date().toDateString();
    if (key !== todayKey){
      setTodayKey(key);
      setTodayClaimed(0);
      lsSet("GAME_CLAIMED_TODAY", 0);
    }
  },[todayKey]);

  // Energy regen per minute
  useEffect(() => {
    const id = setInterval(() => {
      resetDailyIfNeeded();
      setEnergy(e => clamp(e + GameConfig.economy.energy.regenPerMin, 0, GameConfig.economy.energy.max));
    }, 60*1000);
    return () => clearInterval(id);
  },[resetDailyIfNeeded]);

  // Manual mine action → spends energy & fills carry up to capacity
  const mineTick = useCallback((isOffline=false, offlineEff=0) => {
    if (!isOffline){
      const cost = derived.energyCost;
      setEnergy(e => {
        if (e < cost) return e; // not enough energy
        // approx 6 ticks/min online
        let gain = Math.max(1, Math.round(derived.basePerMin / 10));
        // crit chance
        if (Math.random() < derived.critChance) gain = Math.round(gain * derived.critMult);
        setCarry(c => {
          const nv = Math.min(derived.cap, c + gain);
          lsSet("GAME_CARRY", nv);
          return nv;
        });
        return e - cost;
      });
    } else {
      // offline accrual goes straight to carry with efficiency
      const gainPerMin = (derived.basePerMin + derived.botPerMin) * offlineEff;
      const gain = Math.max(0, Math.round(gainPerMin / 6));
      if (gain > 0){ setCarry(c => { const nv = Math.min(derived.cap, c + gain); lsSet("GAME_CARRY", nv); return nv; }); }
    }
  },[derived]);

  const collectToVault = useCallback(() => {
    if (carry <= 0) return;
    setVault(v => { const nv = v + carry; lsSet("GAME_VAULT", nv); return nv; });
    setCarry(0); lsSet("GAME_CARRY", 0);
  },[carry]);

  // Bots passive online accrual every minute
  useEffect(() => {
    const id = setInterval(() => {
      if (derived.botPerMin > 0){
        setCarry(c => { const nv = Math.min(derived.cap, c + derived.botPerMin); lsSet("GAME_CARRY", nv); return nv; });
      }
    }, 60*1000);
    return ()=> clearInterval(id);
  },[derived]);

  // Persist levels when changed
  useEffect(()=>{ lsSet("GAME_LEVELS", levels); },[levels]);

  return { energy, setEnergy, vault, setVault, carry, setCarry, collectToVault, todayClaimed, setTodayClaimed, levels, setLevels, derived, mineTick, resetDailyIfNeeded };
}

// ============================================================================
// PART 7 — QUEUE & NONCE (אנטי כפילות + Reconcile במובייל)
// ============================================================================
function useActionQueue(){
  const [open, setOpen] = useState([]); // [{id, type, created, status, txHash?}]
  const push = useCallback((item) => setOpen(arr => [...arr, item]),[]);
  const setStatus = useCallback((id, status, extra={}) => setOpen(arr => arr.map(it => it.id===id? {...it, status, ...extra}: it)),[]);
  return { open, push, setStatus };
}

function newNonce(){ return `${Date.now()}_${Math.floor(Math.random()*1e6)}`; }

// ============================================================================
// PART 8 — UI PRIMITIVES (קטנים, tailwind-only)
// ============================================================================
function Box({title, children}){
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 shadow">
      <div className="text-sm uppercase tracking-wider text-white/60 mb-2">{title}</div>
      {children}
    </div>
  );
}
function Stat({label, value}){
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-white/60">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
function Button({children, disabled, onClick}){
  return (
    <button disabled={disabled} onClick={onClick}
      className={`px-4 py-2 rounded-xl font-medium shadow ${disabled? 'bg-white/10 text-white/30 cursor-not-allowed':'bg-white/90 text-black hover:bg-white'}`}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// PART 8.1 — Tiny Modals (Info + Reward)
// ---------------------------------------------------------------------------
function Modal({open, title, children, onClose}){
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60">
      <div className="w-full sm:max-w-md m-2 rounded-2xl bg-[#0b0b12] border border-white/10 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
        </div>
        <div className="px-4 py-3 text-sm">{children}</div>
        <div className="px-4 py-3 border-t border-white/10 text-right">
          <button onClick={onClose} className="px-3 py-1 rounded-lg bg-white/90 text-black">Close</button>
        </div>
      </div>
    </div>
  );
}

function RewardToast({open, message, onClose}){
  if (!open) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="px-4 py-2 rounded-xl bg-green-500 text-black shadow-lg">
        <span className="font-semibold">🎉 Reward: </span>{message}
        <button onClick={onClose} className="ml-3 underline">OK</button>
      </div>
    </div>
  );
}

// ============================================================================
// PART 9 — BRIDGE/DEPOSIT/CLAIM ACTIONS (Stubbed Bridge, real Claim)
// ============================================================================
function useGameOps({ queue, eco }){
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const claimAction = useClaimAction();

  const ensureChain = useCallback(async () => {
    if (chainId !== ENV.CHAIN_ID) await switchChainAsync({ chainId: ENV.CHAIN_ID });
  },[chainId, switchChainAsync]);

  // Deposit (Wallet → Game): UX only (Top-Up vault); בפועל אפשר להוסיף on-chain לפי צורך
  const deposit = useCallback(async (amount) => {
    if (!address) throw new Error("Connect wallet");
    await ensureChain();
    const id = newNonce();
    queue.push({ id, type:"deposit", created:Date.now(), status:"pending" });
    await sleep(800); // optimistic UX
    eco.setVault(v => { const nv = v + amount; lsSet("GAME_VAULT", nv); return nv; });
    queue.setStatus(id, "confirmed");
  },[address, ensureChain, queue, eco]);

  // Bridge (Minner → Game): Stub — uses signed ticket (future)
  const bridge = useCallback(async (amount) => {
    if (!address) throw new Error("Connect wallet");
    await ensureChain();
    const id = newNonce();
    queue.push({ id, type:"bridge", created:Date.now(), status:"pending" });
    await sleep(800);
    eco.setVault(v => { const nv = v + amount; lsSet("GAME_VAULT", nv); return nv; });
    queue.setStatus(id, "confirmed");
  },[address, ensureChain, queue, eco]);

  // Claim (Game → Wallet) — real on-chain via GameClaim
  const claim = useCallback(async (amount) => {
    if (!address) throw new Error("Connect wallet");
    await ensureChain();
    // Enforce daily cap (UX side)
    const remaining = GameConfig.caps.claimPerDay - eco.todayClaimed;
    const take = Math.min(amount, Math.max(0, remaining));
    if (take <= 0) throw new Error("Daily claim cap reached");
    // Prepare raw amount (decimals)
    const raw = BigInt(parseUnits(String(take), ENV.DECIMALS));
    const id = newNonce();
    queue.push({ id, type:"claim", created:Date.now(), status:"pending" });
    try{
      const hash = await claimAction({ gameId: ENV.GAME_ID, amountRaw: raw });
      queue.setStatus(id, "submitted", { txHash: hash });
      // optional: wait receipt via wagmi hook externally
      // optimistic reduce vault
      eco.setVault(v => { const nv = Math.max(0, v - take); lsSet("GAME_VAULT", nv); return nv; });
      eco.setTodayClaimed(x => { const nx = x + take; lsSet("GAME_CLAIMED_TODAY", nx); return nx; });
      queue.setStatus(id, "confirmed");
    }catch(err){
      queue.setStatus(id, "failed", { error: String(err?.message||err) });
      throw err;
    }
  },[address, ensureChain, queue, eco]);

  return { deposit, bridge, claim };
}

// PART 9.5 — DAILY GIFT HOOK (fixed)
function useDailyGift(eco, popReward){
  const [giftNextAt, setGiftNextAt] = useState(() => lsGet("GIFT_DAILY_NEXT_AT", 0));
  const [giftBusy, setGiftBusy] = useState(false);
  const giftAvailableInSec = Math.max(0, giftNextAt - nowSec());
  const canOpenGift = !!(GameConfig.gifts?.daily?.enabled) && giftAvailableInSec <= 0;

  const openDailyGift = async () => {
    if (!GameConfig.gifts?.daily?.enabled) return;
    if (giftBusy || !canOpenGift) return;
    setGiftBusy(true);
    try {
      const reward = pickWeighted(GameConfig.gifts.daily.table);
      const amt = reward.amount;
      eco.setVault(v => { const nv = v + amt; lsSet("GAME_VAULT", nv); return nv; });
      popReward(`Daily Gift +${fmtNum(amt)} MLEO`);
      const next = nowSec() + GameConfig.gifts.daily.cooldownSec;
      setGiftNextAt(next);
      lsSet("GIFT_DAILY_NEXT_AT", next);
    } finally {
      setGiftBusy(false);
    }
  };

  return { giftBusy, giftAvailableInSec, canOpenGift, openDailyGift };
}


// ============================================================================
// PART 10 — RECONCILE LOOP (Mobile focus, retry/backoff)
// ============================================================================
function useReconcile({ queue }){
  useEffect(() => {
    const onFocus = () => {
      // כאן נבצע פיוצ׳ר: בדיקת עסקאות פתוחות מול ה-chain / backend
      // כרגע רק מעדכנים סטטוסים pending→confirmed אחרי delay להדגמה
      queue.open.filter(x => x.status === "pending").forEach(async (it) => {
        await sleep(1200);
        queue.setStatus(it.id, "confirmed");
      });
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  },[queue]);
}

// ============================================================================
// PART 11 — DEV CONSOLE (שינויים חיים בקונפיג דרך מודאל פשוט)
// ============================================================================
function DevConsole({ enabled, eco }){
  const [open, setOpen] = useState(false);
  const [cap, setCap] = useState(GameConfig.caps.claimPerDay);
  if (!enabled) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button onClick={() => setOpen(v=>!v)} className="px-3 py-2 rounded-xl bg-purple-500 text-white shadow">Admin</button>
      {open && (
        <div className="mt-2 w-80 rounded-2xl border border-white/10 bg-black/80 p-4 text-sm">
          <div className="font-semibold mb-2">Dev Console</div>
          <div className="space-y-2">
            <div>
              <div className="opacity-70">Claim cap per day</div>
              <input type="number" value={cap} onChange={e=>setCap(Number(e.target.value||0))}
                     className="w-full mt-1 px-2 py-1 rounded bg-white/10"/>
              <button onClick={()=>{ GameConfig.caps.claimPerDay = Number(cap)||GameConfig.caps.claimPerDay; }}
                      className="mt-2 px-3 py-1 rounded bg-white/90 text-black">Apply</button>
            </div>
            <div>
              <button onClick={()=>{ eco.setVault(0); lsSet("GAME_VAULT",0); }} className="px-3 py-1 rounded bg-red-500 text-white">Reset Vault</button>
              <button onClick={()=>{ eco.setTodayClaimed(0); lsSet("GAME_CLAIMED_TODAY",0); }} className="ml-2 px-3 py-1 rounded bg-orange-500 text-white">Reset Daily</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PART 12 — PAGE UI (מסכים מחודשים: כרייה, צבירה, Collect, הסברים ברורים)
// ============================================================================
export default function MleoMinerHybrid(){
  // Modals state — info about upgrade/gift + reward popup
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoTitle, setInfoTitle] = useState("");
  const [infoBody, setInfoBody] = useState("");
  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardMsg, setRewardMsg] = useState("");

  const openInfo = (title, body) => { setInfoTitle(title); setInfoBody(body); setInfoOpen(true); };
  const popReward = (msg) => { setRewardMsg(msg); setRewardOpen(true); setTimeout(()=>setRewardOpen(false), 2500); };

  const envErrors = validateEnv();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const offline = useOfflineEngine();
  const econ = useEconomyCore();
  const queue = useActionQueue();
  const ops = useGameOps({ queue, eco: econ });
  useReconcile({ queue });

  // Daily Gift encapsulated state
  const gift = useDailyGift(econ, popReward);

  const [mounted, setMounted] = useState(false);
  useEffect(()=>{ setMounted(true); },[]);

  // Sim offline accrual background tick
  useEffect(() => {
    const id = setInterval(() => {
      if (offline.isOffline){
        econ.mineTick(true, offline.efficiency);
      }
    }, 10_000);
    return () => clearInterval(id);
  },[offline.isOffline, offline.efficiency, econ]);

  const dailyLeft = Math.max(0, GameConfig.caps.claimPerDay - econ.todayClaimed);
  const carryPct = Math.round(100 * (econ.carry / Math.max(1, econ.derived.cap)));

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-[#0a0a12] text-white">
      <Head><title>MLEO — Hybrid Miner</title></Head>

      {/* HEADER */}
      <header className="sticky top-0 z-40 backdrop-blur border-b border-white/10 bg-black/40">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <div className="font-bold tracking-wide">🐾 MLEO Hybrid Miner</div>
          <div className="text-xs opacity-60">Chain #{ENV.CHAIN_ID} · GameID {ENV.GAME_ID}</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* LEFT: Player & Banking */}
        <section className="md:col-span-1 space-y-4">
          <Box title="Player">
            <Stat label="Wallet" value={isConnected? `${address?.slice(0,6)}…${address?.slice(-4)}` : "Not connected"} />
            <Stat label="Chain" value={`#${chainId||'-'}`} />
            {envErrors.length>0 && (
              <div className="mt-2 text-red-400 text-xs">ENV errors: {envErrors.join(", ")}</div>
            )}
          </Box>

          <Box title="Vault & Daily">
            <Stat label="Vault (in-game)" value={mounted ? `${fmtNum(econ.vault)} MLEO` : '—'} />
            <Stat label="Claimed today" value={mounted ? `${fmtNum(econ.todayClaimed)} / ${fmtNum(GameConfig.caps.claimPerDay)}` : `0.00 / ${fmtNum(GameConfig.caps.claimPerDay)}`} />
            <div className="mt-3 flex gap-2">
              <Button onClick={()=>ops.claim(Math.min(econ.vault, dailyLeft))} disabled={!isConnected || econ.vault<=0 || dailyLeft<=0}>Claim to Wallet</Button>
            </div>
            {dailyLeft<=0 && <div className="text-xs text-yellow-300 mt-2">Daily claim cap reached</div>}
          </Box>

          <Box title="Deposit / Bridge (DEV)">
            <div className="text-xs opacity-70 mb-2">Deposit = Wallet → Game; Bridge = Minner → Game. כרגע במצב בדיקה: מזכה Vault לצורך פיתוח.</div>
            <div className="flex gap-2">
              <Button onClick={()=>ops.deposit(1000)} disabled={!isConnected}>Deposit +1,000</Button>
              <Button onClick={()=>ops.bridge(2000)} disabled={!isConnected}>Bridge +2,000</Button>
            </div>
          </Box>
        </section>

        {/* CENTER: Mining & Offline */}
        <section className="md:col-span-1 space-y-4">
          <Box title="Mining">
            <div className="h-40 rounded-xl bg-white/5 flex items-center justify-center">
              <div className="text-white/60 text-sm">Tap “Mine action” to fill Carry, then <strong>Collect to Vault</strong>.</div>
            </div>
            <div className="mt-3">
              <div className="text-xs opacity-70 mb-1">Carry: {fmtNum(econ.carry)} / {fmtNum(econ.derived.cap)} MLEO</div>
              <div className="w-full h-2 rounded bg-white/10">
                <div className="h-2 rounded bg-white/80" style={{width: carryPct+"%"}}></div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button onClick={()=>econ.mineTick(false,0)}>Mine action</Button>
                <Button onClick={econ.collectToVault} disabled={econ.carry<=0}>Collect → Vault</Button>
              </div>
            </div>
          </Box>

          <Box title="Offline Status">
            <Stat label="Is Offline" value={offline.isOffline? "Yes":"No"} />
            <Stat label="Efficiency" value={`${Math.round(offline.efficiency*100)}%`} />
            <div className="text-xs opacity-70 mt-2">Offline accrual adds to <strong>Carry</strong> up to capacity. Reset on focus. 0–6h=50%; 6–12h→10%.</div>
          </Box>
        </section>

        {/* RIGHT: Queue & Upgrades & Gifts */}
        <section className="md:col-span-1 space-y-4">
          <Box title="Queue">
            <div className="space-y-2 text-sm">
              {queue.open.length===0 && <div className="opacity-60">No pending actions</div>}
              {queue.open.map(it => (
                <div key={it.id} className="rounded-lg bg-white/5 px-3 py-2">
                  <div className="font-medium">{it.type}</div>
                  <div className="text-xs opacity-60">{it.status}{it.txHash? ` · ${it.txHash.slice(0,8)}…`:''}</div>
                </div>
              ))}
            </div>
          </Box>

          <Box title="Upgrades">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(GameConfig.upgrades.tiers).map(([k, arr]) => (
                <div key={k}
                     className="rounded bg-white/5 p-2 cursor-pointer hover:bg-white/10"
                     onClick={() => openInfo(`Upgrade — ${k}`, (GameConfig.upgrades && GameConfig.upgrades.info && GameConfig.upgrades.info[k]) || "No description yet.") }
                >
                  <div className="font-medium capitalize">{k}</div>
                  <div className="text-xs opacity-60">Cost: {fmtNum(arr[0]||0)} MLEO</div>
                  <div className="text-xs opacity-60">Owned: {econ.levels[k]||0}</div>
                  <button
                    className="mt-2 px-2 py-1 rounded bg-white/90 text-black text-xs"
                    onClick={(e)=>{
                      e.stopPropagation();
                      const cost = arr[Math.min((econ.levels[k]||0), arr.length-1)] || arr[arr.length-1];
                      if (econ.vault < cost){ popReward('Not enough MLEO in Vault'); return; }
                      econ.setVault(v=>{ const nv=v-cost; lsSet('GAME_VAULT',nv); return nv; });
                      econ.setLevels(lv => ({...lv, [k]: (lv[k]||0)+1 }));
                      popReward(`Purchased ${k} Tier ${(econ.levels[k]||0)+1} for ${fmtNum(cost)} MLEO`);
                    }}
                  >Buy</button>
                </div>
              ))}
            </div>
            <div className="text-xs opacity-60 mt-2">Tap an upgrade for details. Buying spends from Vault and increases stats (carry/energy/speed/bots).</div>
          </Box>

          <Box title="Gifts & Drops">
            <div className="rounded bg-white/5 p-3 cursor-pointer hover:bg-white/10"
                 onClick={()=>openInfo("Daily Gift", "Open once every 24 hours to receive a random MLEO bonus. Rewards are weighted; cooldown resets after opening.")}
            >
              <div className="font-medium">Daily Gift</div>
              <div className="text-xs opacity-60">{gift.canOpenGift ? 'Ready to open' : ('Next in ' + formatDuration(gift.giftAvailableInSec))}</div>
              <button
                disabled={!gift.canOpenGift || gift.giftBusy}
                className={`mt-2 px-2 py-1 rounded text-xs ${gift.canOpenGift? 'bg-white/90 text-black':'bg-white/10 text-white/40 cursor-not-allowed'}`}
                onClick={(e)=>{ e.stopPropagation(); gift.openDailyGift(); }}
              >{gift.giftBusy ? 'Opening…' : (gift.canOpenGift ? 'Open' : 'Locked')}</button>
            </div>
          </Box>
        </section>

        

        {/* RIGHT: Queue & Upgrades (skeleton) */}
        <section className="md:col-span-1 space-y-4">
          <Box title="Queue">
            <div className="space-y-2 text-sm">
              {queue.open.length===0 && <div className="opacity-60">No pending actions</div>}
              {queue.open.map(it => (
                <div key={it.id} className="rounded-lg bg-white/5 px-3 py-2">
                  <div className="font-medium">{it.type}</div>
                  <div className="text-xs opacity-60">{it.status}{it.txHash? ` · ${it.txHash.slice(0,8)}…`:''}</div>
                </div>
              ))}
            </div>
          </Box>

          <Box title="Upgrades">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(GameConfig.upgrades.tiers).map(([k, arr]) => (
                <div key={k}
                     className="rounded bg-white/5 p-2 cursor-pointer hover:bg-white/10"
                     onClick={() => openInfo(`Upgrade — ${k}`, (GameConfig.upgrades && GameConfig.upgrades.info && GameConfig.upgrades.info[k]) || "No description yet.") }
                >
                  <div className="font-medium capitalize">{k}</div>
                  <div className="text-xs opacity-60">Cost: {fmtNum(arr[0]||0)} MLEO</div>
                  <button
                    className="mt-2 px-2 py-1 rounded bg-white/90 text-black text-xs"
                    onClick={(e)=>{ e.stopPropagation(); popReward(`Purchased ${k} Tier 1 for ${fmtNum(arr[0]||0)} MLEO`); }}
                  >Buy</button>
                </div>
              ))}
            </div>
            <div className="text-xs opacity-60 mt-2">Tap any upgrade to read details. Buying shows a small reward popup.</div>
          </Box>

          <Box title="Gifts & Drops">
            <div className="rounded bg-white/5 p-3 cursor-pointer hover:bg-white/10"
                 onClick={()=>openInfo("Daily Gift", "Open once every 24 hours to receive a random MLEO bonus. Rewards are weighted; cooldown resets after opening.")}
            >
              <div className="font-medium">Daily Gift</div>
              <div className="text-xs opacity-60">{gift.canOpenGift ? 'Ready to open' : ('Next in ' + formatDuration(gift.giftAvailableInSec))}</div>
              <button
                disabled={!gift.canOpenGift || gift.giftBusy}
                className={`mt-2 px-2 py-1 rounded text-xs ${gift.canOpenGift? 'bg-white/90 text-black':'bg-white/10 text-white/40 cursor-not-allowed'}`}
                onClick={(e)=>{ e.stopPropagation(); gift.openDailyGift(); }}
              >{gift.giftBusy? 'Opening…' : (gift.canOpenGift? 'Open' : 'Locked')}</button>
            </div>
          </Box>
        </section>

        {/* GIFTS */}
        <section className="md:col-span-1 hidden"></section>
      </main>

      <DevConsole enabled={true} eco={econ} />

      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs opacity-60">
        © MLEO Hybrid Miner · Config v{GameConfig.version}
      </footer>

      {/* Modals */}
      <Modal open={infoOpen} title={infoTitle} onClose={()=>setInfoOpen(false)}>
        <div className="whitespace-pre-wrap leading-relaxed">{infoBody}</div>
      </Modal>
      <RewardToast open={rewardOpen} message={rewardMsg} onClose={()=>setRewardOpen(false)} />
    </div>
  );
}


// ============================================================================
// PART X — POLYFILLS / SAFE HELPERS (appended)
// ============================================================================
// Ensure formatDuration exists (HH:MM:SS)
function formatDuration(sec){
  try{
    sec = Math.max(0, Math.floor(Number(sec)||0));
    const h = Math.floor(sec/3600); sec -= h*3600;
    const m = Math.floor(sec/60); const s = sec - m*60;
    const pad = (n)=>String(n).padStart(2,'0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }catch{
    return "00:00:00";
  }
}
