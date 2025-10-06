import Layout from "../components/Layout";
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import {
  useAccount, useChainId, usePublicClient, useReadContract,
  useSwitchChain, useWaitForTransactionReceipt, useWriteContract, useDisconnect,
} from "wagmi";
import { formatUnits, parseUnits, zeroAddress, maxUint256 } from "viem";

const STAKING_ADDRESS = process.env.NEXT_PUBLIC_STAKING_FIXED3Y || process.env.NEXT_PUBLIC_STAKING_FIXED3Y_ADDRESS;
const TOKEN_ADDRESS   = process.env.NEXT_PUBLIC_MLEO_TOKEN_ADDRESS;
const ENV_DECIMALS    = Number(process.env.NEXT_PUBLIC_MLEO_DECIMALS || 18);
const CHAIN_ID        = Number(process.env.NEXT_PUBLIC_CLAIM_CHAIN_ID || 97);
const BG_PATH         = "/images/staking-bg.jpg";

// Background settings like main staking page
const NAV_H_DESKTOP = 64;
const NAV_H_MOBILE  = 56;
const BG_SHIFT_DESKTOP = -160;
const BG_SHIFT_MOBILE  = -40;

const isMobile = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const bgStyle = BG_PATH
  ? {
      backgroundImage: `url("${BG_PATH}")`,
      backgroundAttachment: isMobile ? "scroll" : "fixed",
      backgroundRepeat: "no-repeat",
      backgroundSize: isMobile ? "contain" : "cover",
      backgroundPosition: `center calc(${isMobile ? NAV_H_MOBILE : NAV_H_DESKTOP}px + ${isMobile ? BG_SHIFT_MOBILE : BG_SHIFT_DESKTOP}px)`,
      backgroundColor: "#000",
    }
  : { backgroundColor: "#000" };

const ERC20_ABI = [
  { type:"function", name:"decimals",  stateMutability:"view", inputs:[], outputs:[{type:"uint8"}] },
  { type:"function", name:"symbol",    stateMutability:"view", inputs:[], outputs:[{type:"string"}] },
  { type:"function", name:"balanceOf", stateMutability:"view", inputs:[{name:"a",type:"address"}], outputs:[{type:"uint256"}] },
  { type:"function", name:"allowance", stateMutability:"view", inputs:[{name:"o",type:"address"},{name:"s",type:"address"}], outputs:[{type:"uint256"}] },
  { type:"function", name:"approve",   stateMutability:"nonpayable", inputs:[{name:"s",type:"address"},{name:"a",type:"uint256"}], outputs:[{type:"bool"}] },
];

// MLEOFixedTermStaking ABI
const LOCKER_ABI = [
  { type:"function", name:"depositsOpen",     stateMutability:"view", inputs:[], outputs:[{type:"bool"}] },
  { type:"function", name:"principalCap",     stateMutability:"view", inputs:[], outputs:[{type:"uint256"}] },
  { type:"function", name:"totalPrincipal",   stateMutability:"view", inputs:[], outputs:[{type:"uint256"}] },
  { type:"function", name:"rewardsBudget",    stateMutability:"view", inputs:[], outputs:[{type:"uint256"}] },
  { type:"function", name:"aprBps1Y",         stateMutability:"view", inputs:[], outputs:[{type:"uint16"}] },
  { type:"function", name:"aprBps3Y",         stateMutability:"view", inputs:[], outputs:[{type:"uint16"}] },
  { type:"function", name:"lockYears",        stateMutability:"view", inputs:[], outputs:[{type:"uint8"}] },
  { type:"function", name:"positionsOfOwner", stateMutability:"view", inputs:[{name:"user",type:"address"}], outputs:[{type:"uint256[]"}] },
  { type:"function", name:"positions",        stateMutability:"view", inputs:[{name:"id",type:"uint256"}], outputs:[
    {name:"owner",            type:"address"},
    {name:"principal",        type:"uint256"},
    {name:"start",            type:"uint64"},
    {name:"unlockAt",         type:"uint64"},
    {name:"interestReserved", type:"uint256"},
    {name:"claimed",          type:"bool"},
    {name:"lockYears",        type:"uint8"},
  ]},
  { type:"function", name:"previewInterest", stateMutability:"view", inputs:[{name:"principal",type:"uint256"}], outputs:[{type:"uint256"}] },
  { type:"function", name:"stake",           stateMutability:"nonpayable", inputs:[{name:"principal",type:"uint256"}], outputs:[] },
  { type:"function", name:"claim",           stateMutability:"nonpayable", inputs:[{name:"id",type:"uint256"}], outputs:[] },
];

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
const ms  = (x)=> Number(x || 0n) * 1000;
function fmt(n, d){ try{ return Number(formatUnits(n||0n, d)).toLocaleString(undefined,{maximumFractionDigits:6}); } catch{ return "0"; } }
function fmtPct(x){ try{ return `${(Number(x)||0).toLocaleString(undefined,{maximumFractionDigits:2})}%`; } catch{ return "0%"; } }

