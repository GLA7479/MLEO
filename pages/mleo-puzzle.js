import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import Image from "next/image";

export default function MleoPuzzle() {
  const canvasRef = useRef(null);
  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);

  const gridSize = 8;
  const tileSize = 50;
  const board = useRef([]);
  const selectedTile = useRef(null);

  const tileTypes = ["coin", "diamond", "bone"];
  const images = useRef({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHighScore(Number(localStorage.getItem("mleoPuzzleHighScore") || 0));
      setLeaderboard(JSON.parse(localStorage.getItem("mleoPuzzleLeaderboard") || "[]"));

      images.current.coin = new window.Image();
      images.current.coin.src = "/images/leo-logo.png";

      images.current.diamond = new window.Image();
      images.current.diamond.src = "/images/diamond.png";

      images.current.bone = new window.Image();
      images.current.bone.src = "/images/bone.png";
    }
  }, []);

  const updateLeaderboard = (name, score) => {
    let stored = JSON.parse(localStorage.getItem("mleoPuzzleLeaderboard") || "[]");
    const idx = stored.findIndex((p) => p.name === name);
    if (idx >= 0) {
      if (score > stored[idx].score) stored[idx].score = score;
    } else {
      stored.push({ name, score });
    }
    stored = stored.sort((a, b) => b.score - a.score).slice(0, 20);
    localStorage.setItem("mleoPuzzleLeaderboard", JSON.stringify(stored));
    setLeaderboard(stored);
  };

  function initBoard() {
    board.current = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => tileTypes[Math.floor(Math.random() * tileTypes.length)])
    );
    removeMatches();
    setScore(0);
    setGameOver(false);
  }

  function draw(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const tile = board.current[r][c];
        const x = c * tileSize;
        const y = r * tileSize;

        ctx.fillStyle = "#222";
        ctx.fillRect(x, y, tileSize, tileSize);

        if (images.current[tile]?.complete) {
          ctx.drawImage(images.current[tile], x + 5, y + 5, tileSize - 10, tileSize - 10);
        }

        ctx.strokeStyle = "#444";
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }
  }

  function swapTiles(r1, c1, r2, c2) {
    const temp = board.current[r1][c1];
    board.current[r1][c1] = board.current[r2][c2];
    board.current[r2][c2] = temp;
  }

  function handleClick(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const c = Math.floor(x / tileSize);
    const r = Math.floor(y / tileSize);

    if (!selectedTile.current) {
      selectedTile.current = { r, c };
    } else {
      const { r: r1, c: c1 } = selectedTile.current;
      if ((Math.abs(r1 - r) === 1 && c1 === c) || (Math.abs(c1 - c) === 1 && r1 === r)) {
        swapTiles(r1, c1, r, c);
        if (checkMatches().length > 0) {
          handleMatches();
        } else {
          swapTiles(r1, c1, r, c); // ביטול אם אין התאמה
        }
      }
      selectedTile.current = null;
    }
  }

  function checkMatches() {
    const matches = [];

    // בדיקת שורות
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize - 2; c++) {
        const t = board.current[r][c];
        if (t && t === board.current[r][c + 1] && t === board.current[r][c + 2]) {
          matches.push([r, c], [r, c + 1], [r, c + 2]);
        }
      }
    }

    // בדיקת עמודות
    for (let c = 0; c < gridSize; c++) {
      for (let r = 0; r < gridSize - 2; r++) {
        const t = board.current[r][c];
        if (t && t === board.current[r + 1][c] && t === board.current[r + 2][c]) {
          matches.push([r, c], [r + 1, c], [r + 2, c]);
        }
      }
    }

    return matches;
  }

  function handleMatches() {
    let matches = checkMatches();
    if (matches.length === 0) return;

    setScore((s) => s + matches.length * 10);

    matches.forEach(([r, c]) => {
      board.current[r][c] = null;
    });

    dropTiles();
    setTimeout(handleMatches, 300);
  }

  function dropTiles() {
    for (let c = 0; c < gridSize; c++) {
      for (let r = gridSize - 1; r >= 0; r--) {
        if (!board.current[r][c]) {
          for (let k = r - 1; k >= 0; k--) {
            if (board.current[k][c]) {
              board.current[r][c] = board.current[k][c];
              board.current[k][c] = null;
              break;
            }
          }
        }
      }

      for (let r = 0; r < gridSize; r++) {
        if (!board.current[r][c]) {
          board.current[r][c] = tileTypes[Math.floor(Math.random() * tileTypes.length)];
        }
      }
    }
  }

  function removeMatches() {
    while (checkMatches().length > 0) {
      handleMatches();
    }
  }

  useEffect(() => {
    if (!gameRunning) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const loop = () => {
      draw(ctx);
      requestAnimationFrame(loop);
    };

    initBoard();
    requestAnimationFrame(loop);
  }, [gameRunning]);

  return (
    <Layout>
      <div id="game-wrapper" className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative">
        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-[999] text-center p-6">
            <Image src="/images/leo-intro.png" alt="Leo" width={220} height={220} className="mb-6 animate-bounce" />
            <h1 className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-2">🧩 LIO Puzzle</h1>
            <p className="text-base sm:text-lg text-gray-200 mb-4">Swap tiles to match 3 and score points!</p>

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
                width={gridSize * tileSize}
                height={gridSize * tileSize}
                className="border-4 border-yellow-400 rounded-lg w-full max-h-[80vh]"
                onClick={handleClick}
              />

              {gameOver && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-[999]">
                  <h2 className="text-4xl sm:text-5xl font-bold text-red-500 mb-4">GAME OVER</h2>
                  <button
                    className="px-6 py-3 bg-yellow-400 text-black font-bold rounded text-base sm:text-lg"
                    onClick={() => {
                      initBoard();
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
          </>
        )}
      </div>
    </Layout>
  );
}
