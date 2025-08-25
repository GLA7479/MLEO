// pages/mleo-miners.js
// v5.5 — Smooth UI timers, image cache (no flicker), rocks shrink with HP
//  • Smooth circular timers: steady UI pulse (~10Hz) from game loop
//  • Image cache: no per-frame new Image(), no green-dot flickers
//  • Rocks scale down with HP until break, then respawn next stage

import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";

// ====== Config ======
const LANES = 4;
const SLOTS_PER_LANE = 4;
const MAX_MINERS = LANES * SLOTS_PER_LANE; // 16 cap
const PADDING = 6;
const LS_KEY = "mleoMiners_v5_5";

// Assets
const IMG_BG    = "/images/bg-cave.png";
const IMG_MINER = "/images/leo-miner-4x.png";
const IMG_ROCK  = "/images/rock.png";
const IMG_COIN  = "/images/silver.png";

// SFX
const S_CLICK = "/sounds/click.mp3";
const S_MERGE = "/sounds/merge.mp3";
const S_ROCK  = "/sounds/rock.mp3";
const S_GIFT  = "/sounds/gift.mp3"; // optional

// Balance
const BASE_DPS = 2;
const LEVEL_DPS_MUL = 1.9;
const ROCK_BASE_HP = 60;
const ROCK_HP_MUL = 2.15;
const GOLD_FACTOR = 1.0;

// Gifts
const GIFT_INTERVAL_SEC = 60; // every minute (gameplay). Offline: can accrue max 1 ready gift.

// Auto-dog
const DOG_INTERVAL_SEC = 120; // every 2 minutes
const DOG_BANK_CAP = 6;       // can accumulate up to 6 when not playing (and also while playing if board full)

// Rail alignment (fractions of BG height)
const TRACK_Y_FRACS = [0.375, 0.525, 0.675, 0.815];
const LANE_H_FRAC_MOBILE = 0.175;
const LANE_H_FRAC_DESK   = 0.19;

// Offline cap
const OFFLINE_CAP_HOURS = 12;

// ====== *** PER-LANE KNOBS (EDIT HERE) *** ======
const ROCK_TOP_FRACS    = [0.06, 0.06, 0.06, 0.06];
const ROCK_BOTTOM_FRACS = [0.06, 0.06, 0.06, 0.06];

const MINER_Y_FRACS     = [0.56, 0.56, 0.56, 0.56];
const MINER_SIZE_FRACS  = [0.84, 0.84, 0.84, 0.84];
// =================================================

// ===== Formatting =====
const formatShort = (n) => {
  const abs = Math.abs(n || 0);
  if (abs >= 1e12) return (n / 1e12).toFixed(abs < 1e13 ? 1 : 0) + "T";
  if (abs >= 1e9)  return (n / 1e9 ).toFixed(abs < 1e10 ? 1 : 0) + "B";
  if (abs >= 1e6)  return (n / 1e6 ).toFixed(abs < 1e7  ? 1 : 0) + "M";
  if (abs >= 1e3)  return (n / 1e3 ).toFixed(abs < 1e4  ? 1 : 0) + "K";
  return String(Math.floor(n || 0));
};

// ===== Simple image cache (prevents flicker) =====
const IMG_CACHE = {};
function getImg(src) {
  if (!IMG_CACHE[src]) {
    const img = new Image();
    img.src = src;
    IMG_CACHE[src] = img;
  }
  return IMG_CACHE[src];
}

