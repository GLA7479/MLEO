import i18n from "i18next";
import { initReactI18next } from "react-i18next";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: {
        translation: {
          home: "Home",
          about: "About",
          tokenomics: "Tokenomics",
          presale: "Presale",
          staking: "Staking",
          gallery: "Gallery",
          whitepaper: "Whitepaper",
          contact: "Contact",
        },
      },
      he: {
        translation: {
          home: "דף הבית",
          about: "אודות",
          tokenomics: "טוקנומיקס",
          presale: "פריסייל",
          staking: "סטייקינג",
          gallery: "גלריה",
          whitepaper: "וייטפייפר",
          contact: "צור קשר",
        },
      },
    },
    lng: "en", // שפה ראשונית
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

export default i18n;
