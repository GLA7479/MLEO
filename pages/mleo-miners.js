// pages/mleo-miners.js
// v5.1 — Per-lane control for perfect BG fit:
//   • ROCK_TOP_FRACS[4], ROCK_BOTTOM_FRACS[4]
//   • MINER_Y_FRACS[4], MINER_SIZE_FRACS[4]
// שחק רק במערכים למטה לכל מסילה. שאר הלוגיקה זהה ל-v5.0 (כולל OFFLINE).

import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";

// ====== Config ======
const LANES = 4;
const SLOTS_PER_LANE = 4;
const PADDING = 6;
const LS_KEY = "mleoMiners_v5_1";

// Assets
const IMG_BG    = "/images/bg-cave.png";
const IMG_MINER = "/images/leo-miner-4x.png";
const IMG_ROCK  = "/images/rock.png";
const IMG_COIN  = "/images/coin.png";

// SFX
const S_CLICK = "/sounds/click.mp3";
const S_MERGE = "/sounds/merge.mp3";
const S_ROCK  = "/sounds/rock.mp3";

// Balance
const BASE_DPS = 2;
const LEVEL_DPS_MUL = 1.9;
const ROCK_BASE_HP = 60;
const ROCK_HP_MUL = 2.15;
const GOLD_FACTOR = 1.0;

// Rail alignment (fractions of BG height)
const TRACK_Y_FRACS = [0.405, 0.535, 0.695, 0.835];
const LANE_H_FRAC_MOBILE = 0.175;
const LANE_H_FRAC_DESK   = 0.19;

// Offline cap
const OFFLINE_CAP_HOURS = 12;

// ====== *** PER-LANE KNOBS (EDIT HERE) *** ======
// סלעים — רווח מלמעלה/מלמטה לכל מסילה (0..1 מתוך גובה המסילה)
const ROCK_TOP_FRACS    = [0.06, 0.06, 0.06, 0.06];
const ROCK_BOTTOM_FRACS = [0.06, 0.06, 0.06, 0.06];

// כלבים — מיקום אנכי (0=למעלה, 1=למטה) + גודל יחסי לכל מסילה
const MINER_Y_FRACS     = [0.56, 0.56, 0.56, 0.56];
const MINER_SIZE_FRACS  = [0.84, 0.84, 0.84, 0.84];
// =================================================

