import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import Image from "next/image";

export default function MleoFlyer() {
  const canvasRef = useRef(null);
  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);

  const playerY = useRef(200);
  const velocity = useRef(0);
  const animationFrameId = useRef(null);
  const coins = useRef([]);
  const dogSprite = useRef(null);
  const bgImg = useRef(null);
  const coinImg = useRef(null);

  const gravity = 0.4;
  const flapStrength = -4;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHighScore(Number(localStorage.getItem("mleoFlyerHighScore") || 0));
      setLeaderboard(JSON.parse(localStorage.getItem("mleoFlyerLeaderboard") || "[]"));

      dogSprite.current = new window.Image();
      dogSprite.current.src = "/images/dog-spritesheet.png";

      bgImg.current = new window.Image();
      bgImg.current.src = "/images/game-day.png";

      coinImg.current = new window.Image();
      coinImg.current.src = "/images/leo-logo.png";
    }
  }, []);

  const updateLeaderboard = (name, score) => {
    let stored = JSON.parse(localStorage.getItem("mleoFlyerLeaderboard") || "[]");
    const idx = stored.findIndex((p) => p.name === name);
    if (idx >= 0) {
      if (score > stored[idx].score) stored[idx].score = score;
    } else {
      stored.push({ name, score });
    }
    stored = stored.sort((a, b) => b.score - a.score).slice(0, 20);
    localStorage.setItem("mleoFlyerLeaderboard", JSON.stringify(stored));
    setLeaderboard(stored);
  };

  function initGame() {
    playerY.current = 200;
    velocity.current = 0;
    coins.current = [];
    setScore(0);
    setGameOver(false);
  }

  function handleFlap() {
    if (!gameRunning) {
      initGame();
      setGameRunning(true);
    }
    velocity.current = flapStrength;
  }

  function updateGame() {
    velocity.current += gravity;
    playerY.current += velocity.current;

    if (playerY.current > 400) {
      playerY.current = 400;
      velocity.current = 0;
    }

    if (Math.random() < 0.05) coins.current.push({ x: 600, y: Math.random() * 300 + 50 });

    coins.current.forEach((c, i) => {
      c.x -= 3;
      if (c.x < -10) coins.current.splice(i, 1);
      const dx = c.x - 80;
      const dy = c.y - playerY.current;
      if (Math.sqrt(dx * dx + dy * dy) < 50) {
        setScore((s) => s + 1);
        coins.current.splice(i, 1);
      }
    });
  }

  function draw(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (bgImg.current?.complete) ctx.drawImage(bgImg.current, 0, 0, ctx.canvas.width, ctx.canvas.height);

    coins.current.forEach((c) => {
      if (coinImg.current?.complete) ctx.drawImage(coinImg.current, c.x, c.y, 30, 30);
    });

    if (dogSprite.current?.complete) {
      const sw = dogSprite.current.width / 4;
      const sh = dogSprite.current.height;
      ctx.drawImage(dogSprite.current, 0, 0, sw, sh, 200, playerY.current, 50, 50);
    } else {
      ctx.fillStyle = "red";
      ctx.fillRect(80, playerY.current, 40, 40);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const loop = () => {
      if (gameRunning) updateGame();
      draw(ctx);
      animationFrameId.current = requestAnimationFrame(loop);
    };

    animationFrameId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [gameRunning]);

  return (
    <Layout>
      <div id="game-wrapper" className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative">
        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-[999] text-center p-6">
            <Image src="/images/leo-intro.png" alt="Leo" width={220} height={220} className="mb-6 animate-bounce" />
            <h1 className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-2">🐶 LIO Flyer</h1>
            <p className="text-base sm:text-lg text-gray-200 mb-4">Fly with Leo and collect coins!</p>

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
                playerName.trim() ? "bg-yellow-400 text-black hover:scale-105" : "bg-gray-500 text-gray-300 cursor-not-allowed"
              }`}
            >
              ▶ Start Game
            </button>
          </div>
        )}

        {!showIntro && (
          <>
            <div className="hidden sm:block absolute left-1/2 transform -translate-x-1/2 bg-black/60 px-4 py-2 rounded-lg text-lg font-bold z-[999] top-10">
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
                onClick={handleFlap}
              />

              {gameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-[999]">
                  <h2 className="text-4xl sm:text-5xl font-bold text-red-500 mb-4">GAME OVER</h2>
                  <button
                    className="px-6 py-3 bg-yellow-400 text-black font-bold rounded text-base sm:text-lg"
                    onClick={() => {
                      initGame();
                      setGameRunning(true);
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
                else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
                setGameRunning(false);
                setGameOver(false);
                setShowIntro(true);
              }}
              className="fixed top-16 right-4 px-6 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg sm:text-xl z-[999]"
            >
              Exit
            </button>

            {gameRunning && (
              <button
                onTouchStart={handleFlap}
                onMouseDown={handleFlap}
                className="fixed bottom-8 left-1/2 transform -translate-x-1/2 px-8 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg"
              >
                ⬆ FLY
              </button>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
