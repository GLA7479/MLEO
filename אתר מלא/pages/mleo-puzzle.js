// ✅ גרסה מתוקנת עם תמיכה בהחלקת טאצ' + ביטול גלילה מיותרת בנייד + אזהרה לסיבוב מסך

import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import Image from "next/image";
import { useRouter } from "next/router";

const SHAPES = [
  "heart.png",
  "circle.png",
  "square.png",
  "drop.png",
  "diamond.png",
  "star.png",
];

const DIFFICULTY_SETTINGS = {
  easy: { grid: 6, scoreToWin: 500, time: 60 },
  medium: { grid: 7, scoreToWin: 800, time: 90 },
  hard: { grid: 8, scoreToWin: 1400, time: 120 },
};

export default function MleoMatch() {
  const router = useRouter();
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
  const [touchStart, setTouchStart] = useState(null);
  const [isLandscape, setIsLandscape] = useState(false);

  const size = DIFFICULTY_SETTINGS[difficulty].grid;

  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth < 1024;
      const isLandscape = window.innerWidth > window.innerHeight;
      setIsLandscape(isMobile && isLandscape);
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    return () => window.removeEventListener("resize", checkOrientation);
  }, []);

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

  useEffect(() => {
    const preventTouchScroll = (e) => {
      if (e.target.closest(".grid")) e.preventDefault();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("touchmove", preventTouchScroll, { passive: false });

    return () => {
      document.body.style.overflow = "auto";
      document.removeEventListener("touchmove", preventTouchScroll);
    };
  }, []);

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

  const handleTouchStart = (index, e) => {
    const touch = e.touches[0];
    setTouchStart({ index, x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = (index, e) => {
    if (!touchStart) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    const threshold = 30;
    let targetIndex = null;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > threshold && getCoords(touchStart.index)[1] < size - 1) {
        targetIndex = touchStart.index + 1;
      } else if (dx < -threshold && getCoords(touchStart.index)[1] > 0) {
        targetIndex = touchStart.index - 1;
      }
    } else {
      if (dy > threshold && getCoords(touchStart.index)[0] < size - 1) {
        targetIndex = touchStart.index + size;
      } else if (dy < -threshold && getCoords(touchStart.index)[0] > 0) {
        targetIndex = touchStart.index - size;
      }
    }

    if (targetIndex !== null && areAdjacent(touchStart.index, targetIndex)) {
      swapAndCheck(touchStart.index, targetIndex);
      setSelected(null);
    }

    setTouchStart(null);
  };

  const startGame = () => {
    setShowIntro(false);
    setGameRunning(true);
    setGameOver(false);
    setDidWin(false);
    setScore(0);
    setTime(DIFFICULTY_SETTINGS[difficulty].time);
    generateGrid();
  };

  return (
    <Layout>
      <div className="flex flex-col items-center justify-start bg-gray-900 text-white min-h-screen w-full relative overflow-hidden">
        {isLandscape && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 text-white text-center p-6">
            <h2 className="text-xl font-bold">Please rotate the screen to portrait mode.</h2>
          </div>
        )}

        {!showIntro && !isLandscape && (
          <>
            <div className="flex gap-5 my-4 text-lg font-bold z-[999]">
              <div className="bg-black/60 px-3 py-1 rounded">⏳ {time}s</div>
              <div className="bg-black/60 px-3 py-1 rounded">⭐ {score}</div>
            </div>
            <button
              onClick={() => {
                setShowIntro(true);
                setGameRunning(false);
                setGameOver(false);
                setDidWin(false);
                router.push("/game");
              }}
              className="fixed top-20 right-4 px-5 py-3 bg-yellow-400 text-black font-bold rounded-lg text-base z-[999] hover:scale-105 transition"
            >
              Exit
            </button>
          </>
        )}

        {!isLandscape && showIntro ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-[999] text-center p-6">
            <Image src="/images/leo-intro.png" alt="Leo" width={200} height={200} className="mb-6 animate-bounce" />
            <h1 className="text-4xl font-bold text-yellow-400 mb-4">🍬 LEO Match</h1>
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
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={startGame}
                disabled={!playerName.trim()}
                className="px-6 py-3 bg-yellow-400 text-black font-bold rounded text-lg hover:scale-105 transition"
              >
                ▶ Start Game
              </button>
              <button
                onClick={() => {
                  setShowIntro(true);
                  setGameRunning(false);
                  setGameOver(false);
                  setDidWin(false);
                  router.push("/game");
                }}
                className="px-6 py-3 bg-gray-700 text-white font-bold rounded text-lg hover:bg-gray-600 transition"
              >
                ✖ Exit
              </button>
            </div>
          </div>
        ) : null}

        {!isLandscape && !showIntro && (
          <>
            <div
              className="grid gap-1 touch-none"
              style={{
                gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
                width: "min(95vw, 480px)",
                marginTop: "2rem",
              }}
            >
              {grid.map((shape, i) => (
                <div
                  key={i}
                  onClick={() => handleClick(i)}
                  onTouchStart={(e) => handleTouchStart(i, e)}
                  onTouchEnd={(e) => handleTouchEnd(i, e)}
                  className={`bg-gray-700 rounded p-1 transition cursor-pointer select-none ${
                    selected === i ? "ring-4 ring-yellow-400" : ""
                  }`}
                >
                  <img
                    src={`/images/candy/${shape}`}
                    alt="candy"
                    className="w-full h-auto object-contain"
                    draggable={false}
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