// ===== Component =====
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

  // ===== Helpers =====
  const play = (src) => { if (ui.muted || !src) return; try { const a = new Audio(src); a.volume = 0.35; a.play().catch(()=>{}); } catch {} };

  const laneSafe = (arr, lane, fallback) =>
    Array.isArray(arr) && arr[lane] != null ? arr[lane] : (fallback ?? arr?.[0] ?? 0);

  const newRock = (lane, idx) => {
    const hp = Math.floor(ROCK_BASE_HP * Math.pow(ROCK_HP_MUL, idx));
    return { lane, idx, maxHp: hp, hp };
  };
  const minerDps = (lvl, mul) => BASE_DPS * Math.pow(LEVEL_DPS_MUL, lvl - 1) * mul;

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
    anim: { t: 0, coins: [], hint: 1 },
    onceSpawned: false,
    portrait: false,
    paused: true,
    // OFFLINE
    lastSeen: Date.now(),
    pendingOfflineGold: 0,
  });

  const save = () => {
    const s = stateRef.current; if (!s) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        lanes: s.lanes, miners: s.miners, nextId: s.nextId,
        gold: s.gold, spawnCost: s.spawnCost, dpsMult: s.dpsMult, goldMult: s.goldMult,
        muted: ui.muted, onceSpawned: s.onceSpawned,
        lastSeen: s.lastSeen, pendingOfflineGold: s.pendingOfflineGold || 0,
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
    const init = loaded ? { ...newState(), ...loaded, anim: { t: 0, coins: [], hint: loaded.onceSpawned ? 0 : 1 } } : newState();

    // offline on boot
    const now = Date.now();
    let reward = 0;
    if (loaded?.lastSeen) {
      const elapsedSec = Math.max(0, (now - loaded.lastSeen) / 1000);
      if (elapsedSec > 1) reward = simulateOffline(elapsedSec, init);
    }
    init.lastSeen = now;
    init.pendingOfflineGold = (init.pendingOfflineGold || 0) + reward;

    stateRef.current = init;
    setUi((u) => ({ ...u, gold: init.gold, spawnCost: init.spawnCost, dpsMult: init.dpsMult, goldMult: init.goldMult, muted: loaded?.muted || false }));
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

    // visibility handlers for offline
    const onVisibility = () => {
      const s = stateRef.current; if (!s) return;
      if (document.visibilityState === "hidden") {
        s.lastSeen = Date.now();
        save();
      } else if (document.visibilityState === "visible") {
        const now2 = Date.now();
        const elapsed = Math.max(0, (now2 - (s.lastSeen || now2)) / 1000);
        if (elapsed > 1) {
          const r = simulateOffline(elapsed, s);
          s.lastSeen = now2;
          if (r > 0) {
            s.pendingOfflineGold = (s.pendingOfflineGold || 0) + r;
            setShowCollect(true);
            save();
          }
        }
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
        const HUD_RESERVED = 140;
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

  // === Per-lane rock rect with TOP/BOTTOM arrays ===
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

  // ===== Logic =====
  const spawnMiner = (s) => {
    outer: for(let l=0;l<LANES;l++){
      for(let slot=0; slot<SLOTS_PER_LANE; slot++){
        if(!s.lanes[l].slots[slot]){
          const id=s.nextId++; const m={id,level:1,lane:l,slot};
          s.miners[id]=m; s.lanes[l].slots[slot]={id}; break outer;
        }
      }
    }
  };

  const addMiner = () => {
    const s = stateRef.current; if (!s) return;
    if (s.spawnCost == null || s.gold < s.spawnCost) return;
    spawnMiner(s);
    s.gold -= s.spawnCost;
    s.spawnCost = Math.ceil(s.spawnCost*1.12);
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

  const tick = (dt) => {
    const s = stateRef.current; if (!s) return;
    s.anim.t += dt;
    s.paused = gamePaused || showIntro || showCollect;
    if (s.paused) return;

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
    s.lastSeen = Date.now();
  };

  // ===== Drawing (hoisted) =====
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

    // HUD coin tween
    for (const cn of s.anim.coins) {
      const k = cn.t, sx = cn.x, sy = cn.y, tx = 110, ty = 72;
      const x = sx + (tx - sx) * k, y = sy + (ty - sy) * k;
      drawCoin(ctx, x, y, 1 - k);
    }

    if (!s.paused && s.anim.hint) {
      const r = slotRect(0,0);
      ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 3; ctx.setLineDash([6,6]);
      ctx.strokeRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10);
      ctx.setLineDash([]); ctx.fillStyle = "#c7f9cc"; ctx.font = "bold 12px system-ui";
      ctx.fillText("Drag to merge", r.x + 10, r.y + 21);
    }
  }

  function drawBgCover(ctx, b) {
    const img = new Image(); img.src = IMG_BG;
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
    const img = new Image(); img.src = IMG_ROCK;
    const pad = 6; const rw = rect.w - pad*2; const rh = rect.h - pad*2;
    if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, rect.x+pad, rect.y+pad, rw, rh);
    else { ctx.fillStyle="#6b7280"; ctx.fillRect(rect.x+pad, rect.y+pad, rw, rh); }

    const pct = Math.max(0, rock.hp / rock.maxHp);
    const bx = rect.x + pad, by = rect.y + 4, barW = rw, barH = 6;
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

    const img = new Image(); img.src = IMG_MINER;
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
    const w = 62; const img = new Image(); img.src = IMG_MINER;
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
    const img = new Image(); img.src = IMG_COIN; const s = 24;
    ctx.globalAlpha = 0.45 + 0.55 * a;
    if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, x - s/2, y - s/2, s, s);
    else { ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(x, y, s/2, 0, Math.PI*2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  // ===== UI =====
  const disabled = !stateRef.current;

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
                  {(stateRef.current?.pendingOfflineGold || 0).toLocaleString()}
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
                  if (s && !s.onceSpawned) { spawnMiner(s); s.onceSpawned = true; save(); }
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
                  if (s && !s.onceSpawned) { spawnMiner(s); s.onceSpawned = true; save(); }
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
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-2">MLEO Miners — v5.1</h1>

        {/* HUD (compact) */}
        <div className="flex gap-2 flex-wrap justify-center items-center my-2 text-sm">
          <div className="px-2 py-1 bg-black/60 rounded-lg shadow flex items-center gap-1">
            <img src={IMG_COIN} alt="coin" className="w-4 h-4" />
            <b>{stateRef.current?.gold ?? 0}</b>
          </div>
          <div className="px-2 py-1 bg-black/60 rounded-lg shadow">🪓 DPS x<b>{(stateRef.current?.dpsMult || 1).toFixed(2)}</b></div>
          <div className="px-2 py-1 bg-black/60 rounded-lg shadow">🟡 Gold x<b>{(stateRef.current?.goldMult || 1).toFixed(2)}</b></div>
          <button onClick={() => { setUi((u) => ({ ...u, muted: !u.muted })); setTimeout(save, 0); }} className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600">
            {ui.muted ? "🔇" : "🔊"}
          </button>
        </div>

        {/* Actions (compact) */}
        <div className="flex gap-2 mb-2 flex-wrap justify-center text-sm">
          <button
            onClick={addMiner}
            disabled={disabled}
            title={disabled ? "Loading..." : ""}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 font-bold shadow"
          >
            + Add Miner ({stateRef.current?.spawnCost ?? ui.spawnCost})
          </button>

        <button
            onClick={upgradeDps}
            disabled={disabled}
            title={disabled ? "Loading..." : ""}
            className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 font-bold shadow"
          >
            DPS +10% (Cost {getDpsCost()})
          </button>

          <button
            onClick={upgradeGold}
            disabled={disabled}
            title={disabled ? "Loading..." : ""}
            className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 disabled:cursor-not-allowed text-slate-900 font-bold shadow"
          >
            Gold +10% (Cost {getGoldCost()})
          </button>

          <button onClick={onAdd} className="px-3 py-1.5 rounded-xl bg-indigo-400 hover:bg-indigo-300 text-slate-900 font-bold shadow">
            ADD
          </button>
          <button onClick={onCollect} className="px-3 py-1.5 rounded-xl bg-fuchsia-400 hover:bg-fuchsia-300 text-slate-900 font-bold shadow">
            COLLECT
          </button>
        </div>

        {/* Canvas wrapper */}
        <div
          id="miners-canvas-wrap"
          className="w-full border border-slate-700 rounded-2xl overflow-hidden shadow-2xl"
          style={{ maxWidth: isDesktop ? "1024px" : "680px", aspectRatio: isDesktop ? "4 / 3" : undefined }}
        >
          <canvas id="miners-canvas" ref={canvasRef} className="w-full h-full block touch-none select-none" />
        </div>

        <p className="opacity-70 text-[11px] mt-2">
          4 lanes • Drag to move/merge • Break rocks → earn gold • Autosave on this device.
        </p>

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
