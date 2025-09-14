// pages/presale.js
import { useEffect, useMemo, useRef, useState } from "react";
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

/* ======= Tiny UI helpers (compact) ======= */
const Chip = ({ children, className = "" }) => (
  <span className={`px-2 py-0.5 rounded-full border text-[10px] leading-none ${className}`}>{children}</span>
);
const Stat = ({ title, value, hint }) => (
  <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
    <div className="text-[10px] uppercase tracking-wider text-neutral-400">{title}</div>
    <div className="mt-1 text-base font-semibold text-neutral-100">{value}</div>
    {hint ? <div className="text-[11px] text-neutral-500 mt-0.5">{hint}</div> : null}
  </div>
);
function StageDots({ count, active }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <i
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i <= active ? "bg-cyan-400" : "bg-neutral-700"}`}
          title={`Stage ${i + 1}`}
        />
      ))}
    </div>
  );
}

/* ================= Component ================= */
export default function Presale() {
  const [amount, setAmount] = useState("");
  const [tick, setTick] = useState(0);
  const buyCardRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
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
    if (RAW_STAGE_PRICES.length) return RAW_STAGE_PRICES.map((v) => BigInt(v));
    return [3750000000n,4200000000n,4704000000n,5268480000n,5900697600n,6608781312n,7401835069n,8290055278n,9284861911n,10399045340n];
  }, []);
  const STAGE_COUNT = STAGE_PRICES_WEI.length;

  const SOLD_THRESHOLDS_E18 = useMemo(() => {
    if (RAW_SOLD_THRESHOLDS.length) {
      return RAW_SOLD_THRESHOLDS.map((x) => BigInt(x.replace(/_/g, "")) * E18);
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
  const priceSynced = priceWei ? targetPriceWei === priceWei : true;

  const nextStage = Math.min(STAGE_COUNT - 1, activeStage + 1);
  const nextStagePriceWei = STAGE_PRICES_WEI[nextStage] || targetPriceWei;

  // Rolling round (visual only)
  const nowSec = Math.floor(Date.now() / 1000) + tick * 0;
  const base = Number.isFinite(ROUND_ANCHOR_TS) ? ROUND_ANCHOR_TS : 0;
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
  const roundPct = Math.max(0, Math.min(100, Math.round(((ROUND_SECONDS - roundLeftSec) / ROUND_SECONDS) * 100)));
  const isLastStage = activeStage >= STAGE_COUNT - 1;
  const saleShouldBeClosed = isLastStage && roundLeftSec === 0;

// choose any you prefer: 'he-IL' / 'en-GB' וכו'
const DATE_FMT = useMemo(() => new Intl.DateTimeFormat('he-IL', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
  timeZone: 'Asia/Jerusalem', // או 'UTC' אם רוצה עקבי לחלוטין
}), []);

const formatTs = (sec) => DATE_FMT.format(new Date(sec * 1000));


  // Derived numbers
  const minBNB = toBNB(minWei);
  const capTokens = cap ? Number(cap) / 1e18 : 0;
  const soldTokens = sold ? Number(sold) / 1e18 : 0;
  const progressPct = capTokens > 0 ? Math.min(100, (soldTokens / capTokens) * 100) : 0;

  const priceBNBPerToken = toBNB(priceWei);
  const tokensPer1BNB = priceWei ? 1e18 / Number(priceWei) : 0;
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

      {/* Background (no video). Dark, clean, grid texture */}
      <div className="fixed inset-0 -z-10 bg-neutral-950" />
      <div
        className="fixed inset-0 -z-10 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Page */}
      <main className="relative mx-auto w-full max-w-[1200px] px-3 sm:px-6 md:px-8 py-8 md:py-10 text-[14px] text-neutral-100">
        {/* Header */}
        <div className="mb-5 md:mb-8">
          <motion.h1
            className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-100"
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            MLEO Presale
          </motion.h1>
          <p className="mt-1 text-sm text-neutral-400 max-w-[720px]">
            Minimal, gas-friendly checkout. Live stages, real-time progress, and transparent pricing.
          </p>
        </div>

        {/* Split layout: Info left, Buy right */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
          {/* Left column */}
          <section className="md:col-span-7 lg:col-span-8 space-y-3">
            {/* Stage / timer strip */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Chip className="border-neutral-700 text-neutral-300">Stage <b className="ml-1">{activeStage + 1}</b> / {STAGE_COUNT}</Chip>
                  <Chip className="border-neutral-700 text-neutral-300">Mode: <b className="ml-1">Sold</b></Chip>
                  {!priceSynced && (
                    <Chip className="border-amber-600/50 text-amber-300 bg-amber-500/10">price not applied</Chip>
                  )}
                </div>
                <StageDots count={STAGE_COUNT} active={activeStage} />
              </div>

              {/* Round progress (thin) */}
              <div className="mt-3">
                <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${roundPct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[12px] text-neutral-400">
                  <span>Resets every {Math.round(ROUND_SECONDS / 86400)} days</span>
                  <span>
                    Ends: {formatTs(roundEnd)} 
                    &nbsp;{roundLeft.days}d {roundLeft.hours}h {roundLeft.minutes}m {roundLeft.seconds}s
                  </span>
                </div>
              </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat
                title="Raised"
                value={`${raisedBNB.toLocaleString()} tBNB`}
                hint={BNB_USD ? `≈ $${Math.round(raisedBNB * BNB_USD).toLocaleString()}` : ""}
              />
              <Stat
                title="Sold"
                value={soldTokens.toLocaleString()}
                hint={`${progressPct.toFixed(1)}% of cap`}
              />
              <Stat
                title="Current price"
                value={`${priceBNBPerTokenStr} BNB`}
                hint={priceUsdPerTokenStr ? `≈ $${priceUsdPerTokenStr}` : ""}
              />
              <Stat
                title="Next price"
                value={`${nextStage > activeStage ? fmtTiny(toBNB(nextStagePriceWei)) : "—"} BNB`}
                hint={`1 BNB ≈ ${tokensPer1BNBStr} MLEO`}
              />
            </div>

            {/* Global progress bar */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-1.5 text-[12px] text-neutral-400">
                {soldTokens.toLocaleString()} / {capTokens.toLocaleString()} tokens sold
              </div>
            </div>

            {/* Owner tools */}
            {isOwner && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
                <details>
                  <summary className="cursor-pointer list-none select-none text-[12px] text-neutral-300">
                    Owner tools
                  </summary>
                  <div className="mt-2 space-y-2 text-[12px] text-neutral-300">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        Target stage price: <b>{fmtTiny(toBNB(targetPriceWei))} BNB</b>
                        {!priceSynced && <span className="ml-1 text-amber-300">[unsynced]</span>}
                      </div>
                      {!priceSynced && (
                        <button
                          onClick={onAdminSyncPrice}
                          className="px-2.5 py-1 rounded-md border border-amber-700 bg-amber-500/10 hover:bg-amber-500/15"
                          disabled={isPending || isMining}
                        >
                          Apply setPrice()
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div>Paused: <b>{isPaused ? "Yes" : "No"}</b></div>
                      <div className="flex gap-1.5">
                        {!isPaused && saleShouldBeClosed && (
                          <button
                            onClick={() => onAdminPause(true)}
                            className="px-2.5 py-1 rounded-md border border-rose-700 bg-rose-500/10 hover:bg-rose-500/15"
                            disabled={isPending || isMining}
                          >
                            Pause
                          </button>
                        )}
                        {isPaused && (
                          <button
                            onClick={() => onAdminPause(false)}
                            className="px-2.5 py-1 rounded-md border border-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/15"
                            disabled={isPending || isMining}
                          >
                            Unpause
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-neutral-400">
                      Round resets every {Math.round(ROUND_SECONDS / 86400)} days. Price advances when sold threshold is hit.
                      On last stage, after timer ends, disable buy and pause if needed.
                    </p>
                  </div>
                </details>
              </div>
            )}
          </section>

          {/* Right column — Sticky Buy */}
          <aside className="md:col-span-5 lg:col-span-4">
            <div ref={buyCardRef} className="md:sticky md:top-6">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 md:p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.4)] z-[200] relative">
                <div className="flex items-center justify-between text-[13px] text-neutral-300 mb-2">
                  <span>BUY (tBNB)</span>
                  <span className="text-neutral-500">{amount || 0}</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.0001"
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-[14px] text-neutral-100
                               outline-none focus:ring-2 focus:ring-cyan-500/30"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    {["0.01", "0.05", "0.1", "0.25"].map((v) => (
                      <button
                        key={v}
                        onClick={() => setAmount(v)}
                        className="px-2.5 py-1.5 text-[12px] rounded-md border border-neutral-800 bg-neutral-950 hover:bg-neutral-900"
                      >
                        {v} BNB
                      </button>
                    ))}
                    <button
                      onClick={() => setAmount(minBNB ? String(minBNB) : "0.0001")}
                      className="ml-auto px-2.5 py-1.5 text-[12px] rounded-md border border-neutral-800 bg-neutral-950 hover:bg-neutral-900"
                      disabled={!minBNB}
                      title="Set minimum"
                    >
                      Min {minBNB ? `${minBNB} BNB` : ""}
                    </button>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[13px]">
                  <span className="text-neutral-400">You receive</span>
                  <span className="font-semibold text-neutral-100">≈ {tokensToReceive} MLEO</span>
                </div>

                <button
                  className="mt-3 w-full rounded-lg py-2.5 text-[14px] font-semibold
                             bg-cyan-500 hover:bg-cyan-400 text-neutral-950 transition
                             disabled:opacity-60 disabled:cursor-not-allowed"
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

                {isSuccess && <p className="mt-2 text-green-400 text-[12px]">Success! Your purchase is confirmed.</p>}
                {isError && <p className="mt-2 text-rose-400 text-[12px]">Transaction failed.</p>}

                {/* Small notes */}
                <div className="mt-3 border-t border-neutral-800 pt-2 text-[11px] text-neutral-500">
                  Network: BSC Testnet · Min: {minBNB || 0} BNB
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-[11px] text-neutral-500">
          Make sure your wallet is on the correct network before purchasing.
        </div>
      </main>
    </Layout>
  );
}
