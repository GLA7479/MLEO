// components/FullscreenButton.js
import { useEffect, useState } from "react";

export default function FullscreenButton({
  topOffset = 76,
  rightOffsetPx = 64,
  onClick,
}) {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = async () => {
    if (onClick) onClick(); // אופציונלי אם תרצה ליירט
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
      aria-label={isFs ? "Exit Fullscreen" : "Enter Fullscreen"}
      onClick={toggle}
      className="fixed z-[10000] w-10 h-10 flex items-center justify-center
                 rounded-full bg-yellow-400 shadow hover:bg-yellow-300 active:scale-95
                 focus:outline-none"
      style={{ top: `${topOffset}px`, right: `${rightOffsetPx}px` }}
    >
      {/* מסך מלא / חלקי – אייקון שחור עבה */}
      {isFs ? (
        // Exit fullscreen
        <svg
          viewBox="0 0 24 24"
          className="w-7 h-7"
          fill="none"
          stroke="black"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 3H5a2 2 0 0 0-2 2v4M15 21h4a2 2 0 0 0 2-2v-4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4" />
        </svg>
      ) : (
        // Enter fullscreen
        <svg
          viewBox="0 0 24 24"
          className="w-7 h-7"
          fill="none"
          stroke="black"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9V5a2 2 0 0 1 2-2h4M21 15v4a2 2 0 0 1-2 2h-4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4" />
        </svg>
      )}
    </button>
  );
}
