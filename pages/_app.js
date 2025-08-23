// pages/_app.js
import "../styles/globals.css";
import "../i18n";
import React, { useEffect } from "react";
import { registerBackButtonListener, removeBackButtonAllListeners } from "../src/mobile/back-handler";

// ⬇️ חדש: מסך פתיחה עם וידאו / פולבאק
import IntroOverlay from "../components/IntroOverlay";

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // גובה אמיתי (תיקון iOS ל-100vh/100dvh)
    const setVh = () => {
      const vh = window.innerHeight;
      document.documentElement.style.setProperty("--app-vh", `${vh}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    window.addEventListener("orientationchange", setVh);
    return () => {
      window.removeEventListener("resize", setVh);
      window.removeEventListener("orientationchange", setVh);
    };
  }, []);

  useEffect(() => {
    // BACK באנדרואיד (ב-WebView של Capacitor)
    const onBack = () => {
      if (typeof window !== "undefined") history.back();
    };
    registerBackButtonListener(onBack);
    return () => removeBackButtonAllListeners();
  }, []);

  return (
    <>
      {/* מוצג פעם אחת בכל סשן, נסגר כשהוידאו מסתיים או אחרי טיימאאוט */}
      <IntroOverlay />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
