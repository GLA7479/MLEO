// components/IntroOverlay.js
import { useEffect, useRef, useState } from "react";

export default function IntroOverlay({
  src = "/videos/leo-intro.mp4",     // שים כאן את הווידאו שלך (public/videos/leo-intro.mp4)
  durationFallback = 4500,            // כמה זמן להציג אם אין וידאו (פולבאק)
  onceKey = "intro_seen_session",     // מפתח בסשן – רץ פעם אחת
  logo = "/icons/apple-touch-icon.png"// לוגו לפולבאק האנימציה
}) {
  const [show, setShow] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const videoRef = useRef(null);

  // להציג פעם אחת בכל סשן
  useEffect(() => {
    const seen = sessionStorage.getItem(onceKey);
    if (!seen) {
      setShow(true);
      sessionStorage.setItem(onceKey, "1");
    }
  }, [onceKey]);

  // אם אנחנו במצב פולבאק – נסגור אחרי זמן קצוב
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

      {/* שכבת טקסט משותפת (מעל וידאו/פולבאק) */}
      <div className="absolute inset-x-0 bottom-[8vh] text-center px-4">
        <h1
          className="text-white/90 text-[15px] sm:text-lg font-bold tracking-[.25em] uppercase"
          style={{ textShadow: "0 2px 12px rgba(0,0,0,.6)" }}
        >
          POWERED BY <span className="text-yellow-400">LEO</span> – THE REAL SHIBA INU
        </h1>
      </div>

      {/* פולבאק אנימציה אם אין וידאו / שגיאה בטעינה */}
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
