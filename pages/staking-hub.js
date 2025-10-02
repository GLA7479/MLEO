/***************************************************
 * FILE: pages/staking-hub.js
 * TYPE: Main “hub” page linking to all 4 staking pages
 * UI: English-only, unified design, equal-height cards
 * - Bottom-aligned CTA (Enter) on every card
 * - Contract address short + click-to-copy with feedback
 * - Learn more modal per card
 * - TVL & APR boxes: equal height, placed directly above the footer
 ***************************************************/

import Layout from "../components/Layout";
import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useReadContract } from "wagmi";

/*──────────────────────────────────────────────────
  1) ENV & ADDRESSES
──────────────────────────────────────────────────*/
const DECIMALS = Number(process.env.NEXT_PUBLIC_MLEO_DECIMALS || 18);

const ADDRS = {
  token:    process.env.NEXT_PUBLIC_MLEO_TOKEN_ADDRESS || "",
  dynamic:  process.env.NEXT_PUBLIC_STAKING_DYNAMIC || process.env.NEXT_PUBLIC_STAKING_ADDRESS || process.env.NEXT_PUBLIC_STAKING_DYNAMIC_ADDRESS || "",
  fixed1y:  process.env.NEXT_PUBLIC_STAKING_FIXED1Y || process.env.NEXT_PUBLIC_STAKING_FIXED1Y_ADDRESS || "",
  fixed3y:  process.env.NEXT_PUBLIC_STAKING_FIXED3Y || process.env.NEXT_PUBLIC_STAKING_FIXED3Y_ADDRESS || "",
  flex:     process.env.NEXT_PUBLIC_STAKING_FLEX    || process.env.NEXT_PUBLIC_STAKING_FLEX_ADDRESS    || "",
};

/*──────────────────────────────────────────────────
  2) MIN ABIs (Read-only)
──────────────────────────────────────────────────*/
const LOCKER_ABI_MIN = [
  { type:"function", name:"depositsOpen",   stateMutability:"view", inputs:[], outputs:[{type:"bool"}] },
  { type:"function", name:"rewardRate",     stateMutability:"view", inputs:[], outputs:[{type:"uint256"}] },
  { type:"function", name:"totalPrincipal", stateMutability:"view", inputs:[], outputs:[{type:"uint256"}] },
  { type:"function", name:"totalDeposits",  stateMutability:"view", inputs:[], outputs:[{type:"uint256"}] },
];

const ERC20_ABI_MIN = [
  { type:"function", name:"balanceOf", stateMutability:"view", inputs:[{type:"address"}], outputs:[{type:"uint256"}] },
];

/*──────────────────────────────────────────────────
  3) HELPERS
──────────────────────────────────────────────────*/
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
const cx = (...cls)=> cls.filter(Boolean).join(" ");
const shortAddr = (a)=> (a && a.length > 10) ? `${a.slice(0,6)}…${a.slice(-4)}` : (a || "—");
function fmtCompactFromRaw(rawBigint){
  const raw = rawBigint ?? 0n;
  const n = Number(raw) / 10 ** DECIMALS;
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(n);
}
function fmtPercent(n){
  if (n === null || n === undefined || isNaN(n)) return "—";
  return `${n.toFixed(2)}%`;
}

/*──────────────────────────────────────────────────
  4) HOOK: usePoolMeta(address)
──────────────────────────────────────────────────*/
function usePoolMeta(address){
  const enabled = Boolean(address);

  const dep = useReadContract({ address, abi: LOCKER_ABI_MIN, functionName: "depositsOpen",   query: { enabled, refetchInterval: 20000 }});
  const rate= useReadContract({ address, abi: LOCKER_ABI_MIN, functionName: "rewardRate",     query: { enabled, refetchInterval: 20000 }});
  const p  = useReadContract({ address, abi: LOCKER_ABI_MIN, functionName: "totalPrincipal", query: { enabled, refetchInterval: 20000 }});
  const d  = useReadContract({ address, abi: LOCKER_ABI_MIN, functionName: "totalDeposits",  query: { enabled, refetchInterval: 20000 }});
  const fb = useReadContract({ address: ADDRS.token, abi: ERC20_ABI_MIN, functionName: "balanceOf", args:[address], query: { enabled: enabled && !!ADDRS.token, refetchInterval: 20000 }});

  const { open, tvlFmt, aprFmt } = useMemo(() => {
    const open = !!dep.data;

    // TVL for display
    const rawForCard = (p.data ?? d.data ?? fb.data ?? 0n);
    const tvlFmt = fmtCompactFromRaw(rawForCard);

    // APR only if totalPrincipal exists
    let apr = null;
    if ((rate.data ?? 0n) > 0n && (p.data ?? 0n) > 0n) {
      apr = (Number(rate.data) * SECONDS_PER_YEAR / Number(p.data)) * 100;
    }
    return { open, tvlFmt, aprFmt: fmtPercent(apr) };
  }, [dep.data, rate.data, p.data, d.data, fb.data]);

  return { open, tvlFmt, aprFmt };
}

