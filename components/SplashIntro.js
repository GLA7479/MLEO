// components/SplashIntro.js
import { useEffect, useState } from "react";

export default function SplashIntro({
  duration = 1600,
  logoSrc = "/icons/apple-touch-icon.png",
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem("splash_seen");
    const onGame = typeof window !== "undefined" && window.location.pathname === "/game";
    if (!seen && onGame) {
      setVisible(true);
      const t = setTimeout(() => {
        setVisible(false);
        sessionStorage.setItem("splash_seen", "1");
      }, duration);
      return () => clearTimeout(t);
    }
  }, [duration]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden
                    bg-gradient-to-b from-[#0A0F1A] via-[#0A0F1A] to-[#111827]">
      <div className="absolute w-[70vmin] h-[70vmin] rounded-full blur-3xl opacity-25
                      bg-yellow-500/40 animate-pulse-slow" />
      <img
        src={logoSrc}
        alt="MLEO"
        className="relative animate-splash-scale w-[32vmin] h-[32vmin] rounded-[22%] shadow-2xl"
        style={{
          boxShadow:
            "0 0 30px rgba(255,215,0,.25), 0 0 80px rgba(255,215,0,.18), inset 0 0 12px rgba(0,0,0,.35)",
        }}
      />
    </div>
  );
}
