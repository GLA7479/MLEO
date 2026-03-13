// components/Layout.js
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Header from "./Header";
import { Footer } from "./Header";


// הוסר: Back/Settings/Fullscreen + SettingsModal

export default function Layout({ children, video }) {
  const videoRef = useRef(null);
  const router = useRouter();

  // הוסר: settingsOpen / modal

  // זיהוי עמודים
  const isGameHub = router.pathname === "/game";
  const isSubGame = router.pathname.startsWith("/mleo-");
const isPresale = router.pathname === "/presale"; // לא להציג כפתור בעמוד הפריסייל
  const headerShown = !isSubGame;
  const footerShown = !isSubGame && !isGameHub;
 

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [video]);

  // עדכון גובה header כמשתנה CSS
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--header-h", headerShown ? "65px" : "0px");
    if (!getComputedStyle(root).getPropertyValue("--app-100vh")) {
      root.style.setProperty("--app-100vh", "100svh");
    }
  }, [headerShown]);


  return (
    <div className="relative w-full min-h-[var(--app-100vh,100svh)] text-white overflow-hidden">
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

      {headerShown && <Header />}

 

      {/* padding-top רק אם יש Header */}
      <main className={`relative z-10 ${headerShown ? "pt-[65px]" : "pt-0"}`}>
        {children}
      </main>

      {!isGameHub && !isSubGame && !isPresale && (
        <a
          href="/presale"
          className="fixed bottom-4 left-4 bg-yellow-500 hover:bg-yellow-600
                     text-black px-4 py-2 rounded-full text-sm font-bold
                     shadow-lg transition z-50"
        >
          🚀 Join Presale
        </a>
      )}

    {footerShown && <Footer />}

    </div>
  );
}
