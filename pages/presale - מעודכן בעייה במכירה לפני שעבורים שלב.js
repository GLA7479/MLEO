//START PART 1

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
  useDisconnect,
} from "wagmi";
import { parseEther } from "viem";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/router";

/* ================= ENV ================= */
const PRESALE_ADDRESS = process.env.NEXT_PUBLIC_PRESALE_ADDRESS;
const PRESALE_CHAIN_ID = Number(process.env.NEXT_PUBLIC_PRESALE_CHAIN_ID || 97);

const UI_VARIANT_ENV = (process.env.NEXT_PUBLIC_PRESALE_VARIANT || "dark").toLowerCase();
const COIN_IMG = process.env.NEXT_PUBLIC_COIN_IMG || "/images/mleo-coin.png";
const HERO_BG_IMG = process.env.NEXT_PUBLIC_HERO_BG_IMG || "/images/hero-bg.jpg";

const STAGE_MODE = (process.env.NEXT_PUBLIC_STAGE_MODE || "sold").toLowerCase();
const RAW_STAGE_PRICES = (process.env.NEXT_PUBLIC_STAGE_PRICES_WEI || "")
  .split(",").map(s=>s.trim()).filter(Boolean);
const RAW_SOLD_THRESHOLDS = (process.env.NEXT_PUBLIC_STAGE_SOLD_THRESHOLDS || "")
  .split(",").map(s=>s.trim()).filter(Boolean);
const BNB_USD_OVERRIDE = Number(process.env.NEXT_PUBLIC_BNB_USD || 1000);
const ROUND_SECONDS = Number(process.env.NEXT_PUBLIC_ROUND_SECONDS || 3 * 24 * 60 * 60);
const ROUND_ANCHOR_TS = Number(process.env.NEXT_PUBLIC_ROUND_ANCHOR_TS || 0);

/* =============== PRESALE ABI (מותאם לחוזה החדש) =============== */
const PRESALE_ABI = [
  // core
  { type: "function", name: "buy", stateMutability: "payable", inputs: [{ name: "tokenAmount", type: "uint256" }], outputs: [] },
  { type: "function", name: "buyForValue", stateMutability: "payable", inputs: [], outputs: [] },

  { type: "function", name: "tokensSold", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "stageCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "currentStage", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },

  // price (WEI per token)
  { type: "function", name: "priceWei", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },

  // claim API (שימו לב: amount חובה)
  { type:"function", name:"purchasedOf", stateMutability:"view", inputs:[{type:"address"}], outputs:[{type:"uint256"}] },
  { type:"function", name:"claimedOf",   stateMutability:"view", inputs:[{type:"address"}], outputs:[{type:"uint256"}] },
  { type:"function", name:"claimableOf", stateMutability:"view", inputs:[{type:"address"}], outputs:[{type:"uint256"}] },
  { type:"function", name:"claimEnabled",stateMutability:"view", inputs:[], outputs:[{type:"bool"}] },
  { type:"function", name:"claim",       stateMutability:"nonpayable", inputs:[{type:"uint256"}], outputs:[] },

  // (אופציונלי) raw threshold ל-UI ישן
  { type:"function", name:"stageSoldThresholdRaw", stateMutability:"view", inputs:[{type:"uint256"}], outputs:[{type:"uint256"}] },
];

//END PART 1


//START PART 2

/* ======= utils ======= */
const E18 = 1_000_000_000_000_000_000n;
const toBNB = (wei) => (wei ? Number(wei) / 1e18 : 0);
const nf = new Intl.NumberFormat("en-US");
const fmtNum = (n) => (Number.isFinite(n) ? nf.format(n) : "—");
const shorten = (a) => (a ? `${a.slice(0,6)}…${a.slice(-4)}` : "—");
const fmtTiny = (n, d = 12) => (n || n === 0 ? n.toFixed(d).replace(/0+$/,"").replace(/\.$/,"") : "—");

/* ======= Hydration-safe number ======= */
function Num({ mounted, value, placeholder = "0", className = "" }) {
  return (
    <span suppressHydrationWarning className={className}>
      {mounted ? value : placeholder}
    </span>
  );
}

/* ======= UI atoms ======= */
const chipSizes = {
  sm: "text-[11px] px-2 py-0.5 rounded-full",
  md: "text-[12.5px] px-3 py-1 rounded-full",
  lg: "text-[14px] px-4 py-1.5 rounded-full",
};

const Chip = ({ children, className = "", size = "md", minWidth }) => (
  <span
    className={`inline-flex items-center justify-center border ${chipSizes[size]} ${className}`}
    style={minWidth ? { minWidth } : undefined}
  >
    {children}
  </span>
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

//END PART 2


//START PART 3

/* ================= Component ================= */
export default function Presale() {
  const router = useRouter();
  const uiVariant = (router.query.variant?.toString().toLowerCase() || UI_VARIANT_ENV);
  const isLight = uiVariant === "light";
  const isHero = uiVariant === "hero";
  const showHeroBg = isHero || (!!HERO_BG_IMG && HERO_BG_IMG !== "none");

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

  // local cache of last known purchased (per address)
  const [lastKnown, setLastKnown] = useState(() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem("mleo_last_purchased") || "null"); }
    catch { return null; }
  });

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

