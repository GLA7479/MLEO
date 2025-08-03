import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import Image from "next/image";

export default function MleoMemory() {
  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [score, setScore] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [difficulty, setDifficulty] = useState("medium");
  const [windowWidth, setWindowWidth] = useState(1200);
  const [time, setTime] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [startedPlaying, setStartedPlaying] = useState(false);

  const flipSound = typeof Audio !== "undefined" ? new Audio("/sounds/flap.mp3") : null;
  const gameOverSound = typeof Audio !== "undefined" ? new Audio("/sounds/gameover.mp3") : null;

  const allImages = Array.from({ length: 30 }, (_, i) => `/images/shiba${i + 1}.png`);

  const difficultySettings = {
    veryeasy: { num: 3, score: 500, time: 60, label: "🐣 Very Easy", color: "bg-blue-400", active: "bg-blue-500" },
    easy: { num: 6, score: 1000, time: 120, label: "🙂 Easy", color: "bg-green-400", active: "bg-green-500" },
    medium: { num: 12, score: 3000, time: 240, label: "😎 Medium", color: "bg-yellow-400", active: "bg-yellow-500" },
    hard: { num: 20, score: 6000, time: 360, label: "🔥 Hard", color: "bg-orange-500", active: "bg-orange-600" },
    expert: { num: 28, score: 10000, time: 480, label: "💀 Expert", color: "bg-red-500", active: "bg-red-600" },
  };

  function getImagesByDifficulty() {
    const num = difficultySettings[difficulty].num;
    return [...allImages].sort(() => Math.random() - 0.5).slice(0, num);
  }

  function initGame() {
    const { score, time } = difficultySettings[difficulty];
    const cardImages = getImagesByDifficulty();
    const duplicated = [...cardImages, ...cardImages]
      .sort(() => Math.random() - 0.5)
      .map((src, i) => ({ id: i, src }));

    setCards(duplicated);
    setFlipped([]);
    setMatched([]);
    setScore(score);
    setTime(time);
    setGameOver(false);
    setTimerRunning(false);
    setStartedPlaying(false);
    setGameRunning(true);
  }

  useEffect(() => {
    let interval;
    if (timerRunning) {
      interval = setInterval(() => {
        setTime((t) => Math.max(0, t - 1));
        setScore((s) => Math.max(0, s - 5));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    if ((score <= 0 || time <= 0) && gameRunning && !gameOver) {
      setGameOver(true);
      setGameRunning(false);
      setTimerRunning(false);
      gameOverSound?.play().catch(() => {});
    }
  }, [score, time]);

  function handleFlip(card) {
    flipSound?.play().catch(() => {});
    if (!startedPlaying) {
      setStartedPlaying(true);
      setTimerRunning(true);
    }
    if (flipped.length === 2 || flipped.includes(card.id) || matched.includes(card.id)) return;

    const newFlipped = [...flipped, card.id];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      const [first, second] = newFlipped;
      const card1 = cards.find((c) => c.id === first);
      const card2 = cards.find((c) => c.id === second);

      if (card1.src === card2.src) {
        setMatched((prev) => [...prev, first, second]);
      } else {
        setScore((s) => Math.max(0, s - 10));
      }

      setTimeout(() => setFlipped([]), 800);
    }
  }

  const totalCards = cards.length;
  const columns = Math.ceil(Math.sqrt(totalCards));
  const containerWidth = Math.min(windowWidth * 0.9, 1000);
  const cardWidth = Math.max(60, Math.min(120, containerWidth / columns - 8));

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-center p-6">
            <Image src="/images/leo-intro.png" alt="Leo" width={220} height={220} className="mb-6" />
            <h1 className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-2">🧠 LIO Memory</h1>

            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="mb-4 px-4 py-2 rounded text-black w-64 text-center"
            />

            {/* כפתורי רמות – קטנים יותר */}
            <div className="flex flex-wrap justify-center gap-3 mb-4 max-w-xs">
              {Object.keys(difficultySettings).map((key) => (
                <button
                  key={key}
                  onClick={() => setDifficulty(key)}
                  className={`text-black px-3 py-1.5 rounded font-bold text-xs shadow-md transform transition-all duration-200 hover:scale-125 ${
                    difficulty === key
                      ? `${difficultySettings[key].active} scale-125`
                      : `${difficultySettings[key].color} scale-100`
                  }`}
                >
                  {difficultySettings[key].label}
                </button>
              ))}
            </div>

            {/* כפתור START */}
            <button
              onClick={() => {
                if (!playerName.trim()) return;
                setShowIntro(false);
                initGame();
              }}
              disabled={!playerName.trim()}
              className={`mb-4 px-6 py-3 font-bold rounded-lg text-lg shadow-lg transform transition duration-200 hover:scale-125 ${
                playerName.trim()
                  ? "bg-yellow-400 text-black"
                  : "bg-gray-500 text-gray-300 cursor-not-allowed"
              }`}
            >
              ▶ Start Game
            </button>

            {/* טבלה */}
            <table className="border border-gray-500 text-sm mb-4 w-full max-w-md rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-700 text-white">
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">🃏 Cards</th>
                  <th className="px-3 py-2">⏳ Time (s)</th>
                  <th className="px-3 py-2">⭐ Start Score</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(difficultySettings).map(([key, val]) => (
                  <tr
                    key={key}
                    className={`${val.color} text-black hover:scale-105 transform transition duration-200`}
                  >
                    <td className="px-3 py-2 font-bold">{val.label}</td>
                    <td className="px-3 py-2">🃏 {val.num * 2}</td>
                    <td className="px-3 py-2">⏳ {val.time}</td>
                    <td className="px-3 py-2">⭐ {val.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!showIntro && (
          <>
            <div className="flex justify-center items-center gap-3 mb-4">
              <div className="w-32 h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    time / difficultySettings[difficulty].time > 0.6
                      ? "bg-green-500"
                      : time / difficultySettings[difficulty].time > 0.3
                      ? "bg-yellow-400"
                      : "bg-red-500"
                  } transition-all duration-500`}
                  style={{ width: `${(time / difficultySettings[difficulty].time) * 100}%` }}
                ></div>
              </div>
              <div className="bg-black/60 px-3 py-1 rounded-lg text-base font-bold">⏳ {time}s</div>
              <div className="bg-black/60 px-3 py-1 rounded-lg text-base font-bold">⭐ {score}</div>
            </div>

            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${columns}, ${cardWidth}px)`,
                justifyContent: "center",
                maxWidth: `${containerWidth}px`,
                margin: "0 auto",
              }}
            >
              {cards.map((card) => {
                const isFlipped = flipped.includes(card.id) || matched.includes(card.id);
                return (
                  <div
                    key={card.id}
                    onClick={() => handleFlip(card)}
                    className="bg-yellow-500 rounded-lg flex items-center justify-center cursor-pointer transform transition duration-200 hover:scale-125"
                    style={{ width: `${cardWidth}px`, height: `${cardWidth * 1.33}px` }}
                  >
                    {isFlipped ? (
                      <img src={card.src} alt="card" className="w-[90%] h-[90%] object-cover rounded-md" />
                    ) : (
                      <div className="w-[90%] h-[90%] bg-gray-300 rounded-md"></div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ✅ כפתור Exit חזר */}
            <button
              onClick={() => {
                setGameRunning(false);
                setGameOver(false);
                setShowIntro(true);
                setTimerRunning(false);
              }}
              className="fixed top-16 right-4 px-5 py-3 bg-yellow-400 text-black font-bold rounded-lg text-base shadow-lg transform transition duration-200 hover:scale-110"
            >
              Exit
            </button>
          </>
        )}
      </div>
    </Layout>
  );
}
