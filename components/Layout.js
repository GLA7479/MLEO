// components/Layout.js
import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Header from "./Header";
import { Footer } from "./Header";
import FullscreenButton from "./FullscreenButton";

export default function Layout({ children, video, page }) {
  const videoRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [video]);

  const isGamePage = router.pathname === "/game";
  const isSubGame = router.pathname.startsWith("/mleo-");

  const showBack = !["/", "/game"].includes(router.pathname);
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      router.push("/game");
    }
  };

  const showFullscreen = isGamePage || isSubGame;

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

      {/* Back Button */}
      {showBack && (
        <button
          onClick={handleBack}
          aria-label="Back"
          className="fixed left-4 fixed-top-safe
                     z-[9999] rounded-xl bg-black/60 text-white px-4 py-2
                     border border-white/20 backdrop-blur shadow active:scale-95"
        >
          ← Back
        </button>
      )}

      {/* Fullscreen Button */}
      {showFullscreen && <FullscreenButton label="Full" />}

      <main className="relative z-10 pt-[65px]">{children}</main>

      {/* CTA Join Presale – לא יוצג ב-/game ובדפי משחקים */}
      {!isGamePage && !isSubGame && (
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
