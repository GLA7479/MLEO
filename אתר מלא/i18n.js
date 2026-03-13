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
          mining: "Mining",
          gallery: "Gallery",
          whitepaper: "Whitepaper",
          contact: "Contact",
          // Homepage translations
          hero_title: "LEO - THE REAL SHIBA INU",
          hero_subtitle: "Join the revolution of meme coins with real utility and real community. Be an early part of the MLEO movement!",
          join_presale: "🚀 Join Presale",
          learn_more: "Learn More",
          what_is_mleo: "🐕 What is MLEO?",
          mleo_description: "MLEO is a next-gen meme coin inspired by LEO, the real Shiba Inu. We combine fun, community, and real-world utility to create a token that's here to stay.",
          tokenomics_title: "📊 Tokenomics",
          tokenomics_description: "A sustainable and fair token distribution designed to reward early supporters and long-term holders.",
          presale_percent: "Presale",
          team_percent: "Team & Advisors",
          staking_percent: "Staking Rewards",
          reserve_percent: "Reserve",
          cta_title: "Be Part of the MLEO Journey 🚀",
          cta_description: "Secure your place in the future of meme coins with real value and strong community support.",
          join_presale_now: "Join Presale Now",
        },
      },
      he: {
        translation: {
          home: "דף הבית",
          about: "אודות",
          tokenomics: "טוקנומיקס",
          presale: "פריסייל",
          staking: "סטייקינג",
          mining: "כרייה",
          gallery: "גלריה",
          whitepaper: "וייטפייפר",
          contact: "צור קשר",
          // Homepage translations
          hero_title: "LEO - השיבה האמיתי",
          hero_subtitle: "הצטרפו למהפכת מטבעות הממים עם תועלת אמיתית וקהילה אמיתית. היו חלק מוקדם מתנועת MLEO!",
          join_presale: "🚀 הצטרפו לפריסייל",
          learn_more: "למדו עוד",
          what_is_mleo: "🐕 מה זה MLEO?",
          mleo_description: "MLEO הוא מטבע ממים מהדור הבא בהשראת LEO, השיבה האמיתי. אנו משלבים כיף, קהילה ותועלת עולמית אמיתית כדי ליצור טוקן שנשאר כאן.",
          tokenomics_title: "📊 טוקנומיקס",
          tokenomics_description: "הפצת טוקנים בת קיימא והוגנת שנועדה לתגמל תומכים מוקדמים ובעלי מניות לטווח ארוך.",
          presale_percent: "פריסייל",
          team_percent: "צוות ויועצים",
          staking_percent: "תגמולי סטייקינג",
          reserve_percent: "רזרבה",
          cta_title: "היו חלק ממסע MLEO 🚀",
          cta_description: "הבטיחו את מקומכם בעתיד מטבעות הממים עם ערך אמיתי ותמיכה קהילתית חזקה.",
          join_presale_now: "הצטרפו לפריסייל עכשיו",
        },
      },
    },
    lng: "en", // שפה ראשונית
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

export default i18n;
