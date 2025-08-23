import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Header from "./Header";
import { Footer } from "./Header";

export default function Layout({ children, video, page }) {
  const videoRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [video]);

  // Show Back on every page EXCEPT home and /game
  const hideBackOn = new Set(["/", "/game"]);
  const showBack = !hideBackOn.has(router.pathname);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      router.push("/game"); // fallback
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

      {/* Back button — always visible above everything (except on / and /game) */}
      {showBack && (
        <button
          onClick={handleBack}
          aria-label="Back"
          className="fixed left-4 top-[calc(env(safe-area-inset-top,0px)+8px)]
                     z-[9999] pointer-events-auto
                     rounded-xl bg-black/60 text-white px-4 py-2
                     border border-white/20 backdrop-blur shadow active:scale-95"
        >
          ← Back
        </button>
      )}

      <main className="relative z-10 pt-[65px]">{children}</main>

      {/* Presale CTA — hide on /game (hub) only */}
      {router.pathname !== "/game" && (
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
