// pages/mleo-miners.js
// v4.3 — Mobile-only fullscreen, always show 4 lanes + rocks on mobile portrait,
// compact HUD, safe canvas mounting, hoisted draw* functions.

import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";

// ====== Config ======
const LANES = 4;
const SLOTS_PER_LANE = 4;
const CELL_H = 118;              // visual reference (desktop)
const PADDING = 8;
const LS_KEY = "mleoMiners_v4_3";

// Balance
const BASE_DPS = 2;
const LEVEL_DPS_MUL = 1.9;
const ROCK_BASE_HP = 60;
const ROCK_HP_MUL = 2.15;
const GOLD_FACTOR = 1.0;

// Assets
const IMG_MINER = "/images/leo-miner-4x.png";
const IMG_ROCK  = "/images/rock.png";
const IMG_COIN  = "/images/coin.png";
const IMG_BG    = "/images/bg-cave.png";

const S_CLICK = "/sounds/click.mp3";
const S_MERGE = "/sounds/merge.mp3";
const S_ROCK  = "/sounds/rock.mp3";

export default function MleoMiners() {
  const wrapRef   = useRef(null);
  const canvasRef = useRef(null);
  const rafRef    = useRef(0);
  const dragRef   = useRef({ active:false });
  const stateRef  = useRef(null);

  const [ui, setUi] = useState({ gold: 0, spawnCost: 50, dpsMult: 1, goldMult: 1, muted: false });

  // viewport flags
  const [isPortrait, setIsPortrait] = useState(true);
  const [isDesktop,  setIsDesktop]  = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  // flow
  const [showIntro, setShowIntro] = useState(true);
  const [playerName, setPlayerName] = useState("");
  const [gamePaused, setGamePaused] = useState(true);

  // ===== Helpers =====
  const play = (src) => {
    if (ui.muted || !src) return;
    try { const a = new Audio(src); a.volume = 0.35; a.play().catch(() => {}); } catch {}
  };

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
  });

  const save = () => {
    const s = stateRef.current; if (!s) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        lanes: s.lanes, miners: s.miners, nextId: s.nextId,
        gold: s.gold, spawnCost: s.spawnCost, dpsMult: s.dpsMult, goldMult: s.goldMult,
        muted: ui.muted, onceSpawned: s.onceSpawned
      }));
    } catch {}
  };
  const load = () => {
    try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  };

  // ===== Fullscreen + Orientation lock (mobile only) =====
  const enterFullscreenAndLockMobile = async () => {
    try {
      const w = window.innerWidth, desktop = w >= 1024;
      if (desktop) return; // only mobile
      const el = wrapRef.current;
      if (el && el.requestFullscreen) await el.requestFullscreen();
      if (screen.orientation?.lock) { try { await screen.orientation.lock("portrait-primary"); } catch {} }
    } catch {}
  };
  const exitFullscreenIfAny = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
  };

  // ===== Init & Resize =====
  useEffect(() => {
    const s = load();
    const init = s ? { ...newState(), ...s, anim: { t: 0, coins: [], hint: s.onceSpawned ? 0 : 1 } } : newState();
    stateRef.current = init;
    setUi((u) => ({ ...u, gold: init.gold, spawnCost: init.spawnCost, dpsMult: init.dpsMult, goldMult: init.goldMult, muted: s?.muted || false }));

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

    // Prevent page scroll while dragging on canvas
    const preventTouchScroll = (e) => { if (e.target.closest?.("#miners-canvas")) e.preventDefault(); };
    document.addEventListener("touchmove", preventTouchScroll, { passive: false });

    // Canvas + loop (guard if canvas not yet mounted)
    const c = canvasRef.current;
    if (!c) {
      const id = requestAnimationFrame(() => {
        const c2 = canvasRef.current; if (!c2) return;
        const cleanup = setupCanvasAndLoop(c2);
        // put cleanup on ref so unmount catches it
        (rafRef.current) = (rafRef.current || 0);
      });
      return () => cancelAnimationFrame(id);
    }
    const cleanupCanvas = setupCanvasAndLoop(c);

    return () => {
      if (cleanupCanvas) cleanupCanvas();
      window.removeEventListener("resize", updateViewportFlags);
      window.removeEventListener("orientationchange", updateViewportFlags);
      document.removeEventListener("fullscreenchange", updateViewportFlags);
      document.removeEventListener("touchmove", preventTouchScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.muted, isMobileLandscape, gamePaused, isDesktop, isPortrait]);

  // Setup safely
  function setupCanvasAndLoop(cnv) {
    const ctx = cnv.getContext("2d"); if (!ctx) return;
    const DPR = window.devicePixelRatio || 1;

    const resize = () => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();

      // === MOBILE PORTRAIT ===
      if (!isDesktop && isPortrait) {
        // פחות מקום ל-HUD/כפתורים כדי להבטיח 4 מסילות + סלעים
        const HUD_RESERVED = 150; // קומפקטי יותר
        const availableH = Math.max(320, window.innerHeight - HUD_RESERVED);
        // הפוך את הקנבס כך שארבע המסילות תמיד ייכנסו
        cnv.style.width  = "100%";
        cnv.style.height = `${availableH}px`;

        const targetW = rect.width;
        const targetH = availableH;

        cnv.width  = Math.floor(targetW * DPR);
        cnv.height = Math.floor(targetH * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        stateRef.current.portrait = true;
        draw();
        return;
      }

      // === DESKTOP or MOBILE LANDSCAPE (blocked visually anyway) ===
      const targetW = Math.min(rect.width, 1024);
      const desiredH = Math.min(rect.height - 160, LANES * CELL_H + PADDING * 2); // 4:3ish
      const targetH = Math.max(420, desiredH);

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

    // Input handlers
    const onDown = (e) => {
      if (isMobileLandscape || gamePaused) return;
      const p = pos(e);
      const hit = pickMiner(p.x, p.y);
      if (hit) {
        dragRef.current = { active: true, id: hit.id, ox: p.x - hit.x, oy: p.y - hit.y };
        stateRef.current.anim.hint = 0;
        play(S_CLICK);
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
      dragRef.current = { active: false };
      draw();
    };

    cnv.addEventListener("mousedown", onDown);
    cnv.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    cnv.addEventListener("touchstart", (e) => { onDown(e.touches[0]); e.preventDefault(); }, { passive:false });
    cnv.addEventListener("touchmove",  (e) => { onMove(e.touches[0]); e.preventDefault(); }, { passive:false });
    cnv.addEventListener("touchend",   (e) => { onUp(e.changedTouches[0]); e.preventDefault(); }, { passive:false });

    // Game loop
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      tick(dt);
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    // cleanup
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

  // ===== Geometry =====
  const boardRect = () => {
    const c = canvasRef.current;
    return { x: PADDING, y: PADDING, w: (c?.clientWidth || 0) - PADDING * 2, h: (c?.clientHeight || 0) - PADDING * 2 };
  };
  const laneRect = (lane) => {
    const b = boardRect();
    // בנייד – מסילות צמודות יותר כדי שיכנסו 4
    const gap = stateRef.current.portrait ? 3 : 10;
    const h = Math.max(0, (b.h - (LANES - 1) * gap) / LANES);
    const y = b.y + lane * (h + gap);
    return { x: b.x, y, w: b.w, h };
  };
  // סלע מעט צר יותר + קשור לגובה המסילה (כדי שתמיד יראו אותו)
  const rockWidth = (L) => Math.min(L.w * 0.24, Math.max(70, L.h * 0.88));
  const slotRect = (lane, slot) => {
    const L = laneRect(lane);
    const rw = rockWidth(L);
    const cellW = (L.w - rw) / SLOTS_PER_LANE;
    return { x: L.x + slot * cellW, y: L.y, w: cellW - 5, h: L.h };
  };
  const rockRect = (lane) => {
    const L = laneRect(lane);
    const rw = rockWidth(L);
    return { x: L.x + L.w - rw - 5, y: L.y + 5, w: rw, h: L.h - 10 };
  };
  const pos = (e) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left || 0), y: e.clientY - (r?.top || 0) };
  };
  const pickSlot = (x, y) => {
    for (let l = 0; l < LANES; l++) {
      for (let s = 0; s < SLOTS_PER_LANE; s++) {
        const r = slotRect(l, s);
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { lane: l, slot: s };
      }
    }
    return null;
  };
  const pickMiner = (x, y) => {
    const st = stateRef.current;
    for (let l = 0; l < LANES; l++) {
      for (let s = 0; s < SLOTS_PER_LANE; s++) {
        const cell = st.lanes[l].slots[s];
        if (!cell) continue;
        const r = slotRect(l, s);
        const cx = r.x + r.w * 0.52, cy = r.y + r.h * 0.56;
        const rad = Math.min(r.w, r.h) * 0.34;
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy < rad * rad) return { id: cell.id, x: cx, y: cy };
      }
    }
    return null;
  };

  // ===== Game Logic =====
  const spawnMiner = (s) => {
    outer: for (let l = 0; l < LANES; l++) {
      for (let slot = 0; slot < SLOTS_PER_LANE; slot++) {
        if (!s.lanes[l].slots[slot]) {
          const id = s.nextId++;
          const m = { id, level: 1, lane: l, slot };
          s.miners[id] = m;
          s.lanes[l].slots[slot] = { id };
          break outer;
        }
      }
    }
  };
  const addMiner = () => {
    const s = stateRef.current;
    if (s.gold < s.spawnCost) return;
    spawnMiner(s);
    s.gold -= s.spawnCost;
    s.spawnCost = Math.ceil(s.spawnCost * 1.12);
    s.anim.hint = 0;
    setUi((u) => ({ ...u, gold: s.gold, spawnCost: s.spawnCost }));
    play(S_CLICK);
    save();
  };
  const upgradeDps = () => {
    const s = stateRef.current;
    const cost = Math.ceil(160 * Math.pow(1.22, Math.round((s.dpsMult - 1) * 10)));
    if (s.gold < cost) return;
    s.gold -= cost; s.dpsMult = +(s.dpsMult * 1.1).toFixed(3);
    setUi((u)=>({...u,gold:s.gold})); save();
  };
  const upgradeGold= () => {
    const s = stateRef.current;
    const cost = Math.ceil(160 * Math.pow(1.22, Math.round((s.goldMult - 1) * 10)));
    if (s.gold < cost) return;
    s.gold -= cost; s.goldMult = +(s.goldMult * 1.1).toFixed(3);
    setUi((u)=>({...u,gold:s.gold})); save();
  };

  const onAdd    = () => { play(S_CLICK); alert("ADD (Digital wallet) — coming soon 🤝"); };
  const onColect = () => { play(S_CLICK); alert("COLECT (Digital wallet) — coming soon 🪙"); };

  const tick = (dt) => {
    const s = stateRef.current;
    s.anim.t += dt;
    s.paused = gamePaused;
    if (s.paused) return;

    // conveyors
    for (let l = 0; l < LANES; l++) {
      s.lanes[l].beltShift = (s.lanes[l].beltShift + dt * 120) % 48;
    }

    // damage rocks
    for (let l = 0; l < LANES; l++) {
      let dps = 0;
      for (let k = 0; k < SLOTS_PER_LANE; k++) {
        const cell = s.lanes[l].slots[k];
        if (!cell) continue;
        const m = s.miners[cell.id];
        dps += minerDps(m.level, s.dpsMult);
      }
      const rock = s.lanes[l].rock;
      rock.hp -= dps * dt;
      if (rock.hp <= 0) {
        const gain = Math.floor(rock.maxHp * GOLD_FACTOR * s.goldMult);
        s.gold += gain; setUi((u) => ({ ...u, gold: s.gold }));
        const rr = rockRect(l);
        s.anim.coins.push({ x: rr.x + rr.w * 0.5, y: rr.y + rr.h * 0.25, t: 0, v: gain });
        const idx = s.lanes[l].rockCount + 1;
        s.lanes[l].rockCount = idx;
        s.lanes[l].rock = newRock(l, idx);
        play(S_ROCK);
        save();
      }
    }

    // coin animations
    s.anim.coins = s.anim.coins.filter((cn) => { cn.t += dt * 1.2; return cn.t < 1; });
  };

  // ===== Drawing (hoisted) =====
  function draw() {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const s = stateRef.current; if (!s) return;
    const b = boardRect();

    drawBgCover(ctx, b);

    for (let l = 0; l < LANES; l++) {
      const L = laneRect(l);

      // conveyor base
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(L.x, L.y + L.h * 0.68, L.w, L.h * 0.22);

      // segmented plates
      ctx.save();
      ctx.beginPath();
      ctx.rect(L.x, L.y + L.h * 0.68, L.w, L.h * 0.22);
      ctx.clip();
      const shift = s.lanes[l].beltShift;
      for (let x = L.x - (shift % 48); x < L.x + L.w + 48; x += 48) {
        ctx.fillStyle = "#2e3a4d";
        ctx.fillRect(x, L.y + L.h * 0.68, 28, L.h * 0.22);
      }
      ctx.restore();

      // slot pads
      for (let sidx = 0; sidx < SLOTS_PER_LANE; sidx++) {
        const r = slotRect(l, sidx);
        const padY = L.y + L.h * 0.5;
        ctx.fillStyle = "rgba(15,23,42,.75)";
        ctx.fillRect(r.x + 9, padY - 8, r.w - 18, 16);
        ctx.strokeStyle = "#20304a";
        ctx.strokeRect(r.x + 9, padY - 8, r.w - 18, 16);
      }

      // rock
      const rk = s.lanes[l]?.rock;
      if (rk) drawRock(ctx, rockRect(l), rk);

      // miners
      for (let sidx = 0; sidx < SLOTS_PER_LANE; sidx++) {
        const cell = s.lanes[l].slots[sidx];
        if (!cell) continue;
        const m = s.miners[cell.id];
        if (m) drawMiner(ctx, l, sidx, m);
      }
    }

    // dragging ghost
    if (dragRef.current.active) {
      const s2 = stateRef.current;
      const m = s2.miners[dragRef.current.id];
      if (m) {
        const r = slotRect(m.lane, m.slot);
        const x = dragRef.current.x ?? (r.x + r.w * 0.52);
        const y = dragRef.current.y ?? (r.y + r.h * 0.56);
        drawMinerGhost(ctx, x, y, m.level);
      }
    }

    // coins to HUD
    for (const cn of s.anim.coins) {
      const k = cn.t, sx = cn.x, sy = cn.y, tx = 110, ty = 72;
      const x = sx + (tx - sx) * k, y = sy + (ty - sy) * k;
      drawCoin(ctx, x, y, 1 - k);
    }

    if (!s.paused && s.anim.hint) {
      const r = slotRect(0, 0);
      ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
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
      const dx = b.x + (bw - dw) / 2;
      const dy = b.y + (bh - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      const g1 = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      g1.addColorStop(0, "#0b1220"); g1.addColorStop(1, "#0c1526");
      ctx.fillStyle = g1; ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  function drawRock(ctx, rect, rock) {
    const img = new Image(); img.src = IMG_ROCK;
    const pad = 8, rw = rect.w - pad * 2, rh = rect.h - pad * 2;
    if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, rect.x + pad, rect.y + pad, rw, rh);
    else { ctx.fillStyle = "#6b7280"; ctx.fillRect(rect.x + pad, rect.y + pad, rw, rh); }

    // HP bar
    const pct = Math.max(0, rock.hp / rock.maxHp);
    const bx = rect.x + pad, by = rect.y + 6, barW = rw;
    ctx.fillStyle = "#0ea5e9"; ctx.fillRect(bx, by, barW * pct, 8);
    const gloss = ctx.createLinearGradient(0, by, 0, by + 8);
    gloss.addColorStop(0, "rgba(255,255,255,.45)"); gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss; ctx.fillRect(bx, by, barW * pct, 8);
    ctx.strokeStyle = "#082f49"; ctx.lineWidth = 1.2; ctx.strokeRect(bx, by, barW, 8);

    ctx.fillStyle = "#e5e7eb"; ctx.font = "bold 12px system-ui";
    ctx.fillText(`Rock ${rock.idx + 1}`, bx, by + 18);
  }

  function drawMiner(ctx, lane, slot, m) {
    const r = slotRect(lane, slot);
    const cx = r.x + r.w * 0.52, cy = r.y + r.h * 0.56;
    const w = Math.min(r.w, r.h) * 0.92;

    const img = new Image(); img.src = IMG_MINER;
    const frame = Math.floor((stateRef.current.anim.t * 8) % 4);

    if (img.complete && img.naturalWidth > 0) {
      const sw = img.width / 4, sh = img.height;
      ctx.drawImage(img, frame * sw, 0, sw, sh, cx - w/2, cy - w/2, w, w);
    } else {
      ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(cx, cy, w * 0.35, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(cx - w*0.5, cy - w*0.62, 32, 18);
    ctx.fillStyle = "#fff"; ctx.font = "bold 11px system-ui"; ctx.fillText(m.level, cx - w*0.5 + 10, cy - w*0.62 + 13);

    if (m.pop) {
      const k = Math.max(0, 1 - (stateRef.current.anim.t % 1));
      ctx.globalAlpha = k; ctx.fillStyle = "#34d399"; ctx.font = "bold 16px system-ui";
      ctx.fillText(`LV ${m.level}`, cx - 16, cy - w * 0.72); ctx.globalAlpha = 1;
      if (k <= 0.02) delete m.pop;
    }
  }

  function drawMinerGhost(ctx, x, y, lvl) {
    const w = 66; const img = new Image(); img.src = IMG_MINER;
    ctx.globalAlpha = 0.75;
    if (img.complete && img.naturalWidth > 0) {
      const sw = img.width / 4, sh = img.height;
      ctx.drawImage(img, 0, 0, sw, sh, x - w/2, y - w/2, w, w);
    } else {
      ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(x, y, 28, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.font = "bold 13px system-ui"; ctx.fillText(String(lvl), x - 6, y - 24);
  }

  function drawCoin(ctx, x, y, a) {
    const img = new Image(); img.src = IMG_COIN; const s = 26;
    ctx.globalAlpha = 0.45 + 0.55 * a;
    if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, x - s/2, y - s/2, s, s);
    else { ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(x, y, s/2, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  // ===== UI =====
  return (
    <Layout>
      <div
        ref={wrapRef}
        className="flex flex-col items-center justify-start bg-gray-900 text-white min-h-screen w-full relative overflow-hidden select-none"
      >
        {/* Landscape overlay on mobile — full black screen with message */}
        {isMobileLandscape && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black text-white text-center p-6">
            <div>
              <h2 className="text-2xl font-extrabold mb-3">Please rotate your device to portrait.</h2>
              <p className="opacity-80">Landscape is not supported.</p>
            </div>
          </div>
        )}

        {/* Intro */}
        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-[999] text-center p-6">
            <img src="/images/leo-intro.png" alt="Leo" width={200} height={200} className="mb-5" />
            <h1 className="text-3xl sm:text-4xl font-bold text-yellow-400 mb-2">⛏️ MLEO Miners</h1>
            <p className="text-sm sm:text-base text-gray-200 mb-4">Merge miners, break rocks, earn gold.</p>

            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="mb-3 px-4 py-2 rounded text-black w-56 text-center"
            />

            <button
              onClick={async () => {
                if (!playerName.trim()) return;
                try { new Audio(S_CLICK).play().then(()=>{}).catch(()=>{}); } catch {}
                const s = stateRef.current;
                if (!s.onceSpawned) { spawnMiner(s); s.onceSpawned = true; save(); }
                setShowIntro(false);
                setGamePaused(false);
                await enterFullscreenAndLockMobile(); // רק בנייד
              }}
              disabled={!playerName.trim()}
              className={`px-7 py-3 font-bold rounded-lg text-lg shadow-lg transition ${
                playerName.trim() ? "bg-yellow-400 text-black hover:scale-105" : "bg-gray-500 text-gray-300 cursor-not-allowed"
              }`}
            >
              ▶ Start Game
            </button>
          </div>
        )}

        {/* Title (קטן יותר) */}
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-2">MLEO Miners — v4.3</h1>

        {/* HUD — קומפקט בנייד */}
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

        {/* Actions — קומפקט בנייד */}
        <div className="flex gap-2 mb-2 flex-wrap justify-center text-sm">
          <button onClick={addMiner} className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold shadow">
            + Add Miner ({stateRef.current?.spawnCost ?? ui.spawnCost})
          </button>
          <button onClick={upgradeDps} className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold shadow">
            DPS +10%
          </button>
          <button onClick={upgradeGold} className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold shadow">
            Gold +10%
          </button>
          <button onClick={onAdd} className="px-3 py-1.5 rounded-xl bg-indigo-400 hover:bg-indigo-300 text-slate-900 font-bold shadow">
            ADD
          </button>
          <button onClick={onColect} className="px-3 py-1.5 rounded-xl bg-fuchsia-400 hover:bg-fuchsia-300 text-slate-900 font-bold shadow">
            COLECT
          </button>
        </div>

        {/* Canvas wrapper */}
        <div
          id="miners-canvas-wrap"
          className="w-full border border-slate-700 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            // mobile portrait: הגובה נקבע ב-JS (availableH), כאן רק מגבלות רוחב
            maxWidth: isDesktop ? "1024px" : "680px",
            aspectRatio: isDesktop ? "4 / 3" : undefined
          }}
        >
          <canvas id="miners-canvas" ref={canvasRef} className="w-full h-full block touch-none select-none" />
        </div>

        <p className="opacity-70 text-[11px] mt-2">
          4 lanes • Drag to move/merge • Break rocks → earn gold • Autosave on this device.
        </p>

        {/* Exit */}
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
