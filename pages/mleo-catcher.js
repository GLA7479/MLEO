// pages/mleo-catcher.js
import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import Image from "next/image";

export default function MleoCatcher() {
  // ─────────────────────────────────────────────────────────────────────────────
  // מניעת העתקה/תפריט/לחיצה ארוכה
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const preventMenu = (e) => e.preventDefault();
    const preventSelection = (e) => e.preventDefault();

    document.addEventListener("contextmenu", preventMenu);
    document.addEventListener("selectstart", preventSelection);
    document.addEventListener("copy", preventSelection);

    let touchTimer;
    const handleTouchStart = (e) => {
      touchTimer = setTimeout(() => e.preventDefault(), 500);
    };
    const handleTouchEnd = () => clearTimeout(touchTimer);

    document.addEventListener("touchstart", handleTouchStart, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("contextmenu", preventMenu);
      document.removeEventListener("selectstart", preventSelection);
      document.removeEventListener("copy", preventSelection);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Refs + State
  // ─────────────────────────────────────────────────────────────────────────────
  const canvasRef = useRef(null);
  const assetsRef = useRef(null);        // טעינת תמונות פעם אחת
  const leoRef = useRef(null);
  const itemsRef = useRef([]);
  const currentScoreRef = useRef(0);
  const runningRef = useRef(false);
  const rafRef = useRef(0);

  // ↓ לניהול קושי דינמי
  const diffTimerRef = useRef({ lastSpawn: 0 });

  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Persisted data
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedHighScore = Number(localStorage.getItem("mleoCatcherHighScore") || 0);
    setHighScore(savedHighScore);
    const stored = JSON.parse(localStorage.getItem("mleoCatcherLeaderboard") || "[]");
    setLeaderboard(stored);
  }, []);

  const updateLeaderboard = (name, scoreVal) => {
    let stored = JSON.parse(localStorage.getItem("mleoCatcherLeaderboard") || "[]");
    const idx = stored.findIndex((p) => p.name === name);
    if (idx >= 0) {
      if (scoreVal > stored[idx].score) stored[idx].score = scoreVal;
    } else {
      stored.push({ name, score: scoreVal });
    }
    stored = stored.sort((a, b) => b.score - a.score).slice(0, 20);
    localStorage.setItem("mleoCatcherLeaderboard", JSON.stringify(stored));
    setLeaderboard(stored);

    const hs = Number(localStorage.getItem("mleoCatcherHighScore") || 0);
    if (scoreVal > hs) {
      localStorage.setItem("mleoCatcherHighScore", String(scoreVal));
      setHighScore(scoreVal);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Difficulty helpers
  // ─────────────────────────────────────────────────────────────────────────────
  function getDifficulty() {
    const s = currentScoreRef.current;
    const level = Math.floor(s / 10);                 // כל 10 נק' = רמה
    const spawnInterval = Math.max(1200 - level * 120, 250); // מרווח ספאון (ms)
    const itemSpeed = Math.min(3 + level * 0.5, 9);           // מהירות נפילה
    const bombBias = Math.min(0.2 + level * 0.05, 0.6);       // סיכוי לבומבה
    return { spawnInterval, itemSpeed, bombBias, level };
  }

  function getPlayerSpeed() {
    return 5 + Math.min(currentScoreRef.current / 20, 3);     // 5–8
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Game helpers
  // ─────────────────────────────────────────────────────────────────────────────
  function preloadAssets() {
    // טען פעם אחת בלבד
    if (assetsRef.current) return assetsRef.current;

    const leoSprite = new window.Image();
    leoSprite.src = "/images/leo.png";

    const coinImg = new window.Image();
    coinImg.src = "/images/leo-logo.png";

    const diamondImg = new window.Image();
    diamondImg.src = "/images/diamond.png";

    const bombImg = new window.Image();
    bombImg.src = "/images/obstacle1.png";

    const bgImg = new window.Image();
    bgImg.src = "/images/game10.png";

    assetsRef.current = { leoSprite, coinImg, diamondImg, bombImg, bgImg };
    return assetsRef.current;
  }

  function initGame() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    leoRef.current = {
      x: canvas.width / 2 - 50,
      y: canvas.height - 120,
      width: 60,
      height: 70,
      dx: 0,
    };
    itemsRef.current = [];
    currentScoreRef.current = 0;
    setScore(0);
    setGameOver(false);
    diffTimerRef.current.lastSpawn = performance.now();
  }

  function spawnItem(diff) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // בחירת סוג לפי משקלים דינמיים
    const r = Math.random();
    let type = "coin";
    if (r < diff.bombBias) type = "bomb";
    else if (r < diff.bombBias + 0.25) type = "diamond";

    // גדלים
    let size = 40;
    if (type === "bomb") size = 70;
    if (type === "coin") size = 50;
    if (type === "diamond") size = 35;

    // מהירות נפילה של האייטם
    const vy = diff.itemSpeed + Math.random() * 0.8;

    itemsRef.current.push({
      x: Math.random() * (canvas.width - size),
      y: -size,
      size,
      type,
      vy,
    });
  }

  function checkCollision(a, b) {
    const leoHitbox = {
      x: a.x + 10,
      y: a.y + 10,
      width: a.width - 20,
      height: a.height - 35,
    };

    const touchingFromAbove =
      b.y + b.size >= leoHitbox.y && b.y <= leoHitbox.y + leoHitbox.height;

    return (
      touchingFromAbove &&
      leoHitbox.x < b.x + b.size &&
      leoHitbox.x + leoHitbox.width > b.x
    );
  }

  function updateGame() {
    if (!runningRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) {
      rafRef.current = requestAnimationFrame(updateGame);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rafRef.current = requestAnimationFrame(updateGame);
      return;
    }

    const { leoSprite, coinImg, diamondImg, bombImg, bgImg } = assetsRef.current || {};

    // ציור רקע
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (bgImg && bgImg.complete) ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

    // תזוזת ליאו
    const leo = leoRef.current;
    if (leo) {
      leo.x += leo.dx;
      if (leo.x < 0) leo.x = 0;
      if (leo.x + leo.width > canvas.width) leo.x = canvas.width - leo.width;

      if (leoSprite && leoSprite.complete) {
        ctx.drawImage(leoSprite, leo.x, leo.y, leo.width, leo.height);
      }
    }

    // ציור/עדכון אייטמים
    itemsRef.current.forEach((item, i) => {
      item.y += item.vy; // ← מהירות דינמית

      if (item.type === "coin" && coinImg?.complete)
        ctx.drawImage(coinImg, item.x, item.y, item.size, item.size);
      if (item.type === "diamond" && diamondImg?.complete)
        ctx.drawImage(diamondImg, item.x, item.y, item.size, item.size);
      if (item.type === "bomb" && bombImg?.complete)
        ctx.drawImage(bombImg, item.x, item.y, item.size, item.size);

      if (leo && checkCollision(leo, item)) {
        if (item.type === "coin") currentScoreRef.current += 1;
        if (item.type === "diamond") currentScoreRef.current += 5;
        if (item.type === "bomb") {
          runningRef.current = false;
          setGameOver(true);
          updateLeaderboard(playerName, currentScoreRef.current);
        }
        itemsRef.current.splice(i, 1);
        setScore(currentScoreRef.current);
      } else if (item.y > canvas.height) {
        itemsRef.current.splice(i, 1);
      }
    });

    // ספאון לפי טיימר דינמי
    const now = performance.now();
    const diff = getDifficulty();
    if (now - diffTimerRef.current.lastSpawn >= diff.spawnInterval) {
      spawnItem(diff);
      diffTimerRef.current.lastSpawn = now;
    }

    // (אופציונלי) תצוגת רמה
    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(`Level: ${diff.level}`, 16, 28);

    rafRef.current = requestAnimationFrame(updateGame);
  }

  function startGame() {
    // מסך מלא במובייל
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const wrapper = document.getElementById("game-wrapper");
    if (isMobile && wrapper?.requestFullscreen) wrapper.requestFullscreen().catch(() => {});
    else if (isMobile && wrapper?.webkitRequestFullscreen) wrapper.webkitRequestFullscreen?.();

    preloadAssets();
    initGame();
    runningRef.current = true;
    updateGame();
  }

  const moveLeft = () => {
    if (leoRef.current) leoRef.current.dx = -getPlayerSpeed(); // ← דינמי
  };
  const moveRight = () => {
    if (leoRef.current) leoRef.current.dx = getPlayerSpeed();  // ← דינמי
  };
  const stopMove = () => {
    if (leoRef.current) leoRef.current.dx = 0;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Game lifecycle
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameRunning) return;

    const handleKey = (e) => {
      if (!leoRef.current) return;
      if (e.code === "ArrowLeft") moveLeft();
      if (e.code === "ArrowRight") moveRight();
    };

    const handleKeyUp = (e) => {
      if (!leoRef.current) return;
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") stopMove();
    };

    document.addEventListener("keydown", handleKey);
    document.addEventListener("keyup", handleKeyUp);

    // נתחיל רק בפריים הבא כדי לוודא שהקנבס כבר ב‑DOM
    requestAnimationFrame(() => startGame());

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("keyup", handleKeyUp);
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [gameRunning]);

  // ─────────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div
        id="game-wrapper"
        className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative select-none"
      >
        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-[999] text-center p-6">
            <Image src="/images/leo-intro.png" alt="Leo" width={220} height={220} className="mb-6 animate-bounce" />
            <h1 className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-2">🎯 LIO Catcher</h1>
            <p className="text-base sm:text-lg text-gray-200 mb-4">Move Leo to catch coins and avoid bombs!</p>

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
                updateLeaderboard(playerName, 0);
                setShowIntro(false);
                setGameRunning(true);
              }}
              disabled={!playerName.trim()}
              className={`px-8 py-4 font-bold rounded-lg text-xl shadow-lg transition animate-pulse ${
                playerName.trim()
                  ? "bg-yellow-400 text-black hover:scale-105"
                  : "bg-gray-500 text-gray-300 cursor-not-allowed"
              }`}
            >
              ▶ Start Game
            </button>
          </div>
        )}

        {!showIntro && (
          <>
            <div className="hidden sm:block absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-4 py-2 rounded-lg text-lg font-bold z-[999] top-0.5">
              Score: {score} | High Score: {highScore}
            </div>
            <div className="sm:hidden absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-3 py-1 rounded-md text-base font-bold z-[999] bottom-36">
              Score: {score} | High Score: {highScore}
            </div>

            <div className="relative w-full max-w-[95vw] sm:max-w-[960px]">
              <canvas
                ref={canvasRef}
                width={960}
                height={480}
                className="border-4 border-yellow-400 rounded-lg w-full aspect-[2/1] max-h-[80vh]"
              />

              {gameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-[999]">
                  <h2 className="text-4xl sm:text-5xl font-bold text-red-500 mb-4">GAME OVER</h2>
                  <button
                    className="px-6 py-3 bg-yellow-400 text-black font-bold rounded text-base sm:text-lg"
                    onClick={() => {
                      setGameRunning(false);
                      setGameOver(false);
                      setTimeout(() => setGameRunning(true), 50);
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
                setGameRunning(false);
                setGameOver(false);
                setShowIntro(true);
              }}
              className="fixed top-4 right-4 px-6 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg sm:text-xl z-[999]"
            >
              Exit
            </button>

            {gameRunning && (
              <>
                <button
                  onTouchStart={moveLeft}
                  onTouchEnd={stopMove}
                  className="fixed bottom-8 left-4 px-8 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg select-none"
                >
                  ◀ Left
                </button>
                <button
                  onTouchStart={moveRight}
                  onTouchEnd={stopMove}
                  className="fixed bottom-8 right-4 px-8 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg select-none"
                >
                  Right ▶
                </button>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
