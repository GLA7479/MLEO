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

// --- ENV ---
const PRESALE_ADDRESS = process.env.NEXT_PUBLIC_PRESALE_ADDRESS;
const PRESALE_CHAIN_ID = Number(process.env.NEXT_PUBLIC_PRESALE_CHAIN_ID || 97);

// UI-only USD display
const BNB_USD = Number(process.env.NEXT_PUBLIC_BNB_USD || 0);

// Dynamic stages by sold-thresholds (funding goals per stage)
const STAGE_MODE = (process.env.NEXT_PUBLIC_STAGE_MODE || "sold").toLowerCase(); // keep "sold"
const RAW_STAGE_PRICES =
  (process.env.NEXT_PUBLIC_STAGE_PRICES_WEI || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
const RAW_SOLD_THRESHOLDS =
  (process.env.NEXT_PUBLIC_STAGE_SOLD_THRESHOLDS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

// Rolling round (visual countdown) – resets every ROUND_SECONDS from ANCHOR
const ROUND_SECONDS = Number(process.env.NEXT_PUBLIC_ROUND_SECONDS || 3 * 24 * 60 * 60); // 3 days
// Optional: anchor (unix seconds) to align the windows. Defaults to epoch (0) if not set.
const ROUND_ANCHOR_TS = Number(process.env.NEXT_PUBLIC_ROUND_ANCHOR_TS || 0);

// --- ABI (reads + buy + admin) ---
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

export default function Presale() {
  const [amount, setAmount] = useState("");      // user input (BNB)
  const [tick, setTick] = useState(0);           // 1s tick for countdowns

  // tick
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // wallet / chain
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  // reads
  const common = { address: PRESALE_ADDRESS, abi: PRESALE_ABI, chainId: PRESALE_CHAIN_ID, query: { enabled: !!PRESALE_ADDRESS } };
  const { data: priceWei }   = useReadContract({ ...common, functionName: "priceWeiPerToken" });
  const { data: minWei }     = useReadContract({ ...common, functionName: "minWei" });
  const { data: cap }        = useReadContract({ ...common, functionName: "PRESALE_CAP" });
  const { data: sold }       = useReadContract({ ...common, functionName: "presaleSold" });
  const { data: raisedWei }  = useReadContract({ ...common, functionName: "totalRaised" });
  const { data: isPaused }   = useReadContract({ ...common, functionName: "paused" });
  const { data: owner }      = useReadContract({ ...common, functionName: "owner" });

  // writes
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess, isError } = useWaitForTransactionReceipt({ hash: txHash });

  // --- stages (prices & thresholds) ---
  const STAGE_PRICES_WEI = useMemo(() => {
    if (RAW_STAGE_PRICES.length) return RAW_STAGE_PRICES.map(v => BigInt(v));
    // fallback (should be set via ENV for your 10-stage plan)
    return [3750000000n, 4200000000n, 4704000000n, 5268480000n, 5900697600n, 6608781312n, 7401835069n, 8290055278n, 9284861911n, 10399045340n];
  }, []);
  const STAGE_COUNT = STAGE_PRICES_WEI.length;

  const SOLD_THRESHOLDS_E18 = useMemo(() => {
    if (RAW_SOLD_THRESHOLDS.length) {
      return RAW_SOLD_THRESHOLDS.map(x => {
        const clean = x.replace(/_/g, "");
        return BigInt(Math.trunc(Number(clean))) * E18; // tokens (no decimals) -> *1e18
      });
    }
    // Fallback: evenly spaced by cap
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
  }, [sold, SOLD_THRESHOLDS_E18, STAGE_COUNT, STAGE_MODE]);

  const activeStage = stageBySold; // we operate in "sold" mode
  const targetPriceWei = STAGE_PRICES_WEI[activeStage] || 0n;
  const priceSynced = priceWei ? (targetPriceWei === priceWei) : true;

  const nextStage = Math.min(STAGE_COUNT - 1, activeStage + 1);
  const nextStagePriceWei = STAGE_PRICES_WEI[nextStage] || targetPriceWei;

  // --- rolling 3-day round (visual) ---
  const nowSec = Math.floor(Date.now() / 1000) + tick * 0; // tick triggers rerender
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
  const roundPct = Math.max(0, Math.min(100, Math.round(((ROUND_SECONDS - roundLeftSec) / ROUND_SECONDS) * 100)));

  // last-stage closure rule (UI-level)
  const isLastStage = activeStage >= STAGE_COUNT - 1;
  const saleShouldBeClosed = isLastStage && roundLeftSec === 0;

  // --- numbers for UI ---
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

  // --- actions ---
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

  const isOwner = !!(owner && address && owner.toLowerCase() === address.toLowerCase());

  async function onAdminSyncPrice() {
    try {
      await ensureRightChain();
      writeContract({
        address: PRESALE_ADDRESS,
        abi: PRESALE_ABI,
        functionName: "setPrice",
        args: [targetPriceWei],
        chainId: PRESALE_CHAIN_ID,
      });
    } catch (e) { console.error(e); alert("setPrice failed"); }
  }
  async function onAdminPause(pause) {
    try {
      await ensureRightChain();
      writeContract({
        address: PRESALE_ADDRESS,
        abi: PRESALE_ABI,
        functionName: "setPaused",
        args: [pause],
        chainId: PRESALE_CHAIN_ID,
      });
    } catch (e) { console.error(e); alert("setPaused failed"); }
  }

  return (
    <Layout page="presale">
      <Head><title>BUY MLEO — Presale</title></Head>

      {/* background video */}
      <video autoPlay muted loop playsInline preload="auto"
        className="absolute inset-0 w-full h-full object-cover z-0">
        <source src="/videos/presale-bg.mp4" type="video/mp4" />
      </video>

      <motion.main
        className="relative min-h-screen flex flex-col items-center text-white p-4 pt-8 sm:pt-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="absolute inset-0 bg-black/55 z-10" />

        <motion.h1
          className="relative z-20 text-5xl font-extrabold mb-2 bg-gradient-to-r from-sky-400 via-cyan-300 to-fuchsia-400 bg-clip-text text-transparent drop-shadow-[0_2px_20px_rgba(59,130,246,0.45)]"
          initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }}>
          BUY MLEO
        </motion.h1>

        {/* stage + mode + unsynced */}
        <div className="relative z-20 flex flex-wrap items-center justify-center gap-2 mb-3">
          <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sm">
            Stage <b>{activeStage + 1}</b> / {STAGE_COUNT}
          </span>
          <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sm">
            Mode: <b>By Funding Goal (Sold)</b>
          </span>
          {!priceSynced && (
            <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-sm">
              Price unsynced (target stage different)
            </span>
          )}
        </div>

        {/* rolling round countdown */}
        <div className="relative z-20 w-full max-w-xl mb-3">
          <div className="flex items-center justify-between text-sm opacity-90 mb-1">
            <span>Round resets every {Math.round(ROUND_SECONDS/86400)} days</span>
            <span>Ends: {new Date(roundEnd * 1000).toLocaleString()}</span>
          </div>
          <div className="bg-white/15 h-3 rounded-full w-full overflow-hidden ring-1 ring-white/20">
            <div
              className="h-3 bg-gradient-to-r from-fuchsia-400 via-sky-400 to-cyan-300 shadow-[0_0_25px_rgba(34,211,238,0.6)] transition-all"
              style={{ width: `${roundPct}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xl font-semibold">
            Round ends in: {roundLeft.days}d {roundLeft.hours}h {roundLeft.minutes}m {roundLeft.seconds}s
          </p>
        </div>

        {/* Raised + progress */}
        <p className="relative z-20 text-xl font-semibold mb-2">
          Raised: {raisedBNB.toLocaleString()} tBNB{BNB_USD ? ` (~$${Math.round(raisedBNB * BNB_USD).toLocaleString()})` : ""}
        </p>
        <div className="relative z-20 bg-white/15 h-3 rounded-full mb-2 w-full max-w-xl overflow-hidden ring-1 ring-white/20">
          <div className="h-3 bg-gradient-to-r from-emerald-400 via-sky-400 to-cyan-300 transition-all"
            style={{ width: `${progressPct}%` }} />
        </div>
        <p className="relative z-20 text-base mb-6 opacity-90">
          {soldTokens.toLocaleString()} / {capTokens.toLocaleString()} tokens sold
        </p>

        {/* price chips */}
        <div className="relative z-20 flex flex-wrap items-center justify-center gap-2 mb-6">
          <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sm">
            1 BNB ≈ <b>{tokensPer1BNBStr}</b> MLEO
          </span>
          <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-sm">
            1 MLEO ≈ <b>{priceBNBPerTokenStr}</b> BNB
          </span>
          {!!priceUsdPerTokenStr && (
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-sm">
              ≈ ${priceUsdPerTokenStr} USD
            </span>
          )}
          {nextStagePriceWei && nextStage > activeStage && (
            <span className="px-3 py-1 rounded-full bg-pink-500/15 border border-pink-400/30 text-sm">
              Next price → {fmtTiny(toBNB(nextStagePriceWei))}
            </span>
          )}
        </div>

        {/* buy card */}
        <motion.div className="relative z-20 w-full max-w-xl mb-6"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="bg-white/10 backdrop-blur-xl p-5 rounded-2xl border border-white/20 ring-1 ring-cyan-300/20 shadow-[0_0_40px_rgba(56,189,248,0.35)]">
            <div className="flex justify-between mb-2 text-lg">
              <span>BUY (tBNB)</span><span>{amount || 0}</span>
            </div>
            <input
              type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0" min="0" step="0.0001"
              className="w-full p-3 bg-black/40 rounded-md text-white mb-2 text-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300/50"
            />
            <div className="flex items-center justify-between mb-3 text-sm">
              <button className="px-3 py-1 rounded bg-black/40 border border-white/15 hover:bg-black/50"
                onClick={() => setAmount(minBNB ? String(minBNB) : "0.0001")}
                disabled={!minBNB} title="Set minimum">
                Min {minBNB ? `${minBNB} BNB` : ""}
              </button>
              <span>≈ {tokensToReceive} MLEO</span>
            </div>
            <button
              className="bg-gradient-to-r from-sky-400 to-cyan-300 w-full py-3 rounded-md font-bold text-lg hover:scale-[1.02] transition disabled:opacity-60"
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
            {isSuccess && <p className="mt-3 text-green-400 text-sm">Success! Your purchase is confirmed.</p>}
            {isError && <p className="mt-3 text-red-400 text-sm">Transaction failed.</p>}
          </div>
        </motion.div>

        {/* owner tools */}
        {isOwner && (
          <div className="relative z-20 w-full max-w-xl mb-10">
            <div className="bg-black/40 border border-white/15 rounded-xl p-4 text-sm space-y-3">
              <div className="flex items-center justify-between">
                <p>Target stage price: <b>{fmtTiny(toBNB(targetPriceWei))} BNB</b></p>
                {!priceSynced && (
                  <button
                    onClick={onAdminSyncPrice}
                    className="px-3 py-2 rounded-md bg-amber-400/20 border border-amber-400/40 hover:bg-amber-400/30"
                    disabled={isPending || isMining}
                  >
                    Apply setPrice()
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p>Contract paused: <b>{isPaused ? "Yes" : "No"}</b></p>
                <div className="flex gap-2">
                  {!isPaused && saleShouldBeClosed && (
                    <button
                      onClick={() => onAdminPause(true)}
                      className="px-3 py-2 rounded-md bg-rose-400/20 border border-rose-400/40 hover:bg-rose-400/30"
                      disabled={isPending || isMining}
                    >
                      Close sale (Pause)
                    </button>
                  )}
                  {isPaused && (
                    <button
                      onClick={() => onAdminPause(false)}
                      className="px-3 py-2 rounded-md bg-emerald-400/20 border border-emerald-400/40 hover:bg-emerald-400/30"
                      disabled={isPending || isMining}
                    >
                      Unpause
                    </button>
                  )}
                </div>
              </div>
              <p className="opacity-80">
                The round timer resets every {Math.round(ROUND_SECONDS/86400)} days regardless of stage.
                Price only advances once the funding goal (sold threshold) for the stage is hit.
                On the last stage, when the timer ends, buying is disabled and you can pause the contract.
              </p>
            </div>
          </div>
        )}

        <p className="relative z-20 text-pink-300 font-bold text-lg">PRESALE IS LIVE</p>
      </motion.main>
    </Layout>
  );
}
