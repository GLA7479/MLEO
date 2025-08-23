// pages/mleo-runner.js
import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import Image from "next/image";

export default function MleoRunner() {
  const canvasRef = useRef(null);

  // ---------- UI / state ----------
  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver]   = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [score, setScore]         = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerName, setPlayerName]   = useState("");
  const [leaderboard, setLeaderboard] = useState([]);

  // ---------- Audio (נוצר פעם אחת) ----------
  const audioRef = useRef({
    bg: null,
    jump: null,
    coin: null,
    over: null,
    created: false,
  });

  // אחראי ליצור את האובייקטים פעם אחת בלבד
  const ensureAudio = () => {
    if (audioRef.current.created) return audioRef.current;
    const safe = (src) => {
      try { return new Audio(src); } catch { return null; }
    };
    const bg   = safe("/sounds/bg-music.mp3");
    const jump = safe("/sounds/jump.mp3");
    const coin = safe("/sounds/coin.mp3");
    const over = safe("/sounds/game-over.mp3");

    if (bg)   { bg.loop = true; bg.volume = 0.4; }
    if (jump) jump.volume = 0.6;
    if (coin) coin.volume = 0.6;
    if (over) over.volume = 0.7;

    audioRef.current = { bg, jump, coin, over, created: true };
    return audioRef.current;
  };

  // עצירת כל הסאונדים ואיפוסם
  const stopAllAudio = () => {
    const { bg, jump, coin, over } = audioRef.current;
    [bg, jump, coin, over].forEach(a => {
      if (!a) return;
      try { a.pause(); a.currentTime = 0; } catch {}
    });
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedHighScore = localStorage.getItem("mleoHighScore") || 0;
      setHighScore(Number(savedHighScore));
      const stored = JSON.parse(localStorage.getItem("leaderboard") || "[]");
      setLeaderboard(stored);
    }

    // אם האפליקציה הולכת לרקע – לעצור מוזיקה
    const onVis = () => {
      if (document.hidden) stopAllAudio();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // -------- משחק (לולאה/קנבס) --------
  useEffect(() => {
    if (!gameRunning) {
      // כשלא משחקים – לא מנגנים
      stopAllAudio();
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // תמונות
    const leoSprite   = new window.Image(); leoSprite.src   = "/images/dog.png";
    const coinImg     = new window.Image(); coinImg.src     = "/images/leo-logo.png";
    const diamondImg  = new window.Image(); diamondImg.src  = "/images/diamond.png";
    const magnetImg   = new window.Image(); magnetImg.src   = "/images/magnet.png";
    const coin2Img    = new window.Image(); coin2Img.src    = "/images/coin2.png";
    const obstacleImg = new window.Image(); obstacleImg.src = "/images/obstacle.png";

    const backgrounds = [
      "/images/game-day.png",
      "/images/game-evening.png",
      "/images/game-night.png",
      "/images/game-space.png",
      "/images/game-park.png",
    ];
    let bgImg = new window.Image();
    bgImg.src = backgrounds[0];

    // סאונד
    const { bg: bgMusic, jump: jumpSound, coin: coinSound, over: gameOverSound } = ensureAudio();

    let leo, gravity, coins, diamonds, obstacles;
    let coins2 = [];
    let powerUps = [];
    let magnetActive = false;

    let level = 1;
    let showLevelUp = false;
    let levelUpTimer = 0;
    let bgX = 0;
    let running = true;
    let currentScore = 0;
    let speedMultiplier = 1;
    let showHitbox = false;

    // DPI
    function setupCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const displayWidth  = canvas.clientWidth  || 960;
      const displayHeight = canvas.clientHeight || 480;
      canvas.width  = Math.round(displayWidth  * dpr);
      canvas.height = Math.round(displayHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }
    setupCanvas();
    window.addEventListener("resize", setupCanvas);
    const DPR = window.devicePixelRatio || 1;
    const CW = () => canvas.width / DPR;
    const CH = () => canvas.height / DPR;

    function initGame() {
      const isMobile = window.innerWidth < 768;
      const LEO_W = isMobile ? 90 : 85;
      const LEO_H = isMobile ? 110 : 100;

      leo = { x: CW() * 0.18, y: 0, width: LEO_W, height: LEO_H, dy: 0, jumping: false };
      gravity = 0.35;
      coins = []; diamonds = []; obstacles = []; coins2 = []; powerUps = [];
      currentScore = 0; setScore(0); setGameOver(false);

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

    const drawLeo = () => {
      if (!leoSprite.complete || leoSprite.naturalWidth === 0) return;
      ctx.drawImage(leoSprite, Math.round(leo.x), Math.round(leo.y), leo.width, leo.height);
    };

    function update() {
      if (!running) return;

      // מוזיקת רקע – לוודא ניגון יחיד
      if (bgMusic && bgMusic.paused) {
        bgMusic.currentTime = 0;
        bgMusic.play().catch(() => {});
      }

      speedMultiplier = 0.6 + Math.floor(currentScore / 20) * 0.05;

      if (!showLevelUp && currentScore >= level * 30) {
        level++; showLevelUp = true; levelUpTimer = Date.now();
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

      // פיזיקה בסיסית
      const ground = CH() - 40;
      leo.y += leo.dy;
      if (leo.y + leo.height < ground) leo.dy += gravity;
      else { leo.dy = 0; leo.jumping = false; leo.y = ground - leo.height; }

      drawLeo();

      // ----- Coins -----
      const magnetPull = (obj) => {
        const dx = leo.x - obj.x, dy = leo.y - obj.y;
        const dist = Math.hypot(dx, dy); const pull = 4;
        if (dist > 1) { obj.x += (dx / dist) * pull; obj.y += (dy / dist) * pull; }
      };
      const withinMagnet = (o) => Math.abs(leo.x - o.x) < 150 && Math.abs(leo.y - o.y) < 150;

      coins.forEach((c, i) => {
        c.x -= 3 * speedMultiplier;
        if (magnetActive && withinMagnet(c)) magnetPull(c);
        if (coinImg.complete) ctx.drawImage(coinImg, Math.round(c.x), Math.round(c.y), c.size, c.size);
        if (checkCollision(leo, { x: c.x, y: c.y, width: c.size, height: c.size }) || (magnetActive && withinMagnet(c))) {
          coins.splice(i, 1);
          currentScore++; setScore(currentScore);
          if (audioRef.current.coin) { audioRef.current.coin.currentTime = 0; audioRef.current.coin.play().catch(()=>{}); }
        }
        if (c.x + c.size < 0) coins.splice(i, 1);
      });

      diamonds.forEach((d, i) => {
        d.x -= 3 * speedMultiplier;
        if (magnetActive && withinMagnet(d)) magnetPull(d);
        if (diamondImg.complete) ctx.drawImage(diamondImg, Math.round(d.x), Math.round(d.y), d.size, d.size);
        if (checkCollision(leo, { x: d.x, y: d.y, width: d.size, height: d.size }) || (magnetActive && withinMagnet(d))) {
          diamonds.splice(i, 1);
          currentScore += 5; setScore(currentScore);
          if (audioRef.current.coin) { audioRef.current.coin.currentTime = 0; audioRef.current.coin.play().catch(()=>{}); }
        }
        if (d.x + d.size < 0) diamonds.splice(i, 1);
      });

      powerUps.forEach((p, i) => {
        p.x -= 3 * speedMultiplier;
        if (p.type === "magnet" && magnetImg.complete)
          ctx.drawImage(magnetImg, Math.round(p.x), Math.round(p.y), p.size, p.size);
        if (checkCollision(leo, { x: p.x, y: p.y, width: p.size, height: p.size })) {
          powerUps.splice(i, 1);
          if (p.type === "magnet") { magnetActive = true; setTimeout(()=> (magnetActive = false), 5000); }
        }
      });

      obstacles.forEach((o, i) => {
        if (obstacleImg.complete) {
          o.x -= 2.5 * speedMultiplier;
          ctx.drawImage(obstacleImg, Math.round(o.x), Math.round(o.y - o.height), o.width, o.height);
          const hb = { x: o.x + o.width * 0.5, y: o.y - o.height * 0.55, width: o.width * 0.1, height: o.height * 0.2 };
          if (checkCollision(leo, hb)) {
            if (leo.y + leo.height - 15 <= hb.y) {
              if (audioRef.current.jump) { audioRef.current.jump.currentTime = 0; audioRef.current.jump.play().catch(()=>{}); }
              leo.dy = -10; leo.jumping = true;
            } else {
              // --- GAME OVER ---
              running = false;
              setGameRunning(false);
              stopAllAudio();
              if (audioRef.current.over) { audioRef.current.over.currentTime = 0; audioRef.current.over.play().catch(()=>{}); }
              setGameOver(true);

              if (currentScore > highScore) {
                setHighScore(currentScore);
                localStorage.setItem("mleoHighScore", currentScore);
              }
              const stored = JSON.parse(localStorage.getItem("leaderboard") || "[]");
              let updated = [...stored];
              const idx = updated.findIndex(p => p.name === playerName);
              if (idx >= 0) { if (currentScore > updated[idx].score) updated[idx].score = currentScore; }
              else { updated.push({ name: playerName, score: currentScore }); }
              updated = updated.sort((a,b)=> b.score - a.score).slice(0,20);
              localStorage.setItem("leaderboard", JSON.stringify(updated));
              setLeaderboard(updated);
            }
          }
          if (o.x + o.width < 0) obstacles.splice(i, 1);
        }
      });

      // Spawns
      if (Math.random() < 0.022) coins.push({ x: CW(), y: Math.random() * 60 + (CH() - 300), size: 38 });
      if (Math.random() < 0.01) coins2.push({ x: CW(), y: Math.random() * 60 + (CH() - 300), size: 40 });
      if (Math.random() < 0.002) diamonds.push({ x: CW(), y: Math.random() * 60 + (CH() - 300), size: 42 });
      if (Math.random() < 0.0015) powerUps.push({ type: "magnet", x: CW(), y: Math.random() * 60 + (CH() - 300), size: 40 });
      if (Math.random() < 0.007) {
        const isMobile = window.innerWidth < 768;
        const scale = isMobile ? 1.8 : 1.5;
        obstacles.push({ x: CW(), y: CH() - 25, width: 60 * scale * 0.75, height: 60 * scale });
      }

      // ניקוד על מסך רחב/צר – נשאר כמו שהיה
      requestAnimationFrame(update);
    }

    function startGame() {
      const wrapper = document.getElementById("game-wrapper");
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile && wrapper?.requestFullscreen) wrapper.requestFullscreen().catch(()=>{});
      else if (isMobile && wrapper?.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();

      // נגן רקע
      const { bg } = ensureAudio();
      if (bg) { bg.currentTime = 0; bg.play().catch(()=>{}); }

      initGame();
      update();
    }

    function jump() {
      const { jump } = audioRef.current;
      if (jump) { jump.currentTime = 0; jump.play().catch(()=>{}); }
      // ה־leo נוצר בתוך update; נשתמש ברפרנס גלובלי
      // נחלץ דרך closure:
      // (למעלה הוגדר leo; כאן רק נשנה dy אם קיים)
      if (typeof leo !== "undefined" && !leo.jumping) {
        leo.dy = -8.5; leo.jumping = true;
      }
    }

    function handleKey(e) {
      if (e.code === "Space") { e.preventDefault(); jump(); }
      if (e.code === "KeyH") { showHitbox = !showHitbox; }
    }

    document.addEventListener("keydown", handleKey);
    startGame();

    // ---- Cleanup כשעוזבים את העמוד / משנים מצב ----
    return () => {
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", setupCanvas);
      stopAllAudio();
    };
  }, [gameRunning, highScore, playerName]);

  // ---------- UI ----------
  return (
    <Layout>
      <div id="game-wrapper" className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative">

        {/* מסך פתיחה */}
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
          </div>
        )}

        {/* המשחק */}
        {!showIntro && (
          <>
            {/* ניקוד – רחב */}
            <div className="hidden sm:block absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-4 py-2 rounded-lg text-lg font-bold z-[999] top-6">
              Score: {score} | High Score: {highScore}
            </div>
            {/* ניקוד – צר */}
            <div className="sm:hidden absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-3 py-1 rounded-md text-base font-bold z-[999] bottom-36">
              Score: {score} | High Score: {highScore}
            </div>

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
                    onClick={() => { setGameOver(false); setGameRunning(true); }}
                  >
                    Start Again
                  </button>
                </div>
              )}
            </div>

            {/* Back */}
            <button
              onClick={() => {
                stopAllAudio();
                window.history.back();
              }}
              className="fixed top-4 left-4 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded z-[999]"
            >
              ⬅ Back
            </button>

            {/* Jump – מובייל */}
            {gameRunning && (
              <>
                <button
                  onClick={() => {
                    const e = new KeyboardEvent("keydown", { code: "Space" });
                    document.dispatchEvent(e);
                  }}
                  className="fixed bottom-36 sm:bottom-4 right-4 sm:right-4 sm:left-auto px-6 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg sm:text-xl z-[999]
                             left-1/2 transform -translate-x-1/2 sm:translate-x-0 sm:left-auto"
                >
                  Jump
                </button>
                <button
                  onClick={() => {
                    const e = new KeyboardEvent("keydown", { code: "Space" });
                    document.dispatchEvent(e);
                  }}
                  className="hidden sm:block fixed bottom-4 left-4 px-6 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg sm:text-xl z-[999]"
                >
                  Jump
                </button>
              </>
            )}

            {/* Exit */}
            <button
              onClick={() => {
                if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
                else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.();
                stopAllAudio();
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
