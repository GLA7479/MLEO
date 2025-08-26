// components/BackButton.js
import { useRouter } from "next/router";

export default function BackButton({ topOffset = 76, leftOffsetPx = 16 }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      title="Back"
      aria-label="Back"
      className="fixed z-[1200] rounded-full shadow-lg active:scale-95 transition
                 bg-yellow-400 hover:bg-yellow-300 border border-yellow-300"
      style={{
        top: `${topOffset}px`,
        left: `${leftOffsetPx}px`,
        width: 40,
        height: 40,
      }}
    >
      {/* אייקון חץ — שחור, עבה ובולט */}
      <svg viewBox="0 0 24 24" width="22" height="22" className="mx-auto"
           fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
