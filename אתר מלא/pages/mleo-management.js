//START PART 1

// ===============================================
// 📄 START OF FILE: pages/mleo-management.js
// MLEO Mining Manager — Next.js page
// ===============================================

import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
  useDisconnect,
} from "wagmi";
import { useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";
import { parseUnits } from "viem";

const isServer = typeof window === "undefined";
const CONFIG_VER = "v1.0.9";
const LS_KEY = `mleoMgmt_${CONFIG_VER}`;

//END PART 1


//START PART 2

export const GAME_CONFIG = {
  title: "MLEO Mining Manager",
  subtitle: "Build • Upgrade • Automate",
  resources: {
    MLEO: { label: "MLEO", precision: 2 },
    ORE: { label: "Ore", precision: 0 },
    GOLD: { label: "Gold", precision: 0 },
    ENERGY: { label: "Energy", precision: 0, capacity: 120, regenPerSec: 5 }, // 🚀 ריג'ן בסיסי גבוה יותר
  },
  productionBase: { ORE: 0, GOLD: 0, MLEO: 0 },

  // צריכת אנרגיה הופחתה באופן משמעותי
  buildings: [
    { key: "pit", name: "Mining Pit", desc: "Basic open-pit mine.", maxLevel: 50, cost: { GOLD: 40 }, costGrowth: 1.16, energyPerSec: 0.3, outputPerSec: { ORE: 2 } },
    { key: "drill", name: "Power Drill", desc: "Mechanized drilling.", maxLevel: 40, cost: { GOLD: 220, ORE: 90 }, costGrowth: 1.2, energyPerSec: 0.8, outputPerSec: { ORE: 6 }, requires: [{ key: "pit", lvl: 3 }] },
    { key: "refinery", name: "Refinery", desc: "Refines Ore into MLEO.", maxLevel: 30, cost: { GOLD: 1000, ORE: 700 }, costGrowth: 1.22, energyPerSec: 1.2, outputPerSec: { MLEO: 0.04 }, ratios: { OREtoMLEO: 0.20 }, requires: [{ key: "drill", lvl: 5 }] },
    { key: "bots", name: "Mining Bots", desc: "Autonomous robots.", maxLevel: 25, cost: { GOLD: 3500, ORE: 2600 }, costGrowth: 1.25, energyPerSec: 1.5, outputPerSec: { ORE: 8, MLEO: 0.06 }, requires: [{ key: "refinery", lvl: 4 }] },
  ],

  workers: { maxCount: 100, baseHireCost: { GOLD: 100, ORE: 50 }, hireGrowth: 1.15, outputBonusPerWorker: 0.02, energyPerWorker: 0.05 },

  energy: {
    baseCapacity: 120,
    baseRegenPerSec: 5,
    // 🔋 אלה לא "מבנים" — קונים דרך tryBuyGenerator (תיקון הכפתור)
    generators: [
      { key: "cap1", name: "Cap Booster I", cost: { GOLD: 300 }, capacityPlus: 100, regenPlus: 1 },
      { key: "cap2", name: "Cap Booster II", cost: { GOLD: 900 }, capacityPlus: 200, regenPlus: 2, requires: ["cap1"] },
      { key: "cap3", name: "Cap Booster III", cost: { GOLD: 3000 }, capacityPlus: 400, regenPlus: 3, requires: ["cap2"] },
    ],
  },

  tools: [
    { key: "hammer", name: "Reinforced Hammer", cost: { GOLD: 250 }, mult: { ORE: 1.1 } },
    { key: "drillbit", name: "Diamond Drill Bit", cost: { GOLD: 1200 }, mult: { ORE: 1.2 } },
    { key: "ai-core", name: "AI Optimizer", cost: { GOLD: 5000 }, mult: { MLEO: 1.25 } },
  ],
  research: [
    { key: "r_eff1", name: "Logistics I", cost: { ORE: 2000 }, mult: { ALL: 1.05 } },
    { key: "r_eff2", name: "Logistics II", cost: { ORE: 8000 }, mult: { ALL: 1.1 }, requires: ["r_eff1"] },
    { key: "r_ai", name: "AI Pathfinding", cost: { GOLD: 15000 }, mult: { MLEO: 1.15 }, requires: ["r_eff2"] },
  ],

  // 🔁 שינוי כאן — מודל 100B/5y עם תקציב יומי קבוע
  emission: {
    budgetTotal: 100_000_000_000,                      // 100B
    startMs: Date.UTC(2025, 9, 1, 0, 0, 0),            // 1 Oct 2025
    endMs:   Date.UTC(2030, 9, 1, 0, 0, 0),            // 1 Oct 2030
    rollover: false,                                    // Use-it-or-lose-it
  },

  token: {
    TGE_MS: Date.UTC(2026, 0, 1, 0, 0, 0),
    live: true,
    claimSchedule: [
      { monthFromTGE: 1, pct: 0.1 },
      { monthFromTGE: 2, pct: 0.3 },
      { monthFromTGE: 3, pct: 0.5 },
      { monthFromTGE: 4, pct: 0.7 },
      { monthFromTGE: 5, pct: 0.9 },
      { monthFromTGE: 6, pct: 1.0 },
    ],
  },

  chain: {
    CHAIN_ID: Number(process.env.NEXT_PUBLIC_CLAIM_CHAIN_ID || 97),
    CLAIM_ADDRESS: process.env.NEXT_PUBLIC_MLEO_CLAIM_ADDRESS || "0x0000000000000000000000000000000000000000",
    DECIMALS: Number(process.env.NEXT_PUBLIC_MLEO_DECIMALS || 18),
    FN: (process.env.NEXT_PUBLIC_MLEO_CLAIM_FN || "claim").toLowerCase(),
    TESTNET_OVERRIDE:
      (process.env.NEXT_PUBLIC_ALLOW_TESTNET_WALLET || "").toLowerCase() === "1" ||
      (process.env.NEXT_PUBLIC_ALLOW_TESTNET_WALLET || "").toLowerCase() === "true",
  },

  deposit: {
    enabled: true,
    mode: "resources", // or "vault"
    min: 10,
    max: 1_000_000,
    tokenAddress: process.env.NEXT_PUBLIC_MLEO_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000",
    treasury: process.env.NEXT_PUBLIC_MLEO_TREASURY || "0x0000000000000000000000000000000000000000",
    rates: { GOLD: 10, ORE: 25 },
  },
};

//END PART 2


//START PART 3

const CLAIM_ABI_MAP = {
  claim: [{ type: "function", name: "claim", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] }],
  mint: [{ type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }],
  mintto: [{ type: "function", name: "mintTo", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] }],
};
const ERC20_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
];

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const nowMs = () => Date.now();
const fmt = (n, p = 0) => Number(n || 0).toFixed(p);
const fmtAbbrev = (n) => {
  const x = Number(n || 0);
  const abs = Math.abs(x);
  if (abs < 1e3) return x.toFixed(0);
  if (abs < 1e6) return (x / 1e3).toFixed(1) + "K";
  if (abs < 1e9) return (x / 1e6).toFixed(1) + "M";
  if (abs < 1e12) return (x / 1e9).toFixed(1) + "B";
  return (x / 1e12).toFixed(1) + "T";
};
const getTodayKey = () => new Date().toISOString().slice(0, 10);

