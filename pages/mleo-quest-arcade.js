//START PART 1

"use client";
// ===============================================
// 📄 FILE: mleo-quest-arcade (works in pages/ or app/)
// Minimal, self-contained page (no external Layout) to avoid 404
// ===============================================

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { useConnectModal, useAccountModal } from "@rainbow-me/rainbowkit";
import { parseUnits } from "viem";

// ---------- Helpers / constants ----------
const isServer = typeof window === "undefined";
const CONFIG_VER = "arcade_min_v1.0.2";
const LS_KEY = `mleoArcade_${CONFIG_VER}`;

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const nowMs = () => Date.now();
const todayKey = () => new Date().toISOString().slice(0, 10);
const fmtAbbrev = (n) => {
  n = Number(n || 0);
  const abs = Math.abs(n);
  if (abs < 1e3) return n.toFixed(0);
  if (abs < 1e6) return (n / 1e3).toFixed(1) + "K";
  if (abs < 1e9) return (n / 1e6).toFixed(1) + "M";
  if (abs < 1e12) return (n / 1e9).toFixed(1) + "B";
  return (n / 1e12).toFixed(1) + "T";
};

const loadState = () => { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } };
const saveState = (s) => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {} };

// ---------- Config ----------
export const GAME_CONFIG = {
  title: "MLEO Quest Arcade",
  subtitle: "Earn • Upgrade • Bank",
  resources: {
    MLEO: { label: "MLEO" }, ORE: { label: "Ore" }, GOLD: { label: "Gold" }, ENERGY: { label: "Energy" },
  },
  productionBase: { ORE: 0, GOLD: 0, MLEO: 0 },
  buildings: [
    { key: "pit", name: "Mining Pit", desc: "Basic pit.", maxLevel: 50, cost: { GOLD: 50 }, costGrowth: 1.18, energyPerSec: 1, outputPerSec: { ORE: 2 } },
    { key: "drill", name: "Power Drill", desc: "More ore.", maxLevel: 40, cost: { GOLD: 250, ORE: 100 }, costGrowth: 1.22, energyPerSec: 3, outputPerSec: { ORE: 6 }, requires: [{ key: "pit", lvl: 3 }] },
    { key: "refinery", name: "Refinery", desc: "Refine Ore → MLEO.", maxLevel: 30, cost: { GOLD: 1200, ORE: 800 }, costGrowth: 1.25, energyPerSec: 4, outputPerSec: { MLEO: 0.04 }, ratios: { OREtoMLEO: 0.2 }, requires: [{ key: "drill", lvl: 5 }] },
  ],
  workers: { maxCount: 100, baseHireCost: { GOLD: 100, ORE: 50 }, hireGrowth: 1.15, outputBonusPerWorker: 0.02, energyPerWorker: 0.1 },
  energy: { baseCapacity: 100, baseRegenPerSec: 2 },
  tools: [
    { key: "hammer", name: "Reinforced Hammer", cost: { GOLD: 250 }, mult: { ORE: 1.10 } },
    { key: "drillbit", name: "Diamond Drill Bit", cost: { GOLD: 1200 }, mult: { ORE: 1.20 } },
    { key: "ai-core", name: "AI Optimizer", cost: { GOLD: 5000 }, mult: { MLEO: 1.25 } },
  ],
  research: [
    { key: "r_eff1", name: "Logistics I", cost: { ORE: 2000 }, mult: { ALL: 1.05 } },
    { key: "r_eff2", name: "Logistics II", cost: { ORE: 8000 }, mult: { ALL: 1.10 }, requires: ["r_eff1"] },
  ],
  emission: {
    dailyCap: 100_000,
    softcut: [
      { upto: 0.80, factor: 1.00 },
      { upto: 1.00, factor: 0.50 },
      { upto: 1.20, factor: 0.25 },
      { upto: 9.99, factor: 0.10 },
    ],
  },
  offline: {
    sessionMaxHours: 12,
    tiers: [{ upToHours: 2, eff: 0.5 }, { upToHours: 6, eff: 0.3 }, { upToHours: 12, eff: 0.1 }],
    idleKickInMs: 5 * 60 * 1000,
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
    enabled: true, mode: "resources",
    min: 10, max: 1_000_000,
    tokenAddress: process.env.NEXT_PUBLIC_MLEO_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000",
    treasury: process.env.NEXT_PUBLIC_MLEO_TREASURY || "0x0000000000000000000000000000000000000000",
    rates: { GOLD: 10, ORE: 25 },
  },
};