//END PART 3


//START PART 4

  // Wallet / chain
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  // Reads (Presale)
  const presaleCommon = { address: PRESALE_ADDRESS, abi: PRESALE_ABI, chainId: PRESALE_CHAIN_ID, query: { enabled: !!PRESALE_ADDRESS } };
  const { data: tokensSold } = useReadContract({ ...presaleCommon, functionName: "tokensSold" });
  const { data: stageCnt }   = useReadContract({ ...presaleCommon, functionName: "stageCount" });
  const { data: curStage }   = useReadContract({ ...presaleCommon, functionName: "currentStage" });
  const { data: pausedFlag } = useReadContract({ ...presaleCommon, functionName: "paused" });
  const { data: owner }      = useReadContract({ ...presaleCommon, functionName: "owner" });

  // Price (מהחוזה בלבד; אין יותר USD/BNB בפנים)
  const { data: priceWei_plain } = useReadContract({ ...presaleCommon, functionName: "priceWei" });

  // Claim data
  const { data: purchasedWei } = useReadContract({ ...presaleCommon, functionName: "purchasedOf", args: address ? [address] : undefined, query: { enabled: !!(PRESALE_ADDRESS && address) } });
  const { data: claimedWei }   = useReadContract({ ...presaleCommon, functionName: "claimedOf",   args: address ? [address] : undefined, query: { enabled: !!(PRESALE_ADDRESS && address) } });
  const { data: claimableWei } = useReadContract({ ...presaleCommon, functionName: "claimableOf", args: address ? [address] : undefined, query: { enabled: !!(PRESALE_ADDRESS && address) } });
  const { data: claimEnabled } = useReadContract({ ...presaleCommon, functionName: "claimEnabled" });

  // persist purchased
  useEffect(() => {
    if (!address || purchasedWei==null) return;
    const val = Number(purchasedWei) / 1e18;
    const rec = { address: address.toLowerCase(), purchased: val, ts: Date.now() };
    try { localStorage.setItem("mleo_last_purchased", JSON.stringify(rec)); } catch {}
  }, [address, purchasedWei]);


//END PART 4


