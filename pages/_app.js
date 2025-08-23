// pages/_app.js
import "../styles/globals.css";
import "../i18n";
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { registerBackButtonListener, removeBackButtonAllListeners } from "../src/mobile/back-handler";
import { SettingsProvider } from "../components/SettingsContext";
import IntroOverlay from "../components/IntroOverlay";

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  // טען את הגארד רק בדפדפן (לא ב-SSR)
  useEffect(() => {
    (async () => {
      if (typeof window !== "undefined") {
        await import("../utils/global-audio-guard");
      }
    })();

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

  // BACK באנדרואיד
  useEffect(() => {
    const onBack = () => { if (typeof window !== "undefined") history.back(); };
    registerBackButtonListener(onBack);
    return () => removeBackButtonAllListeners();
  }, []);

  // מציגים Intro רק בעמודי המשחקים (/game ו-/mleo-*)
  const showIntro =
    router.pathname === "/game" || router.pathname.startsWith("/mleo-");

  return (
    <SettingsProvider>
      {showIntro && <IntroOverlay />}
      <Component {...pageProps} />
    </SettingsProvider>
  );
}

export default MyApp;
