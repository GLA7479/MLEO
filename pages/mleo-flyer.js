import { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";

export default function MleoFlyer() {
  const canvasRef = useRef(null);
  const [silverImg, setSilverImg] = useState(null);

  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerName, setPlayerName] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [showHitbox, setShowHitbox] = useState(false);
  const [collisionBox, setCollisionBox] = useState(null);

  const [dogSprite, setDogSprite] = useState(null);
  const [coinImg, setCoinImg] = useState(null);
  const [diamondImg, setDiamondImg] = useState(null);
  const [obstacleImg, setObstacleImg] = useState(null);
  const [magnetImg, setMagnetImg] = useState(null);
  const [shieldImg, setShieldImg] = useState(null);

  const gravity = 0.4;
  const flapStrength = -4;

  const playerY = useRef(200);
  const velocity = useRef(0);
  const invincible = useRef(false);
  const animationFrameId = useRef(null);
  const lastObstacleTime = useRef(Date.now());

  const obstacles = useRef([]);
  const coins = useRef([]);
  const powerUps = useRef([]);

  const hasShield = useRef(false);
  const hasMagnet = useRef(false);
  const doublePoints = useRef(false);
  const powerTimers = useRef({});

  const backgrounds = [
    "/images/game1.png",
    "/images/game2.png",
    "/images/game3.png",
    "/images/game4.png",
  ];

  let bgIndex = 0;
  let bgX = 0;
  let frameCount = 0;
  let gameSpeed = 3;

  const safeDrawImage = (ctx, img, ...args) => {
    if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      ctx.drawImage(img, ...args);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const loadImg = (src, setter) => {
        const img = new window.Image();
        img.src = src;
        img.onload = () => setter(img);
      };

      loadImg("/images/dog-fly-sprite.png", setDogSprite);
      loadImg("/images/silver.png", setSilverImg);
      loadImg("/images/coin.png", setCoinImg);
      loadImg("/images/diamond.png", setDiamondImg);
      loadImg("/images/obstacle1.png", setObstacleImg);
      loadImg("/images/magnet.png", setMagnetImg);
      loadImg("/images/shield.png", setShieldImg);

      setHighScore(Number(localStorage.getItem("mleoFlyerHighScore") || 0));
      setLeaderboard(JSON.parse(localStorage.getItem("mleoFlyerLeaderboard") || "[]"));
    }
  }, []);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key.toLowerCase() === "h") {
        e.preventDefault();
        setShowHitbox((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyPress, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyPress, { capture: true });
  }, []);

  const resetGame = () => {
    playerY.current = 200;
    velocity.current = 0;
    obstacles.current = [];
    coins.current = [];
    powerUps.current = [];
    setScore(0);
    setGameOver(false);
    setGameRunning(true);
    gameSpeed = 3;
    hasShield.current = false;
    hasMagnet.current = false;
    doublePoints.current = false;
    powerTimers.current = {};
    invincible.current = true;
    setCollisionBox(null);
    lastObstacleTime.current = Date.now();
    setTimeout(() => (invincible.current = false), 1500);
  };

  const handleFlap = () => {
    if (showIntro) return;

    if (!gameRunning) {
      resetGame();
      setGameStarted(true);
      velocity.current = flapStrength;
      return;
    }
    velocity.current = flapStrength;
  };

  const spawnObstacle = () => {
    const gap = 140;
    const topHeight = Math.random() * 200 + 50;
    obstacles.current.push({
      x: 600,
      top: topHeight,
      bottom: topHeight + gap,
      width: 40,
      height: 60,
    });
  };

  const spawnCoin = () => {
    const types = ["gold", "diamond", "silver"];
    const type = types[Math.floor(Math.random() * types.length)];
    coins.current.push({ x: 600, y: Math.random() * 300 + 50, radius: 12, type });
  };

  const spawnPowerUp = () => {
    const types = ["magnet", "shield", "double"];
    const type = types[Math.floor(Math.random() * types.length)];
    powerUps.current.push({ x: 600, y: Math.random() * 300 + 50, radius: 15, type });
  };

  const activatePowerUp = (type) => {
    if (type === "magnet") hasMagnet.current = true;
    if (type === "shield") hasShield.current = true;
    if (type === "double") doublePoints.current = true;

    powerTimers.current[type] = setTimeout(() => {
      if (type === "magnet") hasMagnet.current = false;
      if (type === "shield") hasShield.current = false;
      if (type === "double") doublePoints.current = false;
    }, 5000);
  };

  const getCoinValue = (c) => {
    if (c.type === "diamond") return doublePoints.current ? 10 : 5;
    if (c.type === "silver") return doublePoints.current ? 4 : 2;
    return doublePoints.current ? 2 : 1;
  };

  const update = () => {
    if (!gameStarted) return;

    velocity.current += gravity;
    playerY.current += velocity.current;

    frameCount++;
    if (frameCount % 600 === 0) bgIndex = (bgIndex + 1) % backgrounds.length;

    bgX -= 1.5;
    if (bgX <= -600) bgX = 0;

    if (playerY.current > 400) {
      playerY.current = 400;
      velocity.current = 0;
    }

    if (Date.now() - lastObstacleTime.current > 2000) {
      spawnObstacle();
      lastObstacleTime.current = Date.now();
    }

    if (Math.random() < 0.05) spawnCoin();
    if (Math.random() < 0.005) spawnPowerUp();

    if (score > 0 && score % 20 === 0) gameSpeed = 3 + Math.floor(score / 20);

    const playerBox = { x: 95, y: playerY.current + 15, w: 30, h: 30 };

    obstacles.current.forEach((o) => {
      o.x -= gameSpeed;
      const topBox = { x: o.x + o.width * 0.5, y: o.top - o.height * 0.5, w: o.width * 0.3, h: o.height * 0.2 };
      const bottomBox = { x: o.x + o.width * 0.5, y: o.bottom + o.height * 0.25, w: o.width * 0.1, h: o.height * 0.2 };

      const hit = (box) =>
        playerBox.x < box.x + box.w &&
        playerBox.x + playerBox.w > box.x &&
        playerBox.y < box.y + box.h &&
        playerBox.y + playerBox.h > box.y;

      if (hit(topBox) || hit(bottomBox)) {
        setCollisionBox(playerBox);
        if (hasShield.current) hasShield.current = false;
        else endGame();
      }
    });

    obstacles.current = obstacles.current.filter((o) => o.x > -o.width);

    coins.current.forEach((c, i) => {
      c.x -= gameSpeed;
      if (c.x < -10) coins.current.splice(i, 1);

      if (hasMagnet.current && Math.abs(c.x - 80) < 100) {
        c.x -= 2;
        c.y += (playerY.current - c.y) * 0.05;
      }

      const dx = c.x - 80;
      const dy = c.y - playerY.current;
      if (Math.sqrt(dx * dx + dy * dy) < 60) {
        setScore((s) => s + getCoinValue(c));
        coins.current.splice(i, 1);
      }
    });

    powerUps.current.forEach((p, i) => {
      p.x -= gameSpeed;
      if (p.x < -10) powerUps.current.splice(i, 1);

      const dx = p.x - 80;
      const dy = p.y - playerY.current;
      if (Math.sqrt(dx * dx + dy * dy) < 50) {
        activatePowerUp(p.type);
        powerUps.current.splice(i, 1);
      }
    });
  };

  const draw = (ctx) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const bgImg = new window.Image();
    bgImg.src = backgrounds[bgIndex];
    safeDrawImage(ctx, bgImg, bgX, 0, ctx.canvas.width, ctx.canvas.height);
    safeDrawImage(ctx, bgImg, bgX + ctx.canvas.width, 0, ctx.canvas.width, ctx.canvas.height);

    coins.current.forEach((c) => {
      const img = c.type === "diamond" ? diamondImg : c.type === "silver" ? silverImg : coinImg;
      safeDrawImage(ctx, img, c.x - 15, c.y - 15, 30, 30);
    });

    powerUps.current.forEach((p) => {
      const img = p.type === "magnet" ? magnetImg : p.type === "shield" ? shieldImg : diamondImg;
      safeDrawImage(ctx, img, p.x - 15, p.y - 15, 30, 30);
    });

    obstacles.current.forEach((o) => {
      safeDrawImage(ctx, obstacleImg, o.x, o.top - o.height, o.width, o.height);
      ctx.save();
      ctx.scale(1, -1);
      safeDrawImage(ctx, obstacleImg, o.x, -o.bottom, o.width, o.height);
      ctx.restore();
    });

    if (dogSprite) safeDrawImage(ctx, dogSprite, 80, playerY.current, 60, 60);

  ctx.fillStyle = "white"; // שינוי הצבע ללבן
