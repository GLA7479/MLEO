// components/IntroOverlay.js
import { useEffect, useRef, useState } from "react";

export default function IntroOverlay({
  src = "/videos/leo-intro.mp4",     // הווידאו שלך (public/videos/leo-intro.mp4)
  durationFallback = 4500,            // כמה זמן להציג אם אין וידאו (פולבאק)
  onceKey = "intro_seen_session",     // פעם אחת בכל סשן (כמו אצלך)
  logo = "/icons/apple-touch-icon.png"
}) {
  const [show, setShow] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const videoRef = useRef(null);

  // להציג פעם אחת בכל סשן (כמו שהיה)
  useEffect(() => {
    const seen = sessionStorage.getItem(onceKey);
    if (!seen) {
      setShow(true);
      sessionStorage.setItem(onceKey, "1");
    }
  }, [onceKey]);

  // פולבאק: נסגר אחרי זמן קצוב
  useEffect(() => {
    if (show && useFallback) {
      const t = setTimeout(() => setShow(false), durationFallback);
      return () => clearTimeout(t);
    }
  }, [show, useFallback, durationFallback]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[99999] overflow-hidden bg-black">
      {/* וידאו אם קיים */}
      {!useFallback && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          onEnded={() => setShow(false)}
          onError={() => setUseFallback(true)}
        >
          <source src={src} type="video/mp4" />
        </video>
      )}

      {/* טקסט – גדול, במרכז, עם אנימציית כניסה איטית */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center">
        <h1
          className="intro-text-animated uppercase font-extrabold text-white/95 tracking-[.30em]
                     text-3xl sm:text-4xl md:text-5xl lg:text-6xl"
          style={{ textShadow: "0 2px 12px rgba(0,0,0,.55)" }}
        >
          POWERED BY <span className="text-yellow-400">LEO</span> – THE REAL SHIBA INU
        </h1>
      </div>

      {/* פולבאק אנימציה אם אין וידאו */}
      {useFallback && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute w-[70vmin] h-[70vmin] rounded-full blur-3xl opacity-25 bg-yellow-500/40 animate-pulse" />
          <img
            src={logo}
            alt="LEO"
            className="relative w-[32vmin] h-[32vmin] rounded-[22%]"
            style={{
              animation: "splash-scale 1.6s ease-in-out forwards",
              boxShadow:
                "0 0 30px rgba(255,215,0,.25), 0 0 80px rgba(255,215,0,.18), inset 0 0 12px rgba(0,0,0,.35)"
            }}
          />
        </div>
      )}
    </div>
  );
}
