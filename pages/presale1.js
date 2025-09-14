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
import { useRouter } from "next/router";

/* ================= ENV / UI VARIANTS ================= */
const PRESALE_ADDRESS = process.env.NEXT_PUBLIC_PRESALE_ADDRESS;
const PRESALE_CHAIN_ID = Number(process.env.NEXT_PUBLIC_PRESALE_CHAIN_ID || 97);
const BNB_USD = Number(process.env.NEXT_PUBLIC_BNB_USD || 0);

// UI variants: 'dark' | 'light' | 'hero'
const UI_VARIANT_ENV = (process.env.NEXT_PUBLIC_PRESALE_VARIANT || "dark").toLowerCase();
// assets
const COIN_IMG = process.env.NEXT_PUBLIC_COIN_IMG || "/images/mleo-coin.png";
const HERO_BG_IMG = process.env.NEXT_PUBLIC_HERO_BG_IMG || "/images/hero-bg.jpg";

/* ================= Presale config ================= */
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

/* =============== ABI =============== */
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

/* ======= utils ======= */
const E18 = 1_000_000_000_000_000_000n;
const toBNB = (wei) => (wei ? Number(wei) / 1e18 : 0);
const nf = new Intl.NumberFormat("en-US");
const fmtNum = (n) => (Number.isFinite(n) ? nf.format(n) : "—");
const shorten = (a) => (a ? `${a.slice(0,6)}…${a.slice(-4)}` : "—");
const fmtTiny = (n, d = 12) => (n ? n.toFixed(d).replace(/0+$/,"").replace(/\.$/,"") : "—");

/* ======= UI atoms ======= */
const Chip = ({ children, className = "" }) => (
  <span className={`px-2 py-0.5 rounded-full border text-[10px] leading-none ${className}`}>{children}</span>
);
const Stat = ({ title, value, hint, cls = {} }) => (
  <div className={`rounded-xl border p-3 ${cls.card} ${cls.border}`}>
    <div className={`text-[10px] uppercase tracking-wider ${cls.muted}`}>{title}</div>
    <div className={`mt-1 text-base font-semibold ${cls.text}`}>{value}</div>
    {hint ? <div className={`text-[11px] mt-0.5 ${cls.subtle}`}>{hint}</div> : null}
  </div>
);
const StageDots = ({ count, active, color = "bg-cyan-400", mute = "bg-neutral-700" }) => (
  <div className="flex items-center gap-1.5">
    {Array.from({ length: count }).map((_, i) => (
      <i key={i} className={`h-1.5 w-1.5 rounded-full ${i <= active ? color : mute}`} />
    ))}
  </div>
);

