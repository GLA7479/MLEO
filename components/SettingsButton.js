// components/SettingsButton.js
export default function SettingsButton({ topOffset = 76, rightOffsetPx = 16, onClick }) {
  return (
    <button
      onClick={onClick}
      title="Settings"
      aria-label="Settings"
      className="fixed z-[1200] rounded-full shadow-lg active:scale-95 transition
                 bg-yellow-400 hover:bg-yellow-300 border border-yellow-300"
      style={{
        top: `${topOffset}px`,
        right: `${rightOffsetPx}px`,
        width: 40,
        height: 40,
      }}
    >
      {/* אייקון גלגל שיניים — שחור, פחות עבה מ-חץ אבל עדיין ברור */}
      <svg viewBox="0 0 24 24" width="22" height="22" className="mx-auto"
           fill="none" stroke="#111827" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8.1 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.1a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 3.4l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09c0 .66.39 1.26 1 1.51.57.23 1.22.1 1.69-.33l.06-.06A2 2 0 1 1 21 7.04l-.06.06c-.43.47-.56 1.12-.33 1.69.25.61.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.66 0-1.26.39-1.51 1z"/>
      </svg>
    </button>
  );
}
