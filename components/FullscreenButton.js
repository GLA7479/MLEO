// components/FullscreenButton.js
import React, { useEffect, useMemo, useState } from "react";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    (window.navigator && window.navigator.standalone) ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export default function FullscreenButton({ label = "Full", className = "" }) {
  const [showTip, setShowTip] = useState(false);

  const canFullscreen = useMemo(() => {
    if (typeof document === "undefined") return false;
    return document.fullscreenEnabled || document.webkitFullscreenEnabled || false;
  }, []);

  useEffect(() => {
    const onChange = () => setShowTip(false);
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const tryFullscreen = async () => {
    if (typeof document === "undefined") return;

    const el = document.documentElement;
    try {
      if (!document.fullscreenElement && canFullscreen) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
          return;
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
          return;
        }
      }
    } catch (_) {}

    if (isIOS() && !isStandalone()) {
      setShowTip(true);
      return;
    }

    // Fallback קטן: לכל הפחות נוודא גובה מלא לפי ה-CSS שלך
    try {
      window.scrollTo(0, 1);
      document.body.classList.add("fullscreen-page");
    } catch (_) {}
  };

  return (
    <>
      <button
        onClick={tryFullscreen}
        className={
          "fixed right-4 fixed-top-safe z-[9999] " +
          "rounded-xl bg-black/60 text-white px-3 py-2 " +
          "border border-white/20 backdrop-blur shadow active:scale-95 " +
          className
        }
        aria-label="Fullscreen"
        title="Fullscreen"
      >
        ⛶ {label}
      </button>

      {showTip && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setShowTip(false)}
        >
          <div className="mx-4 max-w-sm rounded-2xl bg-black/85 text-white p-4 border border-white/15">
            <h3 className="text-lg font-semibold mb-2">מסך מלא ב־iPhone</h3>
            <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-200">
              <li>לחץ על כפתור <strong>שיתוף</strong> (ריבוע עם חץ למעלה).</li>
              <li>בחר <strong>Add to Home Screen</strong>.</li>
              <li>פתח מהאייקון — ירוץ בלי סרגל כתובת.</li>
            </ol>
            <button
              className="mt-3 w-full rounded-lg bg-yellow-400 text-black font-semibold py-2"
              onClick={() => setShowTip(false)}
            >
              הבנתי
            </button>
          </div>
        </div>
      )}
    </>
  );
}
