import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.eydelta.app",   // השאר באותיות קטנות
  appName: "MLEO Games",
  webDir: "out",              // אפשר להשאיר, לא מזיק
  server: {
    url: "https://ey-delta.vercel.app/game", // ← זה האתר שלך
    cleartext: false
  },
  android: { allowMixedContent: false }
};

export default config;
