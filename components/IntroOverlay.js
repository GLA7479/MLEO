// components/IntroOverlay.js
import { useEffect, useState } from "react";

export default function IntroOverlay() {
  const [show, setShow] = useState(true);

  // השהייה של 2 שניות אחרי סיום הסרטון לפני הסתרת האוברליי
  const handleEnded = () => {
    setTimeout(() => setShow(false), 2000); // +2s
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black">
      <video
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        onEnded={handleEnded}
        preload="auto"
      >
        {/* אם יש לך גם WEBM, השאר את שתי השורות */}
        <source src="/videos/leo-intro.webm" type="video/webm" />
        <source src="/videos/leo-intro.mp4" type="video/mp4" />
      </video>

      {/* טקסט גדול + אנימציית כניסה איטית (ממורכז אנכית) */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center">
        <h1
          className="intro-text-animated uppercase font-extrabold text-white/95 tracking-[.28em]
                     text-2xl sm:text-3xl md:text-4xl"
        >
          POWERED BY <span className="text-yellow-400">LEO</span> – THE REAL SHIBA INU
        </h1>
      </div>
    </div>
  );
}