//START PART 5

  const purchased = purchasedWei ? Number(purchasedWei)/1e18 : (lastKnown?.purchased ?? 0);
  const claimed   = claimedWei   ? Number(claimedWei)  /1e18 : 0;
  const claimable = claimableWei ? Number(claimableWei)/1e18 : Math.max(0, purchased - claimed);

  const sold = tokensSold ?? 0n;
  const soldTokens = Number(sold) / 1e18;
  const BNB_USD = BNB_USD_OVERRIDE || 0;

  // Writes
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess, isError } = useWaitForTransactionReceipt({ hash: txHash });

  // Stages (ENV fallback בלבד)
  const STAGE_PRICES_WEI = useMemo(() => (RAW_STAGE_PRICES.length ? RAW_STAGE_PRICES.map(v=>BigInt(v)) :
    [1500000000n,2000000000n,3000000000n,4000000000n,5000000000n,6000000000n,7000000000n,8000000000n,8500000000n,9000000000n]), []);
  const STAGE_COUNT = STAGE_PRICES_WEI.length;
  const SOLD_THRESHOLDS_E18 = useMemo(() => (RAW_SOLD_THRESHOLDS.length ? RAW_SOLD_THRESHOLDS.map(x=>BigInt(x.replace(/_/g,""))*E18) : []), []);
  const stageBySold = useMemo(() => {
    if (STAGE_MODE !== "sold") return 0;
    if (!sold || SOLD_THRESHOLDS_E18.length === 0) return 0;
    let idx = 0; for (let i=0;i<SOLD_THRESHOLDS_E18.length;i++) if (sold >= SOLD_THRESHOLDS_E18[i]) idx = i+1;
    return Math.min(idx, STAGE_COUNT - 1);
  }, [sold, SOLD_THRESHOLDS_E18, STAGE_COUNT]);

  const activeStageFallback = stageBySold;

  // ---- מחיר מהחוזה (עדיפות) + נפילה ל-ENV ----
  const priceFromPlain = priceWei_plain ? BigInt(priceWei_plain) : 0n;

  let targetPriceWei = 0n;
  if (priceFromPlain > 0n) targetPriceWei = priceFromPlain;
  if (targetPriceWei === 0n) targetPriceWei = STAGE_PRICES_WEI[activeStageFallback] || 0n;

  const nextStage = Math.min(STAGE_COUNT - 1, activeStageFallback + 1);
  const nextStagePriceWei = STAGE_PRICES_WEI[nextStage] || targetPriceWei;

  const isPaused = pausedFlag === true;

  // Round (visual)
  const [roundPct, roundEnd, roundLeft] = useMemo(() => {
    const nowSec = Math.floor(Date.now()/1000) + tick*0;
    const base = Number.isFinite(ROUND_ANCHOR_TS) ? ROUND_ANCHOR_TS : 0;
    const roundsSinceBase = Math.floor((nowSec - base) / ROUND_SECONDS);
    const roundStart = base + roundsSinceBase * ROUND_SECONDS;
    const roundEnd = roundStart + ROUND_SECONDS;
    const roundLeftSec = Math.max(0, roundEnd - nowSec);
    const roundPct = Math.max(0, Math.min(100, Math.round(((ROUND_SECONDS - roundLeftSec) / ROUND_SECONDS) * 100)));
    return [roundPct, roundEnd, {
      days: Math.floor(roundLeftSec / 86400),
      hours: Math.floor((roundLeftSec % 86400) / 3600),
      minutes: Math.floor((roundLeftSec % 3600) / 60),
      seconds: roundLeftSec % 60,
    }];
  }, [tick]);

  // Cap/progress
  const capTokens  = RAW_SOLD_THRESHOLDS.length ? Number(RAW_SOLD_THRESHOLDS[RAW_SOLD_THRESHOLDS.length - 1]) : 0;
  const progressPct = capTokens > 0 ? Math.min(100, (soldTokens / capTokens) * 100) : 0;

  // Pricing / display (נגזר ישירות מה-WEI לטוקן)
  const priceBNBPerToken = targetPriceWei ? Number(targetPriceWei) / 1e18 : 0; // BNB per token
  const priceUsdPerToken = (targetPriceWei && BNB_USD) ? priceBNBPerToken * BNB_USD : 0;

  const priceBNBPerTokenStr = fmtTiny(priceBNBPerToken);
  const priceUsdPerTokenStr = priceUsdPerToken ? fmtTiny(priceUsdPerToken, 9) : "—";

  const nextPriceBNBPerToken = nextStagePriceWei ? Number(nextStagePriceWei) / 1e18 : priceBNBPerToken;
  const nextPriceUsdPerToken = BNB_USD ? nextPriceBNBPerToken * BNB_USD : 0;
  const nextPriceUsdPerTokenStr = nextPriceUsdPerToken ? fmtTiny(nextPriceUsdPerToken, 9) : "—";

  // Tokens per 1 BNB (BigInt מדויק)
  const TOKENS_PER_1BNB_WEI = targetPriceWei ? (E18 * E18) / targetPriceWei : 0n;
  const tokensPer1BNB = Number(TOKENS_PER_1BNB_WEI) / 1e18;

  // Tokens per 1 USD (תצוגה בלבד)
  const tokensPer1USD = BNB_USD ? tokensPer1BNB / BNB_USD : 0;

  // חישוב כמות לפי סכום BNB שהוזן (מדויק)
  const tokensToReceive = useMemo(() => {
    const amtBNB = Number(amount || 0);
    if (!amtBNB || !targetPriceWei) return 0;
    const valueWei = parseEther(String(amtBNB));       // BNB in wei (BigInt)
    const tokenWei  = (valueWei * E18) / targetPriceWei;
    return Number(tokenWei) / 1e18;
  }, [amount, targetPriceWei]);

  const estUsdPay = useMemo(() => BNB_USD ? Number(amount || 0) * BNB_USD : 0, [amount, BNB_USD]);
  const raisedUSD = priceUsdPerToken ? soldTokens * priceUsdPerToken : 0;