/*──────────────────────────────────────────────────
  5) PAGE: Staking Hub
──────────────────────────────────────────────────*/
export default function StakingHub(){
  const dyn  = usePoolMeta(ADDRS.dynamic);
  const y1   = usePoolMeta(ADDRS.fixed1y);
  const y3   = usePoolMeta(ADDRS.fixed3y);
  const flex = usePoolMeta(ADDRS.flex);

  const [modal, setModal] = useState(null); // { title, details }

  return (
    <Layout page="staking-hub">
      <Head>
        <title>MLEO — Staking Hub</title>
        <meta name="robots" content="noindex" />
      </Head>

      {/* Background */}
      <div className="min-h-[100svh] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-20%,rgba(16,185,129,0.12),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_80%_10%,rgba(59,130,246,0.10),transparent)]" />
        <div className="relative max-w-7xl mx-auto px-3 md:px-6 pt-8 md:pt-10 pb-16">

          {/* Header */}
          <header className="mb-6 md:mb-10">
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">MLEO — Staking Hub</h1>
            <p className="text-white/70 text-sm md:text-base mt-2">
              Four staking options with consistent design. APR values are on-chain estimates updated in real time.
            </p>
          </header>

          {/* Cards — equal height, metrics sit above the footer */}
          <section className="grid gap-4 md:gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <PoolCard
              tone="emerald"
              title="Dynamic (1Y lock)"
              to="/staking"
              open={dyn.open}
              tvl={dyn.tvlFmt}
              apr={dyn.aprFmt}
              contract={ADDRS.dynamic}
              bullets={[
                "12 months lock; no early exits or cooldowns.",
                "Live APR based on on-chain TVL.",
                "Rewards claimable at unlock.",
              ]}
              onLearnMore={()=> setModal({
                title: "Dynamic (1Y lock) — Details",
                details: learnMoreContent({
                  lock: "Locked for 12 months. No early exit. Rewards are claimable at unlock.",
                  aprNote: "APR adjusts with totalPrincipal (TVL). As TVL grows, APR typically decreases.",
                })
              })}
            />

            <PoolCard
              tone="cyan"
              title="Fixed 1Y"
              to="/staking-fixed1y"
              open={y1.open}
              tvl={y1.tvlFmt}
              apr={y1.aprFmt}
              contract={ADDRS.fixed1y}
              bullets={[
                "12 months lock; no early exit or cooldown.",
                "Claim rewards at the end of the lock.",
                "Designed for stability and predictability.",
              ]}
              onLearnMore={()=> setModal({
                title: "Fixed 1Y — Details",
                details: learnMoreContent({
                  lock: "Locked for 12 months. No early exit. Rewards are claimable at unlock.",
                  aprNote: "APR follows the same formula and depends on totalPrincipal.",
                })
              })}
            />

            <PoolCard
              tone="violet"
              title="Fixed 3Y"
              to="/staking-fixed3y"
              open={y3.open}
              tvl={y3.tvlFmt}
              apr={y3.aprFmt}
              contract={ADDRS.fixed3y}
              bullets={[
                "36 months lock; no early exit.",
                "Rewards become claimable at unlock.",
                "Suited for long-term conviction.",
              ]}
              onLearnMore={()=> setModal({
                title: "Fixed 3Y — Details",
                details: learnMoreContent({
                  lock: "Locked for 36 months. No early exit. Rewards are claimable at unlock.",
                  aprNote: "Longer lock; APR still derived from rewardRate and totalPrincipal.",
                })
              })}
            />

            <PoolCard
              tone="amber"
              title="Flex (choose months)"
              to="/staking-flex"
              open={flex.open}
              tvl={flex.tvlFmt}
              apr={flex.aprFmt}
              contract={ADDRS.flex}
              bullets={[
                "Pick your lock duration in months on the next page.",
                "No exit/cooldown; claim at unlock.",
                "APR updates with TVL in real time.",
              ]}
              onLearnMore={()=> setModal({
                title: "Flex — Details",
                details: learnMoreContent({
                  lock: "Choose lock length (in months) when staking. No early exit. Rewards at unlock.",
                  aprNote: "APR is dynamic and recalculated from on-chain values.",
                })
              })}
            />
          </section>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <Modal onClose={()=>setModal(null)} title={modal.title}>
          {modal.details}
        </Modal>
      )}
    </Layout>
  );
}

