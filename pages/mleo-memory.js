import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import Image from "next/image";
import confetti from "canvas-confetti"; // ✅ אפקט קונפטי

export default function MleoMemory() {
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
  const [windowHeight, setWindowHeight] = useState(800);
  const [time, setTime] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [startedPlaying, setStartedPlaying] = useState(false);
  const [didWin, setDidWin] = useState(false);

  const flipSound = typeof Audio !== "undefined" ? new Audio("/sounds/flap.mp3") : null;
  const winSound = typeof Audio !== "undefined" ? new Audio("/sounds/win.mp3") : null;
  const loseSound = typeof Audio !== "undefined" ? new Audio("/sounds/game-over.mp3") : null;

  const allImages = Array.from({ length: 50 }, (_, i) => `/images/card/shiba${i + 1}.png`);

  const difficultySettings = {
    veryeasy: { num: 3, score: 500, time: 60, label: "🐣 Very Easy", color: "bg-blue-400", active: "bg-blue-500" },
    easy: { num: 6, score: 1000, time: 120, label: "🙂 Easy", color: "bg-green-400", active: "bg-green-500" },
    medium: { num: 12, score: 3000, time: 240, label: "😎 Medium", color: "bg-yellow-400", active: "bg-yellow-500" },
    hard: { num: 20, score: 6000, time: 360, label: "🔥 Hard", color: "bg-orange-500", active: "bg-orange-600" },
    expert: { num: 28, score: 10000, time: 480, label: "💀 Expert", color: "bg-red-500", active: "bg-red-600" },
  };

  function initGameWithDifficulty(diffKey) {
    const { score, time, num } = difficultySettings[diffKey];
    const cardImages = [...allImages].sort(() => Math.random() - 0.5).slice(0, num);

    const duplicated = [...cardImages, ...cardImages]
      .sort(() => Math.random() - 0.5)
      .map((src, i) => ({ id: i, src }));

    setCards(duplicated);
    setFlipped([]);
    setMatched([]);
    setScore(score);
    setTime(time);
    setGameOver(false);
    setDidWin(false);
    setTimerRunning(false);
    setStartedPlaying(false);
    setGameRunning(true);
  }

  function startGame(diffKey) {
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const wrapper = document.getElementById("game-wrapper");
    if (isMobile && wrapper?.requestFullscreen) wrapper.requestFullscreen().catch(() => {});
    else if (isMobile && wrapper?.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();

    initGameWithDifficulty(diffKey);
  }

  // ✅ ספירה לאחור
  useEffect(() => {
    if (!timerRunning) return;

    const interval = setInterval(() => {
      setTime((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerRunning(false);
          setGameOver(true);
          setDidWin(false);
          loseSound?.play().catch(() => {});
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning]);

  // ✅ עצירה והכרזה על ניצחון + אפקט
  useEffect(() => {
    if (matched.length > 0 && matched.length === cards.length) {
      setTimerRunning(false);
      setDidWin(true);
      setGameOver(true);
      winSound?.play().catch(() => {});

      // 🎉 אפקט קונפטי
      confetti({
        particleCount: 200,
        spread: 120,
        origin: { y: 0.6 },
      });
    }
  }, [matched, cards]);

  useEffect(() => {
    const updateSize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    window.addEventListener("orientationchange", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("orientationchange", updateSize);
    };
  }, []);

  function handleFlip(card) {
    if (gameOver || !gameRunning) return;
    if (!startedPlaying) {
      setStartedPlaying(true);
      setTimerRunning(true);
    }
    if (flipped.length === 2 || flipped.includes(card.id) || matched.includes(card.id)) return;

    flipSound?.play().catch(() => {});
    const newFlipped = [...flipped, card.id];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      const [first, second] = newFlipped;
      const card1 = cards.find((c) => c.id === first);
      const card2 = cards.find((c) => c.id === second);

      if (card1.src === card2.src) setMatched((prev) => [...prev, first, second]);
      else setScore((s) => Math.max(0, s - 10));

      setTimeout(() => setFlipped([]), 1200);
    }
  }
  const totalCards = cards.length;
  let columns = windowWidth < 600 ? Math.min(6, totalCards) : Math.min(10, totalCards);
  const rows = Math.ceil(totalCards / columns);
  const containerWidth = windowWidth * 0.95;
  const containerHeight = windowHeight * 0.8;

  const cardWidth = Math.max(
    35,
    Math.min(
      windowWidth < 600 ? 80 : 120,
      Math.min(containerWidth / columns - 6, containerHeight / rows / 1.4 - 6)
    )
  );

  const gapSize = windowWidth < 600 ? 4 : windowWidth < 1024 ? 6 : 10;

  return (
    <Layout>
      <div
        id="game-wrapper"
        className="flex flex-col items-center justify-start bg-gray-900 text-white min-h-screen w-full relative pt-0"
      >
        {showIntro ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-[999] text-center p-6">
            
            {/* ✅ כפתור Exit בפינה הימנית העליונה */}
            <button
              onClick={() => (window.location.href = "/game")}
 className="fixed px-5 py-3 bg-yellow-400 text-black font-bold rounded-lg text-base sm:text-lg z-[999] hover:scale-105 transition"
style={{ top: "70px", right: "10px" }}
            >
              Exit
            </button>

            <Image src="/images/leo-intro.png" alt="Leo" width={220} height={220} className="mb-6 animate-bounce" />
            <h1 className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-2">🧠 LIO Memory</h1>

            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="mb-4 px-4 py-2 rounded text-black w-64 text-center"
            />

            <div className="flex flex-wrap justify-center gap-2 mb-3 max-w-sm">
              {Object.keys(difficultySettings).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    if (!playerName.trim()) return;
                    setDifficulty(key);
                    setShowIntro(false);
                    startGame(key);
                  }}
                  className={`text-black px-3 py-2 rounded font-bold text-sm shadow-md transition hover:scale-110 ${
                    difficulty === key
                      ? `${difficultySettings[key].active} scale-110`
                      : `${difficultySettings[key].color}`
                  }`}
                >
                  {difficultySettings[key].label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* כפתור Exit במשחק נשאר כמו שהיה */}
            <button
              onClick={() => {
                setGameRunning(false);
                setGameOver(false);
                setShowIntro(true);
                setTimerRunning(false);
              }}
              className="fixed right-4 px-5 py-3 bg-yellow-400 text-black font-bold rounded-lg text-base sm:text-lg z-[999] hover:scale-105 transition"
              style={{
                top:
                  /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
                    ? "auto"
                    : windowWidth < 1024
                    ? "16px"
                    : "70px",
                bottom: /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
                  ? "30px"
                  : "auto",
              }}
            >
              Exit
            </button>

            <div className="flex justify-center items-center gap-3 mb-3 mt-0">
              <div className="w-28 sm:w-32 h-3 bg-gray-700 rounded-full overflow-hidden">
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
              <div className="bg-black/60 px-2 py-1 rounded-lg text-sm font-bold">⏳ {time}s</div>
              <div className="bg-black/60 px-2 py-1 rounded-lg text-sm font-bold">⭐ {score}</div>
            </div>

            <div className="flex-1 flex items-center justify-center" style={{ marginTop: "-60px" }}>
              <div
                className={`${gameOver ? "pointer-events-none opacity-50" : ""}`}
                style={{
                  display: "grid",
                  gap: `${gapSize}px`,
                  gridTemplateColumns: `repeat(${columns}, ${cardWidth}px)`,
                  justifyContent: "center",
                  maxWidth: `${containerWidth}px`,
                  maxHeight: `${containerHeight}px`,
                }}
              >
                {cards.map((card) => {
                  const isFlipped = flipped.includes(card.id) || matched.includes(card.id);
                  return (
                    <div
                      key={card.id}
                      onClick={() => handleFlip(card)}
                      className="bg-yellow-500 rounded-lg flex items-center justify-center cursor-pointer transition hover:scale-105"
                      style={{ width: `${cardWidth}px`, height: `${cardWidth * 1.4}px` }}
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
            </div>

            {gameOver && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-[999]">
                <div className="bg-gray-900 p-6 rounded-2xl shadow-lg text-center max-w-sm w-[90%]">
                  <h2 className="text-4xl font-bold mb-4 text-yellow-400">
                    {didWin ? "🎉 YOU WIN 🎉" : "💥 GAME OVER 💥"}
                  </h2>
                  <p className="text-lg mb-5">Final Score: {score}</p>
                  <div className="flex justify-center gap-4">
                    <button
                      className="px-5 py-3 bg-yellow-400 text-black font-bold rounded-lg text-base hover:scale-105 transition"
                      onClick={() => initGameWithDifficulty(difficulty)}
                    >
                      ▶ Play Again
                    </button>
                    <button
                      className="px-5 py-3 bg-gray-400 text-black font-bold rounded-lg text-base hover:scale-105 transition"
                      onClick={() => {
                        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                        setGameRunning(false);
                        setGameOver(false);
                        setShowIntro(true);
                        setTimerRunning(false);
                      }}
                    >
                      ⬅ Exit
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
