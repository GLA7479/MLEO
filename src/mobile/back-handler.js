// Load @capacitor/app only on client (avoids SSR import errors in Next.js)
export function registerBackButtonListener(handler) {
  if (typeof window === "undefined") return; // runs only in browser
  import("@capacitor/app")
    .then(({ App }) => {
      App.addListener("backButton", handler);
    })
    .catch((e) => {
      console.warn("Capacitor App module not available:", e);
    });
}

export function removeBackButtonAllListeners() {
  if (typeof window === "undefined") return; // runs only in browser
  import("@capacitor/app")
    .then(({ App }) => {
      App.removeAllListeners();
    })
    .catch(() => {});
}
