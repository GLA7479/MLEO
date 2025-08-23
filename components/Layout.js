// components/Layout.js
import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Header from "./Header";
import { Footer } from "./Header";
import FullscreenButton from "./FullscreenButton";
import SettingsButton from "./SettingsButton";

export default function Layout({ children, video }) {
  const videoRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [video]);

  const isGameHub = router.pathname === "/game";
  const isSubGame  = router.pathname.startsWith("/mleo-");
  const showButtons = isSubGame; // רק בדפי המשחקים

  // Back: קודם לצאת מ-Full ואז ניווט
  const handleBack = async () => {
    try {
      const inFs = !!document.fullscreenElement || !!document.webkitFullscreenElement;
      if (inFs) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        await new Promise(r => setTimeout(r, 80));
      }
    } catch {}
    if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
    else router.push("/game");
  };

  const TOP_OFFSET = 76;

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
      {video && <div className="absolute inset-0 bg-black/50 -z-10" />}

      <Header />

      {showButtons && (
        <>
          {/* Back – שמאל */}
          <button
            onClick={handleBack}
            aria-label="Back"
            style={{ top: `calc(env(safe-area-inset-top, 0px) + ${TOP_OFFSET}px)` }}
            className="fixed left-4 z-[9999] rounded-xl bg-black/60 text-white px-4 py-2
                       border border-white/20 backdrop-blur shadow active:scale-95"
          >
            ← Back
          </button>

          {/* ימני: ⚙️, ומשמאלו: Full */}
          <SettingsButton topOffset={TOP_OFFSET} rightOffsetPx={16} />
          <FullscreenButton topOffset={TOP_OFFSET} rightOffsetPx={88} labelFull="Full" labelExit="Exit" />
        </>
      )}

      <main className="relative z-10 pt-[65px]">{children}</main>

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
