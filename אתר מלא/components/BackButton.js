// components/BackButton.js
import { useRouter } from "next/router";

export default function BackButton({
  topOffset = 76,
  leftOffsetPx = 16,
  onClick,
}) {
  const router = useRouter();

  const handle = () => {
    if (onClick) return onClick();
    // חזרה רגילה
    if (window.history.length > 1) router.back();
    else router.push("/game");
  };

  return (
    <button
      aria-label="Back"
      onClick={handle}
      className="fixed z-[10000] w-10 h-10 flex items-center justify-center
                 rounded-full bg-yellow-400 shadow hover:bg-yellow-300 active:scale-95
                 focus:outline-none"
      style={{ top: `${topOffset}px`, left: `${leftOffsetPx}px` }}
    >
      {/* חץ שחור עבה */}
      <svg
        viewBox="0 0 24 24"
        className="w-7 h-7"
        fill="none"
        stroke="black"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}