//END PART 5


//START PART 6

  // actions
  async function ensureRightChain(targetId) {
    if (chainId !== targetId) await switchChainAsync({ chainId: targetId });
  }

  async function onBuy() {
    if (!PRESALE_ADDRESS) return alert("Missing PRESALE address (env).");
    if (isPaused) return alert("Presale is paused.");
    try { await ensureRightChain(PRESALE_CHAIN_ID); } catch { return alert("Switch to BSC Testnet (97)."); }

    const value = parseEther(String(amount || "0"));
    if (value <= 0n) return alert("Enter amount in tBNB (e.g., 0.05).");
    if (!targetPriceWei || targetPriceWei === 0n) return alert("Stage price not set.");

    // החוזה תומך גם בקנייה לפי סכום (buyForValue), אבל נשמור על buy(amount) כמו שהיה
    const tokenAmountWei = (value * E18) / targetPriceWei;
    if (tokenAmountWei <= 0n) return alert("Too low amount for current price.");

    try {
      writeContract({
        address: PRESALE_ADDRESS,
        abi: PRESALE_ABI,
        functionName: "buy",
        args: [tokenAmountWei],
        chainId: PRESALE_CHAIN_ID,
        value,
      });
    } catch (e) { console.error(e); alert("Buy failed"); }
  }

  // CLAIM
  const { writeContract: writeClaim, data: claimTx, isPending: isClaiming } = useWriteContract();
  const { isLoading: waitingClaim, isSuccess: claimOk } = useWaitForTransactionReceipt({ hash: claimTx });

  async function onClaim() {
    if (!PRESALE_ADDRESS) return alert("Missing PRESALE address (env).");
    if (!isConnected || !address) return openConnectModal?.();
    if (!claimEnabled) return alert("Claim is disabled.");
    if (!claimableWei || claimableWei === 0n) return alert("Nothing to claim.");
    try { await ensureRightChain(PRESALE_CHAIN_ID); } catch { return alert("Switch to BSC Testnet (97)."); }

    try {
      // בחוזה: claim(uint256 amount) — נתבע את כל ה-claimable
      writeClaim({
        address: PRESALE_ADDRESS,
        abi: PRESALE_ABI,
        functionName: "claim",
        args: [claimableWei],
        chainId: PRESALE_CHAIN_ID
      });
    } catch (e) { console.error(e); alert("Claim failed"); }
  }


//END PART 6


