import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import Image from "next/image";

export default function MleoCatcher() {
  const canvasRef = useRef(null);
  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    const savedHighScore = localStorage.getItem("mleoCatcherHighScore") || 0;
    setHighScore(Number(savedHighScore));

    const stored = JSON.parse(localStorage.getItem("mleoCatcherLeaderboard") || "[]");
    setLeaderboard(stored);
  }, []);

  const updateLeaderboard = (name, score) => {
    let stored = JSON.parse(localStorage.getItem("mleoCatcherLeaderboard") || "[]");
    const playerIndex = stored.findIndex((p) => p.name === name);
    if (playerIndex >= 0) {
      if (score > stored[playerIndex].score) stored[playerIndex].score = score;
    } else {
      stored.push({ name, score });
    }
    stored = stored.sort((a, b) => b.score - a.score).slice(0, 20);
    localStorage.setItem("mleoCatcherLeaderboard", JSON.stringify(stored));
    setLeaderboard(stored);

    // בעתיד: שליחת הנתונים לשרת חיצוני לשמירה
    // fetch("/api/leaderboard", { method: "POST", body: JSON.stringify({ name, score }) });
  };

  useEffect(() => {
    if (!gameRunning) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const leoSprite = new window.Image();
    leoSprite.src = "/images/dog-spritesheet.png";

    const coinImg = new window.Image();
    coinImg.src = "/images/leo-logo.png";

    const diamondImg = new window.Image();
    diamondImg.src = "/images/diamond.png";

    const bombImg = new window.Image();
    bombImg.src = "/images/obstacle.png";

    const bgImg = new window.Image();
    bgImg.src = "/images/game-day.png";

    let leo = { x: canvas.width / 2 - 50, y: canvas.height - 120, width: 90, height: 100, dx: 0 };
    let items = [];
    let currentScore = 0;
    let running = true;

    function spawnItem() {
      const types = ["coin", "diamond", "bomb"];
      const type = types[Math.floor(Math.random() * types.length)];
      items.push({ x: Math.random() * (canvas.width - 40), y: -40, size: 40, type });
    }

    function checkCollision(a, b) {
      return a.x < b.x + b.size && a.x + a.width > b.x && a.y < b.y + b.size && a.y + a.height > b.y;
    }

    function drawLeo() {
      if (!leoSprite.complete) return;
      const sw = leoSprite.width / 4;
      const sh = leoSprite.height;
      ctx.drawImage(leoSprite, 0, 0, sw, sh, leo.x, leo.y, leo.width, leo.height);
    }

    function update() {
      if (!running) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (bgImg.complete) ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

      leo.x += leo.dx;
      if (leo.x < 0) leo.x = 0;
      if (leo.x + leo.width > canvas.width) leo.x = canvas.width - leo.width;

      drawLeo();

      items.forEach((item, i) => {
        item.y += 3;
        if (item.type === "coin" && coinImg.complete) ctx.drawImage(coinImg, item.x, item.y, item.size, item.size);
        if (item.type === "diamond" && diamondImg.complete) ctx.drawImage(diamondImg, item.x, item.y, item.size, item.size);
        if (item.type === "bomb" && bombImg.complete) ctx.drawImage(bombImg, item.x, item.y, item.size, item.size);

        if (checkCollision(leo, item)) {
          if (item.type === "coin") currentScore++;
          if (item.type === "diamond") currentScore += 5;
          if (item.type === "bomb") {
            running = false;
            setGameOver(true);
            updateLeaderboard(playerName, currentScore);
          }
          items.splice(i, 1);
          setScore(currentScore);
        } else if (item.y > canvas.height) {
          items.splice(i, 1);
        }
      });

      if (Math.random() < 0.05) spawnItem();

      requestAnimationFrame(update);
    }

    function startGame() {
      leo.x = canvas.width / 2 - 50;
      items = [];
      currentScore = 0;
      setScore(0);
      setGameOver(false);
      running = true;
      update();
    }

    function handleKey(e) {
      if (e.code === "ArrowLeft") leo.dx = -5;
      if (e.code === "ArrowRight") leo.dx = 5;
    }

    function stopMove(e) {
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") leo.dx = 0;
    }

    document.addEventListener("keydown", handleKey);
    document.addEventListener("keyup", stopMove);
    startGame();

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("keyup", stopMove);
      running = false;
    };
  }, [gameRunning]);

  return (
    <Layout>
      <div id="game-wrapper" className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative">
        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-[999] text-center p-6">
            <Image src="/images/leo-intro.png" alt="Leo" width={220} height={220} className="mb-6 animate-bounce" />
            <h1 className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-2">🎯 LIO Catcher</h1>
            <p className="text-base sm:text-lg text-gray-200 mb-4">Move Leo to catch coins and avoid bombs!</p>

            <input type="text" placeholder="Enter your name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="mb-4 px-4 py-2 rounded text-black w-64 text-center" />

            <button
              onClick={() => {
                if (!playerName.trim()) return;
                updateLeaderboard(playerName, 0);
                setShowIntro(false);
                setGameRunning(true);
              }}
              disabled={!playerName.trim()}
              className={`px-8 py-4 font-bold rounded-lg text-xl shadow-lg transition animate-pulse ${playerName.trim() ? "bg-yellow-400 text-black hover:scale-105" : "bg-gray-500 text-gray-300 cursor-not-allowed"}`}
            >
              ▶ Start Game
            </button>

            <div className="absolute top-12 right-4 bg-black/50 p-4 rounded-lg w-72 shadow-lg hidden sm:block">
              <h2 className="text-lg font-bold mb-2 text-yellow-300">🏆 Leaderboard</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">#</th>
                    <th className="text-left">Player</th>
                    <th className="text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((p, i) => (
                    <tr key={i} className="border-t border-gray-600">
                      <td className="py-1">{i + 1}</td>
                      <td className="py-1">{p.name}</td>
                      <td className="text-right py-1">{p.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!showIntro && (
          <>
            <div className="absolute top-10 left-1/2 transform -translate-x-1/2 bg-black/60 px-4 py-2 rounded-lg text-lg font-bold z-[999]">
              Score: {score} | High Score: {highScore}
            </div>

            <div className="relative w-full max-w-[95vw] sm:max-w-[960px]">
              <canvas ref={canvasRef} width={960} height={480} className="border-4 border-yellow-400 rounded-lg w-full aspect-[2/1] max-h-[80vh]" />

              {gameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-[999]">
                  <h2 className="text-4xl sm:text-5xl font-bold text-red-500 mb-4">GAME OVER</h2>
                  <button className="px-6 py-3 bg-yellow-400 text-black font-bold rounded text-base sm:text-lg" onClick={() => setGameRunning(true)}>
                    Start Again
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); setGameRunning(false); setGameOver(false); setShowIntro(true); }} className="fixed top-16 right-4 px-6 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg sm:text-xl z-[999]">
              Exit
            </button>

            {gameRunning && (
              <div className="fixed bottom-8 left-0 right-0 flex justify-center gap-6 z-[999]">
                <button onTouchStart={() => document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowLeft" }))} onTouchEnd={() => document.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowLeft" }))} className="px-8 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg">
                  ◀ Left
                </button>
                <button onTouchStart={() => document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight" }))} onTouchEnd={() => document.dispatchEvent(new KeyboardEvent("keyup", { code: "ArrowRight" }))} className="px-8 py-4 bg-yellow-400 text-black font-bold rounded-lg text-lg">
                  Right ▶
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