export default function MleoMiners() {
  const wrapRef   = useRef(null);
  const canvasRef = useRef(null);
  const rafRef    = useRef(0);
  const dragRef   = useRef({ active:false });
  const stateRef  = useRef(null);

  const [ui, setUi] = useState({ gold: 0, spawnCost: 50, dpsMult: 1, goldMult: 1, muted: false });

  const [isPortrait, setIsPortrait] = useState(true);
  const [isDesktop,  setIsDesktop]  = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  const [showIntro, setShowIntro] = useState(true);
  const [playerName, setPlayerName] = useState("");
  const [gamePaused, setGamePaused] = useState(true);

  // Offline collect overlay
  const [showCollect, setShowCollect] = useState(false);

  // Gift UI
  const [giftReadyFlag, setGiftReadyFlag] = useState(false);
  const [giftToast, setGiftToast] = useState(null); // {text, id}

  // Small UI pulse to keep timers smooth (re-render ~10Hz)
  const uiPulseAccumRef = useRef(0);
  const [, forceUiPulse] = useState(0);

  // ===== Helpers =====
  const play = (src) => { if (ui.muted || !src) return; try { const a = new Audio(src); a.volume = 0.35; a.play().catch(()=>{}); } catch {} };

  const laneSafe = (arr, lane, fallback) =>
    Array.isArray(arr) && arr[lane] != null ? arr[lane] : (fallback ?? arr?.[0] ?? 0);

  const newRock = (lane, idx) => {
    const hp = Math.floor(ROCK_BASE_HP * Math.pow(ROCK_HP_MUL, idx));
    return { lane, idx, maxHp: hp, hp };
  };
  const minerDps = (lvl, mul) => BASE_DPS * Math.pow(LEVEL_DPS_MUL, lvl - 1) * mul;

  const countMiners = (s) => Object.keys(s.miners).length;

  const newState = () => ({
    lanes: Array.from({ length: LANES }, (_, lane) => ({
      slots: Array(SLOTS_PER_LANE).fill(null),
      rock: newRock(lane, 0),
      rockCount: 0,
      beltShift: 0,
    })),
    miners: {},
    nextId: 1,
    gold: 0,
    spawnCost: 50,
    dpsMult: 1,
    goldMult: 1,
    anim: { t: 0, coins: [], hint: 1, fx: [] },
    onceSpawned: false,
    portrait: false,
    paused: true,

    // Purchasing & levels
    totalPurchased: 0,
    spawnLevel: 1, // 1 + floor(totalPurchased / 30)

    // OFFLINE
    lastSeen: Date.now(),
    pendingOfflineGold: 0,

    // Gifts
    giftNextAt: Date.now() + GIFT_INTERVAL_SEC * 1000,
    giftReady: false,

    // Auto-dog
    autoDogLastAt: Date.now(),
    autoDogBank: 0, // pending auto-spawns (0..6)
  });

  const save = () => {
    const s = stateRef.current; if (!s) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        // core
        lanes: s.lanes, miners: s.miners, nextId: s.nextId,
        gold: s.gold, spawnCost: s.spawnCost, dpsMult: s.dpsMult, goldMult: s.goldMult,
        muted: ui.muted, onceSpawned: s.onceSpawned,
        // offline
        lastSeen: s.lastSeen, pendingOfflineGold: s.pendingOfflineGold || 0,
        // buy-level
        totalPurchased: s.totalPurchased, spawnLevel: s.spawnLevel,
        // gifts
        giftNextAt: s.giftNextAt, giftReady: s.giftReady,
        // auto-dog
        autoDogLastAt: s.autoDogLastAt, autoDogBank: s.autoDogBank,
      }));
    } catch {}
  };
  const load = () => { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } };

  // ===== OFFLINE helpers =====
  const laneDpsSum = (s, laneIdx) => {
    let dps = 0;
    for (let k = 0; k < SLOTS_PER_LANE; k++) {
      const cell = s.lanes[laneIdx].slots[k];
      if (!cell) continue;
      const m = s.miners[cell.id];
      dps += BASE_DPS * Math.pow(LEVEL_DPS_MUL, m.level - 1) * s.dpsMult;
    }
    return dps;
  };

  const simulateOffline = (seconds, s) => {
    if (!s || seconds <= 0) return 0;
    const capSec = Math.min(seconds, OFFLINE_CAP_HOURS * 3600);
    let total = 0;

    for (let l = 0; l < LANES; l++) {
      const dps = laneDpsSum(s, l);
      if (dps <= 0) continue;
      let remain = capSec;

      while (remain > 0) {
        const rock = s.lanes[l].rock;
        const tToBreak = rock.hp / dps;
        if (tToBreak <= remain) {
          total += Math.floor(rock.maxHp * GOLD_FACTOR * s.goldMult);
          const idx = s.lanes[l].rockCount + 1;
          s.lanes[l].rockCount = idx;
          s.lanes[l].rock = newRock(l, idx);
          remain -= tToBreak;
        } else {
          rock.hp = Math.max(1, rock.hp - dps * remain);
          remain = 0;
        }
      }
    }
    return Math.floor(total);
  };

  const onOfflineCollect = () => {
    const s = stateRef.current; if (!s) return;
    const add = s.pendingOfflineGold || 0;
    if (add > 0) {
      s.gold += add;
      s.pendingOfflineGold = 0;
      setUi(u => ({ ...u, gold: s.gold }));
      save();
    }
    setShowCollect(false);
  };

  // ===== Fullscreen + Orientation lock (mobile only) =====
  const enterFullscreenAndLockMobile = async () => {
    try {
      const w = window.innerWidth, desktop = w >= 1024;
      if (desktop) return; // Mobile only
      const el = wrapRef.current;
      if (el?.requestFullscreen) await el.requestFullscreen();
      if (screen.orientation?.lock) { try { await screen.orientation.lock("portrait-primary"); } catch {} }
    } catch {}
  };
  const exitFullscreenIfAny = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {} };

  // ===== Init & Resize =====
  useEffect(() => {
    const loaded = load();
    const init = loaded ? { ...newState(), ...loaded, anim: { t: 0, coins: [], hint: loaded.onceSpawned ? 0 : 1, fx: [] } } : newState();

    // offline on boot
    const now = Date.now();
    let reward = 0;
    if (loaded?.lastSeen) {
      const elapsedSec = Math.max(0, (now - loaded.lastSeen) / 1000);
      if (elapsedSec > 1) reward = simulateOffline(elapsedSec, init);
    }
    init.lastSeen = now;
    init.pendingOfflineGold = (init.pendingOfflineGold || 0) + reward;

    // ===== OFFLINE accruals for gift & auto-dog =====
    // Gift: while away, allow at most 1 ready gift
    if (!init.giftReady && now >= (init.giftNextAt || now)) {
      init.giftReady = true;
    }

    // Auto-dog: accumulate intervals into bank up to DOG_BANK_CAP
    if (!init.autoDogLastAt) init.autoDogLastAt = now;
    const elapsedDogMs = Math.max(0, now - init.autoDogLastAt);
    const dogIntervals = Math.floor(elapsedDogMs / (DOG_INTERVAL_SEC * 1000));
    if (dogIntervals > 0) {
      init.autoDogBank = Math.min(DOG_BANK_CAP, (init.autoDogBank || 0) + dogIntervals);
      init.autoDogLastAt = init.autoDogLastAt + dogIntervals * DOG_INTERVAL_SEC * 1000;
    }

    stateRef.current = init;
    setUi((u) => ({ ...u, gold: init.gold, spawnCost: init.spawnCost, dpsMult: init.dpsMult, goldMult: init.goldMult, muted: loaded?.muted || false }));
    setGiftReadyFlag(!!init.giftReady);
    if (reward > 0) setShowCollect(true);

    const updateViewportFlags = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const portrait = h >= w;
      const desktop  = w >= 1024;
      setIsPortrait(portrait);
      setIsDesktop(desktop);
      setIsMobileLandscape(!portrait && !desktop);
      setGamePaused((p) => (!portrait && !desktop) ? true : (showIntro ? true : false));
    };
    updateViewportFlags();
    window.addEventListener("resize", updateViewportFlags);
    window.addEventListener("orientationchange", updateViewportFlags);
    document.addEventListener("fullscreenchange", updateViewportFlags);

    const preventTouchScroll = (e) => { if (e.target.closest?.("#miners-canvas")) e.preventDefault(); };
    document.addEventListener("touchmove", preventTouchScroll, { passive: false });

    const c = canvasRef.current;
    if (!c) {
      const id = requestAnimationFrame(() => { const c2 = canvasRef.current; if (!c2) return; setupCanvasAndLoop(c2); });
      return () => {
        cancelAnimationFrame(id);
        window.removeEventListener("resize", updateViewportFlags);
        window.removeEventListener("orientationchange", updateViewportFlags);
        document.removeEventListener("fullscreenchange", updateViewportFlags);
        document.removeEventListener("touchmove", preventTouchScroll);
      };
    }
    const cleanup = setupCanvasAndLoop(c);

    // visibility handlers
    const onVisibility = () => {
      const s = stateRef.current; if (!s) return;
      if (document.visibilityState === "hidden") {
        s.lastSeen = Date.now();
        save();
      } else if (document.visibilityState === "visible") {
        const now2 = Date.now();

        // OFFLINE gold
        const elapsed = Math.max(0, (now2 - (s.lastSeen || now2)) / 1000);
        if (elapsed > 1) {
          const r = simulateOffline(elapsed, s);
          s.lastSeen = now2;
          if (r > 0) {
            s.pendingOfflineGold = (s.pendingOfflineGold || 0) + r;
            setShowCollect(true);
          }
        }

        // Gift: allow at most one pending gift from away-time
        if (!s.giftReady && now2 >= (s.giftNextAt || now2)) {
          s.giftReady = true;
          setGiftReadyFlag(true);
        }

        // Auto-dog: accumulate into bank
        if (!s.autoDogLastAt) s.autoDogLastAt = now2;
        const elapsedDogMs2 = Math.max(0, now2 - s.autoDogLastAt);
        const dogIntervals2 = Math.floor(elapsedDogMs2 / (DOG_INTERVAL_SEC * 1000));
        if (dogIntervals2 > 0) {
          s.autoDogBank = Math.min(DOG_BANK_CAP, (s.autoDogBank || 0) + dogIntervals2);
          s.autoDogLastAt = s.autoDogLastAt + dogIntervals2 * DOG_INTERVAL_SEC * 1000;
        }

        save();
      }
    };
    const onHide = () => { const s = stateRef.current; if (s) { s.lastSeen = Date.now(); save(); } };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);

    return () => {
      cleanup && cleanup();
      window.removeEventListener("resize", updateViewportFlags);
      window.removeEventListener("orientationchange", updateViewportFlags);
      document.removeEventListener("fullscreenchange", updateViewportFlags);
      document.removeEventListener("touchmove", preventTouchScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.muted, isMobileLandscape, gamePaused, isDesktop, isPortrait, showIntro]);

  function setupCanvasAndLoop(cnv) {
    const ctx = cnv.getContext("2d"); if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;

    const resize = () => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();

      if (!isDesktop && isPortrait) {
        const HUD_RESERVED = 160;
        const availableH = Math.max(320, window.innerHeight - HUD_RESERVED);

        const targetW = rect.width;
        const targetH = availableH;

        cnv.style.width  = "100%";
        cnv.style.height = `${targetH}px`;
        cnv.width  = Math.floor(targetW * DPR);
        cnv.height = Math.floor(targetH * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        stateRef.current.portrait = true;
        draw();
        return;
      }

      // Desktop / other
      const targetW = Math.min(rect.width, 1024);
      const targetH = Math.max(420, Math.min(rect.height - 150, 768));
      cnv.style.width  = `${targetW}px`;
      cnv.style.height = `${targetH}px`;
      cnv.width  = Math.floor(targetW * DPR);
      cnv.height = Math.floor(targetH * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      stateRef.current.portrait = isPortrait && !isDesktop;
      draw();
    };

    window.addEventListener("resize", resize);
    resize();

    // input
    const onDown = (e) => {
      if (isMobileLandscape || gamePaused || showIntro || showCollect) return;
      const p = pos(e);
      const hit = pickMiner(p.x, p.y);
      if (hit) {
        dragRef.current = { active:true, id:hit.id, ox:p.x-hit.x, oy:p.y-hit.y };
        stateRef.current.anim.hint = 0; play(S_CLICK);
      }
    };
    const onMove = (e) => {
      if (!dragRef.current.active) return;
      const p = pos(e);
      dragRef.current.x = p.x - dragRef.current.ox;
      dragRef.current.y = p.y - dragRef.current.oy;
      draw();
    };
    const onUp = (e) => {
      if (!dragRef.current.active) return;
      const s2 = stateRef.current;
      const id = dragRef.current.id;
      const m = s2.miners[id];
      const p = pos(e);
      const drop = pickSlot(p.x, p.y);
      if (drop) {
        const { lane, slot } = drop;
        const cur = s2.lanes[m.lane];
        cur.slots[m.slot] = null;
        const target = s2.lanes[lane].slots[slot];
        if (!target) {
          m.lane = lane; m.slot = slot;
          s2.lanes[lane].slots[slot] = { id };
        } else if (target.id !== id) {
          const other = s2.miners[target.id];
          if (other && other.level === m.level) {
            cur.slots[m.slot] = null;
            s2.lanes[other.lane].slots[other.slot] = null;
            delete s2.miners[m.id]; delete s2.miners[other.id];
            const nid = s2.nextId++;
            const merged = { id: nid, level: m.level + 1, lane, slot, pop: 1 };
            s2.miners[nid] = merged;
            s2.lanes[lane].slots[slot] = { id: nid };
            play(S_MERGE);
          } else {
            cur.slots[m.slot] = { id: m.id };
          }
        }
        save();
      }
      dragRef.current = { active:false };
      draw();
    };

    cnv.addEventListener("mousedown", onDown);
    cnv.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    cnv.addEventListener("touchstart", (e)=>{ onDown(e.touches[0]); e.preventDefault(); }, {passive:false});
    cnv.addEventListener("touchmove",  (e)=>{ onMove(e.touches[0]); e.preventDefault(); }, {passive:false});
    cnv.addEventListener("touchend",   (e)=>{ onUp(e.changedTouches[0]); e.preventDefault(); }, {passive:false});

    // loop
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      tick(dt); draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      cnv.removeEventListener("mousedown", onDown);
      cnv.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      cnv.removeEventListener("touchstart", onDown);
      cnv.removeEventListener("touchmove", onMove);
      cnv.removeEventListener("touchend", onUp);
    };
  }

  // ===== Geometry aligned to background =====
  const boardRect = () => {
    const c = canvasRef.current;
    return { x:PADDING, y:PADDING, w:(c?.clientWidth||0)-PADDING*2, h:(c?.clientHeight||0)-PADDING*2 };
  };

  const laneHeight = () => {
    const b = boardRect();
    return b.h * (isDesktop ? LANE_H_FRAC_DESK : LANE_H_FRAC_MOBILE);
  };

  const laneRect = (lane) => {
    const b = boardRect();
    const h = laneHeight();
    const centerY = b.y + b.h * TRACK_Y_FRACS[lane];
    const y = Math.max(b.y, Math.min(centerY - h * 0.5, b.y + b.h - h));
    return { x:b.x, y, w:b.w, h };
  };

  const rockWidth = (L) => Math.min(L.w * 0.16, Math.max(50, L.h * 0.64));

  const slotRect = (lane, slot) => {
    const L = laneRect(lane);
    const rw = rockWidth(L);
    const cellW = (L.w - rw) / SLOTS_PER_LANE;
    return { x:L.x + slot * cellW, y:L.y, w:cellW - 4, h:L.h };
  };

  const rockRect = (lane) => {
    const L  = laneRect(lane);
    const rw = rockWidth(L);
    const top    = laneSafe(ROCK_TOP_FRACS, lane, 0.06);
    const bottom = laneSafe(ROCK_BOTTOM_FRACS, lane, 0.06);
    const y  = L.y + L.h * top;
    const h  = L.h * Math.max(0.0, 1 - top - bottom);
    return { x: L.x + L.w - rw - 4, y, w: rw, h };
  };

  const pos = (e) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left || 0), y: e.clientY - (r?.top || 0) };
  };

  const pickSlot = (x,y) => {
    for(let l=0;l<LANES;l++){
      for(let s=0;s<SLOTS_PER_LANE;s++){
        const r = slotRect(l,s);
        if (x>=r.x && x<=r.x+r.w && y>=r.y && y<=r.y+r.h) return {lane:l, slot:s};
      }
    }
    return null;
  };

  const pickMiner = (x,y) => {
    const st = stateRef.current; if (!st) return null;
    for(let l=0;l<LANES;l++){
      for(let s=0;s<SLOTS_PER_LANE;s++){
        const cell = st.lanes[l].slots[s]; if(!cell) continue;
        const r = slotRect(l,s);
        const cyFrac = laneSafe(MINER_Y_FRACS, l, 0.56);
        const cx = r.x + r.w*0.52, cy = r.y + r.h*cyFrac;
        const rad = Math.min(r.w,r.h)*0.33;
        const dx=x-cx, dy=y-cy;
        if (dx*dx + dy*dy < rad*rad) return { id:cell.id, x:cx, y:cy };
      }
    }
    return null;
  };

  // ===== Costs (dynamic) =====
  const getDpsCost = () => {
    const s = stateRef.current; if (!s) return 160;
    return Math.ceil(160 * Math.pow(1.22, Math.round((s.dpsMult - 1) * 10)));
  };
  const getGoldCost = () => {
    const s = stateRef.current; if (!s) return 160;
    return Math.ceil(160 * Math.pow(1.22, Math.round((s.goldMult - 1) * 10)));
  };

  // ===== Gift particles =====
  const spawnCoinBurst = (cx, cy, n = 24) => {
    const s = stateRef.current; if (!s) return;
    for (let i=0;i<n;i++){
      const a = (i / n) * Math.PI * 2 + Math.random()*0.2;
      const sp = 90 + Math.random()*120;
      s.anim.fx.push({
        type: "coin",
        x: cx, y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        t: 0,
        life: 0.9 + Math.random()*0.4,
        size: 18 + Math.random()*10,
      });
    }
  };

  const stepFx = (dt) => {
    const s = stateRef.current; if (!s) return;
    s.anim.fx = s.anim.fx.filter(p => {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt * 0.6;
      return p.t < p.life;
    });
  };

  const drawFx = (ctx) => {
    const s = stateRef.current; if (!s) return;
    const coinImg = getImg(IMG_COIN);
    for (const p of s.anim.fx) {
      const k = Math.min(1, p.t / p.life);
      const a = 1 - k;
      ctx.globalAlpha = 0.25 + 0.75 * a;
      if (p.type === "coin") {
        const sz = p.size * (0.8 + 0.4*Math.sin(p.t*8));
        if (coinImg.complete && coinImg.naturalWidth > 0) {
          ctx.drawImage(coinImg, p.x - sz/2, p.y - sz/2, sz, sz);
        } else {
          ctx.fillStyle="#fbbf24";
          ctx.beginPath(); ctx.arc(p.x, p.y, sz/2, 0, Math.PI*2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
  };

  // ===== Logic =====
  const spawnMiner = (s, level = 1) => {
    for(let l=0;l<LANES;l++){
      for(let slot=0; slot<SLOTS_PER_LANE; slot++){
        if(!s.lanes[l].slots[slot]){
          const id=s.nextId++; const m={id,level, lane:l,slot};
          s.miners[id]=m; s.lanes[l].slots[slot]={id};
          return true;
        }
      }
    }
    return false;
  };

  const addMiner = () => {
    const s = stateRef.current; if (!s) return;

    if (countMiners(s) >= MAX_MINERS) {
      play(S_CLICK);
      alert("Maximum 16 miners on the board.");
      return;
    }
    if (s.spawnCost == null || s.gold < s.spawnCost) return;

    const ok = spawnMiner(s, s.spawnLevel);
    if (!ok) return;

    s.gold -= s.spawnCost;
    s.spawnCost = Math.ceil(s.spawnCost*1.12);

    s.totalPurchased = (s.totalPurchased || 0) + 1;
    s.spawnLevel = 1 + Math.floor((s.totalPurchased) / 30);

    s.anim.hint = 0;
    setUi(u=>({...u, gold:s.gold, spawnCost:s.spawnCost}));
    play(S_CLICK); save();
  };

  const upgradeDps = () => {
    const s = stateRef.current; if (!s) return;
    const cost = getDpsCost(); if (s.gold < cost) return;
    s.gold -= cost; s.dpsMult = +(s.dpsMult * 1.1).toFixed(3);
    setUi(u=>({...u, gold:s.gold})); save();
  };

  const upgradeGold= () => {
    const s = stateRef.current; if (!s) return;
    const cost = getGoldCost(); if (s.gold < cost) return;
    s.gold -= cost; s.goldMult = +(s.goldMult * 1.1).toFixed(3);
    setUi(u=>({...u, gold:s.gold})); save();
  };

  const onAdd     = () => { play(S_CLICK); alert("ADD (Digital wallet) — coming soon 🤝"); };
  const onCollect = () => { play(S_CLICK); alert("COLLECT (Digital wallet) — coming soon 🪙"); };

  // Gift resolver
  const grantGift = () => {
    const s = stateRef.current; if (!s || !s.giftReady) return;

    const b = boardRect();
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;

    const roll = Math.random();
    let toastText = "";
    if (roll < 0.7) {
      const base = Math.max(50, Math.round((s.spawnCost || 100) * 0.4));
      const bonus = Math.round(base * (0.75 + Math.random()*0.5));
      s.gold += bonus;
      setUi(u=>({...u, gold:s.gold}));
      toastText = `+${formatShort(bonus)} coins`;
      spawnCoinBurst(cx, cy, 28);
    } else if (roll < 0.85) {
      s.dpsMult = +(s.dpsMult * 1.1).toFixed(3);
      toastText = "DPS +10%";
      spawnCoinBurst(cx, cy, 20);
    } else {
      s.goldMult = +(s.goldMult * 1.1).toFixed(3);
      toastText = "Gold +10%";
      spawnCoinBurst(cx, cy, 20);
    }

    play(S_GIFT);

    s.giftReady = false;
    s.giftNextAt = Date.now() + GIFT_INTERVAL_SEC * 1000;
    setGiftReadyFlag(false);

    const id = Math.random().toString(36).slice(2);
    setGiftToast({ text: `🎁 ${toastText}`, id });
    setTimeout(() => { setGiftToast(cur => (cur && cur.id === id ? null : cur)); }, 3000);

    save();
  };

  // Try to consume auto-dog bank (and/or interval tick) into actual spawns
  const tryAutoDogSpawns = () => {
    const s = stateRef.current; if (!s) return;
    while (s.autoDogBank > 0 && countMiners(s) < MAX_MINERS) {
      if (!spawnMiner(s, s.spawnLevel)) break;
      s.autoDogBank--;
    }
  };

  const tick = (dt) => {
    const s = stateRef.current; if (!s) return;
    s.anim.t += dt;
    s.paused = gamePaused || showIntro || showCollect;

    // === UI pulse: keep React timers smooth (about 10Hz) ===
    uiPulseAccumRef.current += dt;
    if (uiPulseAccumRef.current >= 0.1) {
      uiPulseAccumRef.current = 0;
      // bump a dummy state to re-render
      forceUiPulse(x => (x + 1) % 1000000);
    }

    const now = Date.now();

    // Gift timing
    if (!s.giftReady) {
      if (now >= (s.giftNextAt || now)) {
        s.giftReady = true;
        setGiftReadyFlag(true);
      }
    }

    // Auto-dog timing
    if (!s.autoDogLastAt) s.autoDogLastAt = now;
    const elapsedDogMs = Math.max(0, now - s.autoDogLastAt);
    const dogIntervals = Math.floor(elapsedDogMs / (DOG_INTERVAL_SEC * 1000));
    if (dogIntervals > 0) {
      s.autoDogBank = Math.min(DOG_BANK_CAP, (s.autoDogBank || 0) + dogIntervals);
      s.autoDogLastAt = s.autoDogLastAt + dogIntervals * DOG_INTERVAL_SEC * 1000;
      save();
    }

    if (!s.paused) tryAutoDogSpawns();

    if (s.paused) { s.lastSeen = now; return; }

    // Gameplay DPS & rocks
    for (let l=0; l<LANES; l++) {
      let dps=0;
      for (let k=0; k<SLOTS_PER_LANE; k++) {
        const cell=s.lanes[l].slots[k]; if(!cell) continue;
        const m=s.miners[cell.id]; dps += minerDps(m.level, s.dpsMult);
      }
      const rock=s.lanes[l].rock;
      rock.hp -= dps*dt;
      if (rock.hp<=0) {
        const gain=Math.floor(rock.maxHp*GOLD_FACTOR*s.goldMult);
        s.gold += gain; setUi(u=>({...u,gold:s.gold}));
        const rr=rockRect(l);
        s.anim.coins.push({ x: rr.x+rr.w*0.5, y: rr.y+rr.h*0.25, t:0, v:gain });
        const idx=s.lanes[l].rockCount+1; s.lanes[l].rockCount=idx; s.lanes[l].rock=newRock(l,idx);
        play(S_ROCK); save();
      }
    }

    s.anim.coins = s.anim.coins.filter(cn=>{ cn.t += dt*1.2; return cn.t < 1; });
    stepFx(dt);

    s.lastSeen = now;
  };

  // ===== Drawing =====
  function draw() {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const s = stateRef.current; if (!s) return;
    const b = boardRect();

    drawBgCover(ctx, b);

    for (let l=0; l<LANES; l++) {
      const L = laneRect(l);

      // slot pads
      for (let sidx=0; sidx<SLOTS_PER_LANE; sidx++) {
        const r = slotRect(l, sidx);
        const padY = L.y + L.h * 0.5;
        ctx.fillStyle   = "rgba(15,23,42,.65)";
        ctx.strokeStyle = "#20304a";
        const pw = r.w - 14, ph = Math.max(10, L.h * 0.18);
        const px = r.x + (r.w - pw) * 0.5, py = padY - ph/2;
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeRect(px, py, pw, ph);
      }

      // rock
      const rk = s.lanes[l]?.rock;
      if (rk) drawRock(ctx, rockRect(l), rk);

      // miners
      for (let sidx=0; sidx<SLOTS_PER_LANE; sidx++) {
        const cell = s.lanes[l].slots[sidx]; if (!cell) continue;
        const m = s.miners[cell.id]; if (m) drawMiner(ctx, l, sidx, m);
      }
    }

    if (dragRef.current.active) {
      const s2 = stateRef.current;
      const m = s2.miners[dragRef.current.id];
      if (m) {
        const r = slotRect(m.lane, m.slot);
        const cyFrac = laneSafe(MINER_Y_FRACS, m.lane, 0.56);
        const x = dragRef.current.x ?? (r.x + r.w*0.52);
        const y = dragRef.current.y ?? (r.y + r.h*cyFrac);
        drawMinerGhost(ctx, x, y, m.level);
      }
    }

    // HUD coin tween to top-left
    for (const cn of s.anim.coins) {
      const k = cn.t, sx = cn.x, sy = cn.y, tx = 110, ty = 72;
      const x = sx + (tx - sx) * k, y = sy + (ty - sy) * k;
      drawCoin(ctx, x, y, 1 - k);
    }

    // Particle FX
    drawFx(ctx);

    if (!s.paused && s.anim.hint) {
      const r = slotRect(0,0);
      ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 3; ctx.setLineDash([6,6]);
      ctx.strokeRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);
      ctx.setLineDash([]); ctx.fillStyle = "#c7f9cc"; ctx.font = "bold 12px system-ui";
      ctx.fillText("Drag to merge", r.x + 10, r.y + 21);
    }
  }

  function drawBgCover(ctx, b) {
    const img = getImg(IMG_BG);
    if (img.complete && img.naturalWidth > 0) {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const bw = b.w, bh = b.h;
      const ir = iw / ih, br = bw / bh;
      let dw, dh;
      if (br > ir) { dw = bw; dh = bw / ir; } else { dh = bh; dw = bh * ir; }
      const dx = b.x + (bw - dw)/2;
      const dy = b.y + (bh - dh)/2;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      const g1 = ctx.createLinearGradient(0,b.y,0,b.y+b.h);
      g1.addColorStop(0,"#0b1220"); g1.addColorStop(1,"#0c1526");
      ctx.fillStyle=g1; ctx.fillRect(b.x,b.y,b.w,b.h);
    }
  }

  function drawRock(ctx, rect, rock) {
    // shrink with HP%
    const pct = Math.max(0, rock.hp / rock.maxHp);
    const scale = 0.35 + 0.65 * pct; // from 1.0→0.35 as HP goes 100%→0%
    const img = getImg(IMG_ROCK);

    const pad = 6;
    const fullW = rect.w - pad*2;
    const fullH = rect.h - pad*2;
    const rw = fullW * scale;
    const rh = fullH * scale;
    const cx = rect.x + rect.w/2;
    const cy = rect.y + rect.h/2;
    const dx = cx - rw/2;
    const dy = cy - rh/2;

    if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, dx, dy, rw, rh);
    else { ctx.fillStyle="#6b7280"; ctx.fillRect(dx, dy, rw, rh); }

    // HP bar
    const bx = rect.x + pad, by = rect.y + 4, barW = fullW, barH = 6;
    ctx.fillStyle="#0ea5e9"; ctx.fillRect(bx, by, barW * pct, barH);
    const gloss = ctx.createLinearGradient(0,by,0,by+barH);
    gloss.addColorStop(0,"rgba(255,255,255,.45)"); gloss.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=gloss; ctx.fillRect(bx, by, barW*pct, barH);
    ctx.strokeStyle="#082f49"; ctx.lineWidth=1; ctx.strokeRect(bx, by, barW, barH);

    ctx.fillStyle="#e5e7eb"; ctx.font="bold 11px system-ui";
    ctx.fillText(`Rock ${rock.idx + 1}`, bx, by + 16);
  }

  function drawMiner(ctx, lane, slot, m) {
    const r  = slotRect(lane, slot);
    const cx = r.x + r.w*0.52;
    const cyFrac = laneSafe(MINER_Y_FRACS, lane, 0.56);
    const sizeF  = laneSafe(MINER_SIZE_FRACS, lane, 0.84);
    const cy = r.y + r.h*cyFrac;
    const w  = Math.min(r.w, r.h) * sizeF;

    const img = getImg(IMG_MINER);
    const frame = Math.floor((stateRef.current.anim.t * 8) % 4);

    if (img.complete && img.naturalWidth > 0) {
      const sw = img.width / 4, sh = img.height;
      ctx.drawImage(img, frame*sw, 0, sw, sh, cx - w/2, cy - w/2, w, w);
    } else {
      ctx.fillStyle="#22c55e"; ctx.beginPath(); ctx.arc(cx, cy, w*0.35, 0, Math.PI*2); ctx.fill();
    }

    // level tag
    ctx.fillStyle="rgba(0,0,0,.6)"; ctx.fillRect(cx - w*0.5, cy - w*0.62, 30, 16);
    ctx.fillStyle="#fff"; ctx.font="bold 10px system-ui"; ctx.fillText(m.level, cx - w*0.5 + 9, cy - w*0.62 + 12);

    if (m.pop) {
      const k = Math.max(0, 1 - (stateRef.current.anim.t % 1));
      ctx.globalAlpha = k; ctx.fillStyle="#34d399"; ctx.font="bold 15px system-ui";
      ctx.fillText(`LV ${m.level}`, cx - 14, cy - w*0.70); ctx.globalAlpha = 1;
      if (k <= 0.02) delete m.pop;
    }
  }

  function drawMinerGhost(ctx, x, y, lvl) {
    const w = 62; const img = getImg(IMG_MINER);
    ctx.globalAlpha = 0.75;
    if (img.complete && img.naturalWidth > 0) {
      const sw = img.width/4, sh = img.height;
      ctx.drawImage(img, 0, 0, sw, sh, x - w/2, y - w/2, w, w);
    } else {
      ctx.fillStyle="#22c55e"; ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1; ctx.fillStyle="#fff"; ctx.font="bold 12px system-ui"; ctx.fillText(String(lvl), x - 6, y - 22);
  }

  function drawCoin(ctx, x, y, a) {
    const img = getImg(IMG_COIN); const s = 24;
    ctx.globalAlpha = 0.45 + 0.55 * a;
    if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, x - s/2, y - s/2, s, s);
    else { ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(x, y, s/2, 0, Math.PI*2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  // ===== UI =====
  const circleStyle = (p, active=true) => ({
    background: `conic-gradient(${active ? '#facc15' : '#94a3b8'} ${Math.floor(p*360)}deg, rgba(255,255,255,0.08) 0)`,
  });

  // Progress helpers for circular timers
  const giftProgress = (() => {
    const s = stateRef.current; if (!s) return 0;
    if (s.giftReady) return 1;
    const now = Date.now();
    const total = GIFT_INTERVAL_SEC * 1000;
    const remain = Math.max(0, (s.giftNextAt || now) - now);
    return Math.max(0, Math.min(1, 1 - remain/total));
  })();

  const dogProgress = (() => {
    const s = stateRef.current; if (!s) return 0;
    if ((s.autoDogBank || 0) >= DOG_BANK_CAP) return 1;
    const now = Date.now();
    const total = DOG_INTERVAL_SEC * 1000;
    const last = s.autoDogLastAt || now;
    const elapsed = Math.max(0, now - last);
    return Math.max(0, Math.min(1, elapsed/total));
  })();

  // ===== Buy availability (render-time) =====
  const sNow = stateRef.current;
  const spawnCostNow = sNow?.spawnCost ?? ui.spawnCost;
  const dpsCostNow   = getDpsCost();
  const goldCostNow  = getGoldCost();

  const canBuyMiner = !!sNow && sNow.gold >= spawnCostNow && countMiners(sNow) < MAX_MINERS;
  const canBuyDps   = !!sNow && sNow.gold >= dpsCostNow;
  const canBuyGold  = !!sNow && sNow.gold >= goldCostNow;

  const price = (n) => formatShort(n ?? 0);

  return (
    <Layout>
      <div
        ref={wrapRef}
        className="flex flex-col items-center justify-start bg-gray-900 text-white min-h-screen w-full relative overflow-hidden select-none"
      >
        {/* Landscape overlay on mobile */}
        {isMobileLandscape && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black text-white text-center p-6">
            <div>
              <h2 className="text-2xl font-extrabold mb-3">Please rotate your device to portrait.</h2>
              <p className="opacity-80">Landscape is not supported.</p>
            </div>
          </div>
        )}

        {/* Intro (CONNECT WALLET / SKIP) */}
        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-start pt-8 bg-gray-900 z-[999] text-center p-6">
            <img src="/images/leo-intro.png" alt="Leo" width={200} height={200} className="mb-5" />
            <h1 className="text-3xl sm:text-4xl font-bold text-yellow-400 mb-2">⛏️ MLEO Miners</h1>
            <p className="text-sm sm:text-base text-gray-200 mb-4">Merge miners, break rocks, earn gold.</p>

            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="mb-4 px-4 py-2 rounded text-black w-56 text-center"
            />

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (!playerName.trim()) return;
                  play(S_CLICK);
                  alert("CONNECT WALLET — coming soon 🤝");
                  const s = stateRef.current;
                  if (s && !s.onceSpawned) { spawnMiner(s, 1); s.onceSpawned = true; save(); }
                  setShowIntro(false); setGamePaused(false);
                  await enterFullscreenAndLockMobile();
                }}
                disabled={!playerName.trim()}
                className={`px-5 py-3 font-bold rounded-lg text-base shadow transition ${
                  playerName.trim() ? "bg-indigo-400 hover:bg-indigo-300 text-black" : "bg-gray-500 text-gray-300 cursor-not-allowed"
                }`}
              >
                CONNECT WALLET
              </button>

              <button
                onClick={async () => {
                  if (!playerName.trim()) return;
                  play(S_CLICK);
                  const s = stateRef.current;
                  if (s && !s.onceSpawned) { spawnMiner(s, 1); s.onceSpawned = true; save(); }
                  setShowIntro(false); setGamePaused(false);
                  await enterFullscreenAndLockMobile();
                }}
                disabled={!playerName.trim()}
                className={`px-5 py-3 font-bold rounded-lg text-base shadow transition ${
                  playerName.trim() ? "bg-yellow-400 hover:bg-yellow-300 text-black" : "bg-gray-500 text-gray-300 cursor-not-allowed"
                }`}
              >
                SKIP
              </button>
            </div>
          </div>
        )}

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-6">
          MLEO Miners — v5.5
        </h1>

        {/* ===== Canvas wrapper ===== */}
        <div
          id="miners-canvas-wrap"
          className="relative w-full border border-slate-700 rounded-2xl overflow-hidden shadow-2xl mt-6"
          style={{ maxWidth: isDesktop ? "1024px" : "680px", aspectRatio: isDesktop ? "4 / 3" : undefined }}
        >
          <canvas id="miners-canvas" ref={canvasRef} className="w-full h-full block touch-none select-none" />

          {/* ==== TOP HUD inside canvas ==== */}
          <div className="absolute left-1/2 -translate-x-1/2 top-3 z-[6] w-[calc(100%-16px)] max-w-[980px]">
            <div className="flex gap-2 flex-wrap justify-center items-center text-sm">
              <div className="px-2 py-1 bg-black/60 rounded-lg shadow flex items-center gap-1">
                <img src={IMG_COIN} alt="coin" className="w-4 h-4" />
                <b>{formatShort(stateRef.current?.gold ?? 0)}</b>
              </div>
              <div className="px-2 py-1 bg-black/60 rounded-lg shadow">🪓 DPS x<b>{(stateRef.current?.dpsMult || 1).toFixed(2)}</b></div>
              <div className="px-2 py-1 bg-black/60 rounded-lg shadow">🟡 Gold x<b>{(stateRef.current?.goldMult || 1).toFixed(2)}</b></div>
              <div className="px-2 py-1 bg-black/60 rounded-lg shadow">🐶 Buy LV <b>{stateRef.current?.spawnLevel || 1}</b></div>

              <div className="flex items-center gap-3 ml-2">
                <div className="relative w-8 h-8 rounded-full grid place-items-center" style={circleStyle(giftProgress, true)} title="Gift every 60s (max 1 offline)">
                  <div className="w-6 h-6 rounded-full bg-black/70 grid place-items-center text-[10px] font-extrabold">🎁</div>
                </div>
                <div className="relative w-8 h-8 rounded-full grid place-items-center" style={circleStyle(dogProgress, true)} title="Auto-dog every 2m (bank up to 6)">
                  <div className="w-6 h-6 rounded-full bg-black/70 grid place-items-center text-[10px] font-extrabold">🐶</div>
                </div>
              </div>

              <button
                onClick={() => { setUi((u) => ({ ...u, muted: !u.muted })); setTimeout(save, 0); }}
                className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600"
              >
                {ui.muted ? "🔇" : "🔊"}
              </button>
            </div>

            {/* Actions row */}
            <div className="flex gap-2 mt-2 flex-wrap justify-center text-sm">
              <button
                onClick={addMiner}
                disabled={!canBuyMiner}
                className={`px-3 py-1.5 rounded-xl text-slate-900 font-bold shadow transition
                  ${canBuyMiner
                    ? "bg-emerald-500 hover:bg-emerald-400 ring-2 ring-emerald-300 shadow-[0_0_18px_rgba(16,185,129,.55)]"
                    : "bg-emerald-500 opacity-60 cursor-not-allowed"}`}
              >
                + Add Miner (LV {sNow?.spawnLevel || 1}) — {price(spawnCostNow)}
              </button>

              <button
                onClick={upgradeDps}
                disabled={!canBuyDps}
                className={`px-3 py-1.5 rounded-xl text-slate-900 font-bold shadow transition
                  ${canBuyDps
                    ? "bg-sky-500 hover:bg-sky-400 ring-2 ring-sky-300 shadow-[0_0_18px_rgba(56,189,248,.55)]"
                    : "bg-sky-500 opacity-60 cursor-not-allowed"}`}
              >
                DPS +10% (Cost {price(dpsCostNow)})
              </button>

              <button
                onClick={upgradeGold}
                disabled={!canBuyGold}
                className={`px-3 py-1.5 rounded-xl text-slate-900 font-bold shadow transition
                  ${canBuyGold
                    ? "bg-amber-400 hover:bg-amber-300 ring-2 ring-amber-300 shadow-[0_0_18px_rgba(251,191,36,.6)]"
                    : "bg-amber-400 opacity-60 cursor-not-allowed"}`}
              >
                Gold +10% (Cost {price(goldCostNow)})
              </button>

              <button onClick={onAdd} className="px-3 py-1.5 rounded-xl bg-indigo-400 hover:bg-indigo-300 text-slate-900 font-bold shadow">
                ADD
              </button>
              <button onClick={onCollect} className="px-3 py-1.5 rounded-xl bg-fuchsia-400 hover:bg-fuchsia-300 text-slate-900 font-bold shadow">
                COLLECT
              </button>
            </div>
          </div>

          {/* Toast (gift result) — INSIDE canvas & lower */}
          {giftToast && (
            <div className="absolute left-1/2 -translate-x-1/2 z-[7]" style={{ top: "200px" }}>
              <div className="px-4 py-2 rounded-xl bg-emerald-400 text-black font-extrabold shadow-lg animate-[fadeOut_3s_ease-out_forwards]">
                {giftToast.text}
              </div>
              <style jsx global>{`
                @keyframes fadeOut {
                  0% { opacity: 0; transform: translateY(-6px) scale(0.96); }
                  15% { opacity: 1; transform: translateY(0) scale(1); }
                  80% { opacity: 1; }
                  100% { opacity: 0; transform: translateY(-10px) scale(0.98); }
                }
              `}</style>
            </div>
          )}

          {/* Center Gift Button — INSIDE canvas */}
          {!showIntro && !gamePaused && !showCollect && giftReadyFlag && (
            <div className="absolute inset-0 z-[8] flex items-center justify-center pointer-events-none">
              <button
                onClick={grantGift}
                className="pointer-events-auto px-6 py-4 rounded-2xl font-extrabold text-black shadow-2xl bg-gradient-to-br from-yellow-300 to-amber-400 border border-yellow-200 hover:from-yellow-200 hover:to-amber-300 active:scale-95
                           animate-[pop_1.2s_ease-in-out_infinite] relative"
              >
                🎁 Claim Gift
                <span className="absolute -inset-2 rounded-3xl blur-3xl bg-yellow-400/30 -z-10" />
              </button>
              <style jsx global>{`
                @keyframes pop {
                  0%   { transform: translateZ(0) scale(1);    box-shadow: 0 8px 30px rgba(251,191,36,0.25); }
                  50%  { transform: translateZ(0) scale(1.04); box-shadow: 0 10px 45px rgba(251,191,36,0.35); }
                  100% { transform: translateZ(0) scale(1);    box-shadow: 0 8px 30px rgba(251,191,36,0.25); }
                }
              `}</style>
            </div>
          )}
        </div>

        {/* Help line */}
        <p className="opacity-70 text-[11px] mt-2">
          4 lanes • Drag to move/merge • Break rocks → earn gold • Autosave on this device.
        </p>

        {/* Offline COLLECT overlay */}
        {showCollect && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/85 px-6 text-center">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20 shadow-2xl max-w-sm w-full">
              <div className="flex items-center justify-center gap-2 mb-3">
                <img src={IMG_COIN} alt="coin" className="w-6 h-6" />
                <h3 className="text-xl font-extrabold text-white">While you were away…</h3>
              </div>
              <p className="text-gray-200 mb-4">
                Earned{" "}
                <b className="text-yellow-300">
                  {formatShort(stateRef.current?.pendingOfflineGold || 0)}
                </b>{" "}
                coins in the background.
              </p>
              <button
                onClick={onOfflineCollect}
                className="mx-auto px-6 py-3 rounded-xl bg-yellow-400 text-black font-extrabold text-lg shadow active:scale-95"
              >
                COLLECT
              </button>
            </div>
          </div>
        )}

        {!showIntro && (
          <button
            onClick={async () => { setShowIntro(true); setGamePaused(true); await exitFullscreenIfAny(); }}
            className="fixed top-3 right-3 px-4 py-2 bg-yellow-400 text-black font-bold rounded-lg text-sm z-[999]"
          >
            Exit
          </button>
        )}
      </div>
    </Layout>
  );
}