//END PART 3


//START PART 4

// --- Daily budget helpers (100B / 5y) ---
const dayKey = (ms = nowMs()) => new Date(ms).toISOString().slice(0, 10);
const daysBetween = (aMs, bMs) => Math.max(1, Math.ceil((bMs - aMs) / (24 * 3600 * 1000)));
function dailyBudget(gc, tMs = nowMs()) {
  const em = gc.emission;
  if (!em?.startMs || !em?.endMs || tMs < em.startMs || tMs >= em.endMs) return 0;
  const totalDays = daysBetween(em.startMs, em.endMs);
  return Math.round((em.budgetTotal / totalDays) * 100) / 100; // סכום יומי מחושב דינאמית
}

// (נשאר — גם אם כבר לא משתמשים בו בפועל)
const softcutFactor = (used, cap, softcut) => {
  if (cap <= 0) return 1;
  const ratio = used / cap;
  for (const s of softcut || []) if (ratio <= s.upto) return s.factor;
  return 0.1;
};
const monthsSince = (ms) => Math.floor((nowMs() - ms) / (30 * 24 * 3600 * 1000));
const currentClaimPct = (tokenCfg) => {
  if (!tokenCfg?.TGE_MS || !tokenCfg.live) return 0;
  const m = monthsSince(tokenCfg.TGE_MS);
  if (m < 0) return 0;
  let pct = 0;
  for (const step of tokenCfg.claimSchedule) if (m >= step.monthFromTGE) pct = Math.max(pct, step.pct);
  return pct;
};
const loadState = () => { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } };
const saveState = (s) => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {} };
const pushActivity = (stateObj, msg) => {
  const entry = { t: nowMs(), msg };
  const arr = Array.isArray(stateObj.activity) ? stateObj.activity : [];
  stateObj.activity = [entry, ...arr].slice(0, 20);
};

//END PART 4


//START PART 5

function freshState() {
  const gc = GAME_CONFIG;
  const baseRes = Object.fromEntries(Object.keys(gc.resources).map(k => [k, 0]));
  return {
    ver: CONFIG_VER,
    res: { ...baseRes, ENERGY: gc.energy.baseCapacity },
    cap: { ENERGY: gc.energy.baseCapacity },
    regen: { ENERGY: gc.energy.baseRegenPerSec },
    buildings: Object.fromEntries(gc.buildings.map(b => [b.key, { lvl: 0 }])),
    workers: 0,
    tools: {},
    research: {},
    gens: {},

    minedToday: 0,
    lastDay: isServer ? "1970-01-01" : getTodayKey(),
    vault: 0,
    balance: 0,
    claimedTotal: 0,
    claimedToWallet: 0,

    depositsTotal: 0,
    lastDeposit: 0,
    activity: [],

    paused: false,          // 🧊 Pause production
    autoBank: true,         // ✅ חדש: העברה אוטומטית ל-Vault כל 5 שניות

    lastTickAt: isServer ? 0 : nowMs(),
    idleSince: isServer ? 0 : nowMs(),
  };
}

//END PART 5

//START PART 6