const ERC20_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
];

//END PART 1


//START PART 2

// ---------- Engine & math ----------
function buildingCost(b, lvl) {
  const pow = Math.pow(b.costGrowth || 1, lvl);
  const out = {};
  for (const [k, v] of Object.entries(b.cost || {})) out[k] = Math.ceil(v * pow);
  return out;
}
function canAfford(res, cost) {
  for (const [k, v] of Object.entries(cost || {})) if ((res[k] || 0) < v) return false;
  return true;
}
function pay(res, cost) {
  const r = { ...res };
  for (const [k, v] of Object.entries(cost || {})) r[k] = (r[k] || 0) - v;
  return r;
}
function unlocked(b, s) {
  if (!b.requires?.length) return true;
  for (const req of b.requires) {
    const lvl = s.buildings[req.key]?.lvl || 0;
    if (lvl < (req.lvl || 1)) return false;
  }
  return true;
}
function totalsMult(s) {
  let mult = { ORE: 1, GOLD: 1, MLEO: 1 };
  for (const t of GAME_CONFIG.tools) if (s.tools[t.key]) for (const [k, m] of Object.entries(t.mult || {})) mult[k] = (mult[k] || 1) * m;
  for (const r of GAME_CONFIG.research)
    if (s.research[r.key])
      for (const [k, m] of Object.entries(r.mult || {})) {
        if (k === "ALL") for (const kk of Object.keys(mult)) mult[kk] *= m;
        else mult[k] = (mult[k] || 1) * m;
      }
  mult.ORE *= 1 + s.workers * (GAME_CONFIG.workers.outputBonusPerWorker || 0);
  mult.MLEO *= 1 + s.workers * (GAME_CONFIG.workers.outputBonusPerWorker || 0);
  return mult;
}
function softcutFactor(used, cap, sc) {
  if (cap <= 0) return 1;
  const r = used / cap;
  for (const s of sc) if (r <= s.upto) return s.factor;
  return 0.1;
}

function freshState() {
  const baseRes = Object.fromEntries(Object.keys(GAME_CONFIG.resources).map((k) => [k, 0]));
  return {
    ver: CONFIG_VER,
    res: { ...baseRes, ENERGY: GAME_CONFIG.energy.baseCapacity },
    cap: { ENERGY: GAME_CONFIG.energy.baseCapacity },
    regen: { ENERGY: GAME_CONFIG.energy.baseRegenPerSec },

    buildings: Object.fromEntries(GAME_CONFIG.buildings.map((b) => [b.key, { lvl: 0 }])),
    workers: 0, tools: {}, research: {},

    minedToday: 0, lastDay: isServer ? "1970-01-01" : todayKey(),
    vault: 0, balance: 0,

    depositsTotal: 0, lastDeposit: 0,

    lastTickAt: isServer ? 0 : nowMs(),
    idleSince: isServer ? 0 : nowMs(),
    offlineConsumedMsInSession: 0,
    offlineSessionStartAt: null,
  };
}

