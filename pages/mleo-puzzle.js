// pages/mleo-match.js
import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import Image from "next/image";

const SHAPES = [
  "heart.png",
  "circle.png",
  "square.png",
  "drop.png",
  "diamond.png",
  "star.png",
];

const DIFFICULTY_SETTINGS = {
  easy: { grid: 6, scoreToWin: 300, time: 60 },
  medium: { grid: 7, scoreToWin: 600, time: 90 },
  hard: { grid: 8, scoreToWin: 1000, time: 120 },
};

export default function MleoMatch() {
  const [playerName, setPlayerName] = useState("");
  const [difficulty, setDifficulty] = useState("easy");
  const [grid, setGrid] = useState([]);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(60);
  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [didWin, setDidWin] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [selected, setSelected] = useState(null);

  const size = DIFFICULTY_SETTINGS[difficulty].grid;

  

  useEffect(() => {
    if (!gameRunning) return;
    if (time <= 0) {
      setGameOver(true);
      setDidWin(score >= DIFFICULTY_SETTINGS[difficulty].scoreToWin);
      setGameRunning(false);
    }
    const interval = setInterval(() => setTime((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [gameRunning, time]);

  const generateGrid = () => {
    const newGrid = [];
    for (let i = 0; i < size * size; i++) {
      const rand = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      newGrid.push(rand);
    }
    setGrid(newGrid);
  };

  const getIndex = (row, col) => row * size + col;
  const getCoords = (index) => [Math.floor(index / size), index % size];

  const areAdjacent = (i1, i2) => {
    const [r1, c1] = getCoords(i1);
    const [r2, c2] = getCoords(i2);
    return (
      (r1 === r2 && Math.abs(c1 - c2) === 1) ||
      (c1 === c2 && Math.abs(r1 - r2) === 1)
    );
  };

  const swapAndCheck = (i1, i2) => {
    const newGrid = [...grid];
    [newGrid[i1], newGrid[i2]] = [newGrid[i2], newGrid[i1]];
    if (hasMatch(newGrid)) {
      setGrid(newGrid);
      clearMatches(newGrid);
    }
  };

  const hasMatch = (g) => {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size - 2; c++) {
        const i = getIndex(r, c);
        if (g[i] && g[i] === g[i + 1] && g[i] === g[i + 2]) return true;
      }
    }
    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size - 2; r++) {
        const i = getIndex(r, c);
        if (g[i] && g[i] === g[i + size] && g[i] === g[i + 2 * size]) return true;
      }
    }
    return false;
  };

  const clearMatches = (g) => {
    const toClear = Array(size * size).fill(false);

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size - 2; c++) {
        const i = getIndex(r, c);
        const val = g[i];
        if (val && val === g[i + 1] && val === g[i + 2]) {
          toClear[i] = toClear[i + 1] = toClear[i + 2] = true;
        }
      }
    }

    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size - 2; r++) {
        const i = getIndex(r, c);
        const val = g[i];
        if (val && val === g[i + size] && val === g[i + 2 * size]) {
          toClear[i] = toClear[i + size] = toClear[i + 2 * size] = true;
        }
      }
    }

    let cleared = 0;
    for (let i = 0; i < toClear.length; i++) {
      if (toClear[i]) {
        g[i] = null;
        cleared++;
      }
    }
    if (cleared > 0) {
      setScore((s) => s + cleared * 10);
      fallDown(g);
    }
  };

  const fallDown = (g) => {
    for (let c = 0; c < size; c++) {
      let col = [];
      for (let r = 0; r < size; r++) {
        const i = getIndex(r, c);
        if (g[i]) col.push(g[i]);
      }
      while (col.length < size) {
        col.unshift(SHAPES[Math.floor(Math.random() * SHAPES.length)]);
      }
      for (let r = 0; r < size; r++) {
        g[getIndex(r, c)] = col[r];
      }
    }
    setGrid([...g]);
    setTimeout(() => clearMatches(g), 300);
  };

  const handleClick = (index) => {
    if (selected === null) {
      setSelected(index);
    } else if (selected === index) {
      setSelected(null);
    } else if (areAdjacent(selected, index)) {
      swapAndCheck(selected, index);
      setSelected(null);
    } else {
      setSelected(index);
    }
  };

  const startGame = () => {
    setShowIntro(false);
    setGameRunning(true);
    setGameOver(false);
    setDidWin(false);
    setScore(0);
    setTime(DIFFICULTY_SETTINGS[difficulty].time);
    generateGrid();

    if (typeof window !== "undefined") {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.msRequestFullscreen) el.msRequestFullscreen();
    }
  };

  return (
    <Layout>
      <div className="flex flex-col items-center justify-start bg-gray-900 text-white min-h-screen w-full relative">
        {showIntro ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-[999] text-center p-6">
            <Image src="/images/leo-intro.png" alt="Leo" width={200} height={200} className="mb-6 animate-bounce" />
            <h1 className="text-4xl font-bold text-yellow-400 mb-4">🍬 LIO Match</h1>
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="mb-4 px-4 py-2 rounded text-black w-64 text-center"
            />
            <div className="flex gap-3 mb-6">
              {Object.keys(DIFFICULTY_SETTINGS).map((key) => (
                <button
                  key={key}
                  onClick={() => setDifficulty(key)}
                  className={`px-4 py-2 rounded font-bold text-sm ${
                    difficulty === key ? "bg-yellow-500" : "bg-yellow-300"
                  }`}
                >
                  {key.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              onClick={startGame}
              disabled={!playerName.trim()}
              className="px-6 py-3 bg-yellow-400 text-black font-bold rounded text-lg hover:scale-105 transition"
            >
              ▶ Start Game
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => window.location.reload()}
              className="fixed top-20 right-4 px-5 py-3 bg-yellow-400 text-black font-bold rounded-lg text-base z-[999] hover:scale-105 transition"
            >
              Exit
            </button>
            <div className="flex gap-5 my-4 text-lg font-bold">
              <div className="bg-black/60 px-3 py-1 rounded">⏳ {time}s</div>
              <div className="bg-black/60 px-3 py-1 rounded">⭐ {score}</div>
            </div>
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
                width: "min(95vw, 480px)",
              }}
            >
              {grid.map((shape, i) => (
                <div
                  key={i}
                  onClick={() => handleClick(i)}
                  className={`bg-gray-700 rounded p-1 hover:scale-105 transition cursor-pointer ${selected === i ? "ring-4 ring-yellow-400" : ""}`}
                >
                  <img
                    src={`/images/candy/${shape}`}
                    alt="candy"
                    className="w-full h-auto object-contain"
                  />
                </div>
              ))}
            </div>
            {gameOver && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-[999] text-center">
                <h2 className="text-4xl font-bold text-yellow-400 mb-4">
                  {didWin ? "🎉 YOU WIN 🎉" : "💥 GAME OVER 💥"}
                </h2>
                <p className="text-lg mb-4">Final Score: {score}</p>
                <button
                  className="px-6 py-3 bg-yellow-400 text-black font-bold rounded text-lg hover:scale-105"
                  onClick={startGame}
                >
                  ▶ Play Again
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}