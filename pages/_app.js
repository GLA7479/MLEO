// pages/_app.js
import "../styles/globals.css";
import "../i18n";
import React, { useEffect } from "react";
import { registerBackButtonListener, removeBackButtonAllListeners } from "../src/mobile/back-handler";

import { SettingsProvider } from "../components/SettingsContext";
import "../utils/global-audio-guard"; // ← טעינה פעם אחת לכל האתר (אין ייצוא)

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    const setVh = () => document.documentElement.style.setProperty("--app-vh", `${window.innerHeight}px`);
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
