// pages/_app.js
import "../styles/globals.css";
import "../i18n";
import React, { useEffect } from "react";
import { registerBackButtonListener, removeBackButtonAllListeners } from "../src/mobile/back-handler";
import { SettingsProvider } from "../components/SettingsContext";
// הוסר: import "../utils/global-audio-guard";  // ← אל תטעין סטטי

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // טען את ה-guard רק בצד לקוח
    (async () => {
      if (typeof window !== "undefined") {
        await import("../utils/global-audio-guard");
      }
    })();

    // תיקון גובה ל-iOS
    const setVh = () => {
      document.documentElement.style.setProperty("--app-vh", `${window.innerHeight}px`);
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
    const onBack = () => { if (typeof window !== "undefined") history.back(); };
    registerBackButtonListener(onBack);
    return () => removeBackButtonAllListeners();
  }, []);

  return (
    <SettingsProvider>
      <Component {...pageProps} />
    </SettingsProvider>
  );
}

export default MyApp;