function buildingCost(gc, bKey, lvl) {
  const b = gc.buildings.find(x => x.key === bKey);
  if (!b) return {};
  const pow = Math.pow(b.costGrowth || 1, lvl);
  const out = {};
  for (const [k, v] of Object.entries(b.cost || {})) out[k] = Math.ceil(v * pow);
  return out;
}
function canAfford(res, cost) { for (const [k, v] of Object.entries(cost)) if ((res[k] || 0) < v) return false; return true; }
function pay(res, cost) { const r = { ...res }; for (const [k, v] of Object.entries(cost)) r[k] = (r[k] || 0) - v; return r; }
function hireCost(gc, count) {
  const base = gc.workers.baseHireCost; const growth = Math.pow(gc.workers.hireGrowth, count);
  const out = {}; for (const [k, v] of Object.entries(base)) out[k] = Math.ceil(v * growth); return out;
}
function totalMultipliers(s, gc) {
  let mult = { ORE: 1, GOLD: 1, MLEO: 1 };
  for (const t of gc.tools) if (s.tools[t.key]) for (const [k, m] of Object.entries(t.mult || {})) mult[k] = (mult[k] || 1) * m;
  for (const r of gc.research) if (s.research[r.key]) for (const [k, m] of Object.entries(r.mult || {})) {
    if (k === "ALL") for (const kk of Object.keys(mult)) mult[kk] *= m; else mult[k] = (mult[k] || 1) * m;
  }
  mult.ORE *= 1 + s.workers * (gc.workers.outputBonusPerWorker || 0);
  mult.MLEO *= 1 + s.workers * (gc.workers.outputBonusPerWorker || 0);
  return mult;
}
function unlocked(b, s) {
  if (!b.requires?.length) return true;
  for (const req of b.requires) {
    const lvl = s.buildings[req.key]?.lvl || 0;
    if (lvl < (req.lvl || 1)) return false;
  }
  return true;
}

//END PART 6


//START PART 7

function tickEngine(s, gc, dt) {
  const today = getTodayKey();
  if (s.lastDay !== today) { s.lastDay = today; s.minedToday = 0; }

  // Energy regen from purchased generators
  const extraRegen = Object.values(s.gens).reduce((a, g) => a + (g.regenPlus || 0), 0);
  const baseRegen = gc.energy.baseRegenPerSec + extraRegen;
  s.res.ENERGY = clamp(s.res.ENERGY + baseRegen * dt, 0, s.cap.ENERGY);

  if (s.paused) return { prod: { ...gc.productionBase } }; // עצירה מוחלטת

  let prod = { ...gc.productionBase };

  // Buildings
  for (const b of gc.buildings) {
    const lvl = s.buildings[b.key]?.lvl || 0;
    if (!lvl || !unlocked(b, s)) continue;

    const eUse = (b.energyPerSec || 0) * lvl;
    // Throttle: אם אין מספיק אנרגיה, לא צורכים ולא מייצרים
    if (s.res.ENERGY >= eUse * dt) {
      s.res.ENERGY -= eUse * dt;
      for (const [k, v] of Object.entries(b.outputPerSec || {})) prod[k] = (prod[k] || 0) + v * lvl;

      if (b.ratios?.OREtoMLEO) {
        const oreToBurn = b.ratios.OREtoMLEO * lvl * dt;
        if (s.res.ORE >= oreToBurn) {
          s.res.ORE -= oreToBurn;
          prod.MLEO = (prod.MLEO || 0) + oreToBurn * 0.05;
        }
      }
    }
  }

  // Workers passive (קטנה מאוד)
  const wUse = (gc.workers.energyPerWorker || 0) * s.workers * dt;
  if (s.res.ENERGY >= wUse) s.res.ENERGY -= wUse;

  // Multipliers
  const mult = totalMultipliers(s, gc);
  for (const k of Object.keys(prod)) prod[k] *= mult[k] || 1;

  // Accrue
  for (const [k, v] of Object.entries(prod)) s.res[k] = (s.res[k] || 0) + v * dt;

  // MLEO unbanked
  const mle = (prod.MLEO || 0) * dt;
  s.balance = (s.balance || 0) + mle;

  return { prod };
}

//END PART 7



//START PART 8

function computeLiveStats(s, gc) {
  let prod = { ...gc.productionBase }; let energyUse = 0;
  for (const b of gc.buildings) {
    const lvl = s.buildings[b.key]?.lvl || 0; if (!lvl || !unlocked(b, s)) continue;
    energyUse += (b.energyPerSec || 0) * lvl;
    for (const [k, v] of Object.entries(b.outputPerSec || {})) prod[k] = (prod[k] || 0) + v * lvl;
  }
  energyUse += (gc.workers.energyPerWorker || 0) * s.workers;
  const extraRegen = Object.values(s.gens).reduce((a, g) => a + (g.regenPlus || 0), 0);
  const regenBase = gc.energy.baseRegenPerSec + extraRegen;
  const mult = totalMultipliers(s, gc);
  for (const k of Object.keys(prod)) prod[k] *= mult[k] || 1;
  const netEnergy = s.paused ? regenBase : (regenBase - energyUse);
  let eta = null, etaLabel = "";
  if (!s.paused) {
    if (netEnergy < 0 && s.res.ENERGY > 0) { eta = s.res.ENERGY / (-netEnergy); etaLabel = "to empty"; }
    else if (netEnergy > 0 && s.res.ENERGY < s.cap.ENERGY) { eta = (s.cap.ENERGY - s.res.ENERGY) / netEnergy; etaLabel = "to full"; }
  } else {
    if (regenBase > 0 && s.res.ENERGY < s.cap.ENERGY) { eta = (s.cap.ENERGY - s.res.ENERGY) / regenBase; etaLabel = "to full (paused)"; }
  }
  return { prodPerSec: prod, energyUsePerSec: energyUse, regenPerSec: regenBase, netEnergyPerSec: netEnergy, etaSec: eta, etaLabel };
}

