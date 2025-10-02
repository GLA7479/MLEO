import { useState, useEffect } from "react";
import { FaBars, FaTimes } from "react-icons/fa";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const { i18n } = useTranslation();
  const [rotate, setRotate] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotate(true);
      setTimeout(() => setRotate(false), 1000);
    }, Math.random() * 8000 + 5000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { key: "home", href: "/" },
    { key: "about", href: "/about" },
    { key: "tokenomics", href: "/tokenomics" },
    { key: "presale", href: "/presale" },
    { key: "staking", href: "/staking-hub" },
    { key: "gallery", href: "/gallery" },
    { key: "whitepaper", href: "/whitepaper" },
    { key: "contact", href: "/contact" },
   { key: "games", href: "/game" }
  ];

  const languages = [
    { code: "en", label: "EN" },
    { code: "he", label: "HE" },
    { code: "ar", label: "AR" },
    { code: "ja", label: "JA" },
    { code: "zh", label: "ZH" },
    { code: "ko", label: "KO" },
    { code: "de", label: "DE" },
    { code: "nl", label: "NL" },
    { code: "fr", label: "FR" },
    { code: "pl", label: "PL" },
    { code: "ro", label: "RO" },
    { code: "ru", label: "RU" },
    { code: "tr", label: "TR" },
  ];

  const colors = [
    "#FF5733", "#FFC300", "#DAF7A6", "#33FFBD",
    "#33A1FF", "#9D33FF", "#FF33A8", "#FF8C33"
  ];

  return (
    <header
      className="fixed w-full z-50 text-yellow-400"
      style={{
        background:
          "linear-gradient(90deg, rgba(11,29,54,0.9) 0%, rgba(18,39,70,0.9) 50%, rgba(11,29,54,0.9) 100%)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/logo.png"
            alt="LIOSH Logo"
            width={70}
            height={70}
            className={`rounded-full transition-transform duration-1000 ${rotate ? "rotate-[360deg]" : ""}`}
            onMouseEnter={() => {
              setRotate(true);
              setTimeout(() => setRotate(false), 1000);
            }}
          />
          <div className="flex flex-col leading-tight">
            <span className="text-xl font-extrabold tracking-wide text-yellow-400">
              LIOSH Token
            </span>
            <span className="text-xs text-gray-300 italic">
              Powered by LIO – The Real Shiba Inu
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <select
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            value={i18n.language}
            className="bg-gray-900 bg-opacity-60 text-yellow-400 px-2 py-0.5 rounded-md text-xs sm:text-sm"
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>

          <button
            className="text-yellow-400 text-2xl"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        {isOpen && (
          <div
            className="fixed right-0 top-20 w-80 flex flex-col items-end py-6 space-y-4 z-50 overflow-hidden"
            style={{ borderRadius: "8px" }}
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: 0.7 }}
            >
              <source src="/videos/menu-bg.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-black bg-opacity-30"></div>

            {menuItems.map((item, index) => (
              <Link
                key={item.key}
                href={item.href}
                className="relative text-lg font-bold pr-5 uppercase"
                style={{
                  color: colors[index % colors.length],
                  textShadow: "0 0 6px rgba(255,255,255,0.8), 0 0 10px rgba(255,255,255,0.6)",
                }}
                onClick={() => setIsOpen(false)}
              >
                {item.key}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

export function FloatingPresaleButton() {
  return (
    <a
      href="/presale"
      className="fixed bottom-6 right-6 bg-yellow-500 hover:bg-yellow-600 text-black px-5 py-3 rounded-full font-bold shadow-lg transition z-50"
    >
      🚀 Join Presale
    </a>
  );
}

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 text-center py-6 mt-10">
      <p className="text-sm">
        📧 Contact us:{" "}
        <a
          href="mailto:contact@liosh.com"
          className="text-yellow-400 hover:underline"
        >
          contact@liosh.com
        </a>{" "}
        | 🌐{" "}
        <a
          href="https://liosh.com"
          className="text-yellow-400 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          liosh.com
        </a>
      </p>
    </footer>
  );
}
