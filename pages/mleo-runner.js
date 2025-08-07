// גרסה משופרת של MleoRunner עם תיקונים למגנט, coin2, קפיצה, סאונד ו־LevelUp
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
      setHighScore(Number(localStorage.getItem("mleoHighScore") || 0));
      setLeaderboard(JSON.parse(localStorage.getItem("leaderboard") || "[]"));
    }
  }, []);

  useEffect(() => {
    if (!gameRunning) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const leoSprite = new window.Image(); leoSprite.src = "/images/dog-spritesheet.png";
    const coinImg = new window.Image(); coinImg.src = "/images/leo-logo.png";
    const coin2Img = new window.Image(); coin2Img.src = "/images/coin2.png";
    const diamondImg = new window.Image(); diamondImg.src = "/images/diamond.png";
    const magnetImg = new window.Image(); magnetImg.src = "/images/magnet.png";
    const obstacleImg = new window.Image(); obstacleImg.src = "/images/obstacle.png";

    const backgrounds = ["/images/game-day.png","/images/game-evening.png","/images/game-night.png","/images/game-space.png","/images/game-park.png"];
    let bgImg = new window.Image(); bgImg.src = backgrounds[0];

    let bgMusic = new Audio("/sounds/bg-music.mp3");
    let jumpSound = new Audio("/sounds/jump.mp3");
    let coinSound = new Audio("/sounds/coin.mp3");
    let coin2Sound = new Audio("/sounds/coin2.mp3");
    let diamondSound = new Audio("/sounds/diamond.mp3");
    let gameOverSound = new Audio("/sounds/game-over.mp3");

    let leo, gravity, coins, diamonds, obstacles, frame = 0, frameCount = 0;
    let level = 1, showLevelUp = false, levelUpTimer = 0, bgX = 0, running = true;
    let currentScore = 0, speedMultiplier = 1, showHitbox = false;
    let powerUps = [], magnetActive = false;

    function initGame() {
      const scale = window.innerWidth < 768 ? 1.8 : 1.5;
      leo = { x: canvas.width/2 - (100*scale), y: canvas.height - 80 - (100*scale), width: 45*scale, height: 100*scale, dy: 0, jumping: false };
      gravity = 0.35;
      coins = []; diamonds = []; obstacles = []; powerUps = [];
      frame = 0; frameCount = 0; currentScore = 0;
      setScore(0); setGameOver(false);
    }

    function checkCollision(r1, r2) {
      return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x && r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
    }

    function drawLeo() {
      if (!leoSprite.complete) return;
      const sw = leoSprite.width / 4;
      ctx.drawImage(leoSprite, frame * sw, 0, sw, leoSprite.height, leo.x, leo.y, leo.width, leo.height);
      if (++frameCount % 6 === 0) frame = (frame + 1) % 4;
    }

    function update() {
      if (!running) return;
      speedMultiplier = 0.6 + Math.floor(currentScore / 20) * 0.05;

      if (!showLevelUp && currentScore >= level * 30) {
        level++; showLevelUp = true; levelUpTimer = Date.now();
        bgImg.src = backgrounds[(level - 1) % backgrounds.length];
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      bgX -= 1.5 * speedMultiplier;
      if (bgX <= -canvas.width) bgX = 0;
      ctx.drawImage(bgImg, bgX, 0, canvas.width, canvas.height);
      ctx.drawImage(bgImg, bgX + canvas.width, 0, canvas.width, canvas.height);

      const ground = canvas.height - 40;
      leo.y += leo.dy;
      if (leo.y + leo.height < ground) leo.dy += gravity;
      else { leo.dy = 0; leo.jumping = false; leo.y = ground - leo.height; }

      drawLeo();

      // משיכת מגנט
      if (magnetActive) {
        [...coins, ...diamonds].forEach(obj => {
          const dx = leo.x - obj.x, dy = leo.y - obj.y, dist = Math.hypot(dx, dy);
          if (dist < 200) { obj.x += dx * 0.08; obj.y += dy * 0.08; }
        });
      }

      // יצירת פריטים
      if (Math.random() < 0.02) coins.push({ x: canvas.width, y: Math.random() * 60 + 180, size: 38, type: 'coin' });
      if (Math.random() < 0.01) coins.push({ x: canvas.width, y: Math.random() * 60 + 180, size: 40, type: 'coin2' });
      if (Math.random() < 0.003) diamonds.push({ x: canvas.width, y: Math.random() * 60 + 180, size: 42 });
      if (Math.random() < 0.0015) powerUps.push({ type: "magnet", x: canvas.width, y: Math.random() * 60 + 180, size: 40 });
      if (Math.random() < 0.012) {
        const scale = window.innerWidth < 768 ? 1.8 : 1.5;
        obstacles.push({ x: canvas.width, y: ground - 10, width: 60 * scale * 0.75, height: 60 * scale });
      }

      // ציור ואיסוף פריטים
      coins.forEach((c, i) => {
        c.x -= 3 * speedMultiplier;
        const img = c.type === 'coin2' ? coin2Img : coinImg;
        ctx.drawImage(img, c.x, c.y, c.size, c.size);
        if (checkCollision(leo, { x: c.x, y: c.y, width: c.size, height: c.size })) {
          coins.splice(i, 1);
          currentScore += c.type === 'coin2' ? 2 : 1;
          setScore(currentScore);
          (c.type === 'coin2' ? coin2Sound : coinSound).play().catch(() => {});
        }
        if (c.x + c.size < 0) coins.splice(i, 1);
      });

      diamonds.forEach((d, i) => {
        d.x -= 3 * speedMultiplier;
        ctx.drawImage(diamondImg, d.x, d.y, d.size, d.size);
        if (checkCollision(leo, { x: d.x, y: d.y, width: d.size, height: d.size })) {
          diamonds.splice(i, 1);
          currentScore += 5;
          setScore(currentScore);
          diamondSound.play().catch(() => {});
        }
        if (d.x + d.size < 0) diamonds.splice(i, 1);
      });

      powerUps.forEach((p, i) => {
        p.x -= 1.5 * speedMultiplier;
        if (p.type === "magnet") ctx.drawImage(magnetImg, p.x, p.y, p.size, p.size);
        if (checkCollision(leo, { x: p.x, y: p.y, width: p.size, height: p.size })) {
          powerUps.splice(i, 1);
          magnetActive = true;
          setTimeout(() => magnetActive = false, 5000);
        }
      });

      obstacles.forEach((o, i) => {
        o.x -= 2.5 * speedMultiplier;
        ctx.drawImage(obstacleImg, o.x, o.y - o.height, o.width, o.height);
        const hitbox = { x: o.x + o.width * 0.5, y: o.y - o.height * 0.55, width: o.width * 0.1, height: o.height * 0.2 };
        if (checkCollision(leo, hitbox)) {
          if (leo.y + leo.height - 15 <= hitbox.y) {
            jumpSound.play().catch(() => {});
            leo.dy = -10; leo.jumping = true;
          } else {
            running = false;
            setGameRunning(false);
            bgMusic.pause();
            gameOverSound.play().catch(() => {});
            setGameOver(true);
            if (currentScore > highScore) {
              setHighScore(currentScore);
              localStorage.setItem("mleoHighScore", currentScore);
            }
            const stored = JSON.parse(localStorage.getItem("leaderboard") || "[]");
            let updated = [...stored];
            const idx = updated.findIndex(p => p.name === playerName);
            if (idx >= 0) updated[idx].score = Math.max(currentScore, updated[idx].score);
            else updated.push({ name: playerName, score: currentScore });
            updated = updated.sort((a, b) => b.score - a.score).slice(0, 20);
            localStorage.setItem("leaderboard", JSON.stringify(updated));
            setLeaderboard(updated);
          }
        }
        if (o.x + o.width < 0) obstacles.splice(i, 1);
      });

      if (showLevelUp && Date.now() - levelUpTimer < 2000) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - (Date.now() - levelUpTimer) / 2000);
        ctx.font = 'bold 60px Arial';
        ctx.fillStyle = 'gold';
        ctx.textAlign = 'center';
        ctx.fillText('LEVEL ' + level, canvas.width / 2, 100);
        ctx.restore();
      } else if (Date.now() - levelUpTimer >= 2000) showLevelUp = false;

      requestAnimationFrame(update);
    }

    function startGame() {
      initGame();
      bgMusic.currentTime = 0;
      bgMusic.play().catch(() => {});
      running = true;
      update();
    }

    function jump() {
      if (leo && !leo.jumping) {
        jumpSound.play().catch(() => {});
        leo.dy = -8.5; leo.jumping = true;
      }
    }

    function handleKey(e) {
      if (e.code === "Space") jump();
      if (e.code === "KeyH") showHitbox = !showHitbox;
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
<>
  {/* ניקוד במסכים רחבים */}
  {!showIntro && (
    <div className="hidden sm:block absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-4 py-2 rounded-lg text-lg font-bold z-[999] top-10">
      Score: {score} | High Score: {highScore}
    </div>
  )}

  {/* ניקוד במסכים קטנים */}
  {!showIntro && (
    <div className="sm:hidden absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-3 py-1 rounded-md text-base font-bold z-[999] bottom-36">
      Score: {score} | High Score: {highScore}
    </div>
  )}
</>




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
