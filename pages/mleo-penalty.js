// pages/mleo-penalty.js
import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";

// Optional images (game draws even without them)
const IMG_KEEPER = "/images/leo-keeper.png";
const IMG_BALL   = "/images/ball.png";
const IMG_BG     = "/images/penalty-bg.png";

const LS_HS   = "penaltyHighScore_v1";
const LS_NAME = "penaltyPlayerName_v1";

// ---- Levels config ----
const LEVEL_DUR_SEC = [60, 90, 120, 150, 180]; // level 1: 60s, then +30s per level
const BASE_SPEED = 2.3;                        // keeper speed at level 1
const SPEED_INC  = 0.5;                        // speed increment per level

const mmss = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
};

export default function MleoPenalty() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const runningRef = useRef(false);

  // Intro + level select
  const [showIntro, setShowIntro] = useState(true);
  const [playerName, setPlayerName] = useState("");
  const [selectedLevel, setSelectedLevel] = useState(1);

  // Game UI
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [shots, setShots] = useState(5);
  const [highScore, setHighScore] = useState(0);

  // Level runtime (no auto-advance)
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(LEVEL_DUR_SEC[0]);
  const [gameOver, setGameOver] = useState(false);

  // Images (game still draws without)
  const imgsRef = useRef({ bg: null, keeper: null, ball: null });
  useEffect(() => {
    const make = (src, key) => {
      const im = new Image();
      im.onload  = () => (imgsRef.current[key] = im);
      im.onerror = () => (imgsRef.current[key] = null);
      im.src = src;
    };
    make(IMG_BG, "bg");
    make(IMG_KEEPER, "keeper");
    make(IMG_BALL, "ball");

    if (typeof window !== "undefined") {
      setHighScore(Number(localStorage.getItem(LS_HS) || 0));
      setPlayerName(localStorage.getItem(LS_NAME) || "");
    }
  }, []);

  // World (logical space; scaled draw to canvas)
  const S = useRef({
    w: 800, h: 450,
    ball:   { x: 400, y: 360, r: 10, vx: 0, vy: 0, moving: false },
    goal:   { x: 200, y: 60,  w: 400, h: 160 },
    keeper: { x: 400, y: 160, w: 120, h: 120, dir: 1, speed: BASE_SPEED },
    aim:    { x: 400, y: 120 },
    power:  0, charging: false,
    lastTs: 0,
  });

  // Pointer input
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    c.style.touchAction = "none";
    c.style.userSelect  = "none";

