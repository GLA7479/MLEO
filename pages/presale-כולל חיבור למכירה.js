// pages/presale.js
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { motion } from "framer-motion";
import Layout from "../components/Layout";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { parseEther } from "viem";
import { useConnectModal } from "@rainbow-me/rainbowkit";

/* ================= ENV ================= */
const PRESALE_ADDRESS = process.env.NEXT_PUBLIC_PRESALE_ADDRESS;
const PRESALE_CHAIN_ID = Number(process.env.NEXT_PUBLIC_PRESALE_CHAIN_ID || 97);
const BNB_USD = Number(process.env.NEXT_PUBLIC_BNB_USD || 0);

// Stages by funding goal (sold tokens thresholds)
const STAGE_MODE = (process.env.NEXT_PUBLIC_STAGE_MODE || "sold").toLowerCase();
const RAW_STAGE_PRICES =
  (process.env.NEXT_PUBLIC_STAGE_PRICES_WEI || "")
    .split(",").map(s => s.trim()).filter(Boolean);
const RAW_SOLD_THRESHOLDS =
  (process.env.NEXT_PUBLIC_STAGE_SOLD_THRESHOLDS || "")
    .split(",").map(s => s.trim()).filter(Boolean);

// Rolling round (visual only)
const ROUND_SECONDS = Number(process.env.NEXT_PUBLIC_ROUND_SECONDS || 3 * 24 * 60 * 60);
const ROUND_ANCHOR_TS = Number(process.env.NEXT_PUBLIC_ROUND_ANCHOR_TS || 0);

/* =============== ABI (reads + writes) =============== */
const PRESALE_ABI = [
  { type: "function", name: "buy", stateMutability: "payable", inputs: [], outputs: [] },
  { type: "function", name: "priceWeiPerToken", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "minWei", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "PRESALE_CAP", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "presaleSold", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalRaised", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "setPrice", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
  { type: "function", name: "setPaused", stateMutability: "nonpayable", inputs: [{ type: "bool" }], outputs: [] },
];

const E18 = 1_000_000_000_000_000_000n;
const toBNB = (wei) => (wei ? Number(wei) / 1e18 : 0);

/* ======= Small UI helpers (compact) ======= */
const Chip = ({ children, className = "" }) => (
  <span className={`px-2.5 py-1 rounded-full border text-[11px] leading-none ${className}`}>
    {children}
  </span>
);

const Card = ({ children, className = "" }) => (
  <div className={`bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl ${className}`}>
    {children}
  </div>
);

const SectionTitle = ({ children }) => (
  <h2 className="text-[11px] uppercase tracking-[0.18em] text-white/70">{children}</h2>
);

function StageStepper({ count, active }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === active;
        return (
          <div
            key={i}
            className={`h-1.5 w-1.5 rounded-full transition-all
            ${i < active ? "bg-cyan-300/90 shadow-[0_0_8px_rgba(34,211,238,0.7)]" : "bg-white/30"}
            ${isActive ? "scale-125 ring-1 ring-cyan-300/70" : ""}`}
            title={`Stage ${i + 1}`}
          />
        );
      })}
    </div>
  );
}

