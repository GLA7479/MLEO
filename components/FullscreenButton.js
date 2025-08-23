// components/FullscreenButton.js
import { useEffect, useState } from "react";

export default function FullscreenButton({
  topOffset = 76,
  rightOffsetPx = 72, // נניח 72px כדי להשאיר מקום ל-⚙️ מימין
  labelFull = "Full",
  labelExit = "Exit",
}) {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const active = !!document.fullscreenElement || !!document.webkitFullscreenElement;
      setIsFs(active);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    onChange();
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const toggle = async () => {
    try {
      const el = document.documentElement;
      const active = !!document.fullscreenElement || !!document.webkitFullscreenElement;
      if (!active) {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      }
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      aria-label={isFs ? "Exit Fullscreen" : "Enter Fullscreen"}
      style={{
        top: `calc(env(safe-area-inset-top, 0px) + ${topOffset}px)`,
        right: `calc(env(safe-area-inset-right, 0px) + ${rightOffsetPx}px)`,
      }}
      className="fixed z-[9999] rounded-xl bg-black/60 text-white px-4 py-2
                 border border-white/20 backdrop-blur shadow active:scale-95"
    >
      {isFs ? labelExit : labelFull}
    </button>
  );
}
