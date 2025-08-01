import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import Image from "next/image";

export default function MleoRunner() {
  const canvasRef = useRef(null);
  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const [playerName, setPlayerName] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedHighScore = localStorage.getItem("mleoHighScore") || 0;
      setHighScore(Number(savedHighScore));

      const stored = JSON.parse(localStorage.getItem("leaderboard") || "[]");
      setLeaderboard(stored);
    }
  }, []);

  useEffect(() => {
    if (!gameRunning) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const leoSprite = new window.Image();
    leoSprite.src = "/images/dog-spritesheet.png";

    const coinImg = new window.Image();
    coinImg.src = "/images/leo-logo.png";

    const obstacleImg = new window.Image();
    obstacleImg.src = "/images/obstacle.png";

    const backgrounds = [
  "/images/game-day.png",
  "/images/game-evening.png",
  "/images/game-night.png",
  "/images/game-space.png",
  "/images/game-park.png",
];
let bgImg = new window.Image();
bgImg.src = backgrounds[0];

    // 🎵 יצירת קבצי סאונד רק בדפדפן
    let bgMusic, jumpSound, coinSound, gameOverSound;

    if (typeof window !== "undefined") {
      const createSafeAudio = (path) => {
        try {
          return new Audio(path);
        } catch {
          return null;
        }
      };

      bgMusic = createSafeAudio("/sounds/bg-music.mp3");
      jumpSound = createSafeAudio("/sounds/jump.mp3");
      coinSound = createSafeAudio("/sounds/coin.mp3");
      gameOverSound = createSafeAudio("/sounds/game-over.mp3");

      if (bgMusic) {
        bgMusic.loop = true;
        bgMusic.volume = 0.4;
      }
      if (jumpSound) jumpSound.volume = 0.6;
      if (coinSound) coinSound.volume = 0.6;
      if (gameOverSound) gameOverSound.volume = 0.7;
    }

    let leo, gravity, coins, obstacles, frame = 0, frameCount = 0;
    let level = 1;
    let showLevelUp = false;
    let levelUpTimer = 0;
    let bgX = 0;
    let running = true;
    let currentScore = 0;
    let speedMultiplier = 1;
    let showHitbox = false; // ✅ מאפשר הדלקה/כיבוי עם מקש H

    function initGame() {
      const isMobile = window.innerWidth < 768;
      const scale = isMobile ? 1.8 : 1.5;

leo = { 
  x: canvas.width / 2 - (100 * scale), 
  y: 200, 
  width: 70 * scale, 
  height: 70 * scale, 
  dy: 0, 
  jumping: false 
};

      gravity = 0.5;
      coins = [];
      obstacles = [];
      frame = 0;
      frameCount = 0;
      currentScore = 0;
      setScore(0);
      setGameOver(false);
    }

    function checkCollision(r1, r2) {
      return (
        r1.x < r2.x + r2.width &&
        r1.x + r1.width > r2.x &&
        r1.y < r2.y + r2.height &&
        r1.y + r1.height > r2.y
      );
    }

    function drawLeo() {
      if (!leoSprite.complete || leoSprite.naturalWidth === 0) return;
      const sw = leoSprite.width / 4;
      const sh = leoSprite.height;
      ctx.drawImage(leoSprite, frame * sw, 0, sw, sh, leo.x, leo.y, leo.width, leo.height);
      frameCount++;
      if (frameCount % 6 === 0) frame = (frame + 1) % 4;
    }

    function update() {
      if (!running) return;

      speedMultiplier = 1 + Math.floor(currentScore / 10) * 0.1;

      if (currentScore >= level * 30) {
        level++;
        showLevelUp = true;
        levelUpTimer = Date.now();
        const newBgIndex = (level - 1) % backgrounds.length;
        bgImg.src = backgrounds[newBgIndex];
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (bgImg.complete && bgImg.naturalWidth > 0) {
        bgX -= 1.5 * speedMultiplier;
        if (bgX <= -canvas.width) bgX = 0;
        ctx.drawImage(bgImg, bgX, 0, canvas.width, canvas.height);
        ctx.drawImage(bgImg, bgX + canvas.width, 0, canvas.width, canvas.height);
      }

      const ground = canvas.height - 80;
      leo.y += leo.dy;
      if (leo.y + leo.height < ground) leo.dy += gravity;
      else {
        leo.dy = 0;
        leo.jumping = false;
        leo.y = ground - leo.height;
      }

      drawLeo();

      coins.forEach((c) => {
        if (coinImg.complete && coinImg.naturalWidth > 0) {
          c.x -= 3 * speedMultiplier;
          ctx.drawImage(coinImg, c.x, c.y, c.size, c.size);
        }
      });

      obstacles.forEach((o) => {
        if (obstacleImg.complete && obstacleImg.naturalWidth > 0) {
          o.x -= 4 * speedMultiplier;
          ctx.drawImage(obstacleImg, o.x, o.y - o.height, o.width, o.height);
        }
      });

      if (Math.random() < 0.03) coins.push({ x: canvas.width, y: Math.random() * 120 + 120, size: 38 });
      if (Math.random() < 0.012) {
        const isMobile = window.innerWidth < 768;
        const scale = isMobile ? 1.8 : 1.5;
        obstacles.push({
          x: canvas.width,
          y: ground + 30,
          width: 60 * scale * 0.75,
          height: 60 * scale,
        });
      }

      coins.forEach((c, i) => {
        if (checkCollision(leo, { x: c.x, y: c.y, width: c.size, height: c.size })) {
          coins.splice(i, 1);
          currentScore++;
          setScore(currentScore);

          if (coinSound) {
            coinSound.currentTime = 0;
            coinSound.play().catch(() => {});
          }
        }
        if (c.x + c.size < 0) coins.splice(i, 1);
      });

      // ✅ בדיקת פגיעה במכשול (Hitbox מוקטן + אפשרות הדמיה עם H)
  obstacles.forEach((o, i) => {
  const reducedHitbox = {
    x: o.x + o.width * 0.2,      // במקום 0.15 → מקטין יותר מהצד
    y: o.y - o.height * 0.85,    // במקום 0.9 → מקטין יותר מלמעלה
    width: o.width * 0.6,        // במקום 0.7 → צר יותר
    height: o.height * 0.8,      // במקום 0.9 → נמוך יותר
  };

        if (showHitbox) {
          ctx.save();
          ctx.strokeStyle = "rgba(255,0,0,0.7)";
          ctx.lineWidth = 2;
          ctx.strokeRect(reducedHitbox.x, reducedHitbox.y, reducedHitbox.width, reducedHitbox.height);
          ctx.restore();
        }

        if (checkCollision(leo, reducedHitbox)) {
          if (leo.y + leo.height - 15 <= reducedHitbox.y) {
            if (jumpSound) {
        jumpSound.currentTime = 0;
        jumpSound.play().catch(() => {});
      }
      leo.dy = -10;
            leo.jumping = true;
          } else {
            running = false;
            setGameRunning(false);
            if (bgMusic) bgMusic.pause();
            if (gameOverSound) {
              gameOverSound.currentTime = 0;
              gameOverSound.play().catch(() => {});
            }

            setGameOver(true);

            if (currentScore > highScore) {
              setHighScore(currentScore);
              localStorage.setItem("mleoHighScore", currentScore);
            }

            const stored = JSON.parse(localStorage.getItem("leaderboard") || "[]");
            let updated = [...stored];
            const playerIndex = updated.findIndex((p) => p.name === playerName);
            if (playerIndex >= 0) {
              if (currentScore > updated[playerIndex].score) updated[playerIndex].score = currentScore;
            } else {
              updated.push({ name: playerName, score: currentScore });
            }
            updated = updated.sort((a, b) => b.score - a.score).slice(0, 20);
            localStorage.setItem("leaderboard", JSON.stringify(updated));
            setLeaderboard(updated);
          }
        }
        if (o.x + o.width < 0) obstacles.splice(i, 1);
      });

            if (showLevelUp && Date.now() - levelUpTimer < 2000) {
        ctx.save();
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = 'yellow';
        ctx.textAlign = 'center';
        ctx.fillText('LEVEL ' + level + '!', canvas.width / 2, 100);
        ctx.restore();
      } else if (Date.now() - levelUpTimer >= 2000) {
        showLevelUp = false;
      }

      requestAnimationFrame(update);
    }

    function startGame() {
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const wrapper = document.getElementById("game-wrapper");
      if (isMobile && wrapper?.requestFullscreen) wrapper.requestFullscreen().catch(() => {});
      else if (isMobile && wrapper?.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();

      if (bgMusic) {
        bgMusic.currentTime = 0;
        bgMusic.play().catch(() => {});
      }

      initGame();
      running = true;
      update();
    }

    function jump() {
      if (leo && !leo.jumping) {
        if (jumpSound) {
        jumpSound.currentTime = 0;
        jumpSound.play().catch(() => {});
      }
      leo.dy = -10;
        leo.jumping = true;
      }
    }

    // ✅ הוספנו אפשרות ללחוץ על H כדי להציג/להסתיר Hitbox
    function handleKey(e) {
      if (e.code === "Space") {
        e.preventDefault();
        jump();
      }
      if (e.code === "KeyH") {
        showHitbox = !showHitbox;
      }
    }

    document.addEventListener("keydown", handleKey);
    startGame();

    return () => {
      document.removeEventListener("keydown", handleKey);
      running = false;
    };
  }, [gameRunning]);

  return (
    <Layout>
      <div id="game-wrapper" className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative">
        {/* 🎬 מסך פתיחה */}
        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-[999] text-center p-6">
            <Image src="/images/leo-intro.png" alt="Leo" width={220} height={220} className="mb-6 animate-bounce" />
            <h1 className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-2">🚀 LIO Runner</h1>
            <p className="text-base sm:text-lg text-gray-200 mb-4">Help Leo collect coins and reach the moon!</p>

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
                const stored = JSON.parse(localStorage.getItem("leaderboard") || "[]");
                if (!stored.find((p) => p.name === playerName)) {
                  stored.push({ name: playerName, score: 0 });
                  localStorage.setItem("leaderboard", JSON.stringify(stored.slice(-20)));
                }
                setShowIntro(false);
                setGameRunning(true);
              }}
              disabled={!playerName.trim()}
              className={`px-8 py-4 font-bold rounded-lg text-xl shadow-lg transform transition animate-pulse ${
                playerName.trim() ? "bg-yellow-400 text-black hover:scale-105" : "bg-gray-500 text-gray-300 cursor-not-allowed"
              }`}
            >
              ▶ Start Game
            </button>

            {/* 📊 טבלת השיאים */}
            <div className="absolute top-12 right-20 bg-black/50 p-4 rounded-lg w-72 shadow-lg hidden sm:block">
              <h2 className="text-lg font-bold mb-2 text-yellow-300">🏆 Leaderboard</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">#</th>
                    <th className="text-left">Player</th>
                    <th className="text-right">High Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((p, i) => (
                    <tr key={i} className="border-t border-gray-600">
                      <td className="text-left py-1">{i + 1}</td>
                      <td className="text-left py-1">{p.name}</td>
                      <td className="text-right py-1">{p.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 🎮 מסך המשחק */}
        {!showIntro && (
          <>
          {/* ניקוד במסכים רחבים */}
{!showIntro && (
  <div
    className="hidden sm:block absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-4 py-2 rounded-lg text-lg font-bold z-[999] top-20"
  >
    Score: {score} | High Score: {highScore}
  </div>
)}

{/* ניקוד במסכים רגילים */}
{!showIntro && (
  <div
    className="sm:hidden absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-3 py-1 rounded-md text-base font-bold z-[999] top-40"
  >
    {score}
  </div>
)}


            <div className="relative w-full max-w-[95vw] sm:max-w-[960px]">
              <canvas ref={canvasRef} width={960} height={480} className="relative z-0 border-4 border-yellow-400 rounded-lg w-full aspect-[2/1] max-h-[80vh]" />

              {gameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-[999]">
                  <h2 className="text-4xl sm:text-5xl font-bold text-red-500 mb-4">GAME OVER</h2>
                  <button className="px-6 py-3 bg-yellow-400 text-black font-bold rounded text-base sm:text-lg" onClick={() => setGameRunning(true)}>
                    Start Again
                  </button>
                </div>
              )}
            </div>

            {/* 🔙 Back */}
            <button onClick={() => window.history.back()} className="fixed top-4 left-4 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded z-[999]">
              ⬅ Back
            </button>

            {/* ⬆ Jump */}
{/* כפתור Jump רגיל */}
{gameRunning && (
  <button
    onClick={() => {
      const e = new KeyboardEvent("keydown", { code: "Space" });
      document.dispatchEvent(e);
    }}
    className="fixed bottom-16 sm:bottom-4 right-4 sm:right-4 sm:left-auto sm:transform-none sm:translate-x-0 px-6 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg sm:text-xl z-[999]
               sm:bottom-4 sm:right-4 left-1/2 transform -translate-x-1/2 sm:left-auto"
  >
    Jump
  </button>
)}

{/* כפתור Jump נוסף למסכים רחבים בצד שמאל */}
{gameRunning && (
  <button
    onClick={() => {
      const e = new KeyboardEvent("keydown", { code: "Space" });
      document.dispatchEvent(e);
    }}
    className="hidden sm:block fixed bottom-4 left-4 px-6 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg sm:text-xl z-[999]"
  >
    Jump
  </button>
)}


            {/* 🚪 Exit */}
            <button
              onClick={() => {
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
                setGameRunning(false);
                setGameOver(false);
                setShowIntro(true);
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
