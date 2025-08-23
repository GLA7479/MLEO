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

export default function FullscreenButton({
  className = "",
  topOffset = 56,            // מרחק מהחלק העליון (אחרי safe-area)
  labelEnter = "Full",       // טקסט כשלא במסך מלא
  labelExit = "Exit",        // טקסט כשבמסך מלא
}) {
  const [showTip, setShowTip] = useState(false);
  const [isFs, setIsFs] = useState(false);

  const canFullscreen = useMemo(() => {
    if (typeof document === "undefined") return false;
    return document.fullscreenEnabled || document.webkitFullscreenEnabled || false;
  }, []);

  // עדכון מצב לפי אירועי שינוי fullscreen (כולל webkit)
  useEffect(() => {
    const update = () => {
      const active =
        !!document.fullscreenElement || !!document.webkitFullscreenElement;
      setIsFs(active);
      if (!active) setShowTip(false);
    };
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange", update);
    update(); // סנכרון ראשוני
    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("webkitfullscreenchange", update);
    };
  }, []);

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } catch (_) {}
  };

  const enterFullscreen = async () => {
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
    } catch (_) {
      // נמשיך ל-fallback
    }
    // iOS בתוך Safari ללא standalone – להדריך Add to Home Screen
    if (isIOS() && !isStandalone()) {
      setShowTip(true);
      return;
    }
    // Fallback קטן: להשתמש בגובה מלא לפי CSS
    try {
      window.scrollTo(0, 1);
      document.body.classList.add("fullscreen-page");
    } catch (_) {}
  };

  const onClick = async () => {
    if (isFs) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  };

  return (
    <>
      <button
        onClick={onClick}
        style={{ top: `calc(env(safe-area-inset-top, 0px) + ${topOffset}px)` }}
        className={
          "fixed right-4 z-[9999] rounded-xl bg-black/60 text-white px-3 py-2 " +
          "border border-white/20 backdrop-blur shadow active:scale-95 " +
          className
        }
        aria-label={isFs ? "Exit Fullscreen" : "Enter Fullscreen"}
        title={isFs ? "Exit Fullscreen" : "Enter Fullscreen"}
      >
        {isFs ? "⤢ " + labelExit : "⛶ " + labelEnter}
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
