import "../styles/globals.css";
import "../i18n"; // מחברים את ההגדרות
import React, { useEffect } from "react";

// אם אין לך alias של "@", הנתיב היחסי הזה נכון למבנה הנוכחי:
import {
  registerBackButtonListener,
  removeBackButtonAllListeners,
} from "../src/mobile/back-handler";

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // הרשמה ללחצן BACK באנדרואיד (ב־WebView בתוך האפליקציה)
    const onBack = () => {
      if (typeof window !== "undefined") {
        // כאן אפשר לשים לוגיקה – סגירת מודל, ניווט אחורה וכו'
        history.back();
      }
    };

    registerBackButtonListener(onBack);
    return () => removeBackButtonAllListeners();
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp;