/*──────────────────────────────────────────────────
  6) UI COMPONENTS
──────────────────────────────────────────────────*/
function PoolCard({
  tone = "emerald",
  title, to, open, tvl, apr, contract, bullets = [], onLearnMore
}){
  const toneRing = {
    emerald: "from-emerald-400/30 to-transparent",
    cyan:    "from-cyan-400/30 to-transparent",
    violet:  "from-violet-400/30 to-transparent",
    amber:   "from-amber-400/40 to-transparent",
  }[tone];

  const [copied, setCopied] = useState(false);
  const onCopy = async ()=>{
    try {
      await navigator.clipboard.writeText(contract || "");
      setCopied(true);
      setTimeout(()=> setCopied(false), 1200);
    } catch {}
  };

  return (
    <div className="relative">
      {/* soft outer glow */}
      <div className={cx(
        "pointer-events-none absolute -inset-[1px] rounded-3xl opacity-60 blur",
        "bg-[conic-gradient(var(--tw-gradient-stops))]",
        "from-white/10 via-white/0 to-white/10"
      )} />

      {/* Equal-height card using flex column + spacer */}
      <div className={cx(
        "relative rounded-3xl p-5 backdrop-blur-sm",
        "bg-white/[0.04] border border-white/10 shadow-xl",
        "flex flex-col min-h-[440px]" // uniform height
      )}>
        {/* top tint */}
        <div className={cx(
          "absolute inset-x-0 -top-0.5 h-20 rounded-t-3xl",
          "bg-gradient-to-b", toneRing
        )} />

        {/* header */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <span className={cx(
            "shrink-0 text-[11px] px-2 py-0.5 rounded-full border",
            open
              ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300"
              : "bg-rose-500/15 border-rose-400/30 text-rose-300"
          )}>
            {open ? "Open" : "Closed"}
          </span>
        </div>

        {/* bullets */}
        {bullets.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-[13px] text-white/85">
            {bullets.map((b, i)=>(
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-white/40" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {/* spacer — pushes the metrics+footer down, keeping equal alignment */}
        <div className="flex-1" />

        {/* metrics (equal height, just above footer) */}
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-2 min-h-[88px]">
            <Metric label="TVL" value={tvl} />
            <Metric label="APR (est)" value={apr} />
          </div>
        </div>

        {/* footer — copyable address + aligned buttons */}
        <div className="pt-4">
          <div className="flex items-center justify-between text-[12px] text-white/60">
            <button
              onClick={onLearnMore}
              className="inline-flex items-center gap-1.5 px-3 h-11 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 transition-colors"
              title="Learn more about APR and lock rules"
            >
              <span aria-hidden>ℹ️</span> <span>Learn more</span>
            </button>

            <button
              type="button"
              onClick={onCopy}
              className="group inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
              title="Click to copy"
            >
              <span className="text-white/60">Contract:</span>
              <code className="truncate max-w-[120px] md:max-w-[160px] text-white/80">
                {shortAddr(contract)}
              </code>
              <span className="text-white/50 group-hover:text-white/80">⧉</span>
            </button>
          </div>

          <Link
            href={to}
            className="mt-3 inline-flex w-full items-center justify-center h-11 rounded-xl bg-emerald-500/85 hover:bg-emerald-500 text-sm font-semibold shadow transition-colors"
          >
            Enter
          </Link>

          {/* tiny copied toast */}
          <div className={cx(
            "mt-2 text-center text-[11px] transition-opacity",
            copied ? "opacity-100" : "opacity-0"
          )}>
            Copied!
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }){
  return (
    <div className="min-h-[64px] rounded-xl p-3 bg-black/30 border border-white/10 flex flex-col justify-center items-center text-center">
      <div className="text-[11px] text-white/60">{label}</div>
      <div className="text-sm font-semibold">{value ?? "—"}</div>
    </div>
  );
}


/*──────────────────────────────────────────────────
  7) MODAL & CONTENT
──────────────────────────────────────────────────*/
function Modal({ title, children, onClose }){
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0f1115] border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h4 className="text-lg font-semibold">{title}</h4>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors rounded-md px-2 py-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
        <div className="p-4 pt-0 text-right">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center px-3 h-11 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function learnMoreContent({ lock, aprNote }){
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <div>
        <h5 className="font-semibold text-white">Lock rules</h5>
        <p className="text-white/80">{lock}</p>
      </div>

      <div>
        <h5 className="font-semibold text-white">APR overview</h5>
        <p className="text-white/80">{aprNote}</p>
        <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="text-[12px] text-white/70">Formula</div>
          <code className="block text-[13px] font-mono mt-1">
            APR = (rewardRate × secondsInYear ÷ totalPrincipal_raw) × 100
          </code>
          <ul className="mt-2 space-y-1 text-white/75">
            <li><span className="font-mono font-semibold">rewardRate</span> — Tokens emitted per second by the pool (from contract).</li>
            <li><span className="font-mono font-semibold">secondsInYear</span> — 31,536,000 (365 days).</li>
            <li><span className="font-mono font-semibold">totalPrincipal_raw</span> — Sum of all users’ staked principal (from contract).</li>
          </ul>
          <p className="mt-2 text-white/70">
            APR is an estimate and moves with TVL. Rewards accrue continuously and are claimable at unlock.
          </p>
        </div>
      </div>
    </div>
  );
}
