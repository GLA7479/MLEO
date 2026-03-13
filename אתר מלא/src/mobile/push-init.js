// Initialize OneSignal on real device only (Cordova/Capacitor environment)
export function initPush() {
  if (typeof window === "undefined") return;

  // On Capacitor, Cordova's 'deviceready' event יורה גם כן:
  const start = () => {
    const OneSignal = window.plugins && window.plugins.OneSignal;
    if (!OneSignal) {
      console.warn("OneSignal plugin not available (emulator without push or web).");
      return;
    }

    try {
      // שים כאן את ה-App ID שלך מ-OneSignal
      OneSignal.setAppId("YOUR-ONESIGNAL-APP-ID");

      // בקשת הרשאה (iOS/Android 13+):
      if (OneSignal.promptForPushNotificationsWithUserResponse) {
        OneSignal.promptForPushNotificationsWithUserResponse((accepted) => {
          console.log("Push permission:", accepted);
        });
      }

      // מאזינים לפתיחת התראה
      if (OneSignal.setNotificationOpenedHandler) {
        OneSignal.setNotificationOpenedHandler((json) => {
          console.log("Notification opened:", json);
          // TODO: ניווט/פעולה בהתאם לנתונים מההתראה
        });
      }
    } catch (e) {
      console.error("OneSignal init error:", e);
    }
  };

  // אם כבר יש deviceready – תרוץ מיידית; אחרת נרשם לאירוע
  if (window.cordova && window.cordova.platformId) {
    document.addEventListener("deviceready", start, { once: true });
  } else {
    // ב־Capacitor לעיתים אין צורך לחכות – אבל נשמור על זהירות
    start();
  }
}