const getPos = (e) => {
  const rect = c.getBoundingClientRect();

  // תמיכה גם ב-pointer events וגם ב-touch events
  const hasTouch = 'touches' in e && e.touches && e.touches[0];
  const clientX = hasTouch ? e.touches[0].clientX : e.clientX;
  const clientY = hasTouch ? e.touches[0].clientY : e.clientY;

  const cx = clientX - rect.left;
  const cy = clientY - rect.top;

  // ממירים למרחב "העולם" (S.current.w/h), לא לפיקסלים של הקנבס
  const s = S.current;
  return {
    x: (cx / rect.width) * s.w,
    y: (cy / rect.height) * s.h,
  };
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

  // Helpers
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

  // Drawing (background only — no white goal frame)
  const drawPitch = (ctx, c, s) => {
    ctx.clearRect(0, 0, c.width, c.height);

    const bg = imgsRef.current.bg;
    if (bg) {
      const iw = bg.naturalWidth, ih = bg.naturalHeight;
      const r = Math.max(c.width / iw, c.height / ih);
      const dw = iw * r, dh = ih * r;
      ctx.drawImage(bg, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
    } else {
      const skyH = (s.goal.y / s.h) * c.height;
      const sky = ctx.createLinearGradient(0, 0, 0, skyH);
      sky.addColorStop(0, "#9ad0ff"); sky.addColorStop(1, "rgba(154,208,255,0)");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, c.width, skyH);
      ctx.fillStyle = "#0c8b39"; ctx.fillRect(0, skyH, c.width, c.height - skyH);
    }
  };

  const drawKeeper = (ctx, c, s) => {
    const sx = c.width / s.w, sy = c.height / s.h;
    const kw = s.keeper.w * sx, kh = s.keeper.h * sy;
    const kx = s.keeper.x * sx - kw / 2, ky = s.keeper.y * sy - kh / 2;

    // shadow
    ctx.globalAlpha = 0.25; ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(s.keeper.x * sx, s.keeper.y * sy + kh * 0.45, kw * 0.45, kh * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    const im = imgsRef.current.keeper;
    if (im) ctx.drawImage(im, kx, ky, kw, kh);
    else { ctx.fillStyle = "#444"; ctx.fillRect(kx, ky, kw, kh); }
  };

  const drawBall = (ctx, c, s) => {
    const sx = c.width / s.w, sy = c.height / s.h;
    const bx = s.ball.x * sx, by = s.ball.y * sy;
    const br = s.ball.r * ((sx + sy) / 2);

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

  // Main loop (timer ends game; no auto-advance)
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;

    const step = (ts) => {
      const s = S.current;
      const dt = Math.min(0.035, (ts - s.lastTs) / 1000 || 0.016);
      s.lastTs = ts;

      // timer
      if (runningRef.current && !gameOver && !showIntro) {
        setTimeLeft((t) => {
          const nt = t - dt;
          if (nt <= 0) {
            runningRef.current = false;
            setGameOver(true);
            const hs = Number(localStorage.getItem(LS_HS) || 0);
            if (scoreRef.current > hs) {
              localStorage.setItem(LS_HS, String(scoreRef.current));
              setHighScore(scoreRef.current);
            }
            return 0;
          }
          return nt;
        });
      }

      if (s.charging) s.power = Math.min(1.1, s.power + 0.9 * dt);
      keeperAI(s);

      if (s.ball.moving) {
        // move & friction
        s.ball.x += s.ball.vx;
        s.ball.y += s.ball.vy;
        s.ball.vx *= 0.992; s.ball.vy *= 0.992;

        // keeper collision — little bounce
        if (collideKeeper(s)) {
          s.ball.vy = Math.max(-s.ball.vy * 0.4, -2.5);
          s.ball.vx = -s.ball.vx * 0.45;
        }

        // if ball nearly stops (not a goal) → count as save and reset
        const speed = Math.hypot(s.ball.vx, s.ball.vy);
        if (speed < 0.25 && !inGoal(s)) {
          setShots((sh) => Math.max(0, sh - 1));
          resetBall();
        }

        // out of bounds
        if (s.ball.y < 0 || s.ball.x < -60 || s.ball.x > s.w + 60 || s.ball.y > s.h + 60) {
          setShots((sh) => Math.max(0, sh - 1));
          resetBall();
        }

        // goal
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

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [showIntro, gameOver]);

  // Start game by selected level
  const startGame = (startLevel = 1) => {
    scoreRef.current = 0; setScore(0);
    setShots(5);
    setGameOver(false);

    setLevel(startLevel);
    setTimeLeft(LEVEL_DUR_SEC[startLevel - 1]);

    const s = S.current;
    s.ball = { x: 400, y: 360, r: 10, vx:0, vy:0, moving:false };
    s.aim  = { x: 400, y: 120 }; s.power = 0; s.charging = false;
    s.keeper.x = 400; s.keeper.dir = 1;
    s.keeper.speed = BASE_SPEED + (startLevel - 1) * SPEED_INC;

    runningRef.current = true;
  };

  const handleChooseLevel = (lv) => {
    const n = playerName.trim(); if (!n) return;
    localStorage.setItem(LS_NAME, n);

    // fullscreen on mobile
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const wrapper = document.getElementById("game-wrapper");
    if (isMobile && wrapper) {
      const req = wrapper.requestFullscreen || wrapper.webkitRequestFullscreen || wrapper.msRequestFullscreen;
      try { req?.call(wrapper); } catch {}
    }

    setShowIntro(false);
    startGame(lv);
  };

  useEffect(() => () => { runningRef.current = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // ===== Responsive canvas (portrait vs landscape) =====
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const landscape = vw > vh;
      setIsLandscape(landscape);

      // base logical aspect is 16:9 (approx 960x540)
      let W, H;

      if (landscape) {
        // In landscape, limit by height so goal isn't cut
        H = Math.min(Math.floor(vh * 0.72), 540);
        W = Math.min(Math.floor(H * (16 / 9)), Math.floor(vw * 0.95), 960);
      } else {
        // Portrait: limit by width
        W = Math.min(Math.floor(vw * 0.95), 960);
        H = Math.min(Math.floor(W * (9 / 16)), Math.floor(vh * 0.80));
      }

      canvas.width = W;
      canvas.height = H;
    };

    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  return (
    <Layout>
      <div
        id="game-wrapper"
        className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative select-none"
      >
        {/* Relative wrapper so HUD can sit on the canvas edge */}
        <div className="relative w-full max-w-[95vw] sm:max-w-[960px]">

          {/* HUD – player name removed; positioned higher */}
          {!showIntro && (
            <>
              {/* Desktop/Tablet */}
<div
  className={`hidden sm:block absolute left-1/2 -translate-x-1/2 ${
    isLandscape ? "-top-12" : "-top-10"
  } bg-black/70 px-4 py-2 rounded-md text-[17px] font-bold z-[999] pointer-events-none`}
>
  Level: {level} | Time: {mmss(timeLeft)} | Score: {score} | High: {highScore}
</div>



              {/* Mobile */}
<div
  className={`sm:hidden absolute left-1/2 -translate-x-1/2 ${
    isLandscape ? "top-2" : "-top-5"
  } bg-black/70 px-3 py-1 rounded text-sm font-bold z-[999] pointer-events-none`}
>
  L{level} • {mmss(timeLeft)} • {score}
</div>


            </>
          )}

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            className="border-4 border-yellow-400 rounded-lg w-full max-h-[80vh] bg-black/20 touch-none"
          />

          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-[999]">
              <h2 className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-4">TIME UP</h2>
              <p className="mb-6 text-lg sm:text-xl">Final Score: <b>{score}</b></p>
              <div className="flex gap-3">
                <button
                  className="px-6 py-3 bg-yellow-400 text-black font-bold rounded text-base sm:text-lg"
                  onClick={() => startGame(level)} // play again same level
                >
                  Play Again (L{level})
                </button>
                <button
                  className="px-6 py-3 bg-gray-200 text-black font-bold rounded text-base sm:text-lg"
                  onClick={() => { setShowIntro(true); setGameOver(false); runningRef.current = false; }}
                >
                  Choose Level
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Exit */}
        <button
          onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.();
            const hs = Number(localStorage.getItem(LS_HS) || 0);
            if (scoreRef.current > hs) { localStorage.setItem(LS_HS, String(scoreRef.current)); setHighScore(scoreRef.current); }
            runningRef.current = false;
            setShowIntro(true);
            setGameOver(false);
          }}
          className="fixed top-16 right-4 px-6 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg sm:text-xl z-[999]"
        >
          Exit
        </button>

        {/* Intro – English */}
        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gray-900/95 z-[999]">
            <img src="/images/leo-intro.png" alt="Leo" width={220} height={220} className="mb-6" />
            <h1 className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-2">⚽ Penalty Shootout</h1>
            <p className="text-base sm:text-lg text-gray-200 mb-5">
              Select a level. Time decreases, and the goalkeeper gets faster at higher levels.
            </p>

            <input
              type="text"
              value={playerName}
              onChange={(e)=>setPlayerName(e.target.value)}
              onKeyDown={(e)=>{ if (e.key === "Enter" && playerName.trim()) handleChooseLevel(selectedLevel); }}
              placeholder="Enter Player Name"
              className="mb-4 px-4 py-2 rounded text-black w-64 text-center"
            />

            <div className="grid grid-cols-5 gap-2 mb-5">
              {[1,2,3,4,5].map((lv) => (
                <button
                  key={lv}
                  onClick={() => setSelectedLevel(lv)}
                  className={`px-4 py-3 rounded font-bold ${
                    selectedLevel === lv ? "bg-yellow-400 text-black" : "bg-gray-700 text-white hover:bg-gray-600"
                  }`}
                >
                  L{lv}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleChooseLevel(selectedLevel)}
              disabled={!playerName.trim()}
              className={`px-8 py-4 font-bold rounded-lg text-xl shadow-lg transition ${
                playerName.trim() ? "bg-yellow-400 text-black hover:scale-105" : "bg-gray-500 text-gray-300 cursor-not-allowed"
              }`}
            >
              ▶ Start at Level {selectedLevel}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