//END PART 8


//START PART 9

export default function MleoManagement() {
  const gc = GAME_CONFIG;
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  useDisconnect();

  const [s, setS] = useState(() => freshState());
  const [mounted, setMounted] = useState(false);
  const [depAmount, setDepAmount] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const rafRef = useRef(0);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const saved = loadState();
    if (saved) { saved.lastTickAt = nowMs(); saved.idleSince = nowMs(); setS(saved); }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    let last = nowMs();
    const loop = () => {
      const t = nowMs(); const dt = clamp((t - last) / 1000, 0, 0.1); last = t;
      setS(prev => { const n = { ...prev }; tickEngine(n, gc, dt); n.lastTickAt = t; return n; });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mounted]);

  useEffect(() => { if (mounted) saveState(s); }, [s, mounted]);


//END PART 9


//START PART 10

  // ---------- Actions
  const tryBuyBuilding = (key) => setS(prev => {
    const n = { ...prev }; const b = gc.buildings.find(x => x.key === key); if (!b) return n;
    if (!unlocked(b, n)) return n;
    const lvl = n.buildings[key]?.lvl || 0; if (lvl >= (b.maxLevel || 999)) return n;
    const cost = buildingCost(gc, key, lvl); if (!canAfford(n.res, cost)) return n;
    n.res = pay(n.res, cost); n.buildings[key] = { lvl: lvl + 1 };
    pushActivity(n, `Upgraded ${b.name} → Lv ${lvl + 1}`);
    return n;
  });

  // ✅ קניית גנרטור אנרגיה
  const tryBuyGenerator = (gKey) => setS(prev => {
    const n = { ...prev };
    const g = gc.energy.generators.find(x => x.key === gKey); if (!g) return n;
    if (n.gens[gKey]) return n; // כל גנרטור פעם אחת
    if (g.requires?.some(dep => !n.gens[dep])) return n;
    if (!canAfford(n.res, g.cost)) return n;
    n.res = pay(n.res, g.cost);
    n.gens[gKey] = g;
    n.cap.ENERGY += g.capacityPlus || 0;
    n.regen.ENERGY = (n.regen.ENERGY || gc.energy.baseRegenPerSec) + (g.regenPlus || 0);
    pushActivity(n, `Bought ${g.name} (+${g.capacityPlus} cap, +${g.regenPlus}/s)`);
    return n;
  });

  const hireCostMemo = () => hireCost(gc, s.workers);
  const tryHireWorker = () => setS(prev => {
    const n = { ...prev }; if (n.workers >= gc.workers.maxCount) return n;
    const cost = hireCost(gc, n.workers); if (!canAfford(n.res, cost)) return n;
    n.res = pay(n.res, cost); n.workers += 1; pushActivity(n, `Hired worker (#${n.workers})`); return n;
  });
  const tryBuyTool = (key) => setS(prev => {
    const n = { ...prev }; if (n.tools[key]) return n;
    const t = gc.tools.find(x => x.key === key); if (!t) return n;
    if (!canAfford(n.res, t.cost)) return n; n.res = pay(n.res, t.cost); n.tools[key] = true; pushActivity(n, `Bought tool: ${t.name}`); return n;
  });
  const tryResearch = (key) => setS(prev => {
    const n = { ...prev }; if (n.research[key]) return n;
    const r = gc.research.find(x => x.key === key); if (!r) return n;
    if (r.requires?.some(dep => !n.research[dep])) return n;
    if (!canAfford(n.res, r.cost)) return n; n.res = pay(n.res, r.cost); n.research[key] = true; pushActivity(n, `Research: ${r.name}`); return n;
  });

//END PART 10


//START PART 11

  const moveBalanceToVault = () => setS(prev => {
    const n = { ...prev };
    // rollover יומי
    const today = getTodayKey();
    if (n.lastDay !== today) { n.lastDay = today; n.minedToday = 0; }

    const budget = dailyBudget(gc, nowMs()); // תקציב ליום (נגזר מ-100B/5y)
    const room   = Math.max(0, budget - n.minedToday);
    const amt    = Math.max(0, Math.floor(n.balance));

    if (!amt) { pushActivity(n, "Nothing to bank."); return n; }

    const allowed = Math.min(amt, Math.floor(room));
    if (allowed > 0) {
      n.vault      += allowed;
      n.minedToday += allowed;
      n.balance    -= allowed;
      pushActivity(n, `Banked ${fmtAbbrev(allowed)} MLEO (today ${fmt(n.minedToday,0)}/${fmt(budget,0)}).`);
    } else {
      pushActivity(n, "Today's budget is exhausted.");
    }

    // Use-it-or-lose-it: אם נגמר התקציב — שורפים את היתרה ה־unbanked
    if (room <= 0 && n.balance >= 1) {
      const burned = Math.floor(n.balance);
      n.balance -= burned;
      pushActivity(n, `Burned ${fmtAbbrev(burned)} unbanked (daily budget reached).`);
    }
    return n;
  });

