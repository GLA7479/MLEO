// pages/mleo-mining-rush.js
// MLEO Mining Rush — merge miners, break rocks, earn coins
// Fix pack 2025-08-27 (v2): solid drag+merge (pointer+window), stable upgrade pricing,
// persistent ad cooldown (no flash on refresh), BUY/ADD disable, LVL badge, video ad.

import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";

// ---------- Identity ----------
const GAME_TITLE = "MLEO Mining Rush";
const LS_KEY     = "mleo_mining_rush_v1";

const START_WITH_MINER = true;
const AUTO_MINER_PLACEMENT = { lane: 1, slot: 1, level: 1 };
const VIDEO_AD_SRC = "/ads/ad1.mp4"; // אם יש רק mp3: "/ads/ad1.mp3"

// ---------- Emission Governor ----------
const EMIT = {
  TOTAL_TOKENS: 100_000_000_000,
  YEARS: 5,
  USERS_BASELINE: 10_000,
  COINS_PER_TOKEN: 1_000,
  OFFLINE_EFF: 0.30,
  OFFLINE_CAP_HOURS: 6,
};
const EMIT_DERIVED = (() => {
  const days = 365 * EMIT.YEARS;
  const tokensPerDay = EMIT.TOTAL_TOKENS / days;
  const tokensPerUserDay = tokensPerDay / EMIT.USERS_BASELINE;
  const coinsPerUserDay = tokensPerUserDay * EMIT.COINS_PER_TOKEN;
  const coinsPerUserMin = coinsPerUserDay / 1440;
  const dailyCapCoins   = coinsPerUserDay * 1.25;
  return { coinsPerUserMin, dailyCapCoins };
})();
function createGovernor() {
  const dayKey = () => new Date().toISOString().slice(0,10);
  const st = {
    today: dayKey(), coinsToday: 0,
    dailyCap: Math.floor(EMIT_DERIVED.dailyCapCoins),
    windowCoins: 0, windowStart: performance.now(),
    difficulty: 1.0, capReached: false,
  };
  function rollDay(){
    const k = dayKey();
    if (st.today !== k){ st.today=k; st.coinsToday=0; st.dailyCap=Math.floor(EMIT_DERIVED.dailyCapCoins); st.capReached=false; }
  }
  function award(rawCoins){
    rollDay();
    const scaled = rawCoins / st.difficulty;
    const remaining = Math.max(0, st.dailyCap - st.coinsToday);
    const add = Math.min(Math.max(0, Math.floor(scaled)), remaining);
    if (add<=0){ st.capReached=true; return 0; }
    st.coinsToday += add; st.windowCoins += add; return add;
  }
  function tick(){
    const now=performance.now(), elapsed=now-st.windowStart;
    if (elapsed>=30_000){
      const mins=elapsed/60000, rate=st.windowCoins/Math.max(mins,1e-6), target=EMIT_DERIVED.coinsPerUserMin;
      if (rate>target*1.10) st.difficulty=Math.min(st.difficulty*1.06,4.0);
      else if (rate<target*0.90) st.difficulty=Math.max(st.difficulty*0.94,0.40);
      st.windowCoins=0; st.windowStart=now;
    }
  }
  function offlineCoins(msAway){
    const minutes = Math.min(EMIT.OFFLINE_CAP_HOURS*60, Math.floor(msAway/60000));
    const coins = minutes * EMIT_DERIVED.coinsPerUserMin * EMIT.OFFLINE_EFF;
    return Math.floor(coins);
  }
  return { award, tick, offlineCoins,
    get difficulty(){return st.difficulty;}, get capReached(){return st.capReached;},
    get dailyCap(){return st.dailyCap;}, get targetPerMin(){return EMIT_DERIVED.coinsPerUserMin;} };
}

// ---------- Game Config ----------
const LANES = 4;
const SLOTS_PER_LANE = 4;
const MAX_MINERS = LANES * SLOTS_PER_LANE;

const TRACK_Y_FRACS = [0.375, 0.525, 0.675, 0.815];
const LANE_H_FRAC_DESK   = 0.19;
const LANE_H_FRAC_MOBILE = 0.20;

const BASE_DPS = 2;
const LEVEL_DPS_MUL = 1.9;
const ROCK_BASE_HP = 60;
const ROCK_HP_MUL  = 2.15;
const GOLD_FACTOR  = 0.12;

const GIFT_PHASES = [
  { durSec: 30*60, intervalSec: 20 },
  { durSec: 30*60, intervalSec: 30 },
  { durSec: 30*60, intervalSec: 40 },
  { durSec: 30*60, intervalSec: 50 },
  { durSec: 60*60, intervalSec: 60 },
];
const GIFT_CYCLE_SEC = GIFT_PHASES.reduce((a,p)=>a+p.durSec,0);
const DOG_INTERVAL_SEC = 15 * 60;
const DOG_BANK_CAP     = 6;
const AD_COOLDOWN_MS   = 10 * 60 * 1000;

// Assets
const IMG_BG    = "/images/bg-cave.png";
const IMG_MINER = "/images/leo-miner-4x.png";
const IMG_ROCK  = "/images/rock.png";
const IMG_COIN  = "/images/silver.png";
const IMG_INTRO = "/images/leo-intro.png";

const S_CLICK = "/sounds/click.mp3";
const S_MERGE = "/sounds/merge.mp3";
const S_ROCK  = "/sounds/rock.mp3";
const S_GIFT  = "/sounds/gift.mp3";

// ---------- Utils ----------
const fmt = (n) => Math.floor(n||0).toLocaleString();
const short = (n) => {
  const a = Math.abs(n||0);
  if (a>=1e12) return (n/1e12).toFixed(a<1e13?1:0)+"T";
  if (a>=1e9 ) return (n/1e9 ).toFixed(a<1e10?1:0)+"B";
  if (a>=1e6 ) return (n/1e6 ).toFixed(a<1e7 ?1:0)+"M";
  if (a>=1e3 ) return (n/1e3 ).toFixed(a<1e4 ?1:0)+"K";
  return String(Math.floor(n||0));
};
const IMG_CACHE = {};
function img(src){ if(!IMG_CACHE[src]){ const i=new Image(); i.src=src; IMG_CACHE[src]=i; } return IMG_CACHE[src]; }