export default function Presale() {
  const [amount, setAmount] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Wallet / chain
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  // Reads
  const common = { address: PRESALE_ADDRESS, abi: PRESALE_ABI, chainId: PRESALE_CHAIN_ID, query: { enabled: !!PRESALE_ADDRESS } };
  const { data: priceWei }   = useReadContract({ ...common, functionName: "priceWeiPerToken" });
  const { data: minWei }     = useReadContract({ ...common, functionName: "minWei" });
  const { data: cap }        = useReadContract({ ...common, functionName: "PRESALE_CAP" });
  const { data: sold }       = useReadContract({ ...common, functionName: "presaleSold" });
  const { data: raisedWei }  = useReadContract({ ...common, functionName: "totalRaised" });
  const { data: isPaused }   = useReadContract({ ...common, functionName: "paused" });
  const { data: owner }      = useReadContract({ ...common, functionName: "owner" });

  // Writes
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess, isError } = useWaitForTransactionReceipt({ hash: txHash });

  // Stages / thresholds
  const STAGE_PRICES_WEI = useMemo(() => {
    if (RAW_STAGE_PRICES.length) return RAW_STAGE_PRICES.map(v => BigInt(v));
    return [3750000000n,4200000000n,4704000000n,5268480000n,5900697600n,6608781312n,7401835069n,8290055278n,9284861911n,10399045340n];
  }, []);
  const STAGE_COUNT = STAGE_PRICES_WEI.length;

  const SOLD_THRESHOLDS_E18 = useMemo(() => {
    if (RAW_SOLD_THRESHOLDS.length) {
      return RAW_SOLD_THRESHOLDS.map(x => BigInt(x.replace(/_/g, "")) * E18);
    }
    if (!cap || STAGE_COUNT < 2) return [];
    const step = cap / BigInt(STAGE_COUNT);
    const arr = [];
    for (let i = 1; i < STAGE_COUNT; i++) arr.push(step * BigInt(i));
    return arr;
  }, [cap, STAGE_COUNT]);

  const stageBySold = useMemo(() => {
    if (STAGE_MODE !== "sold") return 0;
    if (!sold || SOLD_THRESHOLDS_E18.length === 0) return 0;
    let idx = 0;
    for (let i = 0; i < SOLD_THRESHOLDS_E18.length; i++) {
      if (sold >= SOLD_THRESHOLDS_E18[i]) idx = i + 1;
    }
    if (idx > STAGE_COUNT - 1) idx = STAGE_COUNT - 1;
    return idx;
  }, [sold, SOLD_THRESHOLDS_E18, STAGE_COUNT]);

  const activeStage = stageBySold;
  const targetPriceWei = STAGE_PRICES_WEI[activeStage] || 0n;
  const priceSynced = priceWei ? (targetPriceWei === priceWei) : true;

  const nextStage = Math.min(STAGE_COUNT - 1, activeStage + 1);
  const nextStagePriceWei = STAGE_PRICES_WEI[nextStage] || targetPriceWei;

  // Rolling round (visual only)
  const nowSec = Math.floor(Date.now() / 1000) + tick * 0;
  const base = isFinite(ROUND_ANCHOR_TS) ? ROUND_ANCHOR_TS : 0;
  const roundsSinceBase = Math.floor((nowSec - base) / ROUND_SECONDS);
  const roundStart = base + roundsSinceBase * ROUND_SECONDS;
  const roundEnd = roundStart + ROUND_SECONDS;
  const roundLeftSec = Math.max(0, roundEnd - nowSec);
  const roundLeft = {
    days: Math.floor(roundLeftSec / 86400),
    hours: Math.floor((roundLeftSec % 86400) / 3600),
    minutes: Math.floor((roundLeftSec % 3600) / 60),
    seconds: roundLeftSec % 60,
  };
  const roundPct = Math.max(
    0,
    Math.min(100, Math.round(((ROUND_SECONDS - roundLeftSec) / ROUND_SECONDS) * 100))
  );
  const isLastStage = activeStage >= STAGE_COUNT - 1;
  const saleShouldBeClosed = isLastStage && roundLeftSec === 0;

  // Derived numbers
  const minBNB = toBNB(minWei);
  const capTokens  = cap  ? Number(cap)  / 1e18 : 0;
  const soldTokens = sold ? Number(sold) / 1e18 : 0;
  const progressPct = capTokens > 0 ? Math.min(100, (soldTokens / capTokens) * 100) : 0;

  const priceBNBPerToken = toBNB(priceWei);
  const tokensPer1BNB = priceWei ? (1e18 / Number(priceWei)) : 0;
  const tokensPer1BNBStr = tokensPer1BNB ? Math.floor(tokensPer1BNB).toLocaleString() : "—";

  const fmtTiny = (n, d = 12) => (n ? n.toFixed(d).replace(/0+$/,"").replace(/\.$/,"") : "—");
  const priceBNBPerTokenStr = fmtTiny(priceBNBPerToken);
  const priceUsdPerTokenStr = BNB_USD && priceBNBPerToken ? fmtTiny(priceBNBPerToken * BNB_USD, 9) : "";

  const raisedBNB = toBNB(raisedWei);
  const tokensToReceive = useMemo(() => {
    const amt = Number(amount || 0);
    if (!amt || !priceWei) return 0;
    return ((amt * 1e18) / Number(priceWei)).toFixed(2);
  }, [amount, priceWei]);

  /* =============== Actions =============== */
  async function ensureRightChain() {
    if (chainId !== PRESALE_CHAIN_ID) await switchChainAsync({ chainId: PRESALE_CHAIN_ID });
  }
  async function onBuy() {
    if (!PRESALE_ADDRESS) return alert("Missing PRESALE address (env).");
    if (isPaused) return alert("Presale is paused.");
    if (saleShouldBeClosed) return alert("Sale window ended.");
    try { await ensureRightChain(); } catch { return alert("Switch to BSC Testnet (97)."); }

    const value = parseEther(String(amount || "0"));
    if (value <= 0n) return alert("Enter amount in BNB (e.g., 0.05).");
    if (minWei && value < minWei) return alert(`Minimum is ${minBNB} BNB`);

    try {
      writeContract({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "buy", chainId: PRESALE_CHAIN_ID, value });
    } catch (e) { console.error(e); alert("Buy failed"); }
  }
  const { writeContract: writeAdmin } = useWriteContract();
  const isOwner = !!(owner && address && owner.toLowerCase() === address.toLowerCase());

  async function onAdminSyncPrice() {
    try {
      await ensureRightChain();
      writeAdmin({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "setPrice", args: [targetPriceWei], chainId: PRESALE_CHAIN_ID });
    } catch (e) { console.error(e); alert("setPrice failed"); }
  }
  async function onAdminPause(pause) {
    try {
      await ensureRightChain();
      writeAdmin({ address: PRESALE_ADDRESS, abi: PRESALE_ABI, functionName: "setPaused", args: [pause], chainId: PRESALE_CHAIN_ID });
    } catch (e) { console.error(e); alert("setPaused failed"); }
  }

  /* =================== UI =================== */
  return (
    <Layout page="presale">
      <Head><title>BUY MLEO — Presale</title></Head>

      {/* Background video */}
      <video autoPlay muted loop playsInline preload="auto" className="absolute inset-0 w-full h-full object-cover z-0">
        <source src="/videos/presale-bg.mp4" type="video/mp4" />
      </video>
      {/* Stronger dark overlay for readability */}
      <div className="absolute inset-0 z-0 bg-black/70 backdrop-blur-[1.5px]" />

      <motion.main
        className="relative min-h-screen px-3 pb-20 text-[15px] sm:text-[16px]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}
      >
        {/* Centered container with max width */}
        <div className="relative z-10 w-full max-w-[980px] mx-auto">

          {/* Header */}
          <div className="pt-8 sm:pt-10 flex flex-col items-center text-center text-white">
            <motion.h1
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight
                         bg-gradient-to-r from-sky-400 via-cyan-300 to-fuchsia-400 bg-clip-text text-transparent
                         drop-shadow-[0_4px_20px_rgba(59,130,246,0.28)]"
              initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }}
            >
              BUY MLEO
            </motion.h1>

            {/* Stage + Mode + Stepper */}
            <div className="mt-2 flex flex-col items-center gap-2">
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <Chip className="bg-white/10 border-white/25">Stage <b>{activeStage + 1}</b> / {STAGE_COUNT}</Chip>
                <Chip className="bg-white/10 border-white/25">Mode: <b>By Funding Goal (Sold)</b></Chip>
                {!priceSynced && (
                  <Chip className="bg-amber-500/15 border-amber-400/40 text-amber-100">Price unsynced</Chip>
                )}
              </div>
              <StageStepper count={STAGE_COUNT} active={activeStage} />
            </div>

            {/* Round bar */}
            <div className="mt-5 w-full">
              <div className="flex items-center justify-between text-xs text-white/80 mb-1">
                <span>Round resets every {Math.round(ROUND_SECONDS/86400)} days</span>
                <span>Ends: {new Date((roundEnd) * 1000).toLocaleString()}</span>
              </div>
              <div className="h-1.5 bg-white/15 rounded-full overflow-hidden ring-1 ring-white/20">
                <div className="h-full w-full origin-left"
                     style={{ width: `${roundPct}%`, boxShadow: "0 0 14px rgba(56,189,248,.35)" }}
                     className="bg-gradient-to-r from-fuchsia-400 via-sky-400 to-cyan-300 transition-all" />
              </div>
              <p className="mt-1.5 text-base font-semibold">
                Round ends in: {roundLeft.days}d {roundLeft.hours}h {roundLeft.minutes}m {roundLeft.seconds}s
              </p>
            </div>

            {/* KPI row (compact) */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
              <Card className="p-3">
                <SectionTitle>Raised</SectionTitle>
                <div className="mt-0.5 text-lg font-bold">{raisedBNB.toLocaleString()} tBNB</div>
                {BNB_USD ? <div className="text-white/70 text-xs">≈ ${Math.round(raisedBNB * BNB_USD).toLocaleString()}</div> : null}
              </Card>
              <Card className="p-3">
                <SectionTitle>Sold</SectionTitle>
                <div className="mt-0.5 text-lg font-bold">{soldTokens.toLocaleString()}</div>
                <div className="text-white/70 text-xs">{progressPct.toFixed(1)}%</div>
              </Card>
              <Card className="p-3">
                <SectionTitle>Price</SectionTitle>
                <div className="mt-0.5 text-lg font-bold">{priceBNBPerTokenStr} BNB</div>
                {!!priceUsdPerTokenStr && <div className="text-white/70 text-xs">≈ ${priceUsdPerTokenStr}</div>}
              </Card>
              <Card className="p-3">
                <SectionTitle>Next price</SectionTitle>
                <div className="mt-0.5 text-lg font-bold">
                  {nextStage > activeStage ? fmtTiny(toBNB(nextStagePriceWei)) : "—"} BNB
                </div>
                <div className="text-white/70 text-xs">1 BNB ≈ {tokensPer1BNBStr} MLEO</div>
              </Card>
            </div>

            {/* Global progress (thinner) */}
            <div className="mt-5 w-full">
              <div className="h-1.5 bg-white/15 rounded-full overflow-hidden ring-1 ring-white/20">
                <div className="h-full transition-all bg-gradient-to-r from-emerald-400 via-sky-400 to-cyan-300" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="mt-1.5 text-sm opacity-90">
                {soldTokens.toLocaleString()} / {capTokens.toLocaleString()} tokens sold
              </p>
            </div>

            {/* Price chips */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              <Chip className="bg-white/10 border-white/20">1 BNB ≈ <b>{tokensPer1BNBStr}</b> MLEO</Chip>
              <Chip className="bg-white/10 border-white/20">1 MLEO ≈ <b>{priceBNBPerTokenStr}</b> BNB</Chip>
              {!!priceUsdPerTokenStr && (
                <Chip className="bg-emerald-500/15 border-emerald-400/30">≈ ${priceUsdPerTokenStr} USD</Chip>
              )}
            </div>
          </div>

          {/* Buy Card (narrower + smaller controls) */}
          <div className="mt-6 w-full max-w-[720px] mx-auto">
            <Card className="p-4 ring-1 ring-cyan-300/20 shadow-[0_0_26px_rgba(56,189,248,0.22)]">
              <div className="flex items-center justify-between mb-1.5 text-base">
                <span>BUY (tBNB)</span><span>{amount || 0}</span>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="0.0001"
                className="w-full p-2.5 bg-black/40 rounded-lg text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 text-base"
              />

              {/* Quick amounts */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                {["0.01","0.05","0.1","0.25"].map(v => (
                  <button key={v}
                          onClick={() => setAmount(v)}
                          className="px-2.5 py-1 rounded-md border border-white/15 bg-white/10 hover:bg-white/15">
                    {v} BNB
                  </button>
                ))}
                <button
                  onClick={() => setAmount(minBNB ? String(minBNB) : "0.0001")}
                  className="ml-auto px-2.5 py-1 rounded-md border border-white/15 bg-black/40 hover:bg-black/50"
                  disabled={!minBNB}
                  title="Set minimum"
                >
                  Min {minBNB ? `${minBNB} BNB` : ""}
                </button>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-sm">
                <span className="opacity-80">You receive</span>
                <span className="font-semibold">≈ {tokensToReceive} MLEO</span>
              </div>

              <button
                className="mt-3.5 w-full py-2.5 rounded-lg font-bold text-base
                           bg-gradient-to-r from-sky-400 to-cyan-300 hover:scale-[1.015] transition
                           disabled:opacity-60"
                onClick={() => (!isConnected ? openConnectModal?.() : onBuy())}
                disabled={isPending || isMining || isPaused || saleShouldBeClosed}
              >
                {!isConnected ? "CONNECT WALLET"
                  : isPaused ? "PRESALE PAUSED"
                  : saleShouldBeClosed ? "SALE ENDED"
                  : isPending ? "CONFIRM IN WALLET…"
                  : isMining ? "PENDING…"
                  : "BUY NOW"}
              </button>

              {isSuccess && <p className="mt-2 text-green-400 text-xs">Success! Your purchase is confirmed.</p>}
              {isError && <p className="mt-2 text-red-400 text-xs">Transaction failed.</p>}
            </Card>
          </div>

          {/* Owner tools (compact) */}
          {isOwner && (
            <div className="mt-6 w-full max-w-[720px] mx-auto">
              <Card className="p-3">
                <details>
                  <summary className="cursor-pointer list-none select-none flex items-center justify-between">
                    <div className="text-xs">Owner tools</div>
                    <span className="text-[11px] opacity-70">toggle</span>
                  </summary>
                  <div className="mt-2 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        Target stage price: <b>{fmtTiny(toBNB(targetPriceWei))} BNB</b>
                        {!priceSynced && <span className="ml-1.5 text-amber-300">[unsynced]</span>}
                      </div>
                      {!priceSynced && (
                        <button
                          onClick={onAdminSyncPrice}
                          className="px-2.5 py-1.5 rounded-md bg-amber-400/20 border border-amber-400/40 hover:bg-amber-400/30"
                          disabled={isPending || isMining}
                        >
                          Apply setPrice()
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>Contract paused: <b>{isPaused ? "Yes" : "No"}</b></div>
                      <div className="flex gap-1.5">
                        {!isPaused && saleShouldBeClosed && (
                          <button
                            onClick={() => onAdminPause(true)}
                            className="px-2.5 py-1.5 rounded-md bg-rose-400/20 border border-rose-400/40 hover:bg-rose-400/30"
                            disabled={isPending || isMining}
                          >
                            Close sale (Pause)
                          </button>
                        )}
                        {isPaused && (
                          <button
                            onClick={() => onAdminPause(false)}
                            className="px-2.5 py-1.5 rounded-md bg-emerald-400/20 border border-emerald-400/40 hover:bg-emerald-400/30"
                            disabled={isPending || isMining}
                          >
                            Unpause
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="opacity-80">
                      Round timer resets every {Math.round(ROUND_SECONDS/86400)} days regardless of stage.
                      Price advances only when the funding goal (sold threshold) for the stage is hit.
                      On the last stage, when the timer ends, buying is disabled and you can pause the contract.
                    </p>
                  </div>
                </details>
              </Card>
            </div>
          )}
        </div>
      </motion.main>
    </Layout>
  );
}