function tickEngine(s, dt) {
  const today = todayKey();
  if (s.lastDay !== today) { s.lastDay = today; s.minedToday = 0; }

  s.res.ENERGY = clamp(s.res.ENERGY + GAME_CONFIG.energy.baseRegenPerSec * dt, 0, s.cap.ENERGY);

  let prod = { ...GAME_CONFIG.productionBase };
  for (const b of GAME_CONFIG.buildings) {
    const lvl = s.buildings[b.key]?.lvl || 0;
    if (!lvl || !unlocked(b, s)) continue;
    const eUse = (b.energyPerSec || 0) * lvl;
    if (s.res.ENERGY >= eUse * dt) {
      s.res.ENERGY -= eUse * dt;
      for (const [k, v] of Object.entries(b.outputPerSec || {})) prod[k] = (prod[k] || 0) + v * lvl;
      if (b.ratios?.OREtoMLEO) {
        const burn = b.ratios.OREtoMLEO * lvl * dt;
        if (s.res.ORE >= burn) { s.res.ORE -= burn; prod.MLEO = (prod.MLEO || 0) + burn * 0.05; }
      }
    }
  }
  const wUse = (GAME_CONFIG.workers.energyPerWorker || 0) * s.workers * dt;
  if (s.res.ENERGY >= wUse) s.res.ENERGY -= wUse;

  const mult = totalsMult(s);
  for (const k of Object.keys(prod)) prod[k] *= mult[k] || 1;

  for (const [k, v] of Object.entries(prod)) s.res[k] = (s.res[k] || 0) + v * dt;
  s.balance += (prod.MLEO || 0) * dt;
}

function offlineEffAt(consumedMs) {
  const tiers = GAME_CONFIG.offline.tiers;
  const h = consumedMs / 3600000;
  for (const t of tiers) if (h < t.upToHours) return t.eff;
  return 0;
}
function ensureOfflineSessionStart(s) { if (!s.offlineSessionStartAt) s.offlineSessionStartAt = nowMs(); }
function getOfflineSessionLeftMs(s) {
  const used = Math.max(0, s.offlineConsumedMsInSession || 0);
  return Math.max(0, GAME_CONFIG.offline.sessionMaxHours * 3600000 - used);
}
function takeFromOfflineSession(s, elapsedMs) {
  let toConsume = Math.min(elapsedMs, getOfflineSessionLeftMs(s));
  if (toConsume <= 0) return { consumedMs: 0, effectiveMs: 0 };
  let used = s.offlineConsumedMsInSession || 0;
  let consumed = 0, effective = 0;
  while (toConsume > 0) {
    const eff = offlineEffAt(used); if (eff <= 0) break;
    const tiers = GAME_CONFIG.offline.tiers;
    let tierEndMs = tiers[tiers.length - 1].upToHours * 3600000;
    for (const t of tiers) { if ((used / 3600000) < t.upToHours) { tierEndMs = t.upToHours * 3600000; break; } }
    const room = Math.max(0, tierEndMs - used);
    const chunk = Math.min(toConsume, room);
    effective += chunk * eff;
    consumed += chunk;
    used += chunk;
    toConsume -= chunk;
  }
  s.offlineConsumedMsInSession = used;
  return { consumedMs: consumed, effectiveMs: effective };
}


//END PART 2

//START PART 3