ctx.font = "20px Arial";
ctx.fillText(`Score: ${score}`, 10, 30);
ctx.fillText(`High: ${highScore}`, 10, 60);
  };

  const endGame = () => {
    setGameRunning(false);
    setGameOver(true);
    cancelAnimationFrame(animationFrameId.current);
    obstacles.current = [];
    coins.current = [];
    powerUps.current = [];

    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem("mleoFlyerHighScore", score);
    }

    if (playerName) {
      const updated = [...leaderboard, { name: playerName, score }]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      setLeaderboard(updated);
      localStorage.setItem("mleoFlyerLeaderboard", JSON.stringify(updated));
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const loop = () => {
      if (gameRunning) update();
      draw(ctx);
      animationFrameId.current = requestAnimationFrame(loop);
    };

    animationFrameId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [gameRunning, dogSprite, coinImg, diamondImg, obstacleImg, showHitbox, collisionBox]);

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center p-4">
        {showIntro && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-[999] text-center p-6">
            <h1 className="text-4xl sm:text-5xl font-bold text-yellow-400 mb-2">🐶 LIO Flyer</h1>
            <p className="text-base sm:text-lg text-gray-200 mb-4">Fly with Leo and collect coins!</p>

            {leaderboard.length > 0 && (
              <div className="mb-4 text-gray-300">
                <h2 className="font-bold">🏆 Top Players:</h2>
                {leaderboard.slice(0, 3).map((p, i) => (
                  <p key={i}>{i + 1}. {p.name} - {p.score}</p>
                ))}
              </div>
            )}

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
                resetGame();
                setGameStarted(true);
              }}
              disabled={!playerName.trim()}
              className={`px-8 py-4 font-bold rounded-lg text-xl shadow-lg transform transition animate-pulse ${
                playerName.trim()
                  ? "bg-yellow-400 text-black hover:scale-105"
                  : "bg-gray-500 text-gray-300 cursor-not-allowed"
              }`}
            >
              ▶ Start Game
            </button>
          </div>
        )}

        {!showIntro && (
          <div className="relative w-full max-w-[95vw] sm:max-w-[960px]">
            <canvas
              ref={canvasRef}
              width={600}
              height={450}
              className="relative z-0 border-4 border-yellow-400 rounded-lg w-full aspect-[4/3] max-h-[80vh]"
              onClick={handleFlap}
            />

            {/* כפתור RESTART בפינה הימנית העליונה */}
            <button
              onClick={resetGame}
              className="absolute top-2 right-2 px-4 py-2 bg-red-400 text-black font-bold rounded shadow-lg hover:scale-105 transition"
            >
              🔄 Restart
            </button>

            {/* כפתור FLY בפינה הימנית התחתונה */}
            <button
              onClick={handleFlap}
              className="absolute bottom-2 right-2 px-6 py-3 bg-yellow-400 text-black font-bold rounded text-lg shadow-lg hover:scale-105 transition"
            >
              ⬆ FLY
            </button>

            {gameOver && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-[999]">
                <h2 className="text-4xl sm:text-5xl font-bold text-red-500 mb-4">GAME OVER</h2>
                <button
                  className="px-6 py-3 bg-yellow-400 text-black font-bold rounded text-base sm:text-lg"
                  onClick={resetGame}
                >
                  Start Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
