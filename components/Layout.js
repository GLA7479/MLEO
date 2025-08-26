// components/Layout.js
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Header from "./Header";
import { Footer } from "./Header";
import FullscreenButton from "./FullscreenButton";
import SettingsButton from "./SettingsButton";
import BackButton from "./BackButton";
import dynamic from "next/dynamic";

// נטען דינמי כדי להימנע מ-SSR בעייתי
const SettingsModal = dynamic(() => import("./SettingsModal"), { ssr: false });

export default function Layout({ children, video }) {
  const videoRef = useRef(null);
  const router = useRouter();

  // Settings modal state (מקומי ל-Layout)
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [video]);

  // הצגת הכפתורים רק בעמודי משחק משנה
  const isGameHub = router.pathname === "/game";
  const isSubGame = router.pathname.startsWith("/mleo-");
  const showButtons = isSubGame;

  // *** כאן שולטים בגובה שלושת הכפתורים ***
  const TOP_OFFSET = 66;

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
          {/* שמאל: Back */}
          <BackButton topOffset={TOP_OFFSET} leftOffsetPx={16} />

          {/* ימין: Settings + Fullscreen */}
          <SettingsButton
            topOffset={TOP_OFFSET}
            rightOffsetPx={16}
            onClick={() => setSettingsOpen(true)}
          />
          <FullscreenButton
            topOffset={TOP_OFFSET}
            rightOffsetPx={64}
          />
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

      {/* Settings modal (נשאר שלך) */}
      {showButtons && (
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
