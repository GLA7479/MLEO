// components/FullscreenButton.js
import { useEffect, useState } from "react";

export default function FullscreenButton({ topOffset = 76, rightOffsetPx = 64 }) {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      title={isFs ? "Exit Fullscreen" : "Enter Fullscreen"}
      aria-label="Fullscreen"
      className="fixed z-[1200] rounded-full shadow-lg active:scale-95 transition
                 bg-yellow-400 hover:bg-yellow-300 border border-yellow-300"
      style={{
        top: `${topOffset}px`,
        right: `${rightOffsetPx}px`,
        width: 40,
        height: 40,
      }}
    >
      {/* אייקון מסך מלא/חלקי — שחור, עבה */}
      {isFs ? (
        // Exit (arrows in)
        <svg viewBox="0 0 24 24" width="22" height="22" className="mx-auto"
             fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3H5a2 2 0 0 0-2 2v4" />
          <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
          <path d="M3 15v4a2 2 0 0 0 2 2h4" />
          <path d="M21 9V5a2 2 0 0 0-2-2h-4" />
        </svg>
      ) : (
        // Enter (arrows out)
        <svg viewBox="0 0 24 24" width="22" height="22" className="mx-auto"
             fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9V5a1 1 0 0 1 1-1h4" />
          <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
          <path d="M15 4h4a1 1 0 0 1 1 1v4" />
          <path d="M9 20H5a1 1 0 0 1-1-1v-4" />
        </svg>
      )}
    </button>
  );
}
