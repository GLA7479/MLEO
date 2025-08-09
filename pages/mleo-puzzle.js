// pages/mleo-penalty.js
import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";

// --- Assets (שמור ב-/public/images) ---
const IMG_KEEPER = "/images/leo-keeper.png";
const IMG_BALL   = "/images/ball.png";
const IMG_BG     = "/images/penalty-bg.png"; // רקע היי-רס שאפשר להחליף

// Preload (רק בדפדפן)
const keeperImg = typeof Image !== "undefined" ? new Image() : null;
if (keeperImg) keeperImg.src = IMG_KEEPER;

const ballImg = typeof Image !== "undefined" ? new Image() : null;
if (ballImg) ballImg.src = IMG_BALL;

const bgImg = typeof Image !== "undefined" ? new Image() : null;
if (bgImg) bgImg.src = IMG_BG;

// LocalStorage keys
const LS_HS = "mleoPenaltyHighScore";
const LS_LB = "mleoPenaltyLeaderboard";

export default function MleoPenalty() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const runningRef = useRef(false);

  // UI
  const [showIntro, setShowIntro] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [shots, setShots] = useState(5);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);

  // World/state
  const stateRef = useRef({
    w: 800, h: 450,
    ball: { x: 400, y: 360, r: 10, vx: 0, vy: 0, moving: false },
    goal: { x: 200, y: 60, w: 400, h: 160 },
    keeper: { x: 400, y: 180, w: 90, h: 90, dir: 1, speed: 2.3 },
    aim: { x: 400, y: 120 },
    power: 0, charging: false,
    lastTs: 0,
  });

  // Load persisted data
  useEffect(() => {
    if (typeof window === "undefined") return;
    setHighScore(Number(localStorage.getItem(LS_HS) || 0));
    setLeaderboard(JSON.parse(localStorage.getItem(LS_LB) || "[]"));
  }, []);

  const updateLeaderboard = (name, sc) => {
    let lb = JSON.parse(localStorage.getItem(LS_LB) || "[]");
    const i = lb.findIndex((p) => p.name === name);
    if (i >= 0) { if (sc > lb[i].score) lb[i].score = sc; }
    else lb.push({ name, score: sc });
    lb = lb.sort((a,b)=>b.score-a.score).slice(0,20);
    localStorage.setItem(LS_LB, JSON.stringify(lb));
    setLeaderboard(lb);

    const hs = Number(localStorage.getItem(LS_HS) || 0);
    if (sc > hs) { localStorage.setItem(LS_HS, String(sc)); setHighScore(sc); }
  };

  // Responsive canvas + HiDPI
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const onResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const maxW = Math.min(window.innerWidth * 0.95, 960);
      const aspect = 16 / 9;

      // גודל לוגי (CSS)
      const logicalW = Math.round(maxW);
      const logicalH = Math.round(maxW / aspect);
      c.style.width = `${logicalW}px`;
      c.style.height = `${logicalH}px`;

      // רזולוציית ציור אמיתית (Device Pixels)
      c.width = Math.round(logicalW * dpr);
      c.height = Math.round(logicalH * dpr);

      // שיפור רינדור
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
      }
    };

    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // Input (גרירה לכיוון + טעינת עוצמה; שחרור = בעיטה)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const getPos = (e) => {
      const rect = c.getBoundingClientRect();
      const cx = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
      const cy = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
      return { x: cx * (c.width / rect.width), y: cy * (c.height / rect.height) };
    };

    const onDown = (e) => {
      if (!runningRef.current) return;
      const s = stateRef.current;
      if (s.ball.moving) return;
      const p = getPos(e);
      s.charging = true; s.power = 0;
      s.aim.x = Math.max(s.goal.x+10, Math.min(s.goal.x+s.goal.w-10, p.x));
      s.aim.y = Math.max(s.goal.y+10, Math.min(s.goal.y+s.goal.h-10, p.y));
      e.preventDefault();
    };

    const onMove = (e) => {
      const s = stateRef.current;
      if (!s.charging) return;
      const p = getPos(e);
      s.aim.x = Math.max(s.goal.x+10, Math.min(s.goal.x+s.goal.w-10, p.x));
      s.aim.y = Math.max(s.goal.y+10, Math.min(s.goal.y+s.goal.h-10, p.y));
      e.preventDefault();
    };

    const onUp = () => {
      const s = stateRef.current;
      if (!s.charging) return;
      s.charging = false;
      if (!runningRef.current || s.ball.moving) return;

      const dx = s.aim.x - s.ball.x;
      const dy = s.aim.y - s.ball.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / len, ny = dy / len;
      const minPow = 9.5, maxPow = 16;
      const v = minPow + (maxPow - minPow) * Math.min(1, s.power);
      s.ball.vx = nx * v; s.ball.vy = ny * v; s.ball.moving = true;
    };

    c.addEventListener("pointerdown", onDown, { passive: false });
    c.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);

    c.addEventListener("touchstart", onDown, { passive: false });
    c.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);

    return () => {
      c.removeEventListener("pointerdown", onDown);
      c.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      c.removeEventListener("touchstart", onDown);
      c.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  // Helpers
  const resetBall = () => {
    const s = stateRef.current;
    s.ball.x = 400; s.ball.y = 360; s.ball.vx = 0; s.ball.vy = 0; s.ball.moving = false;
    s.aim.x = 400; s.aim.y = 120;
  };

  const keeperAI = (s) => {
    const left = s.goal.x + 40;
    const right = s.goal.x + s.goal.w - 40;
    if (s.charging) {
      if (s.aim.x > s.keeper.x + 4) s.keeper.x += s.keeper.speed * 0.6;
      else if (s.aim.x < s.keeper.x - 4) s.keeper.x -= s.keeper.speed * 0.6;
    } else {
      s.keeper.x += s.keeper.dir * s.keeper.speed;
      if (s.keeper.x < left) { s.keeper.x = left; s.keeper.dir = 1; }
      if (s.keeper.x > right) { s.keeper.x = right; s.keeper.dir = -1; }
    }
  };

  const collideKeeper = (s) => {
    const kx1 = s.keeper.x - s.keeper.w/2, ky1 = s.keeper.y - s.keeper.h/2;
    const kx2 = kx1 + s.keeper.w, ky2 = ky1 + s.keeper.h;
    const cx = s.ball.x, cy = s.ball.y, r = s.ball.r;
    const nx = Math.max(kx1, Math.min(cx, kx2));
    const ny = Math.max(ky1, Math.min(cy, ky2));
    return Math.hypot(cx-nx, cy-ny) < r;
  };

  const inGoal = (s) => {
    const { x,y } = s.ball;
    const { x: gx, y: gy, w: gw, h: gh } = s.goal;
    return x > gx+6 && x < gx+gw-6 && y > gy+6 && y < gy+gh-6;
  };

  // Main loop (ציור) — חשוב: להגדיר step לפני הקריאה ל-RAF
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const drawPitch = (s) => {
      const scaleX = c.width / s.w, scaleY = c.height / s.h;

      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        const iw = bgImg.naturalWidth, ih = bgImg.naturalHeight;
        const r = Math.max(c.width / iw, c.height / ih);
        const dw = iw * r, dh = ih * r;
        const dx = (c.width - dw) / 2, dy = (c.height - dh) / 2;
        ctx.drawImage(bgImg, dx, dy, dw, dh);
      } else {
        const skyH = (stateRef.current.goal.y / stateRef.current.h) * c.height;
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

        const s = stateRef.current;
        const gx = s.goal.x * scaleX, gy = s.goal.y * scaleY, gw = s.goal.w * scaleX, gh = s.goal.h * scaleY;
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 6; ctx.strokeRect(gx, gy, gw, gh);
        ctx.globalAlpha = 0.18; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
        const cols = 10, rows = 6;
        for (let i = 1; i < cols; i++) { const xx = gx + (gw * i) / cols; ctx.beginPath(); ctx.moveTo(xx, gy); ctx.lineTo(xx, gy + gh); ctx.stroke(); }
        for (let j = 1; j < rows; j++) { const yy = gy + (gh * j) / rows; ctx.beginPath(); ctx.moveTo(gx, yy); ctx.lineTo(gx + gw, yy); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
    };

    const drawKeeper = (s) => {
      const scaleX = c.width / s.w, scaleY = c.height / s.h;
      const kw = s.keeper.w * scaleX;
      const kh = s.keeper.h * scaleY;
      const kx = (s.keeper.x * scaleX) - kw / 2;
      const ky = (s.keeper.y * scaleY) - kh / 2;

      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(s.keeper.x * scaleX, (s.keeper.y * scaleY) + kh * 0.45, kw * 0.45, kh * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (keeperImg && keeperImg.complete) {
        ctx.drawImage(keeperImg, kx, ky, kw, kh);
      } else {
        ctx.fillStyle = "#333";
        ctx.fillRect(kx, ky, kw, kh);
      }
    };

    const drawBall = (s) => {
      const scaleX = c.width / s.w, scaleY = c.height / s.h;
      const bx = s.ball.x * scaleX;
      const by = s.ball.y * scaleY;
      const br = s.ball.r * ((scaleX + scaleY) / 2);

      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.ellipse(bx, by + br * 0.5, br * 0.9, br * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (ballImg && ballImg.complete) {
        const size = br * 3;
        ctx.drawImage(ballImg, bx - size / 2, by - size / 2, size, size);
      } else {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#000"; ctx.stroke();
      }
    };

    const drawAimAndPower = (s) => {
      if (!runningRef.current || s.ball.moving) return;
      const ax = s.aim.x * (c.width/s.w);
      const ay = s.aim.y * (c.height/s.h);
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

    // ---- כאן מוגדר step לפני הקריאה הראשונה ל-RAF ----
    const step = (ts) => {
      const s = stateRef.current;
      const dt = Math.min(0.035, (ts - s.lastTs) / 1000 || 0.016);
      s.lastTs = ts;

      if (s.charging) { s.power += 0.9 * dt; if (s.power > 1.1) s.power = 1.1; }

      keeperAI(s);

      if (s.ball.moving) {
        s.ball.x += s.ball.vx;
        s.ball.y += s.ball.vy;
        s.ball.vx *= 0.992; s.ball.vy *= 0.992;

        if (collideKeeper(s)) {
          s.ball.vy = Math.max(-s.ball.vy * 0.3, -2);
          s.ball.vx = -s.ball.vx * 0.4;
        }

        if (s.ball.y < 0 || s.ball.x < -60 || s.ball.x > s.w+60 || s.ball.y > s.h+60) {
          setShots((sh) => Math.max(0, sh - 1));
          resetBall();
        }

        if (inGoal(s) && s.ball.y < s.goal.y + s.goal.h - 12) {
          scoreRef.current += 1; setScore(scoreRef.current);
          setShots((sh) => Math.max(0, sh - 1));
          resetBall();
        }
      }

      // ציור
      drawPitch(s);
      drawKeeper(s);
      drawBall(s);
      drawAimAndPower(s);

      // סיום משחק
      if (runningRef.current && shots === 0 && !s.ball.moving && !s.charging) {
        runningRef.current = false;
        setGameOver(true);
        updateLeaderboard(playerName || "Player", scoreRef.current);
      }

      rafRef.current = requestAnimationFrame(step);
    };

    // מתחילים את הלולאה
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [shots, playerName]);

  const startGame = () => {
    // fullscreen on mobile
    const wrap = document.getElementById("game-wrapper");
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && wrap?.requestFullscreen) wrap.requestFullscreen().catch(()=>{});
    else if (isMobile && wrap?.webkitRequestFullscreen) wrap.webkitRequestFullscreen?.();

    // reset
    scoreRef.current = 0; setScore(0);
    setShots(5); setGameOver(false); setShowIntro(false);

    const s = stateRef.current;
    s.ball = { x: 400, y: 360, r: 10, vx:0, vy:0, moving:false };
    s.aim  = { x: 400, y: 120 };
    s.power = 0; s.charging = false;
    s.keeper.x = 400; s.keeper.dir = 1;

    runningRef.current = true;
    // אין צורך להפעיל RAF כאן – הוא כבר רץ מה-useEffect
  };

  const playAgain = () => { startGame(); };

  // Cleanup כללי
  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <Layout>
      <div id="game-wrapper" className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative select-none">
        {/* Intro (start screen) */}
        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-[999] text-center p-6">
            <h1 className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-2">⚽ Penalty Shootout</h1>
            <p className="text-base sm:text-lg text-gray-200 mb-4">
              גרור בתוך השער לכוון ולטעון עוצמה. שחרר כדי לבעוט. יש לך 5 בעיטות.
            </p>

            <input
              type="text"
              placeholder="השם שלך"
              value={playerName}
              onChange={(e)=>setPlayerName(e.target.value)}
              className="mb-4 px-4 py-2 rounded text-black w-64 text-center"
            />

            <button
              onClick={() => {
                if (!playerName.trim()) return;
                setShowIntro(false);
                startGame();
              }}
              disabled={!playerName.trim()}
              className={`px-8 py-4 font-bold rounded-lg text-xl shadow-lg transition ${
                playerName.trim()
                  ? "bg-yellow-400 text-black hover:scale-105"
                  : "bg-gray-500 text-gray-300 cursor-not-allowed"
              }`}
            >
              ▶ התחל משחק
            </button>
          </div>
        )}

        {!showIntro && (
          <>
            {/* HUD */}
            <div className="hidden sm:block absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-4 py-2 rounded-lg text-lg font-bold z-[999] top-10">
              Score: {score} | Shots: {shots} | High Score: {highScore}
            </div>
            <div className="sm:hidden absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-3 py-1 rounded-md text-base font-bold z-[999] bottom-36">
              Score: {score} | Shots: {shots}
            </div>

            <div className="relative w-full max-w-[95vw] sm:max-w-[960px]">
              <canvas ref={canvasRef} className="border-4 border-yellow-400 rounded-lg w-full aspect-[16/9] max-h-[80vh] bg-black/20 touch-none" />
              {gameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-[999]">
                  <h2 className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-4">Final Score: {score}</h2>
                  <button className="px-6 py-3 bg-yellow-400 text-black font-bold rounded text-base sm:text-lg" onClick={playAgain}>
                    Play Again
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
                updateLeaderboard(playerName || "Player", scoreRef.current);
                setShowIntro(true); setGameOver(false); runningRef.current = false;
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
              }}
              className="fixed top-16 right-4 px-6 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg sm:text-xl z-[999]"
            >
              Exit
            </button>
          </>
        )}
      </div>
    </Layout>
  );
}
