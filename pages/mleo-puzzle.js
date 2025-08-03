import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import Image from "next/image";

export default function MleoPuzzle() {
  const canvasRef = useRef(null);
  const [gameRunning, setGameRunning] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);

  const [windowWidth, setWindowWidth] = useState(800);
  const [tileSize, setTileSize] = useState(50);
  const gridSize = 8;

  const board = useRef([]);
  const animPositions = useRef([]);
  const selectedTile = useRef(null);
  const swappingTiles = useRef(null);
  const comboRef = useRef(0);
  const idleTimer = useRef(null);
  const hintTile = useRef(null);
  const matchEffects = useRef([]);

  const tileTypes = ["coin", "diamond", "bone"];
  const images = useRef({});
  const sounds = useRef({});

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

      sounds.current.swap = new Audio("/sounds/swap.mp3");
      sounds.current.match = new Audio("/sounds/match.mp3");
      sounds.current.clear = new Audio("/sounds/clear.mp3");
    }
  }, []);

  useEffect(() => {
    const resizeHandler = () => {
      const width = window.innerWidth;
      setWindowWidth(width);
      setTileSize(width < 500 ? 35 : width < 800 ? 45 : 50);
    };
    resizeHandler();
    window.addEventListener("resize", resizeHandler);
    return () => window.removeEventListener("resize", resizeHandler);
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
    animPositions.current = board.current.map((row, r) =>
      row.map((_, c) => ({ x: c * tileSize, y: r * tileSize }))
    );
    removeMatches();
    setScore(0);
  }

  function draw(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const tile = board.current[r][c];
        if (!tile) continue;

        const pos = animPositions.current[r][c];
        ctx.fillStyle = "#222";
        ctx.fillRect(pos.x, pos.y, tileSize, tileSize);

        if (images.current[tile]?.complete) {
          ctx.drawImage(images.current[tile], pos.x + 5, pos.y + 5, tileSize - 10, tileSize - 10);
        }

        if (hintTile.current && hintTile.current.r === r && hintTile.current.c === c) {
          ctx.strokeStyle = "yellow";
          ctx.lineWidth = 3;
          ctx.strokeRect(pos.x + 2, pos.y + 2, tileSize - 4, tileSize - 4);
        } else {
          ctx.strokeStyle = "#444";
          ctx.lineWidth = 1;
          ctx.strokeRect(pos.x, pos.y, tileSize, tileSize);
        }
      }
    }

    matchEffects.current.forEach((effect) => {
      const ctxAlpha = 1 - effect.progress;
      ctx.save();
      ctx.globalAlpha = ctxAlpha;
      ctx.beginPath();
      ctx.arc(effect.x + tileSize / 2, effect.y + tileSize / 2, tileSize * effect.progress, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,0,0.8)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      effect.progress += 0.05;
    });

    matchEffects.current = matchEffects.current.filter((e) => e.progress < 1);
  }

  function animatePositions() {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const targetX = c * tileSize;
        const targetY = r * tileSize;
        const pos = animPositions.current[r][c];

        pos.x += (targetX - pos.x) * 0.3;
        pos.y += (targetY - pos.y) * 0.3;
      }
    }
  }

  function swapTiles(r1, c1, r2, c2) {
    const temp = board.current[r1][c1];
    board.current[r1][c1] = board.current[r2][c2];
    board.current[r2][c2] = temp;
  }

  function animateSwap(r1, c1, r2, c2, callback) {
    if (
      !animPositions.current[r1] ||
      !animPositions.current[r1][c1] ||
      !animPositions.current[r2] ||
      !animPositions.current[r2][c2]
    ) {
      callback();
      return;
    }

    const startPos1 = { ...animPositions.current[r1][c1] };
    const startPos2 = { ...animPositions.current[r2][c2] };

    swappingTiles.current = { r1, c1, r2, c2, progress: 0 };

    const animate = () => {
      if (!swappingTiles.current) return;
      swappingTiles.current.progress += 0.1;

      const p = swappingTiles.current.progress;

      if (
        animPositions.current[r1] &&
        animPositions.current[r1][c1] &&
        animPositions.current[r2] &&
        animPositions.current[r2][c2]
      ) {
        animPositions.current[r1][c1].x = startPos1.x + (c2 - c1) * tileSize * p;
        animPositions.current[r1][c1].y = startPos1.y + (r2 - r1) * tileSize * p;

        animPositions.current[r2][c2].x = startPos2.x + (c1 - c2) * tileSize * p;
        animPositions.current[r2][c2].y = startPos2.y + (r1 - r2) * tileSize * p;
      }

      if (p < 1) {
        requestAnimationFrame(animate);
      } else {
        swappingTiles.current = null;
        callback();
      }
    };

    animate();
  }

  function checkMatches() {
    const matches = [];
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize - 2; c++) {
        const t = board.current[r][c];
        if (t && t === board.current[r][c + 1] && t === board.current[r][c + 2]) {
          matches.push([r, c], [r, c + 1], [r, c + 2]);
        }
      }
    }
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
    if (matches.length === 0) {
      comboRef.current = 0;
      return;
    }

    comboRef.current += 1;
    const bonus = comboRef.current > 1 ? comboRef.current * 5 : 0;
    setScore((s) => s + matches.length * 10 + bonus);

    matches.forEach(([r, c]) => {
      board.current[r][c] = null;
      matchEffects.current.push({ x: c * tileSize, y: r * tileSize, progress: 0 });
    });

    if (sounds.current.match) sounds.current.match.play();

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

  function findHint() {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const dirs = [
          [0, 1],
          [1, 0],
        ];
        for (let [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < gridSize && nc < gridSize) {
            swapTiles(r, c, nr, nc);
            if (checkMatches().length > 0) {
              swapTiles(r, c, nr, nc);
              return { r, c };
            }
            swapTiles(r, c, nr, nc);
          }
        }
      }
    }
    return null;
  }

  function resetIdleTimer() {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      hintTile.current = findHint();
    }, 4000);
  }

  function handleClick(e) {
    resetIdleTimer();
    hintTile.current = null;

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
        animateSwap(r1, c1, r, c, () => {
          swapTiles(r1, c1, r, c);
          if (checkMatches().length > 0) {
            if (sounds.current.swap) sounds.current.swap.play();
            handleMatches();
          } else {
            swapTiles(r1, c1, r, c);
          }
        });
      }
      selectedTile.current = null;
    }
  }

  useEffect(() => {
    if (!gameRunning) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const loop = () => {
      animatePositions();
      draw(ctx);
      requestAnimationFrame(loop);
    };

    initBoard();
    resetIdleTimer();
    requestAnimationFrame(loop);
  }, [gameRunning]);

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative">
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

            <div className="relative w-full max-w-[95vw] sm:max-w-[960px]">
              <canvas
                ref={canvasRef}
                width={gridSize * tileSize}
                height={gridSize * tileSize}
                onClick={handleClick}
                className="border-4 border-yellow-400 rounded-lg w-full max-h-[80vh]"
              />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