// ---------- Component ----------
export default function MleoQuestArcade() {
  const gc = GAME_CONFIG;
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [s, setS] = useState(() => freshState());
  const [mounted, setMounted] = useState(false);
  const [depAmount, setDepAmount] = useState("");
  const rafRef = useRef(0);

  // Mount + load
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!mounted) return;
    const saved = loadState(); if (saved) { saved.lastTickAt = nowMs(); saved.idleSince = nowMs(); setS(saved); }
  }, [mounted]);

  // Game loop
  useEffect(() => {
    if (!mounted) return;
    let last = nowMs();
    const loop = () => {
      const t = nowMs(); const dt = clamp((t - last) / 1000, 0, 0.1); last = t;
      setS(prev => { const n = { ...prev }; if (t - n.idleSince > gc.offline.idleKickInMs) ensureOfflineSessionStart(n); tickEngine(n, dt); n.lastTickAt = t; return n; });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mounted]);

  // Persist
  useEffect(() => { if (mounted) saveState(s); }, [s, mounted]);

  // Visibility (offline accrual)
  useEffect(() => {
    if (!mounted) return;
    const onVis = () => setS(prev => {
      const n = { ...prev }; const t = nowMs();
      if (document.visibilityState === "hidden") { n.lastTickAt = t; n.idleSince = t; ensureOfflineSessionStart(n); saveState(n); return n; }
      const elapsed = Math.max(0, t - (n.lastTickAt || t));
      if (elapsed > 1000) { const gate = takeFromOfflineSession(n, elapsed); if (gate.effectiveMs > 0) tickEngine(n, gate.effectiveMs / 1000);
        n.offlineSessionStartAt = null; n.offlineConsumedMsInSession = 0; n.lastTickAt = t; n.idleSince = t; }
      return n;
    });
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [mounted]);

  // Derived — live energy stats
  const live = useMemo(() => {
    let energyUse = 0; let prod = { ...gc.productionBase };
    for (const b of gc.buildings) {
      const lvl = s.buildings[b.key]?.lvl || 0; if (!lvl || !unlocked(b, s)) continue;
      energyUse += (b.energyPerSec || 0) * lvl;
      for (const [k, v] of Object.entries(b.outputPerSec || {})) prod[k] = (prod[k] || 0) + v * lvl;
    }
    energyUse += (gc.workers.energyPerWorker || 0) * s.workers;
    const mult = totalsMult(s); for (const k of Object.keys(prod)) prod[k] *= mult[k] || 1;
    const regen = gc.energy.baseRegenPerSec; const net = regen - energyUse;
    let eta = null, label = "";
    if (net < 0 && s.res.ENERGY > 0) { eta = s.res.ENERGY / (-net); label = "to empty"; }
    if (net > 0 && s.res.ENERGY < s.cap.ENERGY) { eta = (s.cap.ENERGY - s.res.ENERGY) / net; label = "to full"; }
    return { energyUse, regen, net, eta, label };
  }, [s]);

  // Actions
  const tryBuyBuilding = (key) => setS(prev => {
    const n = { ...prev }; const b = gc.buildings.find(x => x.key === key); if (!b) return n;
    if (!unlocked(b, n)) return n;
    const lvl = n.buildings[key]?.lvl || 0; if (lvl >= (b.maxLevel || 999)) return n;
    const cost = buildingCost(b, lvl); if (!canAfford(n.res, cost)) return n;
    n.res = pay(n.res, cost); n.buildings[key] = { lvl: lvl + 1 }; return n;
  });

  const tryHireWorker = () => setS(prev => {
    const n = { ...prev }; if (n.workers >= gc.workers.maxCount) return n;
    const base = gc.workers.baseHireCost; const growth = Math.pow(gc.workers.hireGrowth, n.workers);
    const cost = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.ceil(v * growth)]));
    if (!canAfford(n.res, cost)) return n; n.res = pay(n.res, cost); n.workers += 1; return n;
  });

  const tryBuyTool = (key) => setS(prev => {
    const n = { ...prev }; if (n.tools[key]) return n;
    const tool = gc.tools.find(t => t.key === key); if (!tool) return n;
    if (!canAfford(n.res, tool.cost)) return n;
    n.res = pay(n.res, tool.cost); n.tools[key] = true; return n;
  });

  const tryResearch = (key) => setS(prev => {
    const n = { ...prev }; if (n.research[key]) return n;
    const r = gc.research.find(x => x.key === key); if (!r) return n;
    if (r.requires?.some(dep => !n.research[dep])) return n;
    if (!canAfford(n.res, r.cost)) return n;
    n.res = pay(n.res, r.cost); n.research[key] = true; return n;
  });

  const moveBalanceToVault = () => setS(prev => {
    const n = { ...prev }; const em = gc.emission;
    const amt = Math.max(0, Math.floor(n.balance)); if (!amt) return n;
    const room = Math.max(0, em.dailyCap - n.minedToday);
    if (room <= 0) { n.balance -= amt; return n; }
    const factor = softcutFactor(n.minedToday, em.dailyCap, em.softcut);
    const allowed = Math.min(amt * factor, room);
    n.vault += allowed; n.minedToday += allowed; n.balance -= amt; return n;
  });

  const [depBusy, setDepBusy] = useState(false);
  const onDepositMleo = async () => {
    if (depBusy) return;
    const dep = gc.deposit; if (!dep.enabled) { alert("Deposit disabled"); return; }
    if (!isConnected) { openConnectModal?.(); return; }
    if (chainId !== gc.chain.CHAIN_ID) {
      try { await switchChain?.({ chainId: gc.chain.CHAIN_ID }); } catch { alert("Switch network required"); return; }
    }
    const amtFloat = Number(depAmount || 0);
    if (!amtFloat || amtFloat <= 0) { alert("Enter amount"); return; }
    if (amtFloat < dep.min || amtFloat > dep.max) { alert(`Allowed range: ${dep.min}-${dep.max} MLEO`); return; }
    if (!dep.tokenAddress || !dep.treasury) { alert("Token or treasury address not set"); return; }

    try {
      setDepBusy(true);
      const wei = parseUnits(String(amtFloat), gc.chain.DECIMALS);
      const hash = await writeContractAsync({ address: dep.tokenAddress, abi: ERC20_ABI, functionName: "transfer", args: [dep.treasury, wei], chainId: gc.chain.CHAIN_ID });
      await publicClient.waitForTransactionReceipt({ hash });
      setS(prev => {
        const n = { ...prev };
        n.depositsTotal = (n.depositsTotal || 0) + amtFloat;
        n.lastDeposit = amtFloat;
        if (dep.mode === "vault") n.vault += amtFloat;
        else { n.res.GOLD = (n.res.GOLD || 0) + (dep.rates.GOLD || 0) * amtFloat; n.res.ORE = (n.res.ORE || 0) + (dep.rates.ORE || 0) * amtFloat; }
        return n;
      });
      setDepAmount(""); alert("Deposit successful ✅");
    } catch (e) { console.error(e); alert("Deposit failed or rejected"); }
    finally { setDepBusy(false); }
  };

  // Gate for SSR mismatch
  if (!mounted) {
    return (
      <div className="mx-auto max-w-5xl px-3 py-4 text-white">
        <h1 className="text-2xl font-bold">MLEO Quest Arcade</h1>
        <p className="text-white/60 text-sm">Loading…</p>
      </div>
    );
  }