//START PART 7

  /* =================== UI =================== */
  return (
    <Layout page="presale">
      <Head><title>BUY MLEO — Presale</title></Head>

      {/* Background */}
      <div className={`fixed inset-0 -z-10 ${cls.pageBg}`} />
      <div className={`fixed inset-0 -z-10 pointer-events-none ${isLight ? "mix-blend-multiply" : ""} ${cls.gridTex}`}
        style={{ backgroundImage:"linear-gradient(to right, #0001 1px, transparent 1px), linear-gradient(to bottom, #0001 1px, transparent 1px)", backgroundSize:"40px 40px" }} />
      {showHeroBg && (
        <div className="fixed inset-x-0 top-0 -z-10">
          <div className="relative w-full" style={{ height: "clamp(360px, 100vh, 840px)" }}>
            <img src={HERO_BG_IMG} alt="" className="absolute inset-0 w-full h-full object-cover sm:object-cover object-[50%_18%] select-none pointer-events-none" onError={(e)=> (e.currentTarget.style.display="none")} />
            <div className={`absolute inset-0 ${isLight ? "bg-white/40" : "bg-neutral-950/38"}`} />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
          </div>
        </div>
      )}

      {/* Content */}
      <main className={`relative mx-auto w-full max-w-[1200px] px-3 sm:px-5 md:px-7 pt-4 md:pt-5 pb-24 md:pb-10 text-[14px] ${cls.text} -mt-3 sm:-mt-4 lg:-mt-6`}>
        {/* Header */}
        <div className="mb-3 md:mb-1 flex items-start gap-4 relative">
          {COIN_IMG && (
            <img src={COIN_IMG} alt="MLEO coin" className="sm:hidden block absolute right-2 -top-1 w-14 h-14 object-contain opacity-90 pointer-events-none" onError={(e)=> (e.currentTarget.style.display="none")} aria-hidden="true" />
          )}
          <div className="flex-1 min-w-0">
            <motion.h1 className="text-[26px] sm:text-[32px] font-extrabold tracking-tight" initial={{ y:-8, opacity:0 }} animate={{ y:0, opacity:1 }} transition={{ duration:0.35 }}>
              MLEO Presale
            </motion.h1>
            <p className={`mt-0.1 text-[15.5px] max-w-[720px] ${isLight ? "text-neutral-800" : "text-white"}`}>Minimal, gas-friendly checkout. Live stages, real-time progress, and transparent pricing.</p>

            {/* Chips מתחת לכותרת */}
            <div className="mt-2 flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
              <Chip className="border-cyan-500/50 text-cyan-400 bg-cyan-500/10">Fair Stages</Chip>
              <Chip className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10">FCFS • Anti-bot</Chip>
              <Chip className="border-fuchsia-500/50 text-fuchsia-400 bg-fuchsia-500/10">Instant Allocation</Chip>
            </div>
          </div>

          {/* אין סטטוס ארנק בכותרת */}
          {COIN_IMG && (
            <div className="hidden sm:block shrink-0">
              <img src={COIN_IMG} alt="MLEO coin" className="w-[120px] h-[120px] object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)]" onError={(e)=> (e.currentTarget.style.display="none")} />
            </div>
          )}
        </div>

        {/* Split */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-5">
          {/* Left */}
          <section className="md:col-span-7 lg:col-span-8 space-y-3">
            <StageBlock
              cls={cls}
              STAGE_COUNT={STAGE_COUNT}
              activeStage={activeStageFallback}
              roundPct={roundPct}
              ROUND_SECONDS={ROUND_SECONDS}
              roundEnd={roundEnd}
              sold={sold}
              SOLD_THRESHOLDS_E18={SOLD_THRESHOLDS_E18}
              nextStage={nextStage}
            />

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat cls={cls} title="Raised (USD)" value={`$${fmtNum(Math.round(raisedUSD))}`} hint={BNB_USD ? `≈ ${fmtNum(Math.round(raisedUSD / BNB_USD))} tBNB` : ""} />
              <Stat cls={cls} title="Sold" value={fmtNum(soldTokens)} hint={`${(progressPct || 0).toFixed(1)}% of cap`} />
              <Stat cls={cls} title="Current price" value={`$${priceUsdPerTokenStr || "—"} / token`} hint={`${priceBNBPerTokenStr || "—"} BNB / token`} />
              <Stat cls={cls} title="Next price" value={`${nextStage > activeStageFallback ? `$${nextPriceUsdPerTokenStr}` : "—"} / token`} hint={nextStage > activeStageFallback ? `${fmtTiny(nextPriceBNBPerToken)} BNB / token` : ""} />
            </div>

            {/* Global progress */}
            <ProgressBar cls={cls} progressPct={progressPct} soldTokens={soldTokens} capTokens={capTokens} />

            {/* Trust bar */}
            <TrustBar cls={cls} address={PRESALE_ADDRESS} />
          </section>

          {/* Right — BUY + CLAIM (Desktop) */}
          <aside className="md:col-span-5 lg:col-span-4 hidden md:flex justify-end">
            <div className="w-full max-w-[380px]">
              <BuyClaimPanel
                cls={cls}
                isPaused={!!isPaused}
                isConnected={isConnected}
                address={address}
                disconnect={disconnect}
                openConnectModal={openConnectModal}
                amount={amount}
                setAmount={setAmount}
                tokensToReceive={tokensToReceive}
                estUsdPay={estUsdPay}
                priceBNBPerTokenStr={fmtTiny(priceBNBPerToken)}
                priceUsdPerTokenStr={fmtTiny(priceUsdPerToken, 9)}
                oneUsdToTokens={Math.floor(tokensPer1USD || 0)}
                onBuy={onBuy}
                isPending={isPending}
                isMining={isMining}
                isSuccess={isSuccess}
                isError={isError}
                purchased={purchased}
                claimed={claimed}
                claimable={claimable}
                claimEnabled={!!claimEnabled}
                onClaim={onClaim}
                isClaiming={isClaiming || waitingClaim}
                claimOk={claimOk}
                mounted={mounted}
              />
            </div>
          </aside>
        </div>

        {/* Footer */}
        <div className={`mt-5 text-center text-[11px] ${cls.subtle}`}>
          Smart-contract on BSC Testnet • Make sure your wallet is on the correct network before purchasing.
        </div>
      </main>

      {/* ===== Mobile BUY trigger + Bottom Sheet ===== */}
      <div className="md:hidden">
        {/* Trigger Button (קבוע בתחתית המסך) */}
        <div className="fixed inset-x-0 bottom-0 z-30 p-3">
          <button
            onClick={()=>setSheetOpen(true)}
            className="w-full rounded-xl py-3 font-bold text-[15px] bg-gradient-to-r from-cyan-400 to-sky-400 text-neutral-950 shadow-lg active:scale-[0.995]"
          >
            BUY / CLAIM
          </button>
        </div>

        {/* Backdrop */}
        {sheetOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={()=>setSheetOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sheet */}
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: sheetOpen ? 0 : "100%" }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-neutral-800 bg-neutral-900/95 backdrop-blur p-3"
          role="dialog"
          aria-modal="true"
        >
          <div className="mx-auto w-full max-w-[480px]">
            <div className="flex items-center justify-between mb-2">
              <div className="h-1 w-12 rounded-full bg-neutral-700 mx-auto" />
              <button
                onClick={()=>setSheetOpen(false)}
                className="absolute right-3 top-3 px-2 py-1 rounded-md border border-neutral-700 text-[12px] hover:bg-neutral-800"
              >
                Close
              </button>
            </div>

            <BuyClaimPanel
              cls={cls}
              isPaused={!!isPaused}
              isConnected={isConnected}
              address={address}
              disconnect={disconnect}
              openConnectModal={openConnectModal}
              amount={amount}
              setAmount={setAmount}
              tokensToReceive={tokensToReceive}
              estUsdPay={estUsdPay}
              priceBNBPerTokenStr={fmtTiny(priceBNBPerToken)}
              priceUsdPerTokenStr={fmtTiny(priceUsdPerToken, 9)}
              oneUsdToTokens={Math.floor(tokensPer1USD || 0)}
              onBuy={onBuy}
              isPending={isPending}
              isMining={isMining}
              isSuccess={isSuccess}
              isError={isError}
              purchased={purchased}
              claimed={claimed}
              claimable={claimable}
              claimEnabled={!!claimEnabled}
              onClaim={onClaim}
              isClaiming={isClaiming || waitingClaim}
              claimOk={claimOk}
              mounted={mounted}
            />
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}

//END PART 7



//START PART 8

/* ======= Pieces ======= */

function HeaderWallet({ isConnected, address, disconnect, openConnectModal }) {
  return !isConnected ? (
    <button onClick={() => openConnectModal?.()} className="px-3 py-2 rounded-lg border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10">
      Connect Wallet
    </button>
  ) : (
    <div className="flex items-center gap-2">
      <code className="px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900/60">{shorten(address || "")}</code>
      <button onClick={() => disconnect?.()} className="px-3 py-2 rounded-lg border border-neutral-700 hover:bg-neutral-800">
        Disconnect
      </button>
    </div>
  );
}

function StageBlock({cls, STAGE_COUNT, activeStage, roundPct, ROUND_SECONDS, roundEnd, sold, SOLD_THRESHOLDS_E18, nextStage}) {
  const DATE_FMT = useMemo(() => new Intl.DateTimeFormat("en-GB", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false, timeZone:"UTC" }), []);
  const toNextTokens = useMemo(() => {
    const nextThresholdE18 = SOLD_THRESHOLDS_E18[activeStage] ?? null;
    if (!sold || nextThresholdE18 == null) return null;
    const left = Number(nextThresholdE18 - (sold ?? 0n)) / 1e18;
    return left > 0 ? left : 0;
  }, [sold, activeStage, SOLD_THRESHOLDS_E18]);
  const stagePct = useMemo(() => {
    const nextThresholdE18 = SOLD_THRESHOLDS_E18[activeStage] ?? null;
    if (!sold || nextThresholdE18 == null) return null;
    const prev = SOLD_THRESHOLDS_E18[activeStage - 1] ?? 0n;
    const have = Number((sold ?? 0n) - prev) / 1e18;
    const need = Number(nextThresholdE18 - prev) / 1e18;
    if (need <= 0) return 0;
    return Math.max(0, Math.min(100, (have / need) * 100));
  }, [sold, activeStage, SOLD_THRESHOLDS_E18]);

  return (
    <div className={`rounded-2xl border p-3 md:p-4 ${cls.card} ${cls.border}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Chip className={`${cls.border} ${cls.text}`}>Stage <b className="ml-1">{activeStage + 1}</b> / {STAGE_COUNT}</Chip>
          <Chip className={`${cls.border} ${cls.text}`}>Mode: <b className="ml-1">Sold</b></Chip>
        </div>
        <StageDots count={STAGE_COUNT} active={activeStage} color="bg-cyan-400" mute="bg-neutral-700" />
      </div>

      <div className="mt-3">
        <div className={`h-1.5 ${cls.kpiBarBg} rounded-full overflow-hidden`}>
          <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${roundPct}%` }} />
        </div>
        <div className={`mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[12px] ${cls.muted}`}>
          <span>Resets every {Math.round(ROUND_SECONDS/86400)} days</span>
          <span>Ends: {DATE_FMT.format(new Date(roundEnd * 1000))} UTC</span>
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

function ProgressBar({ cls, progressPct, soldTokens, capTokens }) {
  return (
    <div className={`rounded-2xl border p-3 md:p-4 ${cls.card} ${cls.border}`}>
      <div className={`h-2 ${cls.kpiBarBg} rounded-full overflow-hidden`}>
        <div className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400" style={{ width: `${progressPct}%` }} />
      </div>
      <div className={`mt-2 text-[12px] ${cls.muted}`}>
        {fmtNum(soldTokens)} / {fmtNum(capTokens)} tokens sold
      </div>
    </div>
  );
}

function TrustBar({ cls, address }) {
  return (
    <div className={`rounded-2xl border p-3 flex flex-wrap items-center gap-2 text-[12px] ${cls.card} ${cls.border}`}>
      <span className={`${cls.muted}`}>Contract:</span>
      <code className={`px-2 py-1 rounded-md border ${cls.code}`}>{shorten(address || "")}</code>
      <button onClick={() => navigator.clipboard?.writeText(address || "")} className={`ml-1 px-2 py-1 rounded-md border ${cls.border} hover:opacity-80`}>Copy</button>
      <span className={`ml-auto ${cls.subtle}`}>Network: BSC Testnet</span>
    </div>
  );
}

//END PART 8


//START PART 9

function BuyClaimPanel({
  cls, isPaused, isConnected, address, disconnect, openConnectModal,
  amount, setAmount, tokensToReceive, estUsdPay,
  priceBNBPerTokenStr, priceUsdPerTokenStr, oneUsdToTokens,
  onBuy, isPending, isMining, isSuccess, isError,
  purchased, claimed, claimable, claimEnabled, onClaim, isClaiming, claimOk,
  mounted,
}) {

  return (
    <div className={`rounded-2xl border p-4 ${cls.panel} ${cls.border} ${cls.shadow}`}>
      {/* Wallet (רק בתוך חלון ה-BUY) */}
      <div className="mb-3 flex items-center justify-between gap-2 text-[12.5px]">
        <div className={cls.muted}>Wallet</div>
        {!isConnected ? (
          <button onClick={() => openConnectModal?.()} className="px-2.5 py-1.5 rounded-md border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10">Connect</button>
        ) : (
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 rounded-md border border-neutral-700 bg-neutral-900/60">{shorten(address || "")}</code>
            <button onClick={() => disconnect?.()} className="px-2.5 py-1.5 rounded-md border border-neutral-700 hover:bg-neutral-800">Disconnect</button>
          </div>
        )}
      </div>

      {/* BUY */}
      <div className="flex items-center justify-between text-[12.5px] mb-2">
        <span className={cls.muted}>BUY (tBNB)</span>
        <span className={cls.subtle} suppressHydrationWarning>{mounted ? (amount || 0) : 0}</span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {/* שדה הסכום */}
        <div className="flex items-center gap-2">
          <input
            type="number" value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="0"
            min="0" step="0.0001"
            className={`w-full rounded-xl border px-3 py-2.5 text-[14px] ${cls.text} ${cls.input} ${cls.inputBorder} outline-none focus:ring-2 focus:ring-cyan-500/30`}
          />
        </div>

        {/* כפתורי סכומים — בשורה/רשת מאוזנת */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {["0.01","0.05","0.1","0.25","0.5","1"].map(v=>(
            <button
              key={v}
              onClick={()=>setAmount(v)}
              className={`w-full text-center px-3 py-1.5 text-[12px] rounded-md border ${cls.border} ${cls.input} hover:opacity-90`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* סיכומי רכישה */}
        <div className="grid grid-cols-2 gap-2 text-[12.5px]">
          <div className={`rounded-lg border p-2 ${cls.code}`}>
            <div className={cls.muted}>You receive</div>
            <div className={`font-semibold ${cls.text}`}>
              <Num mounted={mounted} value={fmtNum(tokensToReceive)} placeholder="0" /> MLEO
            </div>
          </div>
          <div className={`rounded-lg border p-2 text-right ${cls.code}`}>
            <div className={cls.muted}>Estimated</div>
            <div className={`font-semibold ${cls.text}`}>
              ≈ $<Num mounted={mounted} value={fmtNum(Math.round(estUsdPay))} placeholder="0" />
            </div>
            <div className={`${cls.subtle} text-[11px] mt-0.5`}>
              1 $ ≈ <Num mounted={mounted} value={fmtNum(oneUsdToTokens || 0)} placeholder="0" /> MLEO
            </div>
          </div>
        </div>
      </div>

      <button
        className="mt-3 w-full rounded-xl py-2.5 text-[14px] font-bold bg-gradient-to-r from-cyan-400 to-sky-400 text-neutral-950 transition hover:brightness-105 active:scale-[0.995] disabled:opacity-60 disabled:cursor-not-allowed"
        onClick={() => (!isConnected ? openConnectModal?.() : onBuy())}
        disabled={isPending || isMining || isPaused}
      >
        {!isConnected ? "CONNECT WALLET"
          : isPaused ? "PRESALE PAUSED"
          : isPending ? "CONFIRM IN WALLET…"
          : isMining ? "PENDING…"
          : "BUY NOW"}
      </button>

      {isSuccess && <p className="mt-2 text-emerald-500 text-[12px]">Success! Your purchase is confirmed.</p>}
      {isError && <p className="mt-2 text-rose-500 text-[12px]">Transaction failed.</p>}

      {/* Purchased / Claim */}
      <div className={`mt-4 pt-3 border-t ${cls.border} space-y-2`}>
        <div className="grid grid-cols-2 gap-2 text-[12.5px]">
          <div className={`rounded-lg border p-2 ${cls.code}`}>
            <div className={cls.muted}>Purchased</div>
            <div className={`font-semibold ${cls.text}`}>
              <Num mounted={mounted} value={fmtNum(purchased)} placeholder="0" /> MLEO
            </div>
          </div>
          <div className={`rounded-lg border p-2 ${cls.code}`}>
            <div className={cls.muted}>Claimable</div>
            <div className={`font-semibold ${cls.text}`}>
              <Num mounted={mounted} value={fmtNum(claimable)} placeholder="0" /> MLEO
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClaim}
          disabled={!isConnected || !claimEnabled || !(claimable > 0) || isClaiming}
          className="inline-flex w-full items-center justify-center rounded-xl border px-3 py-2.5 text-[13px] font-semibold hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
          title={
            !isConnected ? "Connect wallet"
            : !claimEnabled ? "Claim is disabled"
            : !(claimable > 0) ? "Nothing to claim"
            : "Claim tokens"
          }
        >
          {!isConnected ? "CONNECT TO CLAIM"
            : !claimEnabled ? "CLAIM DISABLED"
            : !(claimable > 0) ? "NOTHING TO CLAIM"
            : isClaiming ? "CLAIMING…" : "CLAIM TOKENS"}
        </button>

        {claimOk && <p className="text-emerald-500 text-[12px]">Claim successful!</p>}
      </div>
    </div>
  );
}

//END PART 9