//END PART 11


//START PART 12

  const { openConnectModal: openConnect } = useConnectModal();

  const onDepositMleo = async () => {
    const depCfg = gc.deposit; if (!depCfg.enabled) { alert("Deposit disabled"); return; }
    if (!isConnected) { openConnect?.(); return; }
    if (chainId !== gc.chain.CHAIN_ID) { try { await switchChain?.({ chainId: gc.chain.CHAIN_ID }); } catch { alert("Switch network required"); return; } }
    const amtFloat = Number(depAmount || 0);
    if (!amtFloat || amtFloat <= 0) { alert("Enter amount"); return; }
    if (amtFloat < depCfg.min || amtFloat > depCfg.max) { alert(`Allowed range: ${depCfg.min} - ${depCfg.max} MLEO`); return; }
    if (!depCfg.tokenAddress || !depCfg.treasury) { alert("Token or treasury address not set"); return; }
    try {
      const wei = parseUnits(String(amtFloat), gc.chain.DECIMALS);
      const hash = await writeContractAsync({ address: depCfg.tokenAddress, abi: ERC20_ABI, functionName: "transfer", args: [depCfg.treasury, wei], chainId: gc.chain.CHAIN_ID });
      await publicClient.waitForTransactionReceipt({ hash });
      setS(prev => {
        const n = { ...prev }; n.depositsTotal = (n.depositsTotal || 0) + amtFloat; n.lastDeposit = amtFloat;
        if (depCfg.mode === "vault") {
          n.vault += amtFloat; pushActivity(n, `Deposit ${amtFloat} MLEO → Vault +${amtFloat}`);
        } else {
          const gAdd = (depCfg.rates.GOLD || 0) * amtFloat; const oAdd = (depCfg.rates.ORE || 0) * amtFloat;
          n.res.GOLD = (n.res.GOLD || 0) + gAdd; n.res.ORE = (n.res.ORE || 0) + oAdd;
          pushActivity(n, `Deposit ${amtFloat} MLEO → +${fmtAbbrev(gAdd)} GOLD, +${fmtAbbrev(oAdd)} ORE`);
        }
        return n;
      });
      setDepAmount("");
      alert("Deposit successful ✅");
    } catch (e) { console.error(e); alert("Deposit failed or rejected"); }
  };

  const { claimPct, claimRoom } = useMemo(() => {
    const pct = currentClaimPct(gc.token);
    const maxCumulative = Math.floor((s.claimedTotal + s.vault + s.balance) * pct);
    const room = Math.max(0, maxCumulative - s.claimedToWallet);
    return { claimPct: pct, claimRoom: room };
  }, [s.claimedTotal, s.vault, s.balance]);

  const onClaimToWallet = async () => {
    const chain = gc.chain; const vaultNow = Math.floor(s.vault); if (!vaultNow) return;
    if (!isConnected) { openConnect?.(); return; }
    if (chainId !== chain.CHAIN_ID) { try { await switchChain?.({ chainId: chain.CHAIN_ID }); } catch { alert("Switch network required"); return; } }
    const testnetRoom = chain.TESTNET_OVERRIDE && chainId === chain.CHAIN_ID ? vaultNow : Math.floor(claimRoom);
    const toClaim = Math.min(vaultNow, testnetRoom); if (!toClaim) { alert("Claim locked or empty"); return; }
    try {
      const fnName = chain.FN === "mintto" ? "mintTo" : chain.FN;
      const args = fnName === "claim" ? [parseUnits(String(toClaim), chain.DECIMALS)] : [address, parseUnits(String(toClaim), chain.DECIMALS)];
      const abi = CLAIM_ABI_MAP[chain.FN] || CLAIM_ABI_MAP.claim;
      const hash = await writeContractAsync({ address: chain.CLAIM_ADDRESS, abi, functionName: fnName, args, chainId: chain.CHAIN_ID });
      await publicClient.waitForTransactionReceipt({ hash });
      setS(prev => ({ ...prev, vault: prev.vault - toClaim, claimedToWallet: prev.claimedToWallet + toClaim, claimedTotal: prev.claimedTotal + toClaim }));
    } catch (e) { console.error(e); alert("Claim failed or rejected"); }
  };

  const resetProgress = () => { if (confirm("Reset all progress?")) { const f = freshState(); setS(f); saveState(f); } };

  const live = computeLiveStats(s, gc);

  // ✅ Auto-Bank every 5s (כיבוי/הדלקה מה-UI)
  useEffect(() => {
    if (!mounted || !s.autoBank) return;
    const id = setInterval(() => {
      setS(prev => {
        const n = { ...prev };
        const today = getTodayKey();
        if (n.lastDay !== today) { n.lastDay = today; n.minedToday = 0; }
        const budget = dailyBudget(gc, nowMs());
        const room = Math.max(0, budget - n.minedToday);
        const can = Math.min(Math.floor(n.balance), Math.floor(room));
        if (can > 0) { n.vault += can; n.minedToday += can; n.balance -= can; }
        return n;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [mounted, s.autoBank]);

  if (!mounted) {
    return (
      <Layout title={gc.title}>
        <div className="mx-auto max-w-5xl px-3 py-4 text-white">
          <div className="text-sm text-white/60">Loading…</div>
        </div>
      </Layout>
    );
  }

//END PART 12


//START PART 13

  return (
    <Layout title={gc.title}>
      <div className="mx-auto max-w-5xl px-3 py-4 text-white">
        {/* Goal banner */}
        <div className="mb-3 rounded-2xl bg-emerald-600/10 border border-emerald-600/30 p-3 text-sm">
          <b>Goal:</b> Bank as much <b>MLEO</b> as possible in the <b>Vault</b>, then <b>Claim</b> to wallet after TGE. Convert deposits → build → upgrade → bank.
        </div>

        {/* Quick Start (עברית) */}
        <div className="mb-3 rounded-2xl bg-white/5 border border-white/10 p-3 text-sm">
          <div className="font-semibold mb-1">איך משחקים – 3 צעדים מהירים</div>
          <ol className="list-decimal ml-5 space-y-1">
            <li>שדרגו <b>Refinery Lv.1+</b> כדי להתחיל לצבור <b>MLEO (Unbanked)</b>.</li>
            <li>לחצו <b>Move Balance → Vault</b> (או הפעילו <b>Auto-Bank</b>) כדי להוסיף ל־Vault עד גמר תקציב היום.</li>
            <li>קנו <b>Cap Booster I</b> כדי להעלות <b>Energy</b> ולמנוע עצירות.</li>
          </ol>
          <div className="mt-2 text-xs text-white/70">
            תקציב יומי: {fmt(dailyBudget(gc),2)} MLEO · מנוצל היום: {fmt(s.minedToday,2)} · נותר: {fmt(Math.max(0, dailyBudget(gc) - s.minedToday),2)}
          </div>
          <div className="mt-2">
            <button onClick={() => { /* CTA מהיר לבנקינג */ const evt = new Event('click'); }} className="hidden" />
            <button onClick={() => { /* מפעיל את אותה פונקציית הבנקינג */ (async()=>moveBalanceToVault())(); }} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm">
              Bank now
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{gc.title}</h1>
            <p className="text-white/70 text-sm">{gc.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setHelpOpen(true)} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm">Help / Guide</button>
            <button onClick={() => setS(p => ({ ...p, paused: !p.paused }))} className={`px-3 py-2 rounded-xl text-sm ${s.paused ? "bg-yellow-600 hover:bg-yellow-500" : "bg-white/10 hover:bg-white/20"}`}>
              {s.paused ? "Resume" : "Pause Production"}
            </button>
            {isConnected ? (
              <button onClick={() => openAccountModal?.()} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm">
                {address?.slice(0,6)}…{address?.slice(-4)}
              </button>
            ) : (
              <button onClick={() => openConnectModal?.()} className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm">Connect</button>
            )}
            <button onClick={resetProgress} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm">Reset</button>
          </div>
        </div>

//END PART 13


//START PART 14

        {/* HUD */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(gc.resources).map(([k, cfg]) => (
            <div key={k} className="rounded-2xl bg-white/5 px-3 py-2">
              <div className="text-xs text-white/70">{cfg.label}</div>
              <div className="text-lg font-semibold" suppressHydrationWarning>
                {fmtAbbrev(s.res[k] || 0)}{s.cap[k] ? <span className="text-xs text-white/60">/{fmtAbbrev(s.cap[k])}</span> : null}
              </div>
            </div>
          ))}
          <div className="rounded-2xl bg-white/5 px-3 py-2">
            <div className="text-xs text-white/70">Vault</div>
            <div className="text-lg font-semibold" suppressHydrationWarning>{fmtAbbrev(s.vault)}</div>
          </div>
          <div className="rounded-2xl bg-white/5 px-3 py-2">
            <div className="text-xs text-white/70">Unbanked</div>
            <div className="text-lg font-semibold" suppressHydrationWarning>{fmtAbbrev(s.balance)}</div>
          </div>
        </div>

        {/* Live Stats */}
        <div className="mt-3 grid sm:grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/5 p-3">
            <div className="text-xs text-white/70">Production /s</div>
            <div className="text-sm" suppressHydrationWarning>ORE {fmtAbbrev(live.prodPerSec.ORE || 0)} · GOLD {fmtAbbrev(live.prodPerSec.GOLD || 0)} · MLEO {fmt(live.prodPerSec.MLEO || 0, 3)}</div>
          </div>
          <div className="rounded-2xl bg-white/5 p-3">
            <div className="text-xs text-white/70">Energy</div>
            <div className="text-sm" suppressHydrationWarning>
              Use {fmt(live.energyUsePerSec, 2)}/s · Regen {fmt(live.regenPerSec, 2)}/s · Net {fmt(live.netEnergyPerSec, 2)}/s
            </div>
          </div>
          <div className="rounded-2xl bg-white/5 p-3">
            <div className="text-xs text-white/70">ETA</div>
            <div className="text-sm" suppressHydrationWarning>{live.etaSec ? `${Math.ceil(live.etaSec)}s ${live.etaLabel}` : (s.paused ? "— (paused)" : "—")}</div>
          </div>
        </div>

        {/* Deposit */}
        {gc.deposit.enabled && (
          <div className="mt-4 rounded-2xl bg-white/5 p-3">
            <h3 className="font-semibold mb-1">Deposit MLEO to Start</h3>
            <p className="text-sm text-white/70">
              {gc.deposit.mode === "vault"
                ? "Deposit credits 1:1 to your Vault."
                : `Convert to resources: 1 MLEO → ${gc.deposit.rates.GOLD} GOLD + ${gc.deposit.rates.ORE} ORE`}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <input inputMode="decimal" value={depAmount} onChange={(e) => setDepAmount(e.target.value)} placeholder={`Amount (${gc.deposit.min} - ${gc.deposit.max})`} className="w-40 px-3 py-2 rounded-xl bg-white/10 outline-none" />
              <button onClick={onDepositMleo} className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-sm">Deposit</button>
            </div>
            <div className="text-xs text-white/50 mt-1" suppressHydrationWarning>
              Token: {gc.deposit.tokenAddress.slice(0,6)}…{gc.deposit.tokenAddress.slice(-4)} · Treasury: {gc.deposit.treasury.slice(0,6)}…{gc.deposit.treasury.slice(-4)} · Total deposited: {fmtAbbrev(s.depositsTotal)} MLEO · Last: {fmtAbbrev(s.lastDeposit)} MLEO
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 grid sm:grid-cols-3 gap-3">
          {/* Buildings */}
          <div className="rounded-2xl bg-white/5 p-3">
            <h3 className="font-semibold mb-1">Buildings</h3>
            <div className="space-y-2">
              {gc.buildings.map(b => {
                const lvl = s.buildings[b.key]?.lvl || 0;
                const cost = buildingCost(gc, b.key, lvl);
                const can = canAfford(s.res, cost) && lvl < (b.maxLevel || 999) && unlocked(b, s);
                return (
                  <div key={b.key} className="rounded-xl bg-white/5 px-3 py-2 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{b.name} <span className="text-white/60">Lv {lvl}</span></div>
                      <div className="text-xs text-white/60">Energy: {b.energyPerSec * (lvl || 1)} /s · {b.desc}</div>
                      <div className="text-xs text-white/70 mt-0.5">Cost: {Object.entries(cost).map(([k,v]) => `${k} ${fmtAbbrev(v)}`).join(" · ")}</div>
                    </div>
                    <button disabled={!can} onClick={() => tryBuyBuilding(b.key)} className={`px-3 py-1.5 rounded-lg text-sm ${can ? "bg-cyan-600 hover:bg-cyan-500" : "bg-white/10 text-white/40 cursor-not-allowed"}`}>Upgrade</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Workforce & Tools */}
          <div className="rounded-2xl bg-white/5 p-3">
            <h3 className="font-semibold mb-1">Workforce & Tools</h3>
            <div className="rounded-xl bg-white/5 px-3 py-2 mb-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Workers</div>
                  <div className="text-xs text-white/60">{s.workers}/{gc.workers.maxCount} · +{(gc.workers.outputBonusPerWorker*100).toFixed(0)}%/worker</div>
                </div>
                {(() => {
                  const cost = hireCostMemo();
                  const canHire = canAfford(s.res, cost) && s.workers < gc.workers.maxCount;
                  return (
                    <button disabled={!canHire} title={!canHire ? `Need: ` + Object.entries(cost).map(([k,v])=>`${k} ${v}`).join(' · ') : 'Hire worker'} onClick={tryHireWorker} className={`px-3 py-1.5 rounded-lg text-sm ${canHire ? 'bg-amber-600 hover:bg-amber-500' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}>
                      Hire
                    </button>
                  );
                })()}
              </div>
              <div className="text-xs text-white/70 mt-1">
                Next cost: {Object.entries(hireCostMemo()).map(([k,v])=>`${k} ${fmtAbbrev(v)}`).join(" · ")}
              </div>
            </div>

            <div className="space-y-2">
              {gc.tools.map(t => {
                const owned = !!s.tools[t.key];
                const can = !owned && canAfford(s.res, t.cost);
                return (
                  <div key={t.key} className="rounded-xl bg-white/5 px-3 py-2 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{t.name} {owned ? <span className="text-emerald-400">(owned)</span> : null}</div>
                      <div className="text-xs text-white/70">Cost: {Object.entries(t.cost).map(([k,v])=>`${k} ${fmtAbbrev(v)}`).join(" · ")}</div>
                    </div>
                    <button disabled={!can} onClick={() => tryBuyTool(t.key)} className={`px-3 py-1.5 rounded-lg text-sm ${can ? "bg-fuchsia-600 hover:bg-fuchsia-500" : "bg-white/10 text-white/40 cursor-not-allowed"}`}>{owned ? "Owned" : "Buy"}</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Research */}
          <div className="rounded-2xl bg-white/5 p-3">
            <h3 className="font-semibold mb-1">Research</h3>
            <div className="space-y-2">
              {gc.research.map(r => {
                const owned = !!s.research[r.key];
                const depsOk = !(r.requires?.some(dep => !s.research[dep]));
                const can = !owned && depsOk && canAfford(s.res, r.cost);
                return (
                  <div key={r.key} className="rounded-xl bg-white/5 px-3 py-2 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{r.name} {owned ? <span className="text-emerald-400">(researched)</span> : null}</div>
                      <div className="text-xs text-white/70">Cost: {Object.entries(r.cost).map(([k,v])=>`${k} ${fmtAbbrev(v)}`).join(" · ")}</div>
                    </div>
                    <button disabled={!can} onClick={() => tryResearch(r.key)} className={`px-3 py-1.5 rounded-lg text-sm ${can ? "bg-indigo-600 hover:bg-indigo-500" : "bg-white/10 text-white/40 cursor-not-allowed"}`}>{owned ? "Done" : "Research"}</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

//END PART 14


//START PART 15

        {/* Banking & Claim + Energy Generators */}
        <div className="mt-4 grid sm:grid-cols-3 gap-3">
          {/* 🔄 Banking (עודכן: Today/Used/Left + Auto-Bank + הסבר קצר) */}
          <div className="rounded-2xl bg-white/5 p-3">
            <h3 className="font-semibold mb-1">Banking</h3>
            <p className="text-sm text-white/70">
              Today budget: {fmt(dailyBudget(gc),2)} · Used: {fmt(s.minedToday,2)} · Left: {fmt(Math.max(0, dailyBudget(gc) - s.minedToday),2)}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <button onClick={moveBalanceToVault} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm">
                Move Balance → Vault
              </button>
              <label className="text-xs flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!s.autoBank}
                  onChange={() => setS(p => ({ ...p, autoBank: !p.autoBank }))}
                />
                Auto-Bank every 5s
              </label>
            </div>
            <div className="text-xs text-white/60 mt-2">
              הערה: <b>Deposit</b> במצב “resources” ממיר ל-GOLD/ORE כדי לבנות מהר יותר — הוא לא נכנס ישירות ל-Vault.
              את ה-<b>Vault</b> ממלאים רק דרך בנקינג, ובמסגרת התקציב היומי.
            </div>
          </div>

          {/* Claim */}
          <div className="rounded-2xl bg-white/5 p-3">
            <h3 className="font-semibold mb-1">Claim (after TGE)</h3>
            <div className="text-sm text-white/70">Unlocked: {(claimPct*100).toFixed(0)}%</div>
            <div className="text-xs text-white/50">Room now: {fmtAbbrev(claimRoom)}</div>
            <button onClick={onClaimToWallet} className="mt-2 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-sm">Claim Vault → Wallet</button>
          </div>

          {/* Energy Generators */}
          <div className="rounded-2xl bg-white/5 p-3">
            <h3 className="font-semibold mb-1">Energy Generators</h3>
            <div className="text-sm" suppressHydrationWarning>
              {fmtAbbrev(s.res.ENERGY)}/{fmtAbbrev(s.cap.ENERGY)} <span className="text-white/60">(+{(GAME_CONFIG.energy.baseRegenPerSec + Object.values(s.gens).reduce((a,g)=>a+(g.regenPlus||0),0)).toFixed(1)}/s)</span>
            </div>
            <div className="mt-2 space-y-2">
              {gc.energy.generators.map(g => {
                const owned = !!s.gens[g.key];
                const depsOk = !(g.requires?.some(dep => !s.gens[dep]));
                const can = !owned && depsOk && canAfford(s.res, g.cost);
                return (
                  <div key={g.key} className="rounded-xl bg-white/5 px-3 py-2 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{g.name} {owned ? <span className="text-emerald-400">(owned)</span> : null}</div>
                      <div className="text-xs text-white/70">+{g.capacityPlus} cap · +{g.regenPlus}/s · Cost: {Object.entries(g.cost).map(([k,v])=>`${k} ${fmtAbbrev(v)}`).join(" · ")}</div>
                    </div>
                    <button disabled={!can} onClick={() => tryBuyGenerator(g.key)} className={`px-3 py-1.5 rounded-lg text-sm ${can ? "bg-teal-600 hover:bg-teal-500" : "bg-white/10 text-white/40 cursor-not-allowed"}`}>{owned ? "Owned" : "Buy"}</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Activity */}
        <details className="mt-4 rounded-2xl bg-white/5 p-3">
          <summary className="cursor-pointer select-none">Activity</summary>
          <div className="mt-2 space-y-1 text-xs text-white/80">
            {(s.activity || []).map((a, i) => (<div key={i}>• {new Date(a.t).toLocaleTimeString()} — {a.msg}</div>))}
          </div>
        </details>

        <p className="mt-6 text-center text-xs text-white/50">Config-driven • Local-only simulation • Tweak GAME_CONFIG to rebalance instantly</p>
      </div>

      {/* Help / Guide Modal (English only, per בקשה) */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setHelpOpen(false)} />
          <div className="relative max-w-2xl w-[92%] rounded-2xl bg-zinc-900 text-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">How to Play</h3>
            <ol className="list-decimal ml-5 space-y-2 text-sm text-white/90">
              <li><b>Goal:</b> Bank MLEO in your <b>Vault</b>, then claim to wallet after TGE.</li>
              <li><b>Deposit</b> MLEO. In “resources” mode it converts to GOLD & ORE (see rates). In “vault” mode it's 1:1 to Vault.</li>
              <li><b>Build & Upgrade</b> to increase Ore/Gold/MLEO production (uses Energy per second).</li>
              <li><b>Energy</b>: buy <b>Generators</b> to raise capacity and regen. Use <b>Pause Production</b> if Energy runs out.</li>
              <li><b>Unbanked → Vault</b>: click “Move Balance → Vault” or enable Auto-Bank (daily budget use-it-or-lose-it).</li>
            </ol>
            <div className="mt-4 text-right">
              <button onClick={() => setHelpOpen(false)} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
// ===============================================
// 🔚 END OF FILE
// ===============================================

//END PART 15
