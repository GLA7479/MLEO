/** @type {import('next').NextConfig} */
const nextConfig = {
  // הגדרות לייצוא סטטי (טוב ל-Capacitor) - מושבת זמנית עבור API routes
  // output: 'export',
  trailingSlash: true,
  
  // הגדרות תמונות (ללא אופטימיזציה ל-Capacitor)
  images: {
    unoptimized: true,
  },
  
  // הגדרות build
  distDir: 'out',
  
  // הגדרות webpack (למובייל)
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
