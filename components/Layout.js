import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Header from "./Header";
import { Footer } from "./Header";

export default function Layout({ children, video, page }) {
  const videoRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [video]);

  // בדיקה אם הנתיב הנוכחי הוא עמוד המשחקים או אחד המשחקים עצמם
  const hideButton =
    router.pathname === "/game" ||
    router.pathname.startsWith("/mleo-");

  return (
    <div className="relative w-full min-h-screen text-white overflow-hidden">
      {video && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="fixed top-0 left-0 w-full h-full object-cover -z-10"
          src={video}
        />
      )}

      {video && <div className="absolute inset-0 bg-black/50 -z-10"></div>}

      <Header />

      <main className="relative z-10 pt-[65px]">{children}</main>

      {/* כפתור פריסייל – לא יוצג בעמוד GAME ובמשחקים */}
      {!hideButton && (
        <a
          href="/presale"
          className="fixed bottom-4 left-4 bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-full text-sm font-bold shadow-lg transition z-50"
        >
          🚀 Join Presale
        </a>
      )}

      <Footer />
    </div>
  );
}
