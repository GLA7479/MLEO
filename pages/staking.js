/***************************************************
 * PART 1 — FILE HEADER (English-only UI)
 ***************************************************/
// pages/staking.js — MLEO Locked Staking (compact UI + fixed BG from /public/images)
// Tailwind + Wagmi + RainbowKit (pages router)

import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits, zeroAddress, maxUint256 } from "viem";

/***************************************************
 * PART 2 — ENV & CONSTANTS
 ***************************************************/
const STAKING_ADDRESS = process.env.NEXT_PUBLIC_STAKING_ADDRESS;
const TOKEN_ADDRESS   = process.env.NEXT_PUBLIC_MLEO_TOKEN_ADDRESS;
const ENV_DECIMALS    = Number(process.env.NEXT_PUBLIC_MLEO_DECIMALS || 18);
const CHAIN_ID        = Number(process.env.NEXT_PUBLIC_CLAIM_CHAIN_ID || 97);

// 🔽 Fixed background image (served from public/images)
const BG_PATH = "/images/staking-bg.jpg";


/***************************************************
 * PART 3 — ABIs (as per your MLEOLockedStaking)
 ***************************************************/
const ERC20_ABI = [
  { type:"function", name:"decimals",  stateMutability:"view", inputs:[], outputs:[{type:"uint8"}] },
  { type:"function", name:"symbol",    stateMutability:"view", inputs:[], outputs:[{type:"string"}] },
  { type:"function", name:"balanceOf", stateMutability:"view", inputs:[{name:"a",type:"address"}], outputs:[{type:"uint256"}] },
  { type:"function", name:"allowance", stateMutability:"view", inputs:[{name:"o",type:"address"},{name:"s",type:"address"}], outputs:[{type:"uint256"}] },
  { type:"function", name:"approve",   stateMutability:"nonpayable", inputs:[{name:"s",type:"address"},{name:"a",type:"uint256"}], outputs:[{type:"bool"}] },
];

const LOCKER_ABI = [
  { type:"function", name:"depositsOpen",   stateMutability:"view", inputs:[], outputs:[{type:"bool"}] },
  { type:"function", name:"programStart",   stateMutability:"view", inputs:[], outputs:[{type:"uint64"}] },
  { type:"function", name:"periodFinish",   stateMutability:"view", inputs:[], outputs:[{type:"uint64"}] },
  { type:"function", name:"rewardRate",     stateMutability:"view", inputs:[], outputs:[{type:"uint256"}] },
  { type:"function", name:"totalPrincipal", stateMutability:"view", inputs:[], outputs:[{type:"uint256"}] },
  { type:"function", name:"cooldown",       stateMutability:"view", inputs:[], outputs:[{type:"uint64"}] },
  { type:"function", name:"positionsOf",    stateMutability:"view", inputs:[{name:"u",type:"address"}], outputs:[{type:"uint256[]"}] },
  { type:"function", name:"positions",      stateMutability:"view", inputs:[{name:"id",type:"uint256"}], outputs:[
    {name:"principal", type:"uint128"},
    {name:"start",     type:"uint64"},
    {name:"unlock",    type:"uint64"},
    {name:"exiting",   type:"bool"},
    {name:"requested", type:"uint64"},
    {name:"weight",    type:"uint256"},
    {name:"reward",    type:"uint256"},
  ]},
  { type:"function", name:"earned",      stateMutability:"view", inputs:[{name:"id",type:"uint256"}], outputs:[{type:"uint256"}] },
  { type:"function", name:"stake",       stateMutability:"nonpayable", inputs:[{name:"amount",type:"uint256"}], outputs:[] },
  { type:"function", name:"claim",       stateMutability:"nonpayable", inputs:[{name:"id",type:"uint256"},{name:"to",type:"address"}], outputs:[] },
  { type:"function", name:"claimMany",   stateMutability:"nonpayable", inputs:[{name:"ids",type:"uint256[]"},{name:"to",type:"address"}], outputs:[] },
  { type:"function", name:"requestExit", stateMutability:"nonpayable", inputs:[{name:"id",type:"uint256"}], outputs:[] },
  { type:"function", name:"cancelExit",  stateMutability:"nonpayable", inputs:[{name:"id",type:"uint256"}], outputs:[] },
];

