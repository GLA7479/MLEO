// pages/mleo-penalty.js
import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";

// Optional images (game draws even without them)
const IMG_KEEPER = "/images/leo-keeper.png";
const IMG_BALL   = "/images/ball.png";
const IMG_BG     = "/images/penalty-bg.png";

const LS_HS   = "penaltyHighScore_v1";
const LS_NAME = "penaltyPlayerName_v1";

export default function PenaltyGame() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const runningRef = useRef(false);

  // Intro overlay ONLY (המשחק רץ מתחת)
  const [showIntro, setShowIntro] = useState(true);
  const [playerName, setPlayerName] = useState("");

  // UI
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [shots, setShots] = useState(5);
  const [highScore, setHighScore] = useState(0);

  // Images (loaded if exist; game draws even without them)
  const imgsRef = useRef({ bg: null, keeper: null, ball: null });
  useEffect(() => {
    const make = (src, key) => {
      const im = new Image();
      im.onload  = () => { imgsRef.current[key] = im; };
      im.onerror = () => { imgsRef.current[key] = null; };
      im.src = src;
    };
    make(IMG_BG, "bg");
    make(IMG_KEEPER, "keeper");
    make(IMG_BALL, "ball");

    setHighScore(Number(localStorage.getItem(LS_HS) || 0));
    setPlayerName(localStorage.getItem(LS_NAME) || "");
  }, []);

  // World (fixed logical size; CSS makes it responsive)
  const S = useRef({
    w: 800, h: 450,
    ball:   { x: 400, y: 360, r: 10, vx: 0, vy: 0, moving: false },
    goal:   { x: 200, y: 60,  w: 400, h: 160 },
    keeper: { x: 400, y: 180, w: 90,  h: 90, dir: 1, speed: 2.3 },
    aim:    { x: 400, y: 120 },
    power:  0, charging: false,
    lastTs: 0,
  });

  // Pointer input (לא נוגעים)
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    c.style.touchAction = "none";
    c.style.userSelect  = "none";

    const getPos = (e) => {
      const rect = c.getBoundingClientRect();
      const cx = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
      const cy = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
      return { x: (cx / rect.width) * c.width, y: (cy / rect.height) * c.height };
    };
    const clampAim = (p) => {
      const s = S.current;
      s.aim.x = Math.max(s.goal.x + 10, Math.min(s.goal.x + s.goal.w - 10, p.x));
      s.aim.y = Math.max(s.goal.y + 10, Math.min(s.goal.y + s.goal.h - 10, p.y));
    };

    const onDown = (e) => {
      if (!runningRef.current) return;
      const s = S.current;
      if (s.ball.moving) return;
      clampAim(getPos(e));
      s.charging = true; s.power = 0;
      e.preventDefault?.();
      c.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e) => {
      const s = S.current;
      if (!s.charging) return;
      clampAim(getPos(e));
      e.preventDefault?.();
    };
    const onUp = (e) => {
      const s = S.current;
      if (!s.charging) return;
      s.charging = false;
      if (!runningRef.current || s.ball.moving) return;

      const dx = s.aim.x - s.ball.x;
      const dy = s.aim.y - s.ball.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / len, ny = dy / len;
      const v  = 9.5 + (16 - 9.5) * Math.min(1, s.power);
      s.ball.vx = nx * v; s.ball.vy = ny * v; s.ball.moving = true;

      e.preventDefault?.();
      try { c.releasePointerCapture?.(e.pointerId); } catch {}
    };

    c.addEventListener("pointerdown", onDown, { passive: false });
    c.addEventListener("pointermove", onMove, { passive: false });
    c.addEventListener("pointerup",   onUp,   { passive: false });
    c.addEventListener("pointercancel", onUp, { passive: false });
    c.addEventListener("touchstart", onDown, { passive: false });
    c.addEventListener("touchmove",  onMove, { passive: false });
    c.addEventListener("touchend",   onUp,   { passive: false });

    return () => {
      c.removeEventListener("pointerdown", onDown);
      c.removeEventListener("pointermove", onMove);
      c.removeEventListener("pointerup", onUp);
      c.removeEventListener("pointercancel", onUp);
      c.removeEventListener("touchstart", onDown);
      c.removeEventListener("touchmove", onMove);
      c.removeEventListener("touchend", onUp);
    };
  }, []);

  // Helpers (לא נוגעים)
  const resetBall = () => {
    const s = S.current;
    s.ball.x = 400; s.ball.y = 360; s.ball.vx = 0; s.ball.vy = 0; s.ball.moving = false;
    s.aim.x  = 400; s.aim.y  = 120; s.power = 0; s.charging = false;
  };

  const keeperAI = (s) => {
    const left = s.goal.x + 40, right = s.goal.x + s.goal.w - 40;
    if (s.charging) {
      if (s.aim.x > s.keeper.x + 4) s.keeper.x += s.keeper.speed * 0.6;
      else if (s.aim.x < s.keeper.x - 4) s.keeper.x -= s.keeper.speed * 0.6;
    } else {
      s.keeper.x += s.keeper.dir * s.keeper.speed;
      if (s.keeper.x < left)  { s.keeper.x = left;  s.keeper.dir = 1;  }
      if (s.keeper.x > right) { s.keeper.x = right; s.keeper.dir = -1; }
    }
  };

  const collideKeeper = (s) => {
    const kx1 = s.keeper.x - s.keeper.w/2, ky1 = s.keeper.y - s.keeper.h/2;
    const kx2 = kx1 + s.keeper.w, ky2 = ky1 + s.keeper.h;
    const cx = s.ball.x, cy = s.ball.y, r = s.ball.r;
    const nx = Math.max(kx1, Math.min(cx, kx2));
    const ny = Math.max(ky1, Math.min(cy, ky2));
    return Math.hypot(cx - nx, cy - ny) < r;
  };

  const inGoal = (s) => {
    const { x,y } = s.ball;
    const { x: gx, y: gy, w: gw, h: gh } = s.goal;
    return x > gx+6 && x < gx+gw-6 && y > gy+6 && y < gy+gh-6;
  };

  // Drawing helpers (לא נוגעים)
  const drawPitch = (ctx, c, s) => {
    ctx.clearRect(0, 0, c.width, c.height);

    const bg = imgsRef.current.bg; // null => fallback
    if (bg) {
      const iw = bg.naturalWidth, ih = bg.naturalHeight;
      const r = Math.max(c.width / iw, c.height / ih);
      const dw = iw * r, dh = ih * r;
      const dx = (c.width - dw) / 2, dy = (c.height - dh) / 2;
      ctx.drawImage(bg, dx, dy, dw, dh);
    } else {
      const skyH = (s.goal.y / s.h) * c.height;
      const sky = ctx.createLinearGradient(0, 0, 0, skyH);
      sky.addColorStop(0, "#9ad0ff"); sky.addColorStop(1, "rgba(154,208,255,0)");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, c.width, skyH);
      ctx.fillStyle = "#0c8b39"; ctx.fillRect(0, skyH, c.width, c.height - skyH);
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = i % 2 ? "#0a7c33" : "#0d943e";
        const stripeY = skyH + (i * (c.height - skyH)) / 12;
        ctx.fillRect(0, stripeY, c.width, (c.height - skyH) / 12);
      }
      ctx.globalAlpha = 1;
    }

    // goal + net
    const scaleX = c.width / s.w, scaleY = c.height / s.h;
    const gx = s.goal.x * scaleX, gy = s.goal.y * scaleY, gw = s.goal.w * scaleX, gh = s.goal.h * scaleY;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 6; ctx.strokeRect(gx, gy, gw, gh);
    ctx.globalAlpha = 0.18; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    const cols = 10, rows = 6;
    for (let i = 1; i < cols; i++) { const xx = gx + (gw * i) / cols; ctx.beginPath(); ctx.moveTo(xx, gy); ctx.lineTo(xx, gy + gh); ctx.stroke(); }
    for (let j = 1; j < rows; j++) { const yy = gy + (gh * j) / rows; ctx.beginPath(); ctx.moveTo(gx, yy); ctx.lineTo(gx + gw, yy); ctx.stroke(); }
    ctx.globalAlpha = 1;
  };

  const drawKeeper = (ctx, c, s) => {
    const scaleX = c.width / s.w, scaleY = c.height / s.h;
    const kw = s.keeper.w * scaleX, kh = s.keeper.h * scaleY;
    const kx = s.keeper.x * scaleX - kw / 2, ky = s.keeper.y * scaleY - kh / 2;

    // shadow
    ctx.globalAlpha = 0.25; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(s.keeper.x * scaleX, s.keeper.y * scaleY + kh * 0.45, kw * 0.45, kh * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    const im = imgsRef.current.keeper;
    if (im) ctx.drawImage(im, kx, ky, kw, kh);
    else { ctx.fillStyle = "#444"; ctx.fillRect(kx, ky, kw, kh); }
  };

  const drawBall = (ctx, c, s) => {
    const scaleX = c.width / s.w, scaleY = c.height / s.h;
    const bx = s.ball.x * scaleX, by = s.ball.y * scaleY;
    const br = s.ball.r * ((scaleX + scaleY) / 2);

    ctx.globalAlpha = 0.3; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(bx, by + br * 0.5, br * 0.9, br * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    const im = imgsRef.current.ball;
    if (im) ctx.drawImage(im, bx - br * 1.5, by - br * 1.5, br * 3, br * 3);
    else { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#000"; ctx.stroke(); }
  };

  const drawAimAndPower = (ctx, c, s) => {
    if (!runningRef.current || s.ball.moving) return;
    const ax = s.aim.x * (c.width/s.w), ay = s.aim.y * (c.height/s.h);
    ctx.strokeStyle = "#ff3b3b"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax-10,ay); ctx.lineTo(ax+10,ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax,ay-10); ctx.lineTo(ax,ay+10); ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(c.width-28, c.height-160, 14, 130);
    ctx.fillStyle = "#ff3b3b";
    const ph = Math.round(130 * Math.min(1, s.power));
    ctx.fillRect(c.width-28, c.height-30-ph, 14, ph);
    ctx.strokeStyle = "#fff"; ctx.strokeRect(c.width-28, c.height-160, 14, 130);
  };

  // Main loop (כמו אצלך – לא נוגעים, נשאיר את התלות כמו שהייתה)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    // fixed internal resolution; responsive via CSS
    c.width = 960;
    c.height = 540;

    const step = (ts) => {
      const s = S.current;
      const dt = Math.min(0.035, (ts - s.lastTs) / 1000 || 0.016);
      s.lastTs = ts;

      if (s.charging) s.power = Math.min(1.1, s.power + 0.9 * dt);
      keeperAI(s);

      if (s.ball.moving) {
        s.ball.x += s.ball.vx;
        s.ball.y += s.ball.vy;
        s.ball.vx *= 0.992; s.ball.vy *= 0.992;

        if (collideKeeper(s)) {
          s.ball.vy = Math.max(-s.ball.vy * 0.3, -2);
          s.ball.vx = -s.ball.vx * 0.4;
        }

        if (s.ball.y < 0 || s.ball.x < -60 || s.ball.x > s.w + 60 || s.ball.y > s.h + 60) {
          setShots((sh) => Math.max(0, sh - 1));
          resetBall();
        }

        if (inGoal(s) && s.ball.y < s.goal.y + s.goal.h - 12) {
          scoreRef.current += 1; setScore(scoreRef.current);
          setShots((sh) => Math.max(0, sh - 1));
          resetBall();
        }
      }

      // render
      drawPitch(ctx, c, s);
      drawKeeper(ctx, c, s);
      drawBall(ctx, c, s);
      drawAimAndPower(ctx, c, s);

      // end-game check
      if (runningRef.current && !s.ball.moving && !s.charging && shots === 0) {
        runningRef.current = false;
        const hs = Number(localStorage.getItem(LS_HS) || 0);
        if (scoreRef.current > hs) {
          localStorage.setItem(LS_HS, String(scoreRef.current));
          setHighScore(scoreRef.current);
        }
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [shots]);

  // Flow — בדיוק כמו שהיה: אוטו־סטארט פעם אחת
  const startGame = () => {
    scoreRef.current = 0; setScore(0);
    setShots(5);
    const s = S.current;
    s.ball = { x: 400, y: 360, r: 10, vx:0, vy:0, moving:false };
    s.aim  = { x: 400, y: 120 }; s.power = 0; s.charging = false;
    s.keeper.x = 400; s.keeper.dir = 1;
    runningRef.current = true;
  };
  useEffect(() => { startGame(); }, []); // ← כמו בגרסה שעבדה לך

  // כפתור Start במסך פתיחה (רק הורדת שכבה + שמירת שם + fullscreen לנייד)
  const handleStart = () => {
    const n = playerName.trim(); if (!n) return;
    localStorage.setItem(LS_NAME, n);
    // fullscreen במובייל
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const host = document.getElementById("penalty-host");
    if (isMobile && host) {
      const req = host.requestFullscreen || host.webkitRequestFullscreen || host.msRequestFullscreen;
      try { req?.call(host); } catch {}
    }
    setShowIntro(false);
  };

  return (
    <Layout>
      <div id="penalty-host" className="flex flex-col items-center justify-start min-h-screen bg-gray-900 text-white relative">
        {/* HUD */}
        <div className="absolute left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-lg text-lg font-bold z-[60] top-10 pointer-events-none">
          Player: {playerName || "—"} | Score: {score} | Shots: {shots} | High Score: {highScore}
        </div>

        {/* Canvas */}
        <div className="relative w-full mt-24" style={{ maxWidth: 960 }}>
          <canvas
            ref={canvasRef}
            width={960}
            height={540}
            className="border-4 border-yellow-400 rounded-lg block w-full"
            style={{ height: "auto", cursor: "crosshair" }}
          />
        </div>

        {/* Exit */}
        <button
          onClick={() => {
            const hs = Number(localStorage.getItem(LS_HS) || 0);
            if (scoreRef.current > hs) { localStorage.setItem(LS_HS, String(scoreRef.current)); setHighScore(scoreRef.current); }
            runningRef.current = false;
            setShowIntro(true); // חוזרים למסך פתיחה בלבד (המשחק רץ מחדש אחרי refresh או Start חדש)
          }}
          className="fixed top-16 right-4 px-6 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg sm:text-xl z-[80]"
        >
          Exit
        </button>

        {/* Intro overlay (מכסה את המשחק שרץ מתחת) */}
        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gray-900/95 z-[90]">
            <img src="/images/leo-intro.png" alt="Leo" width={200} height={200} className="mb-6" />
            <h1 className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-2">⚽ Penalty Shootout</h1>
            <p className="text-base sm:text-lg text-gray-200 mb-5">
              Drag & hold inside the goal to aim & charge. Release to shoot.
            </p>

            <input
              type="text"
              value={playerName}
              onChange={(e)=>setPlayerName(e.target.value)}
              onKeyDown={(e)=>{ if (e.key === "Enter" && playerName.trim()) handleStart(); }}
              placeholder="Your name"
              className="mb-4 px-4 py-2 rounded text-black w-64 text-center"
            />
            <button
              onClick={handleStart}
              disabled={!playerName.trim()}
              className={`px-8 py-4 font-bold rounded-lg text-xl shadow-lg transition ${
                playerName.trim() ? "bg-yellow-400 text-black hover:scale-105" : "bg-gray-500 text-gray-300 cursor-not-allowed"
              }`}
            >
              ▶ Start Game
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
