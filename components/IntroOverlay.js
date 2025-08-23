// components/IntroOverlay.js
import { useEffect, useState } from "react";

export default function IntroOverlay() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 4000); // 4 שניות
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black z-[99999] flex items-center justify-center">
      <video
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
      >
        <source src="/videos/intro.mp4" type="video/mp4" />
      </video>

      <div className="absolute bottom-12 w-full text-center">
        <h1 className="text-white text-xl font-bold tracking-widest">
          POWERED BY <span className="text-yellow-400">LEO</span> THE REAL SHIBA INU
        </h1>
      </div>
    </div>
  );
}
