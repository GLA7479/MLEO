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

  const pingSound = typeof Audio !== "undefined" ? new Audio("/sounds/ping.mp3") : null;
  const gameOverSound = typeof Audio !== "undefined" ? new Audio("/sounds/gameover.mp3") : null;

  const allImages = [
    "/images/shiba1.png", "/images/shiba2.png", "/images/shiba3.png",
    "/images/shiba4.png", "/images/shiba5.png", "/images/shiba6.png",
    "/images/shiba7.png", "/images/shiba8.png", "/images/shiba9.png",
    "/images/shiba10.png", "/images/shiba11.png", "/images/shiba12.png",
    "/images/shiba13.png", "/images/shiba14.png", "/images/shiba15.png",
    "/images/shiba16.png", "/images/shiba17.png", "/images/shiba18.png",
    "/images/shiba19.png", "/images/shiba20.png", "/images/shiba21.png",
    "/images/shiba22.png", "/images/shiba23.png", "/images/shiba24.png",
    "/images/shiba25.png", "/images/shiba26.png", "/images/shiba27.png",
    "/images/shiba28.png"
  ];

  function getImagesByDifficulty() {
    if (difficulty === "easy") return allImages.slice(0, 6);   // 6 קלפים → 12 קלפים סה"כ
    if (difficulty === "medium") return allImages.slice(0, 12); // 12 קלפים → 24 קלפים סה"כ
    if (difficulty === "hard") return allImages.slice(0, 20);   // 20 קלפים → 40 קלפים סה"כ
    return allImages.slice(0, 12);
  }

  function getStartScore() {
    if (difficulty === "easy") return 1000;
    if (difficulty === "medium") return 3000;
    if (difficulty === "hard") return 6000;
  }

  function getMaxTime() {
    if (difficulty === "easy") return 120;
    if (difficulty === "medium") return 240;
    if (difficulty === "hard") return 360;
  }

  // ✅ טיימר
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

  // ✅ Game Over אם ניקוד או זמן = 0
  useEffect(() => {
    if ((score <= 0 || time <= 0) && gameRunning && !gameOver) {
      setGameOver(true);
      setGameRunning(false);
      setTimerRunning(false);
      if (gameOverSound) {
        gameOverSound.currentTime = 0;
        gameOverSound.play().catch(() => {});
      }
    }
  }, [score, time]);

  function initGame() {
    const cardImages = getImagesByDifficulty();
    const duplicated = [...cardImages, ...cardImages]
      .sort(() => Math.random() - 0.5)
      .map((src, i) => ({ id: i, src }));

    setCards(duplicated);
    setFlipped([]);
    setMatched([]);
    setScore(getStartScore());
    setTime(getMaxTime());
    setGameOver(false);
    setTimerRunning(false);
    setStartedPlaying(false);
    setGameRunning(true);
  }

  function handleFlip(card) {
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
        setScore((s) => Math.max(0, s - 10)); // ✅ הורדה על טעות
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative p-4">
        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-[999] text-center p-6">
            <Image src="/images/leo-intro.png" alt="Leo" width={220} height={220} className="mb-6 animate-bounce" />
            <h1 className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-2">🧠 LIO Memory</h1>

            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="mb-4 px-4 py-2 rounded text-black w-64 text-center"
            />

            <div className="flex gap-3 mb-4">
              <button onClick={() => setDifficulty("easy")} className={`px-4 py-2 rounded font-bold ${difficulty === "easy" ? "bg-green-400 text-black" : "bg-gray-500"}`}>קל</button>
              <button onClick={() => setDifficulty("medium")} className={`px-4 py-2 rounded font-bold ${difficulty === "medium" ? "bg-yellow-400 text-black" : "bg-gray-500"}`}>בינוני</button>
              <button onClick={() => setDifficulty("hard")} className={`px-4 py-2 rounded font-bold ${difficulty === "hard" ? "bg-red-400 text-black" : "bg-gray-500"}`}>קשה</button>
            </div>

            <button
              onClick={() => {
                if (!playerName.trim()) return;
                setShowIntro(false);
                initGame();
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
            <div className="flex justify-center items-center gap-3 mb-4">
              <div className="w-32 h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    time / getMaxTime() > 0.6
                      ? "bg-green-500"
                      : time / getMaxTime() > 0.3
                      ? "bg-yellow-400"
                      : "bg-red-500"
                  } transition-all duration-500`}
                  style={{ width: `${(time / getMaxTime()) * 100}%` }}
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
                    className="bg-yellow-500 rounded-lg flex items-center justify-center cursor-pointer"
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

            {gameOver && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-[999]">
                <h2 className="text-4xl sm:text-5xl font-bold text-red-500 mb-4">💥 GAME OVER 💥</h2>
                <p className="text-xl mb-4">Final Score: {score}</p>
                <button
                  className="px-6 py-3 bg-yellow-400 text-black font-bold rounded text-base sm:text-lg"
                  onClick={() => initGame()}
                >
                  Play Again
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setGameRunning(false);
                setGameOver(false);
                setShowIntro(true);
                setTimerRunning(false);
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