// ---------- Diamond Chest roll ----------
function rollDiamondPrize() {
  const r = Math.random();
  if (r < 0.55) return Math.random()<0.5 ? "coins_x10"   : "dog+3";
  if (r < 0.85) return Math.random()<0.5 ? "coins_x100"  : "dog+5";
  return Math.random()<0.5 ? "coins_x1000" : "dog+7";
}

// ---------- Component ----------
export default function MiningRush() {
  const wrapRef   = useRef(null);
  const canvasRef = useRef(null);
  const rafRef    = useRef(0);
  const dragRef   = useRef({active:false});
  const stateRef  = useRef(null);
  const govRef    = useRef(createGovernor());

  // UI mirrors
  const [ui, setUi] = useState({ gold: 0, spawnCost: 50, dpsMult: 1, goldMult: 1, muted: false });
  const [stats, setStats] = useState({ diamonds: 0, dailyCap: govRef.current.dailyCap, capReached: false });
  const [hud, setHud] = useState({ giftReady:false, nextGiftSec: 0, giftToast:null });
  const [introOpen, setIntroOpen] = useState(true);
  const [howOpen, setHowOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(true);
  const [isDesktop,  setIsDesktop]  = useState(false);

  // Ad gift
  const [adOpen, setAdOpen] = useState(false);
  const [adUntil, setAdUntil] = useState(0);
const [adLoaded, setAdLoaded] = useState(false);
const [mounted, setMounted] = useState(false);
  const adRemainMs = Math.max(0, adUntil - Date.now());
  const addDisabled = !adLoaded || adRemainMs > 0;

  const play = (src)=>{ if(ui.muted || !src) return; try{ const a=new Audio(src); a.volume=0.4; a.play().catch(()=>{});}catch{} };

  // ----- State -----
  const newRock = (lane, idx)=>({ lane, idx, maxHp: Math.floor(ROCK_BASE_HP*Math.pow(ROCK_HP_MUL, idx)), hp: Math.floor(ROCK_BASE_HP*Math.pow(ROCK_HP_MUL, idx)) });
  const newState = ()=>{
    const now=Date.now();
    return {
      lanes: Array.from({length:LANES},(_,lane)=>({ slots:Array(SLOTS_PER_LANE).fill(null), rock:newRock(lane,0), rockCount:0 })),
      miners:{}, nextId:1,
      gold:0, spawnCost:50, dpsMult:1, goldMult:1,
      dpsCost: 1200, goldCost: 1400, // מחירי שדרוג יציבים (עולים רק אחרי קנייה)
      // gifts
      cycleStartAt: now, lastGiftIntervalSec:20, giftNextAt: now + 20*1000, giftReady:false,
      diamonds:0, nextDiamondPrize: rollDiamondPrize(),
      // auto-dog bank
      autoDogLastAt: now, autoDogBank:0,
      // fx
      anim:{t:0,coins:[],fx:[],hint:1},
      // session
      onceSpawned:false, paused:true, lastSeen:now, pendingOfflineGold:0,
    };
  };

  // ----- Save / Load -----
  const save = (adOverride)=>{
    const s=stateRef.current; if(!s) return;
    const adValue = (typeof adOverride === "number") ? adOverride : adUntil;
    try{
      localStorage.setItem(LS_KEY, JSON.stringify({
        lanes:s.lanes, miners:s.miners, nextId:s.nextId,
        gold:s.gold, spawnCost:s.spawnCost, dpsMult:s.dpsMult, goldMult:s.goldMult,
        dpsCost:s.dpsCost, goldCost:s.goldCost,
        cycleStartAt:s.cycleStartAt, lastGiftIntervalSec:s.lastGiftIntervalSec, giftNextAt:s.giftNextAt, giftReady:s.giftReady,
        diamonds:s.diamonds, nextDiamondPrize:s.nextDiamondPrize,
        autoDogLastAt:s.autoDogLastAt, autoDogBank:s.autoDogBank,
        onceSpawned:s.onceSpawned, lastSeen:s.lastSeen, pendingOfflineGold:s.pendingOfflineGold,
        adUntil: adValue,
      }));
      localStorage.setItem(LS_KEY+"_adUntil", String(adValue)); // גיבוי
    }catch{}
  };
  const load = ()=>{ try{ const raw=localStorage.getItem(LS_KEY); return raw?JSON.parse(raw):null; }catch{ return null; } };

  // ----- Math helpers -----
  const minerDps = (lvl,mul)=> BASE_DPS * Math.pow(LEVEL_DPS_MUL, lvl-1) * mul;
  const laneDps = (s,lane)=>{
    let d=0;
    for(let k=0;k<SLOTS_PER_LANE;k++){ const c=s.lanes[lane].slots[k]; if(!c) continue; const m=s.miners[c.id]; if(!m) continue; d += minerDps(m.level, s.dpsMult); }
    return d;
  };

  // ----- Offline simulation -----
  const simulateOffline = (seconds,s)=>{
    const capSec = Math.min(seconds, EMIT.OFFLINE_CAP_HOURS*3600);
    if (capSec<=0) return 0;
    let total = 0;
    for(let l=0;l<LANES;l++){
      let dps = laneDps(s,l); if(dps<=0) continue;
      let remain = capSec;
      while(remain>0){
        const rk = s.lanes[l].rock;
        const tBreak = rk.hp / dps;
        if (tBreak <= remain){
          total += Math.floor(rk.maxHp*GOLD_FACTOR*s.goldMult);
          const idx = s.lanes[l].rockCount + 1;
          s.lanes[l].rockCount = idx;
          s.lanes[l].rock = newRock(l, idx);
          remain -= tBreak;
        } else {
          rk.hp = Math.max(1, rk.hp - dps*remain);
          remain = 0;
        }
      }
    }
    return Math.floor(total);
  };

  // ----- Init -----
  useEffect(()=>{
    const loaded = load();
    const s = loaded ? { ...newState(), ...loaded, anim:{t:0,coins:[],fx:[],hint: loaded.onceSpawned?0:1} } : newState();

    if (!s.miners || Object.keys(s.miners).length === 0) s.onceSpawned = false;

    // ad cooldown restore – גם מהמפתח הרזרבי
    if (loaded?.adUntil != null) setAdUntil(Number(loaded.adUntil));
    else {
      const rawAd = localStorage.getItem(LS_KEY+"_adUntil");
      if (rawAd != null) setAdUntil(Number(rawAd));
    }
    setAdLoaded(true);
setMounted(true);

    const now = Date.now();
    if (loaded?.lastSeen) {
      const elapsed = Math.max(0,(now - loaded.lastSeen)/1000);
      if (elapsed>1) {
        const raw = simulateOffline(elapsed, s);
        const add = govRef.current.award(raw);
        s.pendingOfflineGold = (s.pendingOfflineGold||0) + add;
        if (add>0) setCollectOpen(true);
      }
    }
    s.lastSeen = now;

    if (!s.lastGiftIntervalSec) s.lastGiftIntervalSec = 20;
    if (!s.giftReady && now >= (s.giftNextAt||now)) s.giftReady = true;

    stateRef.current = s;
    setUi(u=>({ ...u, gold:s.gold, spawnCost:s.spawnCost, dpsMult:s.dpsMult, goldMult:s.goldMult }));
    setStats(st=>({ ...st, diamonds:s.diamonds, dailyCap: govRef.current.dailyCap, capReached: govRef.current.capReached }));

    const updateFlags = ()=>{
      const w=window.innerWidth, h=window.innerHeight;
      setIsPortrait(h>=w); setIsDesktop(w>=1024);
    };
    updateFlags();
    window.addEventListener("resize", updateFlags);
    document.addEventListener("visibilitychange", onVisibility);

    const c = canvasRef.current; if (c) setupCanvas(c);

    return ()=>{
      window.removeEventListener("resize", updateFlags);
      document.removeEventListener("visibilitychange", onVisibility);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onVisibility = ()=>{
    const s=stateRef.current; if(!s) return;
    if (document.visibilityState==="hidden") { s.lastSeen = Date.now(); save(); }
    else {
      const now = Date.now();
      const elapsed = Math.max(0,(now-(s.lastSeen||now))/1000);
      if (elapsed>1) {
        const raw = simulateOffline(elapsed, s);
        const add = govRef.current.award(raw);
        if (add>0) { s.pendingOfflineGold=(s.pendingOfflineGold||0)+add; setCollectOpen(true); }
      }
      s.lastSeen = now;
      if (!s.giftReady && now >= (s.giftNextAt||now)) { s.giftReady=true; setHud(h=>({...h,giftReady:true})); }
      save();
    }
  };

  // ----- Canvas/Loop -----
  function setupCanvas(cnv){
    const ctx = cnv.getContext("2d");
    const DPR = window.devicePixelRatio || 1;
// חשוב למובייל/ספארי: למנוע פאנינג/זום ברירת־מחדל
cnv.style.touchAction = "none";

    const resize = ()=>{
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const portrait = isPortrait && !isDesktop;
      const targetW = Math.min(rect.width, 1100);
      const targetH = portrait ? Math.max(420, Math.round(targetW*0.75)) : Math.max(420, Math.round(targetW*0.56));
      cnv.style.width = `${targetW}px`;
      cnv.style.height= `${targetH}px`;
      cnv.width  = Math.floor(targetW*DPR);
      cnv.height = Math.floor(targetH*DPR);
      ctx.setTransform(DPR,0,0,DPR,0,0);
      draw();
    };
    resize();
    window.addEventListener("resize", resize);

// ----- Pointer-based input (אמין במובייל/דסקטופ) -----
const pos = (e)=>{ const r=cnv.getBoundingClientRect(); return {x:e.clientX-r.left, y:e.clientY-r.top}; };

const onDown=(e)=>{
  e.preventDefault();
  const s=stateRef.current; if(!s || introOpen || collectOpen) return;
  const p = pos(e);

  const hit = pickMiner(p.x,p.y);
  if (hit){
    dragRef.current={active:true,id:hit.id,ox:p.x-hit.x,oy:p.y-hit.y,x:p.x,y:p.y, pointerId:e.pointerId};
    try { cnv.setPointerCapture(e.pointerId); } catch {}
    play(S_CLICK);
    return;
  } // ←←← הסוגר שהיה חסר

  const pill = pickPill(p.x,p.y);
  if (pill){ trySpawnAt(pill.lane,pill.slot); return; }
};

const onMove=(e)=>{
  if(!dragRef.current.active) return;
  e.preventDefault();
  const p=pos(e); // ←←← היה pos(e, cnv)
  dragRef.current.x=p.x-dragRef.current.ox;
  dragRef.current.y=p.y-dragRef.current.oy;
  draw();
};

const onUp=(e)=>{
  e.preventDefault();
  if(!dragRef.current.active) return;
  const s=stateRef.current; const id=dragRef.current.id; const m=s.miners[id];
  const p=pos(e); const drop = pickSlot(p.x,p.y);
  const cur=s.lanes[m.lane];

  if (drop){
    const {lane,slot}=drop;
    // אותו תא? לא מזיזים
    if (lane===m.lane && slot===m.slot){
      dragRef.current={active:false};
      try { cnv.releasePointerCapture(e.pointerId); } catch {}
      draw(); return;
    }
    const target=s.lanes[lane].slots[slot];
    if(!target){
      cur.slots[m.slot]=null; m.lane=lane; m.slot=slot; s.lanes[lane].slots[slot]={id}; save();
    } else if (target.id!==id){
      const other=s.miners[target.id];
      if (other && other.level===m.level){
        cur.slots[m.slot]=null; s.lanes[other.lane].slots[other.slot]=null;
        delete s.miners[m.id]; delete s.miners[other.id];
        const nid = s.nextId++; const merged={id:nid,level:m.level+1,lane,slot,pop:1};
        s.miners[nid]=merged; s.lanes[lane].slots[slot]={id:nid}; play(S_MERGE); save();
      }
    }
  }
  dragRef.current={active:false};
  try { cnv.releasePointerCapture(e.pointerId); } catch {}
  draw();
};


    cnv.addEventListener("pointerdown", onDown, { passive:false });
    cnv.addEventListener("pointermove", onMove, { passive:false });
    cnv.addEventListener("pointerup",   onUp,   { passive:false });

    // loop
    let last = performance.now();
    const loop=(t)=>{
      const s=stateRef.current; if(!s) return;
      const dt = Math.min(0.05, (t-last)/1000); last=t;
      s.anim.t += dt;

      // gifts timing
      const now = Date.now();
      let off = getCycleOffsetSec(s, now), acc=0, curInt=GIFT_PHASES[0].intervalSec;
      for(const ph of GIFT_PHASES){ if(off<acc+ph.durSec){ curInt=ph.intervalSec; break; } acc+=ph.durSec; }
      s.lastGiftIntervalSec = curInt;
      if(!s.giftReady && now >= (s.giftNextAt||now)){ s.giftReady=true; setHud(h=>({...h,giftReady:true})); }
      setHud(h=>({...h,nextGiftSec: Math.max(0, Math.ceil(((s.giftNextAt||now)-now)/1000))}));

      // auto-dog bank
      if (!s.autoDogLastAt) s.autoDogLastAt = now;
      const elapsed = Math.max(0, now - s.autoDogLastAt);
      const intervals = Math.floor(elapsed / (DOG_INTERVAL_SEC*1000));
      if (intervals>0){
        const room = Math.max(0, DOG_BANK_CAP - (s.autoDogBank||0));
        const add = Math.min(intervals, room);
        if (add>0) s.autoDogBank = (s.autoDogBank||0) + add;
        s.autoDogLastAt = now - (elapsed % (DOG_INTERVAL_SEC*1000));
      }

      if (!introOpen && !collectOpen){
        // DPS per lane
        for(let l=0;l<LANES;l++){
          const dps=laneDps(s,l);
          const rk=s.lanes[l].rock;
          rk.hp -= dps*dt;
          if (rk.hp <= 0){
            const raw = Math.floor(rk.maxHp*GOLD_FACTOR*s.goldMult);
            const add = govRef.current.award(raw);
            s.gold += add;
            const rr = rockRect(l, cnv);
            s.anim.coins.push({x: rr.x+rr.w*0.5, y: rr.y+rr.h*0.25, t:0, v:add});
            const idx=s.lanes[l].rockCount+1; s.lanes[l].rockCount=idx; s.lanes[l].rock=newRock(l,idx);
            play(S_ROCK); save();
          }
        }
        s.anim.coins = s.anim.coins.filter(c=>{ c.t += dt*1.2; return c.t<1; });
        govRef.current.tick();
        setStats(st=>({ ...st, diamonds:s.diamonds, dailyCap: govRef.current.dailyCap, capReached: govRef.current.capReached }));
      }

      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  // ----- Geometry & picking -----
  const boardRect = ()=>{
    const c = canvasRef.current;
    return { x:8, y:8, w:(c?.clientWidth||0)-16, h:(c?.clientHeight||0)-16 };
  };
  const laneHeight = ()=>{ const b=boardRect(); return b.h*(isDesktop?LANE_H_FRAC_DESK:LANE_H_FRAC_MOBILE); };
  const laneRect = (lane)=>{
    const b=boardRect(), h=laneHeight();
    const cy = b.y + b.h * TRACK_Y_FRACS[lane];
    const y  = Math.max(b.y, Math.min(cy - h*0.5, b.y + b.h - h));
    return { x:b.x, y, w:b.w, h };
  };
  const rockWidth = (L)=> Math.min(L.w*0.20, Math.max(56, L.h*0.68));
  const slotRect = (lane,slot)=>{
    const L=laneRect(lane), rw=rockWidth(L), cellW=(L.w - rw)/SLOTS_PER_LANE;
    return { x:L.x + slot*cellW, y:L.y, w:cellW - 4, h:L.h };
  };
  const rockRect = (lane, cnv)=>{
    const L=laneRect(lane), rw=rockWidth(L);
    const y = L.y + L.h*0.08, h = L.h*0.84;
    return { x: L.x + L.w - rw - 4, y, w: rw, h };
  };
  const pickSlot=(x,y)=>{
    for(let l=0;l<LANES;l++){ for(let s=0;s<SLOTS_PER_LANE;s++){ const r=slotRect(l,s); if(x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h) return {lane:l,slot:s}; } }
    return null;
  };
  const pickMiner=(x,y)=>{
    const s=stateRef.current; if(!s) return null;
    for(let l=0;l<LANES;l++){ for(let sl=0;sl<SLOTS_PER_LANE;sl++){
      const cell=s.lanes[l].slots[sl]; if(!cell) continue;
      const r=slotRect(l,sl); const cx=r.x+r.w*0.5, cy=r.y+r.h*0.55; const rad=Math.min(r.w,r.h)*0.48;
      const dx=x-cx, dy=y-cy; if(dx*dx+dy*dy < rad*rad) return {id:cell.id, x:cx, y:cy};
    } }
    return null;
  };
  const pillRect=(lane,slot)=>{
    const L=laneRect(lane), r=slotRect(lane,slot);
    const pw=r.w*0.36, ph=L.h*0.18, px=r.x+(r.w-pw)*0.5, py=L.y+L.h*0.5 - ph/2;
    return { x:px, y:py, w:pw, h:ph };
  };
  const pointIn=(x,y,rc)=> x>=rc.x && x<=rc.x+rc.w && y>=rc.y && y<=rc.y+rc.h;
  const pickPill=(x,y)=>{
    const s=stateRef.current; if(!s) return null;
    for(let l=0;l<LANES;l++){ for(let sl=0;sl<SLOTS_PER_LANE;sl++){
      const cell=s.lanes[l].slots[sl]; if(cell) continue; const pr=pillRect(l,sl); if(pointIn(x,y,pr)) return {lane:l,slot:sl};
    } }
    return null;
  };

  // ----- Actions -----
  const trySpawnAt = (lane,slot)=>{
    const s=stateRef.current; if(!s) return;
    if (Object.keys(s.miners).length >= MAX_MINERS) { alert("Max 16 miners."); return; }
    if (s.gold < s.spawnCost) return;
    if (s.lanes[lane].slots[slot]) return;
    const id=s.nextId++; const m={id,level: s.onceSpawned ? s.spawnLevel||1 : 1, lane,slot, pop:1};
    s.miners[id]=m; s.lanes[lane].slots[slot]={id};
    s.gold -= s.spawnCost; s.spawnCost = Math.ceil(s.spawnCost*1.12);
    s.onceSpawned = true;
    setUi(u=>({...u,gold:s.gold,spawnCost:s.spawnCost}));
    play(S_CLICK); save();
  };

  const addMiner = ()=>{
    const s=stateRef.current; if(!s) return;
    for(let l=0;l<LANES;l++){ for(let k=0;k<SLOTS_PER_LANE;k++){ if(!s.lanes[l].slots[k]){ trySpawnAt(l,k); return; } } }
  };

  const buyDps  = ()=>{
    const s=stateRef.current; if(!s) return;
    const cost = s.dpsCost;
    if (s.gold < cost) return;
    s.gold -= cost; s.dpsMult = +(s.dpsMult*1.1).toFixed(3);
    s.dpsCost = Math.ceil(s.dpsCost * 1.18);
    setUi(u=>({...u,gold:s.gold,dpsMult:s.dpsMult})); save();
  };
  const buyGold = ()=>{
    const s=stateRef.current; if(!s) return;
    const cost = s.goldCost;
    if (s.gold < cost) return;
    s.gold -= cost; s.goldMult = +(s.goldMult*1.1).toFixed(3);
    s.goldCost = Math.ceil(s.goldCost * 1.18);
    setUi(u=>({...u,gold:s.gold,goldMult:s.goldMult})); save();
  };

  const claimGift = ()=>{
    const s=stateRef.current; if(!s || !s.giftReady) return;
    const rockGain = 80; // בסיס מתנה שמרני
    const giftCoin = Math.round(rockGain * 0.10);

    if (Math.random() < 0.10){
      s.diamonds = (s.diamonds||0) + 1;
      setStats(st=>({...st, diamonds:s.diamonds }));
      play(S_GIFT); setToast("💎 +1 Diamond");
      if (s.diamonds >= 3){
        s.diamonds -= 3;
        const prize = s.nextDiamondPrize || rollDiamondPrize();
        s.nextDiamondPrize = rollDiamondPrize();
        const giveCoins = (mult,label)=>{
          const add = govRef.current.award(giftCoin * mult);
          s.gold += add; setUi(u=>({...u,gold:s.gold})); setToast(`💎 ${label} +${short(add)} coins`);
        };
        if (prize==="coins_x10")    giveCoins(10,"1000% gift");
        else if (prize==="coins_x100")  giveCoins(100,"10000% gift");
        else if (prize==="coins_x1000") giveCoins(1000,"100000% gift");
        else if (prize==="dog+3")   grantDogOrCoins(Math.max(1,(s.spawnLevel||1)+3),"Diamond Chest");
        else if (prize==="dog+5")   grantDogOrCoins(Math.max(1,(s.spawnLevel||1)+5),"Diamond Chest");
        else                        grantDogOrCoins(Math.max(1,(s.spawnLevel||1)+7),"Diamond Chest");
      }
    } else {
      let r=Math.random(); let t;
      if (r<0.60) t="coins"; else if (r<0.80) t="dog"; else if (r<0.85) t="dps"; else t="gold";
      if (t==="coins"){
        const add = govRef.current.award(giftCoin);
        s.gold += add; setUi(u=>({...u,gold:s.gold})); setToast(`🎁 +${short(add)} coins`);
      } else if (t==="dog"){
        grantDogOrCoins(Math.max(1,(stateRef.current.spawnLevel||1)-1), "Gift");
      } else if (t==="dps"){
        s.dpsMult = +(s.dpsMult*1.1).toFixed(3); setUi(u=>({...u,dpsMult:s.dpsMult})); setToast("🎁 DPS +10%");
      } else {
        s.goldMult = +(s.goldMult*1.1).toFixed(3); setUi(u=>({...u,goldMult:s.goldMult})); setToast("🎁 GOLD +10%");
      }
    }
    s.giftReady=false; scheduleNextGift(s, Date.now());
    save();
  };

  function grantDogOrCoins(targetLevel, reason){
    const s=stateRef.current; if(!s) return;
    for(let l=0;l<LANES;l++){ for(let k=0;k<SLOTS_PER_LANE;k++){
      if(!s.lanes[l].slots[k]){
        const id=s.nextId++; const m={id,level:targetLevel,lane:l,slot:k,pop:1}; s.miners[id]=m; s.lanes[l].slots[k]={id};
        setToast(`🐶 ${reason}: Dog LV ${targetLevel}`); play(S_GIFT); save(); return;
      }
    }}
    const comp = Math.max(50, Math.round((s.spawnCost||100)*1.0));
    const add = govRef.current.award(comp);
    s.gold += add; setUi(u=>({...u,gold:s.gold})); setToast(`🐶 No space — +${short(add)} coins`);
  }

  const onAdGift = ()=>{ if (addDisabled) return; setAdOpen(true); };

  const finalizeAdGift = ()=>{
    const s=stateRef.current; if(!s) return;
    const add = govRef.current.award(40); // פרס צפייה
    s.gold += add; setUi(u=>({...u,gold:s.gold})); setToast(`▶️ Ad Gift +${short(add)} coins`);
    const until = Date.now() + AD_COOLDOWN_MS;
    setAdUntil(until);
    setAdOpen(false);
    save(Number(until));                           // לקובץ ה־LS הראשי
  try { localStorage.setItem(LS_KEY+"_adUntil", String(until)); } catch {}
  };

  function scheduleNextGift(s, now=Date.now()){
    const sec = currentGiftInterval(s, now);
    s.giftNextAt = now + sec*1000;
    s.lastGiftIntervalSec = sec;
    setHud(h=>({...h,giftReady:false, nextGiftSec: sec}));
  }
  function currentGiftInterval(s, now=Date.now()){
    let off = getCycleOffsetSec(s, now), acc=0;
    for(const ph of GIFT_PHASES){ if(off<acc+ph.durSec) return ph.intervalSec; acc+=ph.durSec; }
    return GIFT_PHASES[GIFT_PHASES.length-1].intervalSec;
  }
  function getCycleOffsetSec(s, now){ normalizeCycleStart(s, now); return Math.max(0, Math.floor((now - s.cycleStartAt)/1000)); }
  function normalizeCycleStart(s, now){ if(!s.cycleStartAt) s.cycleStartAt=now; const diff=Math.max(0,Math.floor((now-s.cycleStartAt)/1000)); if(diff>=GIFT_CYCLE_SEC) s.cycleStartAt += Math.floor(diff/GIFT_CYCLE_SEC)*GIFT_CYCLE_SEC*1000; }

  // ----- UI helpers -----
  const setToast = (text, ms=3000)=>{ const id=Math.random().toString(36).slice(2); setHud(h=>({...h,giftToast:{text,id}})); setTimeout(()=>{ setHud(h=> h.giftToast && h.giftToast.id===id ? {...h,giftToast:null} : h ); }, ms); };
  const onCollectOffline = ()=>{
    const s=stateRef.current; if(!s) return;
    const add = s.pendingOfflineGold||0;
    if (add>0){ s.gold += add; s.pendingOfflineGold=0; setUi(u=>({...u,gold:s.gold})); save(); }
    setCollectOpen(false);
  };

  // ----- Drawing -----
  function draw(){
    const c=canvasRef.current; if(!c) return; const ctx=c.getContext("2d"); if(!ctx) return;
    const s=stateRef.current; if(!s) return;
    const b=boardRect();

    // background
    const bg=img(IMG_BG);
    if (bg.complete && bg.naturalWidth>0){
      const iw=bg.naturalWidth, ih=bg.naturalHeight, ir=iw/ih, br=b.w/b.h;
      let dw,dh; if(br>ir){ dw=b.w; dh=b.w/ir; } else { dh=b.h; dw=b.h*ir; }
      ctx.drawImage(bg, b.x+(b.w-dw)/2, b.y+(b.h-dh)/2, dw, dh);
    } else {
      ctx.fillStyle="#0b1220"; ctx.fillRect(b.x,b.y,b.w,b.h);
    }

    const pulse = 0.5 + 0.5*Math.sin((s.anim.t||0)*4);
    for(let l=0;l<LANES;l++){
      // ADD
      for(let k=0;k<SLOTS_PER_LANE;k++){
        const cell=s.lanes[l].slots[k]; if(cell) continue;
        const pr=pillRect(l,k);
        const canAfford = (s.gold>=s.spawnCost) && (Object.keys(s.miners).length<MAX_MINERS);
        drawPill(ctx, pr.x, pr.y, pr.w, pr.h, "ADD", canAfford, pulse);
      }

      // rock
      const rk=s.lanes[l].rock, rr=rockRect(l,c);
      drawRock(ctx, rr, rk);

      // miners
      for(let k=0;k<SLOTS_PER_LANE;k++){
        const cell=s.lanes[l].slots[k]; if(!cell) continue;
        drawMiner(ctx, l, k, s.miners[cell.id]);
      }
    }

    // drag ghost
    if (dragRef.current.active){
      const s0=stateRef.current; const m=s0.miners[dragRef.current.id]; if(m){
        const r=slotRect(m.lane,m.slot); const cx=dragRef.current.x ?? (r.x+r.w*0.5), cy=dragRef.current.y ?? (r.y+r.h*0.55);
        drawMinerGhost(ctx,cx,cy,m.level);
      }
    }

    // particles → HUD
    for(const cn of s.anim.coins){
      const k=cn.t, sx=cn.x, sy=cn.y, tx=110, ty=72;
      const x=sx+(tx-sx)*k, y=sy+(ty-sy)*k;
      drawCoin(ctx,x,y,1-k);
    }
  }
  function drawPill(ctx,x,y,w,h,label,enabled=true,pulse=0){
    ctx.save();
    const r=Math.min(w,h)/2;
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
    const g=ctx.createLinearGradient(x,y,x,y+h);
    if (enabled){ g.addColorStop(0,"#fef08a"); g.addColorStop(1,"#facc15"); }
    else { g.addColorStop(0,"#475569"); g.addColorStop(1,"#334155"); }
    ctx.fillStyle=g; ctx.shadowColor= enabled?`rgba(250,204,21,${0.3+0.3*pulse})`:"rgba(148,163,184,0.3)";
    ctx.shadowBlur= enabled?18:10; ctx.shadowOffsetY=2; ctx.fill(); ctx.shadowBlur=0;
    ctx.lineWidth=1.5; ctx.strokeStyle=enabled?"#a16207":"#475569"; ctx.stroke();
    ctx.fillStyle=enabled?"#111827":"#cbd5e1"; ctx.font=`bold ${Math.max(12,Math.floor(h*0.45))}px system-ui`; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(label, x+w/2, y+h/2);
    ctx.restore();
  }
  function drawRock(ctx, rect, rock){
    const pct = Math.max(0, rock.hp/rock.maxHp);
    const scale = 0.35 + 0.65*pct;
    const pad=6, fullW=rect.w-pad*2, fullH=rect.h-pad*2, rw=fullW*scale, rh=fullH*scale;
    const cx=rect.x+rect.w/2, cy=rect.y+rect.h/2, dx=cx-rw/2, dy=cy-rh/2;
    const rimg=img(IMG_ROCK);
    if (rimg.complete && rimg.naturalWidth>0) ctx.drawImage(rimg,dx,dy,rw,rh); else { ctx.fillStyle="#6b7280"; ctx.fillRect(dx,dy,rw,rh); }
    // hp bar
    const bx=rect.x+pad, by=rect.y+4, bw=fullW, bh=6;
    ctx.fillStyle="#0ea5e9"; ctx.fillRect(bx,by,bw*pct,bh);
    const gloss=ctx.createLinearGradient(0,by,0,by+bh); gloss.addColorStop(0,"rgba(255,255,255,.45)"); gloss.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=gloss; ctx.fillRect(bx,by,bw*pct,bh);
    ctx.strokeStyle="#082f49"; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh);
  }
  function drawMiner(ctx, lane, slot, m){
    const r=slotRect(lane,slot); const cx=r.x+r.w*0.5, cy=r.y+r.h*0.55; const w=Math.min(r.w,r.h)*0.84;
    const spr=img(IMG_MINER); const frame=Math.floor(((stateRef.current?.anim.t)||0)*8)%4;
    if (spr.complete && spr.naturalWidth>0){ const sw=spr.width/4, sh=spr.height; ctx.drawImage(spr, frame*sw,0,sw,sh, cx-w/2, cy-w/2, w, w); }
    else { ctx.fillStyle="#22c55e"; ctx.beginPath(); ctx.arc(cx,cy,w*0.35,0,Math.PI*2); ctx.fill(); }
    // LVL badge
    const bw=30, bh=18, bx=cx-w*0.46, by=cy-w*0.62;
    ctx.save();
    ctx.fillStyle="rgba(0,0,0,0.72)"; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle="rgba(255,255,255,0.25)"; ctx.lineWidth=1; ctx.strokeRect(bx+0.5, by+0.5, bw-1, bh-1);
    ctx.fillStyle="#fff"; ctx.font="bold 11px system-ui"; ctx.fillText(String(m.level), bx+10, by+13);
    ctx.restore();

    if (m.pop){ const k=Math.max(0,1-(stateRef.current.anim.t%1)); ctx.globalAlpha=k; ctx.fillStyle="#34d399"; ctx.font="bold 15px system-ui"; ctx.fillText(`LV ${m.level}`, cx-16, by-6); ctx.globalAlpha=1; if(k<=0.02) delete m.pop; }
  }
  function drawMinerGhost(ctx,x,y,lvl){
    const w=62, spr=img(IMG_MINER); ctx.globalAlpha=0.75;
    if (spr.complete && spr.naturalWidth>0){ const sw=spr.width/4, sh=spr.height; ctx.drawImage(spr,0,0,sw,sh, x-w/2, y-w/2, w, w); }
    else { ctx.fillStyle="#22c55e"; ctx.beginPath(); ctx.arc(x,y,26,0,Math.PI*2); ctx.fill(); }
    ctx.globalAlpha=1; ctx.fillStyle="#fff"; ctx.font="bold 12px system-ui"; ctx.fillText(String(lvl), x-6, y-22);
  }
  function drawCoin(ctx,x,y,a){
    const co=img(IMG_COIN), s=24; ctx.globalAlpha=0.45+0.55*a;
    if (co.complete && co.naturalWidth>0) ctx.drawImage(co,x-s/2,y-s/2,s,s); else { ctx.fillStyle="#fbbf24"; ctx.beginPath(); ctx.arc(x,y,s/2,0,Math.PI*2); ctx.fill(); }
    ctx.globalAlpha=1;
  }

  // ----- Render -----
  const giftBtnLabel  = hud.giftReady ? "Claim Gift" : `Gift in ~${hud.nextGiftSec}s`;
  const adRemainLabel = !adLoaded
    ? "—"
    : (addDisabled ? `${Math.floor(adRemainMs/60000)}:${String(Math.floor((adRemainMs%60000)/1000)).padStart(2,"0")}` : "Watch Ad");
  const addCanAfford  = (stateRef.current?.gold||0) >= (stateRef.current?.spawnCost||0) && Object.keys(stateRef.current?.miners||{}).length < MAX_MINERS;

  return (
    <Layout>
      <div ref={wrapRef} className="min-h-screen w-full bg-gray-900 text-white px-3 py-6 flex flex-col items-center select-none">
        {/* Title & Stats */}
        <div className="w-full max-w-6xl mb-3">
          <h1 className="text-xl font-extrabold tracking-wide text-white/90">{GAME_TITLE}</h1>
        </div>
        <div className="w-full max-w-6xl grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Stat label="Coins"     value={fmt(ui.gold)} />
          <Stat label="Spawn Cost" value={fmt(stateRef.current?.spawnCost||0)} />
          <Stat label="DPS (all)" value={fmt(Array.from({length:LANES},(_,i)=>laneDps(stateRef.current||newState(),i)).reduce((a,b)=>a+b,0))} />
          <Stat label="Diamonds"  value={fmt(stats.diamonds)} />
          <Stat label="Daily Cap" value={fmt(stats.dailyCap)} />
        </div>

        {/* Canvas */}
        <div className="w-full max-w-6xl rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-b from-black/25 to-black/10 shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
          <div className="p-3">
            <div className="rounded-2xl overflow-hidden border border-white/10">
              <canvas id="miners-canvas" ref={canvasRef} className="w-full block" style={{ aspectRatio: "16/9", touchAction:"none" }} />
            </div>
            <div className="mt-2 text-[12px] text-white/60 text-center">
              Drag miners to merge. Click “ADD” pills to buy a miner. Gifts are the only source of Diamonds.
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-bold mb-2">Miners</h3>
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/70">Buy Miner • Cost: {fmt(stateRef.current?.spawnCost||0)}</div>
              <button className="px-3 py-2 rounded-xl border border-white/15 disabled:opacity-40 hover:bg-white/10"
                      disabled={!addCanAfford} onClick={addMiner}>ADD</button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-bold mb-2">Upgrades</h3>
            <UpgradeRow label="DPS +10%"  priceEst={`~${fmt(stateRef.current?.dpsCost||0)}`}  onBuy={buyDps}
                        disabled={(stateRef.current?.gold||0) < (stateRef.current?.dpsCost||0)} />
            <UpgradeRow label="GOLD +10%" priceEst={`~${fmt(stateRef.current?.goldCost||0)}`} onBuy={buyGold}
                        disabled={(stateRef.current?.gold||0) < (stateRef.current?.goldCost||0)} />
            {stats.capReached && <div className="mt-2 text-xs text-amber-300/90">Daily cap reached — come back tomorrow!</div>}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <h3 className="font-bold mb-2">Gifts</h3>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 rounded-xl border border-white/15 disabled:opacity-40 hover:bg-white/10"
                      disabled={!hud.giftReady} onClick={()=>{ play(S_CLICK); claimGift(); }}>
                {giftBtnLabel}
              </button>
 {mounted && (
    <button className="px-3 py-2 rounded-xl border border-white/15 disabled:opacity-40 hover:bg-white/10"
            disabled={addDisabled}
            onClick={()=>{ play(S_CLICK); onAdGift(); }}>
      {adRemainLabel}
    </button>
  )}
            </div>
            <div className="text-xs text-white/60 mt-2">
              Gifts may grant Coins/Dog/DPS/GOLD. Diamonds come from Gifts only. Every 3 Diamonds opens a <b>Big Chest</b>.
            </div>
          </div>
        </div>

        {/* Intro */}
        {introOpen && (
          <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d0f14] p-6 text-center shadow-2xl">
              <img src={IMG_INTRO} alt="MLEO" className="mx-auto mb-4 w-24 h-24 rounded-full object-cover" />
              <h2 className="text-2xl font-extrabold mb-2">{GAME_TITLE}</h2>
              <p className="text-white/80 text-sm mb-4">Merge miners and break rocks to earn coins. Passive accrual (up to 6h) while you’re away.</p>
              <div className="grid grid-cols-1 gap-2 mb-3">
                <button onClick={()=>{ startGame(); }} className="w-full py-3 rounded-xl bg-yellow-400 text-black font-extrabold">CONNECT WALLET</button>
                <button onClick={()=>{ startGame(); }} className="w-full py-3 rounded-xl bg-white/10 border border-white/15 font-semibold">SKIP</button>
                <button onClick={()=>setHowOpen(true)} className="w-full py-3 rounded-xl bg-white/5 border border-white/10 font-semibold">HOW TO PLAY</button>
              </div>
              <p className="text-xs text-white/50">Wallet integration coming soon.</p>
            </div>
          </div>
        )}

        {/* How To */}
        {howOpen && (
          <div className="fixed inset-0 z-[10000] bg-black/70 flex items-center justify-center p-4" onClick={()=>setHowOpen(false)}>
            <div className="w-full max-w-lg rounded-2xl bg-[#0d0f14] border border-white/10 p-5 text-left" onClick={(e)=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold">How to Play</h3>
                <button onClick={()=>setHowOpen(false)} className="text-white/70 hover:text-white">✕</button>
              </div>
              <ul className="list-disc pl-5 space-y-2 text-sm text-white/90">
                <li>Drag miners of the same level to <b>merge</b> them.</li>
                <li>Each lane has a <b>rock</b>. Your miners continuously deal DPS to break it. Breaking a rock grants coins (governed).</li>
                <li>Use <b>ADD</b> to place miners on empty slots.</li>
                <li><b>Gifts</b> appear on a cadence and are the only source of <b>Diamonds</b>. Every 3 Diamonds open a Big Chest with a large reward.</li>
                <li>Passive accrual occurs while offline (up to 6 hours).</li>
              </ul>
            </div>
          </div>
        )}

        {/* Offline collect */}
        {collectOpen && (
          <div className="fixed inset-0 z-[10001] bg-black/70 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#0d0f14] border border-white/10 p-5 text-center">
              <h3 className="text-xl font-bold mb-2">Welcome back!</h3>
              <p className="text-sm text-white/80 mb-4">You earned coins while away.</p>
              <button onClick={onCollectOffline} className="px-4 py-3 rounded-xl bg-yellow-400 text-black font-extrabold w-full">Collect</button>
            </div>
          </div>
        )}

        {/* Ad gift modal — video */}
        {adOpen && (
          <div className="fixed inset-0 z-[10002] bg-black/80 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-[#0d0f14] border border-white/10 p-5 text-center">
              <h3 className="text-xl font-bold mb-2">Watch Ad</h3>
              <p className="text-sm text-white/70 mb-3">Watch till the end to receive a large gift.</p>
              <video
                key={String(adUntil)}
                src={VIDEO_AD_SRC}
                autoPlay
                controls
                onEnded={finalizeAdGift}
                onError={()=>setToast("⚠️ Video not found at "+VIDEO_AD_SRC)}
                style={{ width: "100%", borderRadius: 12 }}
              />
              <button onClick={()=>setAdOpen(false)} className="mt-3 text-white/70 hover:text-white">Cancel</button>
            </div>
          </div>
        )}

        {/* Toast */}
        {hud.giftToast && (
          <div className="fixed bottom-4 left-0 right-0 mx-auto w-fit px-4 py-2 rounded-xl bg-black/70 border border-white/10 text-sm">
            {hud.giftToast.text}
          </div>
        )}
      </div>
    </Layout>
  );

  // ----- small helpers -----
  function startGame(){
    const s = stateRef.current;
    if (!s) { setIntroOpen(false); return; }

    const minersCount = Object.keys(s.miners || {}).length;
    if (START_WITH_MINER && minersCount === 0) {
      const placeFreeMiner = (lane, slot, level=1) => {
        if (s.lanes[lane].slots[slot]) return false;
        const id = s.nextId++;
        s.miners[id] = { id, level, lane, slot, pop: 1 };
        s.lanes[lane].slots[slot] = { id };
        return true;
      };
      const { lane, slot, level } = AUTO_MINER_PLACEMENT;
      let ok = placeFreeMiner(lane, slot, level);
      if (!ok) {
        outer: for (let l=0; l<LANES; l++) {
          for (let k=0; k<SLOTS_PER_LANE; k++) {
            if (!s.lanes[l].slots[k]) { placeFreeMiner(l, k, level); break outer; }
          }
        }
      }
      s.onceSpawned = true;
      save();
    }

    setIntroOpen(false);
  }
}

// ---------- UI bits ----------
function Stat({label, value}) {
  return (
    <div className="p-3 rounded-2xl border border-white/10 bg-white/5">
      <div className="text-[11px] text-white/60">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
function UpgradeRow({label, priceEst, onBuy, disabled}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-white/60">Cost: {priceEst}</div>
      </div>
      <button
        onClick={onBuy}
        disabled={disabled}
        className="px-3 py-2 rounded-xl border border-white/15 disabled:opacity-40 hover:bg-white/10"
      >
        Buy
      </button>
    </div>
  );
}
