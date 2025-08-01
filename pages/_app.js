import "../styles/globals.css";
import "../i18n"; // מחברים את ההגדרות
import { useEffect } from "react";

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // קוד שרץ פעם אחת בטעינת האתר
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp;
