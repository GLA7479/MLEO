// pages/mleo-runner.js
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

  // === helpers: mute flags from localStorage ===
  const getMute = () => {
    if (typeof window === "undefined") return { all:false, music:false, sfx:false };
    const all   = localStorage.getItem("settings:muteAll")   === "true";
    const music = localStorage.getItem("settings:muteMusic") === "true";
    const sfx   = localStorage.getItem("settings:muteSFX")   === "true";
    return { all, music, sfx };
  };

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

    // 🐶 תמונה בודדת של הכלב (לא ספרייט)
    const leoSprite = new window.Image();
    leoSprite.src = "/images/dog.png";

    const coinImg = new window.Image();
    coinImg.src = "/images/leo-logo.png";

    const diamondImg = new window.Image();
    diamondImg.src = "/images/diamond.png";

    const magnetImg = new window.Image();
    magnetImg.src = "/images/magnet.png";

    const coin2Img = new window.Image();
    coin2Img.src = "/images/coin2.png";

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

    // ==== Audio (עם כיבוי בטוח) ====
    let bgMusic, jumpSound, coinSound, gameOverSound;
    const mutes = getMute();

    if (typeof window !== "undefined") {
      const createSafeAudio = (path) => {
        try {
          const a = new Audio(path);
          a.preload = "auto";
          return a;
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
        bgMusic.volume = mutes.all || mutes.music ? 0 : 0.4;
      }
      if (jumpSound)   jumpSound.volume    = mutes.all || mutes.sfx ? 0 : 0.6;
      if (coinSound)   coinSound.volume    = mutes.all || mutes.sfx ? 0 : 0.6;
      if (gameOverSound) gameOverSound.volume = mutes.all || mutes.sfx ? 0 : 0.7;
    }

    // עוצר/מחדש רקע לפי נראות המסך
    const onVisibility = () => {
      if (!bgMusic) return;
      if (document.hidden) bgMusic.pause();
      else if (!mutes.all && !mutes.music && !gameOver) {
        bgMusic.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    let leo, gravity, coins, diamonds, obstacles;
    let coins2 = [];

    let level = 1;
    let showLevelUp = false;
    let levelUpTimer = 0;
    let bgX = 0;
    let running = true;
    let currentScore = 0;
    let speedMultiplier = 1;
    let showHitbox = false;

    let powerUps = [];
    let magnetActive = false;

    // === DPR setup (חדות) ===
    function setupCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.clientWidth || 960;
      const displayHeight = canvas.clientHeight || 480;

      canvas.width = Math.round(displayWidth * dpr);
      canvas.height = Math.round(displayHeight * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }
    setupCanvas();
    window.addEventListener("resize", setupCanvas);

    const DPR = window.devicePixelRatio || 1;
    const CW = () => canvas.width / DPR;
    const CH = () => canvas.height / DPR;

    function isWithinMagnetRange(obj) {
      const dx = Math.abs(leo.x - obj.x);
      const dy = Math.abs(leo.y - obj.y);
      return dx < 150 && dy < 150;
    }

    function initGame() {
      const isMobile = window.innerWidth < 768;

      const LEO_W = isMobile ? 90 : 85;
      const LEO_H = isMobile ? 110 : 100;

      leo = {
        x: CW() * 0.18,
        y: 0,
        width: LEO_W,
        height: LEO_H,
        dy: 0,
        jumping: false,
      };

      gravity = 0.35;
      coins = [];
      diamonds = [];
      powerUps = [];
      obstacles = [];
      currentScore = 0;
      setScore(0);
      setGameOver(false);

      const ground = CH() - 40;
      leo.y = ground - leo.height;
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
      const x = Math.round(leo.x);
      const y = Math.round(leo.y);
      ctx.drawImage(leoSprite, x, y, leo.width, leo.height);
    }

    function update() {
      if (!running) return;

      speedMultiplier = 0.6 + Math.floor(currentScore / 20) * 0.05;

      if (!showLevelUp && currentScore >= level * 30) {
        level++;
        showLevelUp = true;
        levelUpTimer = Date.now();
        const newBgIndex = (level - 1) % backgrounds.length;
        bgImg.src = backgrounds[newBgIndex];
      }

      ctx.clearRect(0, 0, CW(), CH());

      if (bgImg.complete && bgImg.naturalWidth > 0) {
        bgX -= 1.5 * speedMultiplier;
        if (bgX <= -CW()) bgX = 0;
        ctx.drawImage(bgImg, Math.round(bgX), 0, CW(), CH());
        ctx.drawImage(bgImg, Math.round(bgX + CW()), 0, CW(), CH());
      }

      const ground = CH() - 40;

      leo.y += leo.dy;
      if (leo.y + leo.height < ground) leo.dy += gravity;
      else {
        leo.dy = 0;
        leo.jumping = false;
        leo.y = ground - leo.height;
      }

      drawLeo();

      // Coins
      coins.forEach((c, i) => {
        c.x -= 3 * speedMultiplier;

        if (magnetActive && isWithinMagnetRange(c)) {
          const dx = leo.x - c.x;
          const dy = leo.y - c.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const pullStrength = 4;
          if (dist > 1) {
            c.x += (dx / dist) * pullStrength;
            c.y += (dy / dist) * pullStrength;
          }
        }

        if (coinImg.complete) {
          ctx.drawImage(coinImg, Math.round(c.x), Math.round(c.y), c.size, c.size);
        }

        if (
          checkCollision(leo, { x: c.x, y: c.y, width: c.size, height: c.size }) ||
          (magnetActive && isWithinMagnetRange(c))
        ) {
          coins.splice(i, 1);
          currentScore++;
          setScore(currentScore);
          if (coinSound && !(mutes.all || mutes.sfx)) {
            coinSound.currentTime = 0;
            coinSound.play().catch(() => {});
          }
        }

        if (c.x + c.size < 0) coins.splice(i, 1);
      });

      // Diamonds
      diamonds.forEach((d, i) => {
        d.x -= 3 * speedMultiplier;

        if (magnetActive && isWithinMagnetRange(d)) {
          const dx = leo.x - d.x;
          const dy = leo.y - d.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const pullStrength = 4;
          if (dist > 1) {
            d.x += (dx / dist) * pullStrength;
            d.y += (dy / dist) * pullStrength;
          }
        }

        if (diamondImg.complete) {
          ctx.drawImage(diamondImg, Math.round(d.x), Math.round(d.y), d.size, d.size);
        }

        if (
          checkCollision(leo, { x: d.x, y: d.y, width: d.size, height: d.size }) ||
          (magnetActive && isWithinMagnetRange(d))
        ) {
          diamonds.splice(i, 1);
          currentScore += 5;
          setScore(currentScore);
          if (coinSound && !(mutes.all || mutes.sfx)) {
            coinSound.currentTime = 0;
            coinSound.play().catch(() => {});
          }
        }

        if (d.x + d.size < 0) diamonds.splice(i, 1);
      });

      // PowerUps (magnet)
      powerUps.forEach((p) => {
        p.x -= 3 * speedMultiplier;
        if (p.type === "magnet" && magnetImg.complete) {
          ctx.drawImage(magnetImg, Math.round(p.x), Math.round(p.y), p.size, p.size);
        }
      });

      // Obstacles
      obstacles.forEach((o) => {
        if (obstacleImg.complete && obstacleImg.naturalWidth > 0) {
          o.x -= 2.5 * speedMultiplier;
          ctx.drawImage(obstacleImg, Math.round(o.x), Math.round(o.y - o.height), o.width, o.height);
        }
      });

      // Spawns
      if (Math.random() < 0.022) coins.push({ x: CW(), y: Math.random() * 60 + (CH() - 300), size: 38 });
      if (Math.random() < 0.01) coins2.push({ x: CW(), y: Math.random() * 60 + (CH() - 300), size: 40 });
      if (Math.random() < 0.002) diamonds.push({ x: CW(), y: Math.random() * 60 + (CH() - 300), size: 42 });

      if (Math.random() < 0.0015) {
        powerUps.push({ type: "magnet", x: CW(), y: Math.random() * 60 + (CH() - 300), size: 40 });
      }

      if (Math.random() < 0.007) {
        const isMobile = window.innerWidth < 768;
        const scale = isMobile ? 1.8 : 1.5;
        obstacles.push({
          x: CW(),
          y: CH() - 25,
          width: 60 * scale * 0.75,
          height: 60 * scale,
        });
      }

      // Coins2
      coins2.forEach((c, i) => {
        c.x -= 3 * speedMultiplier;

        if (magnetActive && isWithinMagnetRange(c)) {
          const dx = leo.x - c.x;
          const dy = leo.y - c.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const pullStrength = 4;
          if (dist > 1) {
            c.x += (dx / dist) * pullStrength;
            c.y += (dy / dist) * pullStrength;
          }
        }

        if (coin2Img.complete) {
          ctx.drawImage(coin2Img, Math.round(c.x), Math.round(c.y), c.size, c.size);
        }

        if (
          checkCollision(leo, { x: c.x, y: c.y, width: c.size, height: c.size }) ||
          (magnetActive && isWithinMagnetRange(c))
        ) {
          coins2.splice(i, 1);
          currentScore += 3;
          setScore(currentScore);
          if (coinSound && !(mutes.all || mutes.sfx)) {
            coinSound.currentTime = 0;
            coinSound.play().catch(() => {});
          }
        }

        if (c.x + c.size < 0) coins2.splice(i, 1);
      });

      // איסוף מגנט
      powerUps.forEach((p, i) => {
        if (checkCollision(leo, { x: p.x, y: p.y, width: p.size, height: p.size })) {
          powerUps.splice(i, 1);
          if (p.type === "magnet") {
            magnetActive = true;
            setTimeout(() => (magnetActive = false), 5000);
          }
        }
      });

      // פגיעות במכשולים
      obstacles.forEach((o, i) => {
        const reducedHitbox = {
          x: o.x + o.width * 0.5,
          y: o.y - o.height * 0.55,
          width: o.width * 0.1,
          height: o.height * 0.2,
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
            if (jumpSound && !(mutes.all || mutes.sfx)) {
              jumpSound.currentTime = 0;
              jumpSound.play().catch(() => {});
            }
            leo.dy = -10;
            leo.jumping = true;
          } else {
            running = false;
            setGameRunning(false);
            if (bgMusic) bgMusic.pause();
            if (gameOverSound && !(mutes.all || mutes.sfx)) {
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
        ctx.font = "bold 48px Arial";
        ctx.fillStyle = "yellow";
        ctx.textAlign = "center";
        ctx.fillText("LEVEL " + level + "!", CW() / 2, 100);
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

      if (bgMusic && !(mutes.all || mutes.music)) {
        bgMusic.currentTime = 0;
        bgMusic.play().catch(() => {});
      }

      initGame();
      running = true;
      update();
    }

    function jump() {
      if (leo && !leo.jumping) {
        if (jumpSound && !(mutes.all || mutes.sfx)) {
          jumpSound.currentTime = 0;
          jumpSound.play().catch(() => {});
        }
        leo.dy = -8.5;
        leo.jumping = true;
      }
    }

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

    // ==== ניקוי מוחלט של אודיו והאזנות ====
    return () => {
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", setupCanvas);
      document.removeEventListener("visibilitychange", onVisibility);
      running = false;

      // עצירה ושחרור
      [bgMusic, jumpSound, coinSound, gameOverSound].forEach((a) => {
        if (!a) return;
        try {
          a.pause();
          a.currentTime = 0;
          // פריקה מהדפדפן כדי שלא ימשיך "לנשום" אחרי ניווט
          a.src = "";
          a.load?.();
        } catch {}
      });
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
            <>
              {/* ניקוד – רחב */}
              {!showIntro && (
                <div className="hidden sm:block absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-4 py-2 rounded-lg text-lg font-bold z-[999] top-0.5">
                  Score: {score} | High Score: {highScore}
                </div>
              )}
              {/* ניקוד – מובייל */}
              {!showIntro && (
                <div className="sm:hidden absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-3 py-1 rounded-md text-base font-bold z-[999] bottom-36">
                  Score: {score} | High Score: {highScore}
                </div>
              )}
            </>

            <div className="relative w-full max-w-[95vw] sm:max-w-[960px]">
              <canvas
                ref={canvasRef}
                width={960}
                height={480}
                className="relative z-0 border-4 border-yellow-400 rounded-lg w-full aspect-[2/1] max-h-[80vh]"
              />

              {gameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-[999]">
                  <h2 className="text-4xl sm:text-5xl font-bold text-red-500 mb-4">GAME OVER</h2>
                  <button
                    className="px-6 py-3 bg-yellow-400 text-black font-bold rounded text-base sm:text-lg"
                    onClick={() => setGameRunning(true)}
                  >
                    Start Again
                  </button>
                </div>
              )}
            </div>

            {/* 🔙 Back */}
            <button
              onClick={() => window.history.back()}
              className="fixed top-4 left-4 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded z-[999]"
            >
              ⬅ Back
            </button>

            {/* ⬆ Jump */}
            {gameRunning && (
              <button
                onClick={() => {
                  const e = new KeyboardEvent("keydown", { code: "Space" });
                  document.dispatchEvent(e);
                }}
                className="fixed bottom-36 sm:bottom-4 right-4 sm:right-4 sm:left-auto sm:transform-none sm:translate-x-0 px-6 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg sm:text-xl z-[999]
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
                try {
                  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                  else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
                } catch {}
                setGameRunning(false);
                setGameOver(false);
                setShowIntro(true);
              }}
              className="fixed top-4 right-4 px-6 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg sm:text-xl z-[999]"
            >
              Exit
            </button>
          </>
        )}
      </div>
    </Layout>
  );
}
