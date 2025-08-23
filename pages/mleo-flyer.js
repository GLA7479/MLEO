// pages/mleo-flyer.js
import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";

// --- Assets ---
const BG_IMAGES = ["/images/game1.png", "/images/game2.png", "/images/game3.png", "/images/game4.png"];
const SPRITE_DOG = "/images/leo2.png";
const IMG_COIN = "/images/coin.png";
const IMG_DIAMOND = "/images/diamond.png";
const IMG_OBSTACLE = "/images/obstacle1.png";

const SND_FLAP = "/sounds/flap2.mp3";
const SND_WIN = "/sounds/win.mp3";
const SND_LOSE = "/sounds/game-over.mp3";
const SND_COIN = "/sounds/coin.mp3";
const SND_BOMB = "/sounds/bomb.mp3";

// Sizes per type (px)
const sizeCoin = 42;
const sizeDiamond = 34;
const sizeBomb = 50;

export default function MleoFlyer() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const runningRef = useRef(false);

  // UI / general state
  const [showIntro, setShowIntro] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);

  // world
  const dogRef = useRef(null);
  const itemsRef = useRef([]);
  const bgIndexRef = useRef(0);
  const gravityRef = useRef(0.08);        // עדין
  const flapPowerRef = useRef(-2.2);      // עדין

  // press-and-hold (mobile) – בלי בוסט חד
  const isFlyingRef = useRef(false);

  // timing (dt)
  const lastTimeRef = useRef(performance.now());

  // difficulty timer
  const diffTimerRef = useRef({ lastSpawn: 0 });

  // preloaded assets
  const assetsRef = useRef({
    bgs: [],
    dog: null,
    coin: null,
    diamond: null,
    obstacle: null,
    sounds: {},
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block context/selection/long-press (scoped; לא חוסם UI)
  useEffect(() => {
    const wrapper = document.getElementById("game-wrapper");
    if (!wrapper) return;

    const isUI = (el) =>
      el.closest?.("input, textarea, select, button, [role='textbox'], [contenteditable='true']");

    const preventMenu = (e) => { if (!isUI(e.target)) e.preventDefault(); };
    const preventSelection = (e) => { if (!isUI(e.target)) e.preventDefault(); };

    let touchTimer;
    const handleTouchStart = (e) => {
      if (isUI(e.target)) return;
      touchTimer = setTimeout(() => { e.preventDefault(); }, 500);
    };
    const handleTouchEnd = () => clearTimeout(touchTimer);

    wrapper.addEventListener("contextmenu", preventMenu);
    wrapper.addEventListener("selectstart", preventSelection);
    wrapper.addEventListener("copy", preventSelection);
    wrapper.addEventListener("touchstart", handleTouchStart, { passive: false });
    wrapper.addEventListener("touchend", handleTouchEnd);

    return () => {
      wrapper.removeEventListener("contextmenu", preventMenu);
      wrapper.removeEventListener("selectstart", preventSelection);
      wrapper.removeEventListener("copy", preventSelection);
      wrapper.removeEventListener("touchstart", handleTouchStart);
      wrapper.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Preload images & sounds + persisted data
  useEffect(() => {
    const loadImage = (src) =>
      new Promise((res) => {
        const img = new window.Image();
        img.onload = () => res(img);
        img.src = src;
        if (img.complete) res(img);
      });

    Promise.all(BG_IMAGES.map(loadImage)).then((imgs) => (assetsRef.current.bgs = imgs));
    loadImage(SPRITE_DOG).then((img) => (assetsRef.current.dog = img));
    loadImage(IMG_COIN).then((img) => (assetsRef.current.coin = img));
    loadImage(IMG_DIAMOND).then((img) => (assetsRef.current.diamond = img));
    loadImage(IMG_OBSTACLE).then((img) => (assetsRef.current.obstacle = img));

    if (typeof Audio !== "undefined") {
      assetsRef.current.sounds = {
        flap: new Audio(SND_FLAP),
        win: new Audio(SND_WIN),
        lose: new Audio(SND_LOSE),
        coin: new Audio(SND_COIN),
        bomb: new Audio(SND_BOMB),
      };
      Object.values(assetsRef.current.sounds).forEach((a) => (a.volume = 1.0));
    }

    if (typeof window !== "undefined") {
      const hs = Number(localStorage.getItem("mleoFlyerHighScore") || 0);
      setHighScore(hs);
      const lb = JSON.parse(localStorage.getItem("mleoFlyerLeaderboard") || "[]");
      setLeaderboard(lb);
    }
  }, []);

  const updateLeaderboard = (name, sc) => {
    let lb = JSON.parse(localStorage.getItem("mleoFlyerLeaderboard") || "[]");
    const i = lb.findIndex((p) => p.name === name);
    if (i >= 0) {
      if (sc > lb[i].score) lb[i].score = sc;
    } else {
      lb.push({ name, score: sc });
    }
    lb = lb.sort((a, b) => b.score - a.score).slice(0, 20);
    localStorage.setItem("mleoFlyerLeaderboard", JSON.stringify(lb));
    setLeaderboard(lb);

    const hs = Number(localStorage.getItem("mleoFlyerHighScore") || 0);
    if (sc > hs) {
      localStorage.setItem("mleoFlyerHighScore", String(sc));
      setHighScore(sc);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  function getDifficulty() {
    const s = scoreRef.current;
    const level = Math.floor(s / 12);

    const spawnInterval = Math.max(1200 - level * 110, 300);
    const itemSpeed     = Math.min(2.6 + level * 0.4, 7.8);
    const bombBias      = Math.min(0.08 + level * 0.05, 0.55);

    // עדין יותר (קפיצה/נפילה איטיים)
    const gravity    = Math.min(0.06 + level * 0.004, 0.12);
    const flapPower  = Math.max(-1.8 - level * 0.03, -2.8);

    return { level, spawnInterval, itemSpeed, bombBias, gravity, flapPower };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Init
  function initGame() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = Math.min(window.innerWidth * 0.95, 960);
    const H = Math.min(Math.round(W * 0.52), window.innerHeight * 0.8);
    canvas.width = W;
    canvas.height = H;

    dogRef.current = { x: canvas.width / 3, y: H / 2, w: 60, h: 50, vy: 0 };
    itemsRef.current = [];
    bgIndexRef.current = Math.floor(Math.random() * BG_IMAGES.length);

    const d = getDifficulty();
    gravityRef.current = d.gravity;
    flapPowerRef.current = d.flapPower;

    scoreRef.current = 0;
    setScore(0);
    setGameOver(false);
    diffTimerRef.current.lastSpawn = performance.now();
    lastTimeRef.current = performance.now();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Spawn item with dynamic weights/speed
  function spawnItem(diff) {
    const r = Math.random();
    let type = "coin";
    if (r < diff.bombBias) type = "bomb";
    else if (r < diff.bombBias + 0.25) type = "diamond";

    const size = type === "diamond" ? sizeDiamond : type === "coin" ? sizeCoin : sizeBomb;
    const canvas = canvasRef.current || { width: 800, height: 420 };

    itemsRef.current.push({
      type,
      x: canvas.width + size,
      y: Math.random() * (canvas.height - size - 30) + 15,
      size,
      vx: -(diff.itemSpeed + Math.random() * 0.6),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  function isHit(dog, it) {
    const a = { x: dog.x + 10, y: dog.y + 8, w: dog.w - 20, h: dog.h - 16 };
    const b = { x: it.x, y: it.y, w: it.size, h: it.size };
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main loop – time based (dt) + press-and-hold thrust (no burst)
  function loop() {
    if (!runningRef.current) return;

    const now = performance.now();
    let dt = (now - lastTimeRef.current) / 1000; // seconds
    lastTimeRef.current = now;
    if (dt > 0.05) dt = 0.05; // cap long frames
    const scale = dt * 60;    // נרמול ל־60FPS

    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = requestAnimationFrame(loop); return; }
    const ctx = canvas.getContext("2d");
    const A = assetsRef.current;

    // background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bg = A.bgs[bgIndexRef.current];
    if (bg) ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

    // difficulty per-frame
    const d = getDifficulty();
    gravityRef.current = d.gravity;
    flapPowerRef.current = d.flapPower;

    // update dog
    const dog = dogRef.current;

    // גרביטציה עדינה
    dog.vy += gravityRef.current * scale;

    // press-and-hold – דחיפה רציפה ועדינה בלבד
    if (isFlyingRef.current) {
      dog.vy += (flapPowerRef.current * 0.42) * scale; // 0.38–0.5 לפי טעם
    }

    // חיכוך/החלקה
    dog.vy *= Math.pow(0.99, scale);

    // הגבלת מהירות (נפילה ועלייה איטיות)
    dog.vy = Math.max(Math.min(dog.vy, 2.4), -3.2);

    // עדכון מיקום
    dog.y  += dog.vy * scale;

    // גבולות
    const floor = canvas.height - dog.h - 12;
    if (dog.y < 8) { dog.y = 8; dog.vy = Math.max(dog.vy, 0); }
    if (dog.y > floor) { dog.y = floor; dog.vy = Math.min(dog.vy, 0); }

    // draw dog
    if (A.dog) ctx.drawImage(A.dog, dog.x, dog.y, dog.w, dog.h);

    // timed spawn
    if (now - diffTimerRef.current.lastSpawn >= d.spawnInterval) {
      spawnItem(d);
      diffTimerRef.current.lastSpawn = now;
    }

    // items
    for (let i = itemsRef.current.length - 1; i >= 0; i--) {
      const it = itemsRef.current[i];
      it.x += it.vx * scale;

      if (it.type === "coin" && A.coin) ctx.drawImage(A.coin, it.x, it.y, it.size, it.size);
      if (it.type === "diamond" && A.diamond) ctx.drawImage(A.diamond, it.x, it.y, it.size, it.size);
      if (it.type === "bomb" && A.obstacle) ctx.drawImage(A.obstacle, it.x, it.y, it.size, it.size);

      if (it.x < -it.size) { itemsRef.current.splice(i, 1); continue; }

      if (isHit(dog, it)) {
        if (it.type === "coin") {
          const ns = scoreRef.current + 1;
          scoreRef.current = ns; setScore(ns);
          assetsRef.current.sounds.coin?.play().catch(() => {});
        } else if (it.type === "diamond") {
          const ns = scoreRef.current + 5;
          scoreRef.current = ns; setScore(ns);
          assetsRef.current.sounds.coin?.play().catch(() => {});
        } else {
          assetsRef.current.sounds.bomb?.play().catch(() => {});
          runningRef.current = false;
          setGameOver(true);
          updateLeaderboard(playerName || "Player", scoreRef.current);
          cancelAnimationFrame(rafRef.current);
          return;
        }
        itemsRef.current.splice(i, 1);
      }
    }

    // HUD
    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(`Level: ${d.level}`, 16, 28);

    rafRef.current = requestAnimationFrame(loop);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Controls – press-and-hold (no burst) + keyboard (בוסט עדין לנייח בלבד)
  useEffect(() => {
    const isUI = (el) =>
      el.closest?.("input, textarea, select, button, [role='textbox'], [contenteditable='true']");

    // מקלדת: בוסט עדין. אם תרצה לבטל – תגיד ואסיר.
    const flapOnce = () => {
      if (!runningRef.current) return;
      dogRef.current.vy += flapPowerRef.current * 0.35;
      const s = assetsRef.current.sounds.flap;
      if (s) { try { s.currentTime = 0; s.play(); } catch(_) {} }
    };

    const onKeyDown = (e) => {
      if (isUI(e.target)) return;
      if (e.code === "Space" || e.code === "ArrowUp") flapOnce();
    };

    const canvas = canvasRef.current;

    // מובייל: בלי בוסט חד – רק מצב לחוץ
    const onPointerDown = (e) => {
      if (isUI(e.target)) return;
      e.preventDefault();
      isFlyingRef.current = true;
      canvas?.setPointerCapture?.(e.pointerId);
    };
    const onPointerUp = (e) => {
      isFlyingRef.current = false;
      canvas?.releasePointerCapture?.(e.pointerId);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, { passive: false });
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    document.addEventListener("pointerleave", onPointerUp);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      document.removeEventListener("pointerleave", onPointerUp);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Responsive canvas
  useEffect(() => {
    const onResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const W = Math.min(window.innerWidth * 0.95, 960);
      const H = Math.min(Math.round(W * 0.52), window.innerHeight * 0.8);
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

  // ─────────────────────────────────────────────────────────────────────────────
  function startGame() {
    // request fullscreen on mobile
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const wrapper = document.getElementById("game-wrapper");
    if (isMobile && wrapper?.requestFullscreen) wrapper.requestFullscreen().catch(() => {});
    else if (isMobile && wrapper?.webkitRequestFullscreen) wrapper.webkitRequestFullscreen?.();

    if (!canvasRef.current) { requestAnimationFrame(startGame); return; }

    initGame();
    runningRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }

  function restartGame() {
    setGameOver(false);
    startGame();
  }

  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div
        id="game-wrapper"
        className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative select-none"
      >
        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-[999] text-center p-6">
            <img src="/images/leo-intro.png" alt="Leo" width={220} height={220} className="mb-6 animate-bounce" />
            <h1 className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-2">🛩️ LIO Flyer</h1>
            <p className="text-base sm:text-lg text-gray-200 mb-4">Hold to fly. Collect coins, avoid obstacles.</p>

            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="mb-4 px-4 py-2 rounded text-black w-64 text-center"
            />

            <button
              onClick={() => {
                if (!playerName.trim()) return;
                setShowIntro(false);
                // unlock sounds on gesture
                Object.values(assetsRef.current.sounds || {}).forEach((a) => {
                  try { a.play().then(()=>a.pause()); } catch(_) {}
                });
                startGame();
              }}
              disabled={!playerName.trim()}
              className={`px-8 py-4 font-bold rounded-lg text-xl shadow-lg transition animate-pulse ${
                playerName.trim() ? "bg-yellow-400 text-black hover:scale-105" : "bg-gray-500 text-gray-300 cursor-not-allowed"
              }`}
            >
              ▶ Start Game
            </button>
          </div>
        )}

        {!showIntro && (
          <>
            {/* HUD */}
            <div className="hidden sm:block absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-4 py-2 rounded-lg text-lg font-bold z-[999] top-0.5">
              Score: {score} | High Score: {highScore}
            </div>
            <div className="sm:hidden absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-3 py-1 rounded-md text-base font-bold z-[999] bottom-36">
              Score: {score} | High Score: {highScore}
            </div>

            <div className="relative w-full max-w-[95vw] sm:max-w-[960px]">
              <canvas
                ref={canvasRef}
                className="border-4 border-yellow-400 rounded-lg w-full aspect-[2/1] max-h-[80vh] bg-black/20 touch-none"
              />
              {gameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-[999]">
                  <h2 className="text-4xl sm:text-5xl font-bold text-red-500 mb-4">GAME OVER</h2>
                  <button
                    className="px-6 py-3 bg-yellow-400 text-black font-bold rounded text-base sm:text-lg"
                    onClick={() => {
                      updateLeaderboard(playerName || "Player", scoreRef.current);
                      restartGame();
                    }}
                  >
                    Start Again
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.();
                updateLeaderboard(playerName || "Player", scoreRef.current);
                setShowIntro(true);
                setGameOver(false);
                runningRef.current = false;
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
              }}
              className="fixed top-4 right-4 px-6 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg sm:text-xl z-[999]"
            >
              Exit
            </button>

            {/* Mobile fly button – המאזין הגלובלי מטפל (בלי בוסט חד) */}
            <button
              onPointerDown={(e) => { e.preventDefault(); }}
              className="sm:hidden fixed bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg select-none"
            >
              FLY
            </button>
          </>
        )}
      </div>
    </Layout>
  );
}