export default function StakingFixed3YPage(){
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const pc = usePublicClient();
  const { writeContractAsync: write } = useWriteContract();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  const [lastTx, setLastTx] = useState();
  useWaitForTransactionReceipt({ hash: lastTx, confirmations: 1 });

  const [decimals, setDecimals] = useState(ENV_DECIMALS);
  const [symbol, setSymbol]     = useState("MLEO");
  const [amount, setAmount]     = useState("");
  const [err, setErr]           = useState("");
  const [positions, setPositions] = useState([]);
  const [sortDesc, setSortDesc]   = useState(true);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const symRead = useReadContract({ address:TOKEN_ADDRESS, abi:ERC20_ABI, functionName:"symbol" });
  useEffect(()=>{ if(symRead.data) setSymbol(symRead.data); }, [symRead.data]);
  const decRead = useReadContract({ address:TOKEN_ADDRESS, abi:ERC20_ABI, functionName:"decimals" });
  useEffect(()=>{ if(typeof decRead.data==="number") setDecimals(decRead.data); }, [decRead.data]);

  const balRead = useReadContract({ address:TOKEN_ADDRESS, abi:ERC20_ABI, functionName:"balanceOf", args:[address||zeroAddress], query:{enabled:!!address, refetchInterval:10000}});
  const allowanceRead = useReadContract({ address:TOKEN_ADDRESS, abi:ERC20_ABI, functionName:"allowance", args:[address||zeroAddress, STAKING_ADDRESS], query:{enabled:!!address, refetchInterval:10000}});
  const balance   = balRead.data || 0n;
  const allowance = allowanceRead.data || 0n;

  const depositsOpen = useReadContract({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"depositsOpen",     query:{refetchInterval:15000}});
  const principalCap = useReadContract({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"principalCap",     query:{refetchInterval:15000}});
  const totalP       = useReadContract({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"totalPrincipal",   query:{refetchInterval:15000}});
  const rewardsBudget= useReadContract({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"rewardsBudget",    query:{refetchInterval:15000}});
  const aprBps1Y     = useReadContract({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"aprBps1Y",         query:{refetchInterval:15000}});
  const aprBps3Y     = useReadContract({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"aprBps3Y",         query:{refetchInterval:15000}});
  const lockYears    = useReadContract({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"lockYears",        query:{refetchInterval:15000}});

  const posIdsRead = useReadContract({
    address: STAKING_ADDRESS, abi: LOCKER_ABI, functionName: "positionsOfOwner",
    args: [address || zeroAddress], query: { enabled: !!address, refetchInterval: 10000 },
  });

  useEffect(()=>{
    let ignore = false;
    (async function hydrate(){
      try{
        if(!pc || !posIdsRead.data){ if(!ignore) setPositions([]); return; }
        const ids = posIdsRead.data.map(x=>BigInt(x));
        if(!ids.length){ if(!ignore) setPositions([]); return; }
        const calls = ids.map((id)=>[
          { address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"positions", args:[id] },
        ]).flat();
        const res = await pc.multicall({ contracts:calls });

        const arr = [];
        for(let i=0;i<ids.length;i++){
          const pos = res[i]?.result || [];
          arr.push({
            id: ids[i].toString(),
            principal: pos?.[1] ?? 0n,        // principal
            start:     pos?.[2] ?? 0n,        // start
            unlock:    pos?.[3] ?? 0n,        // unlockAt
            interestReserved: pos?.[4] ?? 0n, // interestReserved
            claimed:   pos?.[5] ?? false,     // claimed
            lockYears: pos?.[6] ?? 0,         // lockYears
          });
        }
        arr.sort((a,b)=> sortDesc ? Number(b.id)-Number(a.id) : Number(a.id)-Number(b.id));
        if(!ignore) setPositions(arr);
      }catch(e){ console.error(e); if(!ignore) setPositions([]); }
    })();
    return ()=>{ ignore = true; };
  }, [pc, posIdsRead.data, sortDesc, lastTx]);

  const required   = useMemo(()=>{ try{ return amount.trim()? parseUnits(amount.trim(),decimals):0n; }catch{ return 0n;}}, [amount,decimals]);
  const needApprove= useMemo(()=> allowance < required, [allowance, required]);
  const aprPct     = useMemo(()=>{
    // For Fixed Term Staking, APR is fixed (40% for 1Y, 60% for 3Y)
    const years = Number(lockYears.data || 3);
    const aprBps = years === 1 ? Number(aprBps1Y.data || 0) : Number(aprBps3Y.data || 0);
    return aprBps / 100; // Convert basis points to percentage
  }, [lockYears.data, aprBps1Y.data, aprBps3Y.data]);

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
      const tx = await write({ address:STAKING_ADDRESS, abi:LOCKER_ABI, functionName:"claim", args:[BigInt(id)] });
      setLastTx(tx);
    }catch(e){ setErr(e?.shortMessage || e?.message || "Claim failed"); }
  }
  async function onClaimAll(){
    try{ setErr(""); await ensureNetwork();
      const claimablePositions = positions.filter(p => 
        !p.claimed && 
        Number(p.unlock) <= Date.now() / 1000
      );
      if (!claimablePositions.length) throw new Error("Nothing to claim");
      
      // Claim each position individually since there's no claimMany
      for (const pos of claimablePositions) {
        await write({ address: STAKING_ADDRESS, abi: LOCKER_ABI, functionName: "claim", args: [BigInt(pos.id)] });
      }
    }catch(e){ setErr(e?.shortMessage || e?.message || "Claim all failed"); }
  }

  // Use the new background style

  return (
    <Layout page="staking-fixed3y">
      <Head><title>MLEO — Staking (Fixed 3Y)</title><meta name="robots" content="noindex" /></Head>
      <div className="text-white relative pt-[28px] md:pt-[10px]" style={{ ...bgStyle, minHeight: "100svh" }}>
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative max-w-5xl mx-auto px-3 md:px-4 py-2 md:py-4">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <div>
              <h1 className="text-lg md:text-xl font-semibold tracking-tight">Stake MLEO — Fixed 3Y Staking</h1>
              <p className="text-white/70 text-xs">3 years lock • Fixed 60% APR • No early exit</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (isConnected) {
                    setShowWalletModal(true);
                  } else {
                    openConnectModal();
                  }
                }}
                className="px-3 py-1.5 text-xs rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              >
                {isConnected ? "Connected" : "Connect"}
              </button>
              <button
                onClick={() => window.history.back()}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 transition-colors"
                title="Go back"
              >
                →
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-2.5 md:gap-3 mb-3 md:mb-4">
            <Stat label="Deposits open" value={depositsOpen.data ? "Yes" : "No"} />
            <Stat label={`Total principal (${symbol})`} value={fmt(totalP.data, decimals)} />
            <Stat label="APR (fixed)" value={fmtPct(aprPct)} />
            <Stat label={`Principal cap (${symbol})`} value={fmt(principalCap.data, decimals)} />
            <Stat label={`Rewards budget (${symbol})`} value={fmt(rewardsBudget.data, decimals)} />
            <Stat label="Lock period" value={`${lockYears.data || 3} year${(lockYears.data || 3) > 1 ? 's' : ''}`} />
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 shadow-xl p-3 md:p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base md:text-lg font-semibold">Stake</h2>
              <div className="text-[11px] text-white/60">Balance: {fmt(balance, decimals)} {symbol}</div>
            </div>

            <div className="text-[11px] text-white/50 mb-2">
              Allowance: {fmt(allowance, decimals)} {symbol} • Required: {fmt(required, decimals)} {symbol}
            </div>

            <div className="flex gap-2">
              <input value={amount} onChange={(e)=>setAmount(e.target.value)} placeholder="Amount to stake"
                className="flex-1 bg-black/35 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/30" />
              <button onClick={()=>setAmount(String(Number(formatUnits(balance||0n, decimals))))}
                className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-xs">MAX</button>
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
              <button onClick={onClaimAll} className="px-3.5 py-2 rounded-lg bg-blue-500/80 hover:bg-blue-500 disabled:opacity-50 text-xs">Claim all</button>
            </div>

            {!!err && <div className="mt-2 text-red-400 text-xs break-all">{err}</div>}
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 shadow-xl p-3 md:p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base md:text-lg font-semibold">My positions</h2>
              <button onClick={()=>setSortDesc(s=>!s)} className="px-2.5 py-1.5 rounded-md bg-white/10 border border-white/15 text-[11px]">Sort: {sortDesc ? "Newest" : "Oldest"}</button>
            </div>

            {!positions.length && <div className="text-sm text-white/60">No positions yet.</div>}

            <div className="grid gap-2.5">
              {positions.map(p=>(
                <div key={p.id} className="rounded-lg p-2.5 bg-black/30 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">ID #{p.id}</div>
                    <span className="text-[10px] px-2 py-0.5 rounded border bg-emerald-500/15 border-emerald-500/30 text-emerald-300">Locked</span>
                  </div>

                  <div className="grid md:grid-cols-4 gap-2 mt-2 text-[13px]">
                    <Info label="Principal"      value={`${fmt(p.principal, decimals)} ${symbol}`} />
                    <Info label="Interest"       value={`${fmt(p.interestReserved, decimals)} ${symbol}`} />
                    <Info label="Lock Years"     value={`${p.lockYears} year${p.lockYears > 1 ? 's' : ''}`} />
                    <Info label="Status"         value={p.claimed ? "Claimed" : "Active"} />
                    <Info label="Start"          value={p.start ? new Date(ms(p.start)).toLocaleString() : "—"} />
                    <Info label="Unlock"         value={p.unlock? new Date(ms(p.unlock)).toLocaleString() : "—"} />
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    {!p.claimed && Number(p.unlock) <= Date.now() / 1000 ? (
                      <button onClick={()=>onClaim(p.id)} className="px-3 py-1.5 rounded-lg bg-blue-500/80 hover:bg-blue-500 disabled:opacity-50 text-xs">Claim Now</button>
                    ) : (
                      <span className="px-3 py-1.5 rounded-lg bg-gray-500/30 text-xs text-gray-300">
                        {p.claimed ? "Claimed" : "Locked"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 text-center text-white/40 text-[11px]">
            <span>Contract:</span> <code className="mx-1">{STAKING_ADDRESS}</code> • <span>Token:</span> <code className="mx-1">{TOKEN_ADDRESS}</code>
          </div>
        </div>
      </div>

      {/* Wallet Status Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <div className="text-green-400 text-2xl mb-4">🟢</div>
              <h3 className="text-white text-xl font-bold mb-2">Wallet Connected</h3>
              <div className="bg-gray-800 rounded-lg p-3 mb-4">
                <div className="text-gray-300 text-sm mb-1">Address:</div>
                <div className="text-white text-sm font-mono break-all">
                  {address}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    disconnect();
                    setShowWalletModal(false);
                  }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                >
                  Disconnect
                </button>
                <button
                  onClick={() => setShowWalletModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function Stat({ label, value }){ return (<div className="rounded-lg p-2.5 bg-white/5 border border-white/10 shadow-sm"><div className="text-[10px] text-white/60">{label}</div><div className="text-sm md:text-base font-semibold">{value ?? "—"}</div></div>); }
function Info({ label, value }){ return (<div className="rounded-md p-2 bg-black/30 border border-white/10"><div className="text-[10px] text-white/60 mb-0.5">{label}</div><div className="text-[13px] font-medium break-words">{value ?? "—"}</div></div>); }
