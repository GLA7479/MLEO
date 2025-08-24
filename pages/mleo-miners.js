// pages/mleo-miners.js
// v3.6 — Portrait-only on mobile, 4 lanes, Layout-integrated, autosave, drag/merge
// Chat in Hebrew; code in EN only.

import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";

// ====== Config ======
const LANES = 4;
const SLOTS_PER_LANE = 4;
const CELL_W = 128;
const CELL_H = 118;
const PADDING = 12;
const LS_KEY = "mleoMiners_v3_6";
const ONLY_PORTRAIT_MOBILE = true;

// Balance
const BASE_DPS = 2;
const LEVEL_DPS_MUL = 1.9;
const ROCK_BASE_HP = 60;
const ROCK_HP_MUL = 2.15;
const GOLD_FACTOR = 1.0;

// Assets (place under /public/images and /public/sounds)
const IMG_MINER = "/images/leo-miner-4x.png"; // 4 frames, 1 row, transparent
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

  const [ui, setUi] = useState({
    gold: 0,
    spawnCost: 50,
    dpsMult: 1,
    goldMult: 1,
    muted: false,
  });
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);

  // ===== Helpers =====
  const play = (src) => {
    if (ui.muted || !src) return;
    try {
      const a = new Audio(src);
      a.volume = 0.35;
      a.play().catch(() => {});
    } catch {}
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
  });

  const save = () => {
    const s = stateRef.current;
    if (!s) return;
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          lanes: s.lanes,
          miners: s.miners,
          nextId: s.nextId,
          gold: s.gold,
          spawnCost: s.spawnCost,
          dpsMult: s.dpsMult,
          goldMult: s.goldMult,
          muted: ui.muted,
          onceSpawned: s.onceSpawned,
        })
      );
    } catch {}
  };
  const load = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  // ===== Init & Orientation Lock =====
  useEffect(() => {
    const s = load();
    const init = s
      ? { ...newState(), ...s, anim: { t: 0, coins: [], hint: s.onceSpawned ? 0 : 1 } }
      : newState();
    stateRef.current = init;
    setUi((u) => ({
      ...u,
      gold: init.gold,
      spawnCost: init.spawnCost,
      dpsMult: init.dpsMult,
      goldMult: init.goldMult,
      muted: s?.muted || false,
    }));

    // Auto-spawn first miner on first run
    if (!init.onceSpawned) {
      spawnMiner(init);
      init.onceSpawned = true;
      save();
    }

    // Orientation lock (portrait-only on mobile)
    const checkOrientation = () => {
      const mobile = window.innerWidth < 1024;
      const landscape = window.innerWidth > window.innerHeight;
      setIsMobileLandscape(ONLY_PORTRAIT_MOBILE && mobile && landscape);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    // Prevent page scroll while dragging on canvas
    const preventTouchScroll = (e) => {
      if (e.target.closest?.("#miners-canvas")) e.preventDefault();
    };
    document.addEventListener("touchmove", preventTouchScroll, { passive: false });

    // Canvas init
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    const DPR = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = wrapRef.current.getBoundingClientRect();
      const portrait = rect.height > rect.width; // heuristic for layout scaling
      const lanesTargetH = portrait
        ? Math.min(rect.height - 150, rect.width * 1.3)
        : Math.min(rect.height - 150, LANES * CELL_H + PADDING * 2);
      const targetW = Math.min(rect.width, (SLOTS_PER_LANE + 1) * CELL_W + PADDING * 2, 980);
      const targetH = Math.max(320, lanesTargetH);

      c.width = Math.floor(targetW * DPR);
      c.height = Math.floor(targetH * DPR);
      c.style.width = targetW + "px";
      c.style.height = targetH + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      stateRef.current.portrait = portrait;
      draw();
    };
    window.addEventListener("resize", resize);
    resize();

    // Input handlers
    const onDown = (e) => {
      if (isMobileLandscape) return;
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
          m.lane = lane;
          m.slot = slot;
          s2.lanes[lane].slots[slot] = { id };
        } else if (target.id !== id) {
          const other = s2.miners[target.id];
          if (other && other.level === m.level) {
            cur.slots[m.slot] = null;
            s2.lanes[other.lane].slots[other.slot] = null;
            delete s2.miners[m.id];
            delete s2.miners[other.id];
            const nid = s2.nextId++;
            const merged = { id: nid, level: m.level + 1, lane, slot, pop: 1 };
            s2.miners[nid] = merged;
            s2.lanes[lane].slots[slot] = { id: nid };
            play(S_MERGE);
          } else {
            // revert
            cur.slots[m.slot] = { id: m.id };
          }
        }
        save();
      }
      dragRef.current = { active: false };
      draw();
    };

    c.addEventListener("mousedown", onDown);
    c.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    c.addEventListener(
      "touchstart",
      (e) => {
        onDown(e.touches[0]);
        e.preventDefault();
      },
      { passive: false }
    );
    c.addEventListener(
      "touchmove",
      (e) => {
        onMove(e.touches[0]);
        e.preventDefault();
      },
      { passive: false }
    );
    c.addEventListener(
      "touchend",
      (e) => {
        onUp(e.changedTouches[0]);
        e.preventDefault();
      },
      { passive: false }
    );

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

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      c.removeEventListener("mousedown", onDown);
      c.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      c.removeEventListener("touchstart", onDown);
      c.removeEventListener("touchmove", onMove);
      c.removeEventListener("touchend", onUp);
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
      document.removeEventListener("touchmove", preventTouchScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.muted, isMobileLandscape]);

  // ===== Geometry =====
  const boardRect = () => {
    const c = canvasRef.current;
    return { x: PADDING, y: PADDING, w: c.clientWidth - PADDING * 2, h: c.clientHeight - PADDING * 2 };
  };
  const laneRect = (lane) => {
    const b = boardRect();
    const gap = stateRef.current.portrait ? 6 : 10;
    const h = (b.h - (LANES - 1) * gap) / LANES;
    const y = b.y + lane * (h + gap);
    return { x: b.x, y, w: b.w, h };
  };
  const rockWidth = (L) => Math.min(L.w * 0.26, Math.max(80, L.h * 0.9));
  const slotRect = (lane, slot) => {
    const L = laneRect(lane);
    const rw = rockWidth(L);
    const cellW = (L.w - rw) / SLOTS_PER_LANE;
    const x = L.x + slot * cellW;
    return { x, y: L.y, w: cellW - 6, h: L.h };
  };
  const rockRect = (lane) => {
    const L = laneRect(lane);
    const rw = rockWidth(L);
    return { x: L.x + L.w - rw - 6, y: L.y + 6, w: rw, h: L.h - 12 };
  };
  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
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
    const scale = st.portrait ? 1.1 : 1;
    for (let l = 0; l < LANES; l++) {
      for (let s = 0; s < SLOTS_PER_LANE; s++) {
        const cell = st.lanes[l].slots[s];
        if (!cell) continue;
        const r = slotRect(l, s);
        const cx = r.x + r.w * 0.52;
        const cy = r.y + r.h * 0.56;
        const rad = Math.min(r.w, r.h) * 0.36 * scale;
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
    stateRef.current.anim.hint = 0;
    setUi((u) => ({ ...u, gold: s.gold, spawnCost: s.spawnCost }));
    play(S_CLICK);
    save();
  };
  const upgradeDps = () => {
    const s = stateRef.current;
    const cost = Math.ceil(160 * Math.pow(1.22, Math.round((s.dpsMult - 1) * 10)));
    if (s.gold < cost) return;
    s.gold -= cost;
    s.dpsMult = +(s.dpsMult * 1.1).toFixed(3);
    setUi((u) => ({ ...u, gold: s.gold }));
    save();
  };
  const upgradeGold = () => {
    const s = stateRef.current;
    const cost = Math.ceil(160 * Math.pow(1.22, Math.round((s.goldMult - 1) * 10)));
    if (s.gold < cost) return;
    s.gold -= cost;
    s.goldMult = +(s.goldMult * 1.1).toFixed(3);
    setUi((u) => ({ ...u, gold: s.gold }));
    save();
  };
  const resetGame = () => {
    const ns = newState();
    stateRef.current = ns;
    setUi({ gold: 0, spawnCost: 50, dpsMult: 1, goldMult: 1, muted: ui.muted });
    save();
  };

  const tick = (dt) => {
    const s = stateRef.current;
    s.anim.t += dt;

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
        s.gold += gain;
        setUi((u) => ({ ...u, gold: s.gold }));
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
    s.anim.coins = s.anim.coins.filter((cn) => {
      cn.t += dt * 1.2;
      return cn.t < 1;
    });
  };

  // ===== Drawing =====
  const draw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const s = stateRef.current;
    if (!s) return;
    const b = boardRect();

    drawBg(ctx, b);

    for (let l = 0; l < LANES; l++) {
      const L = laneRect(l);

      // conveyor base
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(L.x, L.y + L.h * 0.68, L.w, L.h * 0.22);

      // segmented plates (scrolling)
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
        ctx.fillRect(r.x + 10, padY - 9, r.w - 20, 18);
        ctx.strokeStyle = "#20304a";
        ctx.strokeRect(r.x + 10, padY - 9, r.w - 20, 18);
      }

      // rock
      drawRock(ctx, rockRect(l), s.lanes[l].rock);

      // miners
      for (let sidx = 0; sidx < SLOTS_PER_LANE; sidx++) {
        const cell = s.lanes[l].slots[sidx];
        if (!cell) continue;
        const m = s.miners[cell.id];
        drawMiner(ctx, l, sidx, m);
      }
    }

    // dragging ghost
    if (dragRef.current.active) {
      const s2 = stateRef.current;
      const m = s2.miners[dragRef.current.id];
      const r = slotRect(m.lane, m.slot);
      const x = dragRef.current.x ?? (r.x + r.w * 0.52);
      const y = dragRef.current.y ?? (r.y + r.h * 0.56);
      drawMinerGhost(ctx, x, y, m.level);
    }

    // coin tweens to HUD (top-left HUD approx)
    for (const cn of s.anim.coins) {
      const k = cn.t;
      const sx = cn.x, sy = cn.y;
      const tx = 110, ty = 72;
      const x = sx + (tx - sx) * k;
      const y = sy + (ty - sy) * k;
      drawCoin(ctx, x, y, 1 - k);
    }

    if (s.anim.hint) {
      const l = 0, sidx = 0;
      const r = slotRect(l, sidx);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12);
      ctx.setLineDash([]);
      ctx.fillStyle = "#c7f9cc";
      ctx.font = "bold 12px system-ui";
      ctx.fillText("Drag to merge", r.x + 10, r.y + 22);
    }
  };

  const drawBg = (ctx, b) => {
    const bg = new Image();
    bg.src = IMG_BG;
    if (bg.complete && bg.naturalWidth > 0) {
      ctx.drawImage(bg, b.x, b.y, b.w, b.h);
    } else {
      const g1 = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
      g1.addColorStop(0, "#0b1220");
      g1.addColorStop(1, "#0c1526");
      ctx.fillStyle = g1;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
  };

  const drawRock = (ctx, rect, rock) => {
    const img = new Image();
    img.src = IMG_ROCK;
    const pad = 8;
    const rw = rect.w - pad * 2;
    const rh = rect.h - pad * 2;
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, rect.x + pad, rect.y + pad, rw, rh);
    } else {
      ctx.fillStyle = "#6b7280";
      ctx.fillRect(rect.x + pad, rect.y + pad, rw, rh);
    }

    // HP bar
    const pct = Math.max(0, rock.hp / rock.maxHp);
    const barW = rw;
    const bx = rect.x + pad, by = rect.y + 6;
    ctx.fillStyle = "#0ea5e9";
    ctx.fillRect(bx, by, barW * pct, 8);
    const gloss = ctx.createLinearGradient(0, by, 0, by + 8);
    gloss.addColorStop(0, "rgba(255,255,255,.45)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(bx, by, barW * pct, 8);
    ctx.strokeStyle = "#082f49";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, barW, 8);

    // label
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "bold 12px system-ui";
    ctx.fillText(`Rock ${rock.idx + 1}`, bx, by + 18);
  };

  const drawMiner = (ctx, lane, slot, m) => {
    const r = slotRect(lane, slot);
    const cx = r.x + r.w * 0.52, cy = r.y + r.h * 0.56;
    const w = Math.min(r.w, r.h) * 0.95;
    const h = w;

    const img = new Image();
    img.src = IMG_MINER;
    const frame = Math.floor((stateRef.current.anim.t * 8) % 4);

    if (img.complete && img.naturalWidth > 0) {
      const sw = img.width / 4, sh = img.height;
      ctx.drawImage(img, frame * sw, 0, sw, sh, cx - w / 2, cy - h / 2, w, h);
    } else {
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // level tag
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(cx - w * 0.5, cy - h * 0.62, 34, 20);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px system-ui";
    ctx.fillText(m.level, cx - w * 0.5 + 11, cy - h * 0.62 + 14);

    // pop text on merge
    if (m.pop) {
      const k = Math.max(0, 1 - (stateRef.current.anim.t % 1));
      ctx.globalAlpha = k;
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 18px system-ui";
      ctx.fillText(`LV ${m.level}`, cx - 18, cy - h * 0.75);
      ctx.globalAlpha = 1;
      if (k <= 0.02) delete m.pop;
    }
  };

  const drawMinerGhost = (ctx, x, y, lvl) => {
    const w = 74, h = 74;
    const img = new Image();
    img.src = IMG_MINER;
    ctx.globalAlpha = 0.75;
    if (img.complete && img.naturalWidth > 0) {
      const sw = img.width / 4, sh = img.height;
      ctx.drawImage(img, 0, 0, sw, sh, x - w / 2, y - h / 2, w, h);
    } else {
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px system-ui";
    ctx.fillText(String(lvl), x - 6, y - 26);
  };

  const drawCoin = (ctx, x, y, a) => {
    const img = new Image();
    img.src = IMG_COIN;
    const s = 30;
    ctx.globalAlpha = 0.45 + 0.55 * a;
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
    } else {
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(x, y, s / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  // ===== UI =====
  return (
    <Layout>
      <div
        ref={wrapRef}
        className="flex flex-col items-center justify-start bg-gray-900 text-white min-h-screen w-full relative overflow-hidden"
      >
        {/* Portrait-only overlay on mobile */}
        {isMobileLandscape && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 text-white text-center p-6">
            <h2 className="text-xl font-bold">Please rotate the screen to portrait mode.</h2>
          </div>
        )}

        <h1 className="text-2xl font-extrabold tracking-tight mt-2">MLEO Miners — v3.6 (4 Lanes)</h1>

        {/* HUD */}
        <div className="flex gap-2 flex-wrap justify-center items-center my-3">
          <div className="px-3 py-2 bg-black/60 rounded-xl shadow flex items-center gap-1">
            <img src={IMG_COIN} alt="coin" className="w-5 h-5" />
            <b>{stateRef.current?.gold ?? 0}</b>
          </div>
          <div className="px-3 py-2 bg-black/60 rounded-xl shadow">🪓 DPS x<b>{(stateRef.current?.dpsMult || 1).toFixed(2)}</b></div>
          <div className="px-3 py-2 bg-black/60 rounded-xl shadow">🟡 Gold x<b>{(stateRef.current?.goldMult || 1).toFixed(2)}</b></div>
          <button
            onClick={() => {
              setUi((u) => ({ ...u, muted: !u.muted }));
              setTimeout(save, 0);
            }}
            className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600"
          >
            {ui.muted ? "🔇" : "🔊"}
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-3 flex-wrap justify-center">
          <button onClick={addMiner} className="px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold shadow">
            + Add Miner (Cost {stateRef.current?.spawnCost ?? ui.spawnCost})
          </button>
          <button onClick={upgradeDps} className="px-4 py-2 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold shadow">
            Upgrade DPS +10%
          </button>
          <button onClick={upgradeGold} className="px-4 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold shadow">
            Upgrade Gold +10%
          </button>
          <button onClick={resetGame} className="px-4 py-2 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-bold shadow">
            Reset
          </button>
        </div>

        {/* Canvas */}
        <div className="w-full max-w-4xl aspect-[16/9] border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
          <canvas id="miners-canvas" ref={canvasRef} className="w-full h-full block touch-none select-none" />
        </div>

        <p className="opacity-70 text-xs mt-2">
          4 lanes • Drag to move/merge • Break rocks → earn gold → buy upgrades • Autosave on this device.
        </p>
      </div>
    </Layout>
  );
}
