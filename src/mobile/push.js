// src/mobile/push.js
// OneSignal init (Capacitor plugin). Safe no-op on web.
export function initPush() {
  const isCap = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform?.();
  if (!isCap) return;

  // OneSignal Capacitor plugin exposes a global after sync (native).
  // @ts-ignore
  const OneSignal = window?.OneSignal;
  if (!OneSignal) {
    console.log('OneSignal not available yet');
    return;
  }

  const APP_ID = 'ONESIGNAL_APP_ID'; // ← change to your OneSignal App ID
  try {
    OneSignal.initialize(APP_ID);
    OneSignal.Notifications.requestPermission(true);
    OneSignal.Notifications.addEventListener('click', (event) => {
      const deeplink = event?.notification?.additionalData?.deeplink;
      if (deeplink) window.location.href = deeplink;
    });
  } catch (e) {
    console.log('OneSignal init error', e);
  }
}