//END PART 3


//START PART 4

  // ---------- Render ----------
  return (
    <div className="mx-auto max-w-5xl px-3 py-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{gc.title}</h1>
          <p className="text-white/70 text-sm">{gc.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <button onClick={() => openAccountModal?.()} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm">
              {address?.slice(0, 6)}…{address?.slice(-4)}
            </button>
          ) : (
            <button onClick={() => openConnectModal?.()} className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm">Connect</button>
          )}
          <button onClick={() => { const f = freshState(); setS(f); saveState(f); }} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm">Reset</button>
        </div>
      </div>

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

      {/* Deposit */}
      <div className="mt-4 rounded-2xl bg-white/5 p-3">
        <h3 className="font-semibold mb-1">Deposit MLEO</h3>
        <p className="text-sm text-white/70">
          {gc.deposit.mode === "vault"
            ? "Deposit credits 1:1 to your Vault."
            : `Convert to resources: 1 MLEO → ${gc.deposit.rates.GOLD} GOLD + ${gc.deposit.rates.ORE} ORE`}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <input inputMode="decimal" value={depAmount} onChange={(e) => setDepAmount(e.target.value)}
                 placeholder={`Amount (${gc.deposit.min} - ${gc.deposit.max})`}
                 className="w-44 px-3 py-2 rounded-xl bg-white/10 outline-none" />
          <button onClick={onDepositMleo} disabled={depBusy}
                  className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-sm">
            {depBusy ? "Waiting…" : "Deposit"}
          </button>
        </div>
        <div className="text-xs text-white/50 mt-2">
          Token: {gc.deposit.tokenAddress.slice(0,6)}…{gc.deposit.tokenAddress.slice(-4)} · Treasury: {gc.deposit.treasury.slice(0,6)}…{gc.deposit.treasury.slice(-4)}
          {" · "}Total deposited: {fmtAbbrev(s.depositsTotal)} MLEO{" · "}Last: {fmtAbbrev(s.lastDeposit)} MLEO
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 grid sm:grid-cols-3 gap-3">
        {/* Buildings */}
        <div className="rounded-2xl bg-white/5 p-3">
          <h3 className="font-semibold mb-1">Buildings</h3>
          <div className="space-y-2">
            {gc.buildings.map(b => {
              const lvl = s.buildings[b.key]?.lvl || 0;
              const cost = buildingCost(b, lvl);
              const can = canAfford(s.res, cost) && lvl < (b.maxLevel || 999) && unlocked(b, s);
              return (
                <div key={b.key} className="rounded-xl bg-white/5 px-3 py-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{b.name} <span className="text-white/60">Lv {lvl}</span></div>
                    <div className="text-xs text-white/60">Energy: {b.energyPerSec * (lvl || 1)} /s · {b.desc}</div>
                    <div className="text-xs text-white/70 mt-0.5">Cost: {Object.entries(cost).map(([k, v]) => `${k} ${fmtAbbrev(v)}`).join(" · ")}</div>
                  </div>
                  <button disabled={!can} onClick={() => tryBuyBuilding(b.key)}
                          className={`px-3 py-1.5 rounded-lg text-sm ${can ? "bg-cyan-600 hover:bg-cyan-500" : "bg-white/10 text-white/40 cursor-not-allowed"}`}>Upgrade</button>
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
                const growth = Math.pow(gc.workers.hireGrowth, s.workers);
                const base = gc.workers.baseHireCost;
                const cost = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.ceil(v * growth)]));
                const canHire = canAfford(s.res, cost) && s.workers < gc.workers.maxCount;
                return (
                  <button disabled={!canHire} onClick={tryHireWorker}
                          title={!canHire ? `Need: ` + Object.entries(cost).map(([k, v]) => `${k} ${v}`).join(' · ') : 'Hire worker'}
                          className={`px-3 py-1.5 rounded-lg text-sm ${canHire ? 'bg-amber-600 hover:bg-amber-500' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}>Hire</button>
                );
              })()}
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
                    <div className="text-xs text-white/70">Cost: {Object.entries(t.cost).map(([k, v]) => `${k} ${fmtAbbrev(v)}`).join(" · ")}</div>
                  </div>
                  <button disabled={!can} onClick={() => tryBuyTool(t.key)}
                          className={`px-3 py-1.5 rounded-lg text-sm ${can ? "bg-fuchsia-600 hover:bg-fuchsia-500" : "bg-white/10 text-white/40 cursor-not-allowed"}`}>{owned ? "Owned" : "Buy"}</button>
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
                    <div className="text-xs text-white/70">Cost: {Object.entries(r.cost).map(([k, v]) => `${k} ${fmtAbbrev(v)}`).join(" · ")}</div>
                  </div>
                  <button disabled={!can} onClick={() => tryResearch(r.key)}
                          className={`px-3 py-1.5 rounded-lg text-sm ${can ? "bg-indigo-600 hover:bg-indigo-500" : "bg-white/10 text-white/40 cursor-not-allowed"}`}>{owned ? "Done" : "Research"}</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Banking & Energy */}
      <div className="mt-4 grid sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white/5 p-3">
          <h3 className="font-semibold mb-1">Banking</h3>
          <p className="text-sm text-white/70">Daily cap: {fmtAbbrev(gc.emission.dailyCap)} · Used today: {fmtAbbrev(s.minedToday)}</p>
          <button onClick={moveBalanceToVault} className="mt-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm">Move Balance → Vault</button>
        </div>
        <div className="rounded-2xl bg-white/5 p-3 sm:col-span-2">
          <h3 className="font-semibold mb-1">Energy</h3>
          <div className="text-sm" suppressHydrationWarning>
            {fmtAbbrev(s.res.ENERGY)}/{fmtAbbrev(s.cap.ENERGY)} · Regen {gc.energy.baseRegenPerSec.toFixed(1)}/s · Use {live.energyUse.toFixed(1)}/s · Net {live.net.toFixed(1)}/s
            {live.eta ? <span className="text-white/60"> · ~{Math.max(1, Math.floor(live.eta)).toFixed(0)}s {live.label}</span> : null}
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-white/50">Arcade • Minimal self-contained page. If you use the <strong>app/</strong> router put this file at <code>app/mleo-quest-arcade/page.jsx</code>. Otherwise at <code>pages/mleo-quest-arcade.js</code>.</p>
    </div>
  );
}


//END PART 4
