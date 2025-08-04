import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";

// --- Asset paths (adjust if needed) ---
const BG_IMAGES = ["/images/game1.png", "/images/game2.png", "/images/game3.png", "/images/game4.png"];
const SPRITE_DOG = "/images/leo2.png";           // or "/images/dog-fly-sprite.png"
const IMG_COIN = "/images/coin.png";
const IMG_DIAMOND = "/images/diamond.png";
const IMG_OBSTACLE = "/images/obstacle1.png";

const SND_FLAP = "/sounds/flap.mp3";
const SND_WIN = "/sounds/win.mp3";
const SND_LOSE = "/sounds/game-over.mp3";
const SND_COIN = "/sounds/coin.mp3";
const SND_BOMB = "/sounds/bomb.mp3";

// === Tunables ===
// Overall chance each frame to spawn an item (0.0 - 1.0)
export const spawnRate = 0.03;                // e.g., 0.03 = 3% per frame
// Per-type probabilities (do not need to sum to 1.0; will be normalized)
export const chanceCoin = 0.65;
export const chanceDiamond = 0.25;
export const chanceBomb = 0.10;

// Optional: sizes per type (px)
export const sizeCoin = 42;
export const sizeDiamond = 34;
export const sizeBomb = 50;

export default function MleoFlyer() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const runningRef = useRef(false);

  // UI / general state
  const [showIntro, setShowIntro] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0); // keep an always-fresh score reference
  const [highScore, setHighScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);

  // world
  const dogRef = useRef(null);
  const itemsRef = useRef([]);
  const bgIndexRef = useRef(0);
  const gravityRef = useRef(0.35);
  const flapPowerRef = useRef(-4.2);

  // preloaded assets
  const assetsRef = useRef({
    bgs: [],
    dog: null,
    coin: null,
    diamond: null,
    obstacle: null,
    sounds: {},
  });

  // --- block context menu / selection / long-press (like your other games) ---
  useEffect(() => {
    const preventMenu = (e) => e.preventDefault();
    const preventSelection = (e) => e.preventDefault();

    document.addEventListener("contextmenu", preventMenu);
    document.addEventListener("selectstart", preventSelection);
    document.addEventListener("copy", preventSelection);

    let touchTimer;
    const handleTouchStart = (e) => {
      touchTimer = setTimeout(() => {
        e.preventDefault();
      }, 500);
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

  // --- preload images & sounds ---
  useEffect(() => {
    const loadImage = (src) =>
      new Promise((res) => {
        const img = new Image();
        img.onload = () => res(img);
        img.src = src;
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
      Object.values(assetsRef.current.sounds).forEach((a) => {
        a.volume = 1.0;
      });
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

  // --- init game ---
  function initGame() {
    const canvas = canvasRef.current;
    if (!canvas) return; // guard against null
    const W = canvas.clientWidth || window.innerWidth * 0.95;
    const H = Math.min(Math.round(W * 0.52), window.innerHeight * 0.8);
    canvas.width = W;
    canvas.height = H;

    dogRef.current = {
      x: canvas.width / 3,
      y: H / 2,
      w: 70,
      h: 60,
      vy: 0,
    };
    itemsRef.current = [];
    bgIndexRef.current = Math.floor(Math.random() * BG_IMAGES.length);
    gravityRef.current = 0.05;
    flapPowerRef.current = -2;
    scoreRef.current = 0;
    setScore(0);
    setGameOver(false);
  }

  // --- spawn items with tunable probabilities ---
  function spawnItem() {
    // normalize chances (so they don't have to sum to 1)
    const total = chanceCoin + chanceDiamond + chanceBomb;
    let type = "coin";
    if (total > 0) {
      const r = Math.random() * total;
      if (r < chanceCoin) type = "coin";
      else if (r < chanceCoin + chanceDiamond) type = "diamond";
      else type = "bomb";
    }

    // sizes per type
    let size = type === "diamond" ? sizeDiamond : type === "coin" ? sizeCoin : sizeBomb;

    const canvas = canvasRef.current;
    itemsRef.current.push({
      type,
      x: (canvas?.width || 800) + size,
      y: Math.random() * ((canvas?.height || 400) - size - 30) + 15,
      size,
      vx: -3.3,
    });
  }

  // --- simple AABB collision ---
  function isHit(dog, it) {
    const a = { x: dog.x + 10, y: dog.y + 8, w: dog.w - 20, h: dog.h - 16 };
    const b = { x: it.x, y: it.y, w: it.size, h: it.size };
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // --- main loop ---
  function loop() {
    if (!runningRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = requestAnimationFrame(loop); return; }
    const ctx = canvas.getContext("2d");
    const A = assetsRef.current;

    // background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bg = A.bgs[bgIndexRef.current];
    if (bg) ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

    // update dog
    const dog = dogRef.current;
    dog.vy += gravityRef.current;
    dog.y += dog.vy;
    const floor = canvas.height - dog.h - 12;
    if (dog.y < 8) dog.y = 8;
    if (dog.y > floor) dog.y = floor;

    // draw dog
    if (A.dog) ctx.drawImage(A.dog, dog.x, dog.y, dog.w, dog.h);

    // spawn by overall rate
    if (Math.random() < spawnRate) spawnItem();

    // items move & draw & collide
    for (let i = itemsRef.current.length - 1; i >= 0; i--) {
      const it = itemsRef.current[i];
      it.x += it.vx;

      if (it.type === "coin" && A.coin) ctx.drawImage(A.coin, it.x, it.y, it.size, it.size);
      if (it.type === "diamond" && A.diamond) ctx.drawImage(A.diamond, it.x, it.y, it.size, it.size);
      if (it.type === "bomb" && A.obstacle) ctx.drawImage(A.obstacle, it.x, it.y, it.size, it.size);

      if (it.x < -it.size) {
        itemsRef.current.splice(i, 1);
        continue;
      }

      if (isHit(dog, it)) {
        if (it.type === "coin") {
          setScore((s) => {
            const ns = s + 1;
            scoreRef.current = ns;
            A.sounds.coin?.play().catch(() => {});
            return ns;
          });
        } else if (it.type === "diamond") {
          setScore((s) => {
            const ns = s + 5;
            scoreRef.current = ns;
            A.sounds.coin?.play().catch(() => {});
            return ns;
          });
        } else {
          // hit obstacle -> Game Over
          A.sounds.bomb?.play().catch(() => {});
          runningRef.current = false;
          setGameOver(true);
          updateLeaderboard(playerName || "Player", scoreRef.current);
          cancelAnimationFrame(rafRef.current);
          return;
        }
        itemsRef.current.splice(i, 1);
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }

  // --- controls ---
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!runningRef.current) return;
      if (e.code === "Space" || e.code === "ArrowUp") {
        dogRef.current.vy = flapPowerRef.current;
        assetsRef.current.sounds.flap?.play().catch(() => {});
      }
    };
    const onTouch = (e) => {
      if (!runningRef.current) return;
      e.preventDefault();
      dogRef.current.vy = flapPowerRef.current;
      assetsRef.current.sounds.flap?.play().catch(() => {});
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("touchstart", onTouch, { passive: false });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("touchstart", onTouch);
    };
  }, []);

  // --- responsive canvas sizing ---
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

  function startGame() {
    // request fullscreen on mobile (user gesture)
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const wrapper = document.getElementById("game-wrapper");
    if (isMobile && wrapper?.requestFullscreen) wrapper.requestFullscreen().catch(() => {});
    else if (isMobile && wrapper?.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();

    // ensure canvas exists; if not, retry on next frame (or fallback to short timeout)
    if (!canvasRef.current) {
      requestAnimationFrame(startGame);
      return;
    }

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
            <p className="text-base sm:text-lg text-gray-200 mb-4">Tap / Space to fly. Collect coins, avoid obstacles.</p>

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
                // unlock sounds on user gesture
                Object.values(assetsRef.current.sounds || {}).forEach((a) => { try { a.play().then(()=>a.pause()); } catch(_) {} });
                // start after next tick to ensure canvas mounted
                setTimeout(() => startGame(), 0);
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
            <div className="hidden sm:block absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-4 py-2 rounded-lg text-lg font-bold z-[999] top-10">
              Score: {score} | High Score: {highScore}
            </div>
            <div className="sm:hidden absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-3 py-1 rounded-md text-base font-bold z-[999] bottom-36">
              Score: {score} | High Score: {highScore}
            </div>

            <div className="relative w-full max-w-[95vw] sm:max-w-[960px]">
              <canvas
                ref={canvasRef}
                className="border-4 border-yellow-400 rounded-lg w-full aspect-[2/1] max-h-[80vh] bg-black/20"
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
                // exit fullscreen & back to intro
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.();
                updateLeaderboard(playerName || "Player", scoreRef.current);
                setShowIntro(true);
                setGameOver(false);
                runningRef.current = false;
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
              }}
              className="fixed top-16 right-4 px-6 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg sm:text-xl z-[999]"
            >
              Exit
            </button>

            {/* Mobile fly button (touch anywhere also works) */}
            <button
              onTouchStart={(e) => {
                e.preventDefault();
                dogRef.current.vy = flapPowerRef.current;
                assetsRef.current.sounds.flap?.play().catch(() => {});
              }}
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
