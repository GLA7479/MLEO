/** @type {import('next').NextConfig} */
const nextConfig = {
  // אפשר להשאיר Strict Mode
  reactStrictMode: true,

  // אין output:'export' ואין distDir — Vercel בונה ל-.next
  trailingSlash: true,

  // באתר על Vercel מומלץ להשאיר אופטימיזציית תמונות דלוקה (ברירת מחדל)
  // אם יש לך תמונות חיצוניות, הוסף להלן domains / remotePatterns לפי הצורך.
  images: {
    // unoptimized: false, // ברירת המחדל; השאר כך או מחק את images לגמרי
  },

  // לזיהוי/אבחון בלבד — אפשר להסיר אחרי שהדפלוי עובר חלק
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // שמירה על fallback כדי למנוע ניסיונות bundle ל-fs/net/tls בצד לקוח
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