/* ================= Component ================= */
export default function Presale() {
  const router = useRouter();
  const uiVariant = (router.query.variant?.toString().toLowerCase() || UI_VARIANT_ENV);
  const isLight = uiVariant === "light";
  const isHero = uiVariant === "hero";
  const showHeroBg = isHero || (!!HERO_BG_IMG && HERO_BG_IMG !== "none");

  // palette classes
  const cls = {
    pageBg: isLight ? "bg-white" : "bg-neutral-950",
    gridTex: isLight ? "opacity-[0.04]" : "opacity-[0.08]",
    text: isLight ? "text-neutral-900" : "text-neutral-100",
    muted: isLight ? "text-neutral-600" : "text-neutral-400",
    subtle: isLight ? "text-neutral-500" : "text-neutral-400",
    border: isLight ? "border-neutral-200" : "border-neutral-800",
    card: isLight ? "bg-white" : "bg-neutral-900/60",
    panel: isLight ? "bg-white" : "bg-neutral-900/80",
    input: isLight ? "bg-white" : "bg-neutral-950",
    inputBorder: isLight ? "border-neutral-300" : "border-neutral-800",
    code: isLight ? "bg-neutral-50 border-neutral-200" : "bg-neutral-950/70 border-neutral-800",
    kpiBarBg: isLight ? "bg-neutral-200" : "bg-neutral-800",
    shadow: isLight ? "shadow-[0_1px_0_rgba(0,0,0,0.03)]" : "shadow-[0_0_0_1px_rgba(0,0,0,0.45)]",
  };

  const [amount, setAmount] = useState("");
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
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
    if (RAW_SOLD_THRESHOLDS.length) return RAW_SOLD_THRESHOLDS.map((x) => BigInt(x.replace(/_/g, "")) * E18);
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
    for (let i = 0; i < SOLD_THRESHOLDS_E18.length; i++) if (sold >= SOLD_THRESHOLDS_E18[i]) idx = i + 1;
    return Math.min(idx, STAGE_COUNT - 1);
  }, [sold, SOLD_THRESHOLDS_E18, STAGE_COUNT]);

  const activeStage = stageBySold;
  const targetPriceWei = STAGE_PRICES_WEI[activeStage] || 0n;
  const priceSynced = priceWei ? targetPriceWei === priceWei : true;

  const nextStage = Math.min(STAGE_COUNT - 1, activeStage + 1);
  const nextStagePriceWei = STAGE_PRICES_WEI[nextStage] || targetPriceWei;

  // Next threshold (visual only)
  const nextThresholdE18 = SOLD_THRESHOLDS_E18[activeStage] ?? null;
  const toNextTokens = useMemo(() => {
    if (!sold || nextThresholdE18 == null) return null;
    const left = Number(nextThresholdE18 - sold) / 1e18;
    return left > 0 ? left : 0;
  }, [sold, nextThresholdE18]);

  // percent inside current stage (visual only)
  const stagePct = useMemo(() => {
    if (!sold || nextThresholdE18 == null) return null;
    const prev = SOLD_THRESHOLDS_E18[activeStage - 1] ?? 0n;
    const have = Number(sold - prev) / 1e18;
    const need = Number(nextThresholdE18 - prev) / 1e18;
    if (need <= 0) return 0;
    return Math.max(0, Math.min(100, (have / need) * 100));
  }, [sold, nextThresholdE18, SOLD_THRESHOLDS_E18, activeStage]);

  // Deterministic Date (hydration-safe)
  const DATE_FMT = useMemo(() => new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, timeZone: "UTC",
  }), []);

  // Round progress
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

  // Derived numbers
  const minBNB = toBNB(minWei);
  const capTokens  = cap  ? Number(cap)  / 1e18 : 0;
  const soldTokens = sold ? Number(sold) / 1e18 : 0;
  const progressPct = capTokens > 0 ? Math.min(100, (soldTokens / capTokens) * 100) : 0;

  const priceBNBPerToken = toBNB(priceWei);
  const tokensPer1BNB = priceWei ? (1e18 / Number(priceWei)) : 0;
  const tokensPer1BNBStr = tokensPer1BNB ? fmtNum(Math.floor(tokensPer1BNB)) : "—";
  const priceBNBPerTokenStr = fmtTiny(priceBNBPerToken);
  const priceUsdPerTokenStr = BNB_USD && priceBNBPerToken ? fmtTiny(priceBNBPerToken * BNB_USD, 9) : "";
  const raisedBNB = toBNB(raisedWei);

  // Tokens per 1 USD (אם יש שער)
  const tokensPer1USD = priceWei && BNB_USD ? (1e18 / Number(priceWei)) / BNB_USD : 0;
  const tokensPer1USDStr = tokensPer1USD ? fmtNum(Math.floor(tokensPer1USD)) : "—";

  const tokensToReceive = useMemo(() => {
    const amt = Number(amount || 0);
    if (!amt || !priceWei) return 0;
    return Number(((amt * 1e18) / Number(priceWei)).toFixed(2));
  }, [amount, priceWei]);

  const estUsdPay = useMemo(() => {
    const amt = Number(amount || 0);
    return BNB_USD ? amt * BNB_USD : 0;
  }, [amount, BNB_USD]);

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

      {/* Background grid */}
      <div className={`fixed inset-0 -z-10 ${cls.pageBg}`} />
      <div
        className={`fixed inset-0 -z-10 pointer-events-none ${isLight ? "mix-blend-multiply" : ""} ${cls.gridTex}`}
        style={{
          backgroundImage:
            "linear-gradient(to right, #0001 1px, transparent 1px), linear-gradient(to bottom, #0001 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Hero image: contain on mobile (no crop), cover on >=sm */}
  {showHeroBg && (
  <div className="fixed inset-x-0 top-0 -z-10">
    {/* גובה אלסטי: לא פחות מ־320px, עד 55vh, לא יותר מ־520px */}
    <div className="relative w-full" style={{ height: "clamp(300px, 100vh, 840px)" }}>
      <img
        src={HERO_BG_IMG}
        alt=""
        className="
          absolute inset-0 w-full h-full
          object-cover sm:object-cover
          object-[50%_18%]     /* פוקוס קצת למעלה */
          select-none pointer-events-none
        "
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
      {/* overlay בהיר יותר כדי שהתמונה תבלוט */}
      <div className={`absolute inset-0 ${isLight ? "bg-white/40" : "bg-neutral-950/38"}`} />
      {/* דגרדיינט לקריאות טקסט בתחתית בלי להחשיך את כל התמונה */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
    </div>
  </div>
)}


      {/* Mobile CTA */}
      <div className="fixed bottom-3 left-0 right-0 z-[130] px-3 sm:hidden">
        <button
          onClick={() => (!isConnected ? openConnectModal?.() : setSheetOpen(true))}
          className="w-full py-3 rounded-full font-extrabold tracking-wide shadow-xl
                     bg-gradient-to-r from-cyan-400 to-sky-400 text-neutral-950 active:scale-[0.99]"
          style={{ paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom))` }}
        >
          {!isConnected ? "CONNECT WALLET" : "JOIN PRESALE"}
        </button>
      </div>

      {/* Compact top spacing */}
 <main className={`relative mx-auto w-full max-w-[1200px] px-3 sm:px-5 md:px-7 pt-4 md:pt-5 pb-10 text-[14px] ${cls.text}`}>

        {/* Header */}
        <div className="mb-4 md:mb-6 flex items-start gap-4 relative">
          {/* scrim behind header for better legibility */}
          <div className="absolute -inset-x-3 -top-2 bottom-0 pointer-events-none
                          bg-gradient-to-b from-black/40 via-black/20 to-transparent
                          sm:from-black/30 sm:via-black/15 rounded-2xl" />

          {/* coin for mobile (overlay) */}
          {COIN_IMG && (
            <img
              src={COIN_IMG}
              alt="MLEO coin"
              className="sm:hidden block absolute right-2 -top-1 w-14 h-14 object-contain opacity-90 pointer-events-none"
              onError={(e) => (e.currentTarget.style.display = "none")}
              aria-hidden="true"
            />
          )}

          <div className="flex-1 min-w-0">
<motion.h1
              className="text-[26px] sm:text-[32px] font-extrabold tracking-tight
                         drop-shadow-[0_2px_6px_rgba(0,0,0,.55)]
                         [text-shadow:0_2px_6px_rgba(0,0,0,.55)]"
              initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.35 }}
            >
              MLEO Presale
            </motion.h1>
           <p className={`mt-1 text-[13.5px] max-w-[720px] ${cls.muted}
                           [text-shadow:0_1px_3px_rgba(0,0,0,.55)]`}>
              Minimal, gas-friendly checkout. Live stages, real-time progress, and transparent pricing.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip className="border-cyan-500/40 text-cyan-600 bg-cyan-500/10">Fair Stages</Chip>
              <Chip className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10">FCFS • Anti-bot</Chip>
              <Chip className="border-fuchsia-500/40 text-fuchsia-600 bg-fuchsia-500/10">Instant Allocation</Chip>
            </div>
          </div>

          {/* coin for desktop/tablet */}
          {COIN_IMG && (
            <div className="hidden sm:block shrink-0">
              <img
                src={COIN_IMG}
                alt="MLEO coin"
                className="w-[120px] h-[120px] object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
          )}
        </div>

        {/* Split */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-5">
          {/* Left */}
          <section className="md:col-span-7 lg:col-span-8 space-y-3">
            <StageCard
              cls={cls}
              STAGE_COUNT={STAGE_COUNT}
              activeStage={activeStage}
              priceSynced={priceSynced}
              roundPct={roundPct}
              roundEnd={roundEnd}
              roundLeft={roundLeft}
              DATE_FMT={DATE_FMT}
              mounted={mounted}
              resetDays={Math.round(ROUND_SECONDS / 86400)}
              isLight={isLight}
              toNextTokens={toNextTokens}
              nextStage={nextStage}
              stagePct={stagePct}
            />

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat cls={cls} title="Raised" value={`${fmtNum(raisedBNB)} tBNB`} hint={BNB_USD ? `≈ $${fmtNum(Math.round(raisedBNB * BNB_USD))}` : ""} />
              <Stat cls={cls} title="Sold" value={fmtNum(soldTokens)} hint={`${(progressPct || 0).toFixed(1)}% of cap`} />
              <Stat cls={cls} title="Current price" value={`${priceBNBPerTokenStr} BNB`} hint={BNB_USD ? `1 $ ≈ ${tokensPer1USDStr} MLEO` : ""} />
              <Stat cls={cls} title="Next price" value={`${nextStage > activeStage ? fmtTiny(toBNB(nextStagePriceWei)) : "—"} BNB`} hint={BNB_USD ? `1 $ ≈ ${tokensPer1USDStr} MLEO` : `1 BNB ≈ ${tokensPer1BNBStr} MLEO`} />
            </div>

            {/* Global progress */}
            <div className={`rounded-2xl border p-3 md:p-4 ${cls.card} ${cls.border}`}>
              <div className={`h-2 ${cls.kpiBarBg} rounded-full overflow-hidden`}>
                <div className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400" style={{ width: `${progressPct}%` }} />
              </div>
              <div className={`mt-2 text-[12px] ${cls.muted}`}>
                {fmtNum(soldTokens)} / {fmtNum(capTokens)} tokens sold
              </div>
            </div>

            {/* How it works */}
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Connect", "Open your wallet on BSC Testnet"],
                ["Enter amount", "Pick a quick amount or type custom"],
                ["Confirm", "Approve the tx, tokens are reserved"],
              ].map(([t, s], i) => (
                <div key={i} className={`rounded-xl border p-3 ${cls.card} ${cls.border}`}>
                  <div className="text-[12px] font-semibold">{t}</div>
                  <div className={`text-[11.5px] mt-0.5 ${cls.subtle}`}>{s}</div>
                </div>
              ))}
            </div>

            {/* Trust bar */}
            <div className={`rounded-2xl border p-3 flex flex-wrap items-center gap-2 text-[12px] ${cls.card} ${cls.border}`}>
              <span className={`${cls.muted}`}>Contract:</span>
              <code className={`px-2 py-1 rounded-md border ${cls.code}`}>{shorten(PRESALE_ADDRESS || "")}</code>
              <button
                onClick={() => navigator.clipboard?.writeText(PRESALE_ADDRESS || "")}
                className={`ml-1 px-2 py-1 rounded-md border ${cls.border} ${isLight ? "hover:bg-neutral-50" : "hover:bg-neutral-900"}`}
              >
                Copy
              </button>
              <span className={`ml-auto ${cls.subtle}`}>Network: BSC Testnet</span>
            </div>
          </section>

          {/* Right — Compact Buy */}
          <aside className="md:col-span-5 lg:col-span-4 hidden md:flex justify-end">
            <div className="w-full max-w-[360px]">
              <BuyPanel
                isLight={isLight}
                cls={cls}
                amount={amount}
                setAmount={setAmount}
                minBNB={minBNB}
                tokensToReceive={tokensToReceive}
                estUsdPay={estUsdPay}
                isConnected={isConnected}
                onBuy={onBuy}
                openConnectModal={openConnectModal}
                disabled={isPending || isMining || isPaused || saleShouldBeClosed}
                isPending={isPending}
                isMining={isMining}
                isPaused={!!isPaused}
                saleShouldBeClosed={saleShouldBeClosed}
                isSuccess={isSuccess}
                isError={isError}
              />
            </div>
          </aside>
        </div>

        {/* Footer */}
        <div className={`mt-5 text-center text-[11px] ${cls.subtle}`}>
          Smart-contract on BSC Testnet • Make sure your wallet is on the correct network before purchasing.
        </div>
      </main>

      {/* MOBILE Bottom Sheet */}
      <div className={`fixed inset-0 z-[140] sm:hidden ${sheetOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!sheetOpen}>
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity ${sheetOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setSheetOpen(false)}
        />
        <div
          className={`absolute left-0 right-0 bottom-0 rounded-t-3xl border-t ${cls.border} ${cls.panel}
                     ${cls.shadow} p-4 transition-transform`}
          style={{
            transform: `translateY(${sheetOpen ? "0%" : "110%"})`,
            paddingBottom: `calc(1rem + env(safe-area-inset-bottom))`,
          }}
        >
          <div className="mx-auto w-full max-w-[560px]">
            <div className={`mx-auto mb-3 h-1 w-10 rounded-full ${isLight ? "bg-neutral-300" : "bg-neutral-700"}`} />
            <BuyPanel
              isLight={isLight}
              cls={cls}
              amount={amount}
              setAmount={setAmount}
              minBNB={minBNB}
              tokensToReceive={tokensToReceive}
              estUsdPay={estUsdPay}
              isConnected={isConnected}
              onBuy={async () => { await onBuy(); }}
              openConnectModal={openConnectModal}
              disabled={isPending || isMining || isPaused || saleShouldBeClosed}
              isPending={isPending}
              isMining={isMining}
              isPaused={!!isPaused}
              saleShouldBeClosed={saleShouldBeClosed}
              isSuccess={isSuccess}
              isError={isError}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}

/* ======= Pieces ======= */
function StageCard({
  cls, STAGE_COUNT, activeStage, priceSynced,
  roundPct, roundEnd, roundLeft, DATE_FMT, mounted, resetDays,
  isLight, toNextTokens, nextStage, stagePct,
}) {
  return (
    <div className={`rounded-2xl border p-3 md:p-4 ${cls.card} ${cls.border}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Chip className={`${cls.border} ${cls.text}`}>Stage <b className="ml-1">{activeStage + 1}</b> / {STAGE_COUNT}</Chip>
          <Chip className={`${cls.border} ${cls.text}`}>Mode: <b className="ml-1">Sold</b></Chip>
          {!priceSynced && <Chip className="border-amber-600/50 text-amber-600 bg-amber-500/10">price not applied</Chip>}
        </div>
        <StageDots
          count={STAGE_COUNT}
          active={activeStage}
          color="bg-cyan-400"
          mute={isLight ? "bg-neutral-300" : "bg-neutral-700"}
        />
      </div>

      <div className="mt-3">
        <div className={`h-1.5 ${cls.kpiBarBg} rounded-full overflow-hidden`}>
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400"
            style={{ width: mounted ? `${roundPct}%` : "0%" }}
          />
        </div>
        <div className={`mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[12px] ${cls.muted}`}>
          <span>Resets every {resetDays} days</span>
          <span suppressHydrationWarning>
            Ends: {DATE_FMT.format(new Date(roundEnd * 1000))} UTC • {mounted ? (
              <>{roundLeft.days}d {roundLeft.hours}h {roundLeft.minutes}m {roundLeft.seconds}s</>
            ) : "—"}
          </span>
        </div>
      </div>

      {toNextTokens != null && nextStage > activeStage && (
        <div className={`mt-3 rounded-xl border p-2.5 ${cls.card} ${cls.border}`}>
          <div className={`flex items-center justify-between text-[12px] ${cls.text}`}>
            <span>Next price at stage {nextStage + 1}</span>
            <span className={cls.muted}>Need ~{fmtNum(Math.max(0, Math.ceil(toNextTokens)))} MLEO</span>
          </div>
          <div className={`mt-1 h-1 ${cls.kpiBarBg} rounded-full overflow-hidden`}>
            <div className="h-full bg-cyan-400" style={{ width: `${stagePct ?? 0}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function BuyPanel({
  cls, isLight,
  amount, setAmount, minBNB, tokensToReceive, estUsdPay,
  isConnected, onBuy, openConnectModal, disabled,
  isPending, isMining, isPaused, saleShouldBeClosed,
  isSuccess, isError,
}) {
  return (
    <div className={`rounded-2xl border p-4 ${cls.panel} ${cls.border} ${cls.shadow}`}>
      <div className="flex items-center justify-between text-[12.5px] mb-2">
        <span className={cls.muted}>BUY (tBNB)</span>
        <span className={cls.subtle}>{amount || 0}</span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            min="0"
            step="0.0001"
            className={`w-full rounded-xl border px-3 py-2.5 text-[14px] ${cls.text} ${cls.input} ${cls.inputBorder} outline-none focus:ring-2 focus:ring-cyan-500/30`}
          />
          <div className="hidden sm:flex flex-col gap-1">
            {["0.01", "0.05", "0.1", "0.25"].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(v)}
                className={`px-3 py-1.5 text-[12px] rounded-md border ${cls.border} ${cls.input} ${isLight ? "hover:bg-neutral-50" : "hover:bg-neutral-900"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="sm:hidden grid grid-cols-4 gap-1">
          {["0.01", "0.05", "0.1", "0.25"].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className={`px-2.5 py-2 text-[12px] rounded-md border ${cls.border} ${cls.input} ${isLight ? "hover:bg-neutral-50" : "hover:bg-neutral-900"}`}
            >
              {v}
            </button>
          ))}
          <button
            onClick={() => setAmount(minBNB ? String(minBNB) : "0.0001")}
            className={`col-span-4 mt-1 px-2.5 py-2 text-[12px] rounded-md border ${cls.border} ${cls.input}`}
            disabled={!minBNB}
            title="Set minimum"
          >
            Min {minBNB ? `${minBNB} BNB` : ""}
          </button>
        </div>

        <div className="mt-1 grid grid-cols-2 gap-2 text-[12.5px]">
          <div className={`rounded-lg border p-2 ${cls.code}`}>
            <div className={cls.muted}>You receive</div>
            <div className={`font-semibold ${cls.text}`}>≈ {fmtNum(tokensToReceive)} MLEO</div>
          </div>
          <div className={`rounded-lg border p-2 text-right ${cls.code}`}>
            <div className={cls.muted}>Estimated</div>
            <div className={`font-semibold ${cls.text}`}>≈ ${fmtNum(Math.round(estUsdPay))}</div>
          </div>
        </div>
      </div>

      <button
        className="mt-3 w-full rounded-xl py-2.5 text-[14px] font-bold
                   bg-gradient-to-r from-cyan-400 to-sky-400 text-neutral-950 transition
                   hover:brightness-105 active:scale-[0.995]
                   disabled:opacity-60 disabled:cursor-not-allowed"
        onClick={() => (!isConnected ? openConnectModal?.() : onBuy())}
        disabled={disabled}
      >
        {!isConnected ? "CONNECT WALLET"
          : isPaused ? "PRESALE PAUSED"
          : saleShouldBeClosed ? "SALE ENDED"
          : isPending ? "CONFIRM IN WALLET…"
          : isMining ? "PENDING…"
          : "BUY NOW"}
      </button>

      {isSuccess && <p className="mt-2 text-emerald-500 text-[12px]">Success! Your purchase is confirmed.</p>}
      {isError && <p className="mt-2 text-rose-500 text-[12px]">Transaction failed.</p>}

      <div className={`mt-3 border-t pt-2 text-[11px] ${cls.subtle}`} style={{ borderColor: isLight ? "#e5e7eb" : "#1f2937" }}>
        Network: BSC Testnet · Min: {minBNB || 0} BNB
      </div>
    </div>
  );
}
