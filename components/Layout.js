// components/Layout.js
import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Header from "./Header";
import { Footer } from "./Header";
import FullscreenButton from "./FullscreenButton";

export default function Layout({ children, video }) {
  const videoRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [video]);

  const isGameHub = router.pathname === "/game";            // דף הרשימה
  const isSubGame  = router.pathname.startsWith("/mleo-");  // דפי משחק/הרשמה
  const showButtons = isSubGame;                            // כפתורים רק אחרי /game

  // כמה להוריד מתחת ל-safe-area (שנה כאן אם תרצה)
  const TOP_OFFSET = 74;

  // יציאה ממסך מלא אם צריך (תומך גם ב-webkit ל-Safari)
  const exitFullscreenIfNeeded = async () => {
    if (typeof document === "undefined") return;
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } catch (_e) {
      // לא נורא אם נכשל – נמשיך ניווט
    }
  };

  // Back: קודם לצאת ממסך מלא, ואז לחזור אחורה/לניווט חלופי
  const handleBack = async () => {
    await exitFullscreenIfNeeded();

    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      router.push("/game"); // fallback: חזרה לרשימת המשחקים
    }
  };

  return (
    <div className="relative w-full min-h-screen text-white overflow-hidden">
      {video && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="fixed top-0 left-0 w-full h-full object-cover -z-10"
          src={video}
        />
      )}
      {video && <div className="absolute inset-0 bg-black/50 -z-10"></div>}

      <Header />

      {/* Back + Full רק בדפי המשחקים (mleo-*) */}
      {showButtons && (
        <>
          <button
            onClick={handleBack}
            aria-label="Back"
            style={{ top: `calc(env(safe-area-inset-top, 0px) + ${TOP_OFFSET}px)` }}
            className="fixed left-4 z-[9999] rounded-xl bg-black/60 text-white px-4 py-2
                       border border-white/20 backdrop-blur shadow active:scale-95"
          >
            ← Back
          </button>

          <FullscreenButton label="Full" topOffset={TOP_OFFSET} />
        </>
      )}

      <main className="relative z-10 pt-[65px]">{children}</main>

      {/* הסתרת Join Presale בהאב ובדפי משחקים; הצגה בשאר העמודים */}
      {!isGameHub && !isSubGame && (
        <a
          href="/presale"
          className="fixed bottom-4 left-4 bg-yellow-500 hover:bg-yellow-600
                     text-black px-4 py-2 rounded-full text-sm font-bold
                     shadow-lg transition z-50"
        >
          🚀 Join Presale
        </a>
      )}

      <Footer />
    </div>
  );
}