/***************************************************
 * PART 4 — HELPERS
 ***************************************************/
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
const now = ()=> Math.floor(Date.now()/1000);
const ms  = (x)=> Number(x || 0n) * 1000;
function fmt(n, d){ try{ return Number(formatUnits(n||0n, d)).toLocaleString(undefined,{maximumFractionDigits:6}); } catch{ return "0"; } }
function fmtPct(x){ try{ return `${(Number(x)||0).toLocaleString(undefined,{maximumFractionDigits:2})}%`; } catch{ return "0%"; } }
function dhms(secs){
  secs = Math.max(0, Number(secs||0));
  const d = Math.floor(secs/86400); secs-=d*86400;
  const h = Math.floor(secs/3600);  secs-=h*3600;
  const m = Math.floor(secs/60);    secs-=m*60;
  const s = Math.floor(secs);
  return `${d}d ${h}h ${m}m ${s}s`;
}

/***************************************************
 * PART 5 — MAIN COMPONENT (compact layout)
 ***************************************************/
export default function StakingPage(){
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const pc = usePublicClient();
  const { writeContractAsync: write } = useWriteContract();

  const [lastTx, setLastTx] = useState();
  useWaitForTransactionReceipt({ hash: lastTx, confirmations: 1 });

  const [decimals, setDecimals] = useState(ENV_DECIMALS);
  const [symbol, setSymbol]     = useState("MLEO");
  const [amount, setAmount]     = useState("");
  const [err, setErr]           = useState("");
  const [positions, setPositions] = useState([]);
  const [sortDesc, setSortDesc]   = useState(true);

// Only claim when position is exiting, cooldown finished, and has reward
const claimableIds = positions
  .filter(p => p.exiting && p.coolLeft === 0 && (p.rewardLive || 0n) > 0n)
  .map(p => BigInt(p.id));

const hasClaimable = claimableIds.length > 0;
const totalClaimable = positions
  .filter(p => p.exiting && p.coolLeft === 0 && (p.rewardLive || 0n) > 0n)
  .reduce((acc, p) => acc + (p.rewardLive || 0n), 0n);




  // Token meta
  const symRead = useReadContract({ address:TOKEN_ADDRESS, abi:ERC20_ABI, functionName:"symbol" });
  useEffect(()=>{ if(symRead.data) setSymbol(symRead.data); }, [symRead.data]);
  const decRead = useReadContract({ address:TOKEN_ADDRESS, abi:ERC20_ABI, functionName:"decimals" });
  useEffect(()=>{ if(typeof decRead.data==="number") setDecimals(decRead.data); }, [decRead.data]);

  // Balance & allowance
  const balRead = useReadContract({ address:TOKEN_ADDRESS, abi:ERC20_ABI, functionName:"balanceOf", args:[address||zeroAddress], query:{enabled:!!address, refetchInterval:10000}});
  const allowanceRead = useReadContract({ address:TOKEN_ADDRESS, abi:ERC20_ABI, functionName:"allowance", args:[address||zeroAddress, STAKING_ADDRESS], query:{enabled:!!address, refetchInterval:10000}});
  const balance   = balRead.data || 0n;
  const allowance = allowanceRead.data || 0n;

  // Global reads
  const depositsOpen = useReadContract({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"depositsOpen",   query:{refetchInterval:15000}});
  const programStart = useReadContract({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"programStart",   query:{refetchInterval:15000}});
  const finish       = useReadContract({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"periodFinish",   query:{refetchInterval:15000}});
  const rewardRate   = useReadContract({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"rewardRate",     query:{refetchInterval:15000}});
  const totalP       = useReadContract({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"totalPrincipal", query:{refetchInterval:15000}});
  const cooldownRead = useReadContract({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"cooldown",       query:{refetchInterval:30000}});

 // Positions
const posIdsRead = useReadContract({
  address: STAKING_ADDRESS,
  abi: LOCKER_ABI,
  functionName: "positionsOf",
  args: [address || zeroAddress],
  query: { enabled: !!address, refetchInterval: 10000 }
});

useEffect(() => {
  let ignore = false;

  (async () => {
    try {
      if (!pc || !posIdsRead.data) { if (!ignore) setPositions([]); return; }

      const ids = posIdsRead.data.map(x => BigInt(x));
      if (ids.length === 0) { if (!ignore) setPositions([]); return; }

      // build multicall
      const calls = ids.flatMap((id) => ([
        { address: STAKING_ADDRESS, abi: LOCKER_ABI, functionName: "positions", args: [id] },
        { address: STAKING_ADDRESS, abi: LOCKER_ABI, functionName: "earned",    args: [id] },
      ]));

      // ✅ THIS was missing
      const res = await pc.multicall({ contracts: calls });

      // build positions array (cooldownEnd is already an END timestamp on-chain)
      const arr = [];
      for (let i = 0; i < ids.length; i++) {
        const pos  = res[i * 2]?.result || [];
        const earn = res[i * 2 + 1]?.result || 0n;

        const principal   = pos?.[0] ?? 0n;
        const start       = pos?.[1] ?? 0n;
        const unlock      = pos?.[2] ?? 0n;
        const exiting     = pos?.[3] ?? false;
        const cooldownEnd = Number(pos?.[4] ?? 0n); // end timestamp
        const weight      = pos?.[5] ?? 0n;
        const reward      = pos?.[6] ?? 0n;

        const coolEnds = cooldownEnd || 0;
        const coolLeft = coolEnds ? Math.max(0, coolEnds - now()) : 0;

        arr.push({
          id: ids[i].toString(),
          principal, start, unlock, exiting,
          requested: BigInt(cooldownEnd), // להצגה בלבד
          weight, rewardStored: reward, rewardLive: earn,
          coolEnds, coolLeft,
        });
      }

      arr.sort((a, b) => (sortDesc ? Number(b.id) - Number(a.id) : Number(a.id) - Number(b.id)));
      if (!ignore) setPositions(arr);
    } catch (e) {
      console.error("hydrate positions failed", e);
      if (!ignore) setPositions([]);
    }
  })();

  return () => { ignore = true; };
}, [pc, posIdsRead.data, sortDesc, lastTx]);


  // Derived
  const required   = useMemo(()=>{ try{ return amount.trim()? parseUnits(amount.trim(),decimals):0n; }catch{ return 0n;}}, [amount,decimals]);
  const needApprove= useMemo(()=> allowance < required, [allowance, required]);
  const aprPct     = useMemo(()=>{
    const r = Number(rewardRate.data||0n) / 10**decimals;
    const t = Number(totalP.data||0n)     / 10**decimals;
    if(!r || !t) return 0;
    return (r * SECONDS_PER_YEAR / t) * 100;
  }, [rewardRate.data,totalP.data,decimals]);

  /***************************************************
   * PART 6 — ACTIONS
   ***************************************************/
  async function ensureNetwork(){ if(chainId!==CHAIN_ID) await switchChain({ chainId: CHAIN_ID }); }

  async function onApprove(max=false){
    try{ setErr(""); await ensureNetwork();
      const amt = max ? maxUint256 : (required || balance);
      const tx  = await write({ address:TOKEN_ADDRESS, abi:ERC20_ABI, functionName:"approve", args:[STAKING_ADDRESS, amt] });
      setLastTx(tx);
    }catch(e){ setErr(e?.shortMessage || e?.message || "Approval failed"); }
  }
  async function onStake(){
    try{ setErr(""); await ensureNetwork();
      if(!amount.trim()) throw new Error("Enter an amount to stake");
      const tx = await write({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"stake", args:[required] });
      setAmount(""); setLastTx(tx);
    }catch(e){ setErr(e?.shortMessage || e?.message || "Stake failed"); }
  }
  async function onClaim(id){
    try{ setErr(""); await ensureNetwork();
      const tx = await write({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"claim", args:[BigInt(id), address] });
      setLastTx(tx);
    }catch(e){ setErr(e?.shortMessage || e?.message || "Claim failed"); }
  }
 async function onClaimAll(){
  try{
    setErr(""); await ensureNetwork();
    if (!claimableIds.length) throw new Error("Nothing to claim");
    const tx = await write({
      address: STAKING_ADDRESS,
      abi: LOCKER_ABI,
      functionName: "claimMany",
      args: [claimableIds, address],
    });
    setLastTx(tx);
  }catch(e){ setErr(e?.shortMessage || e?.message || "Claim all failed"); }
}


  async function onRequestExit(id){
    try{ setErr(""); await ensureNetwork();
      const tx = await write({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"requestExit", args:[BigInt(id)] });
      setLastTx(tx);
    }catch(e){ setErr(e?.shortMessage || e?.message || "Exit request failed"); }
  }
  async function onCancelExit(id){
    try{ setErr(""); await ensureNetwork();
      const tx = await write({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"cancelExit", args:[BigInt(id)] });
      setLastTx(tx);
    }catch(e){ setErr(e?.shortMessage || e?.message || "Cancel exit failed"); }
  }

  /***************************************************
   * PART 7 — UI (compact + fixed BG)
   ***************************************************/
 
// mobile-aware background (no side cropping on phones)
const isMobile = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const bgStyle = BG_PATH
  ? {
      backgroundImage: `url("${BG_PATH}")`,
      backgroundAttachment: isMobile ? "scroll" : "fixed",
      backgroundRepeat: "no-repeat",
      backgroundPosition: isMobile ? "center top" : "center",
      backgroundSize: isMobile ? "contain" : "cover",
      backgroundColor: "#000",
    }
  : { backgroundColor: "#000" };



  return (
    <>
      <Head><title>MLEO — Staking</title><meta name="robots" content="noindex" /></Head>

<div className="text-white relative" style={{ ...bgStyle, minHeight: "100svh" }}>
        {/* Subtle overlay for readability */}
        <div className="absolute inset-0 bg-black/45" />

        <div className="relative max-w-5xl mx-auto px-3 md:px-4 py-5 md:py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 md:mb-5">
            <div>
              <h1 className="text-lg md:text-xl font-semibold tracking-tight">Stake MLEO</h1>
              <p className="text-white/70 text-xs">Yearly linear pool • Live APR • Per-position</p>
            </div>
            <ConnectButton />
          </div>

          {/* Global stats */}
          <div className="grid sm:grid-cols-3 gap-2.5 md:gap-3 mb-5">
            <Stat label="Deposits open" value={depositsOpen.data ? "Yes" : "No"} />
            <Stat label={`Total principal (${symbol})`} value={fmt(totalP.data, decimals)} />
            <Stat label="APR (est)" value={fmtPct(aprPct)} />
            <Stat label="Program start" value={programStart.data ? new Date(ms(programStart.data)).toLocaleString() : "—"} />
            <Stat label="Period finish" value={finish.data ? new Date(ms(finish.data)).toLocaleString() : "—"} />
            <Stat
  label="Cooldown (days)"
  value={
    cooldownRead.data
      ? ((Number(cooldownRead.data) >= 365 ? Number(cooldownRead.data) : Number(cooldownRead.data) * 86400) / 86400).toFixed(2)
      : "—"
  }
/>


          </div>

          {/* Stake / Allowance — compact card */}
          <div className="rounded-xl bg-white/5 border border-white/10 shadow-xl p-3 md:p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base md:text-lg font-semibold">Stake</h2>
              <div className="text-[11px] text-white/60">Balance: {fmt(balance, decimals)} {symbol}</div>
            </div>

            <div className="text-[11px] text-white/50 mb-2">
              Allowance: {fmt(allowance, decimals)} {symbol} • Required: {fmt(required, decimals)} {symbol}
            </div>

            <div className="flex gap-2">
              <input
                value={amount}
                onChange={(e)=>setAmount(e.target.value)}
                placeholder="Amount to stake"
                className="flex-1 bg-black/35 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/30"
              />
              <button
                onClick={()=>setAmount(String(Number(formatUnits(balance||0n, decimals))))}
                className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-xs"
              >
                MAX
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {needApprove ? (
                <>
                  <button onClick={()=>onApprove(false)} className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs">Approve</button>
                  <button onClick={()=>onApprove(true)}  className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs">Approve MAX</button>
                </>
              ) : (
                <button onClick={onStake} disabled={!isConnected || !amount.trim()} className="px-3.5 py-2 rounded-lg bg-emerald-500/85 hover:bg-emerald-500 disabled:opacity-50 text-xs">Stake</button>
              )}
             <button
  onClick={onClaimAll}
  disabled={!hasClaimable}
  className="px-3.5 py-2 rounded-lg bg-blue-500/80 hover:bg-blue-500 disabled:opacity-50 text-xs"
>
  Claim all {hasClaimable ? `(${fmt(totalClaimable, decimals)} ${symbol})` : ""}
</button>


            </div>

            {!!err && <div className="mt-2 text-red-400 text-xs break-all">{err}</div>}
          </div>

          {/* Positions — compact list */}
          <div className="rounded-xl bg-white/5 border border-white/10 shadow-xl p-3 md:p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base md:text-lg font-semibold">My positions</h2>
              <button onClick={()=>setSortDesc(s=>!s)} className="px-2.5 py-1.5 rounded-md bg-white/10 border border-white/15 text-[11px]">
                Sort: {sortDesc ? "Newest" : "Oldest"}
              </button>
            </div>

            {!positions.length && <div className="text-sm text-white/60">No positions yet.</div>}

            <div className="grid gap-2.5">
              {positions.map(p=>(
                <div key={p.id} className="rounded-lg p-2.5 bg-black/30 border border-white/10">
                  {/* header row */}
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">ID #{p.id}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${p.exiting ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"}`}>
                      {p.exiting ? "Exiting" : "Active"}
                    </span>
                  </div>

                  {/* stats grid */}
                  <div className="grid md:grid-cols-4 gap-2 mt-2 text-[13px]">
                    <Info label="Principal"      value={`${fmt(p.principal, decimals)} ${symbol}`} />
                    <Info label="Weight"         value={fmt(p.weight, decimals)} />
                    <Info label="Earned (live)"  value={`${fmt(p.rewardLive, decimals)} ${symbol}`} />
                    <Info label="Reward stored"  value={`${fmt(p.rewardStored, decimals)} ${symbol}`} />
                    <Info label="Start"          value={p.start ? new Date(ms(p.start)).toLocaleString() : "—"} />
                    <Info label="Unlock"         value={p.unlock? new Date(ms(p.unlock)).toLocaleString() : "—"} />
    <Info label="Cooldown ends" value={p.coolEnds ? new Date(ms(p.coolEnds)).toLocaleString() : "—"} />
<Info label="Cooldown left" value={p.coolEnds ? dhms(p.coolLeft) : "—"} />

                  </div>

                  {/* actions */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
  onClick={()=>onClaim(p.id)}
  disabled={!(p.exiting && p.coolLeft === 0 && (p.rewardLive || 0n) > 0n)}
  className="px-3 py-1.5 rounded-lg bg-blue-500/80 hover:bg-blue-500 disabled:opacity-50 text-xs"
>
  Claim
</button>

                    {!p.exiting ? (
                      <button onClick={()=>onRequestExit(p.id)} className="px-3 py-1.5 rounded-lg bg-amber-500/80 hover:bg-amber-500 text-xs">Request exit</button>
                    ) : (
                      <button onClick={()=>onCancelExit(p.id)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-xs">Cancel exit</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center text-white/40 text-[11px]">
            <span>Contract:</span> <code className="mx-1">{STAKING_ADDRESS}</code> • <span>Token:</span> <code className="mx-1">{TOKEN_ADDRESS}</code>
          </div>
        </div>
      </div>
    </>
  );
}

/***************************************************
 * PART 8 — SMALL UI COMPONENTS (compact)
 ***************************************************/
function Stat({ label, value }) {
  return (
    <div className="rounded-lg p-2.5 bg-white/5 border border-white/10 shadow-sm">
      <div className="text-[10px] text-white/60">{label}</div>
      <div className="text-sm md:text-base font-semibold">{value ?? "—"}</div>
    </div>
  );
}
function Info({ label, value }) {
  return (
    <div className="rounded-md p-2 bg-black/30 border border-white/10">
      <div className="text-[10px] text-white/60 mb-0.5">{label}</div>
      <div className="text-[13px] font-medium break-words">{value ?? "—"}</div>
    </div>
  );
}
