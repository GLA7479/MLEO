import Layout from "../components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { TOTAL_SUPPLY_LABEL, TOKENOMICS_ITEMS } from "../data/tokenomics";

export default function Home() {
  const [activeVideo, setActiveVideo] = useState(null);
  const [activeImage, setActiveImage] = useState(null);

  const images = [
    { src: "/images/shiba1.jpg", alt: "LEO Shiba 1" },
    { src: "/images/shiba2.jpg", alt: "LEO Shiba 2" },
    { src: "/images/shiba3.jpg", alt: "LEO Shiba 3" },
    { src: "/images/shiba4.jpg", alt: "LEO Shiba 4" },
  ];

  const ecosystemCards = [
    {
      icon: "⛏️",
      title: "Mining",
      text: "Interactive mining systems built around progression, activity, and long-term engagement inside the MLEO ecosystem.",
      href: "https://mleo-m.vercel.app/?lang=en",
      cta: "Explore Mining",
    },
    {
      icon: "🎮",
      title: "Arcade",
      text: "Arcade-style games and fun experiences designed to keep the ecosystem active, entertaining, and rewarding.",
      href: "https://mleo-m.vercel.app/mining?lang=en",
      cta: "Enter Arcade",
    },
    {
      icon: "🌐",
      title: "Online",
      text: "Competitive and evolving multiplayer experiences that expand the MLEO world beyond a standard token project.",
      href: "https://mleo-m.vercel.app/mining?lang=en",
      cta: "Go Online",
    },
    {
      icon: "🏦",
      title: "Vault & Rewards",
      text: "A connected environment where gameplay, progression, and future reward mechanics come together under one ecosystem.",
      href: "/about",
      cta: "Learn More",
    },
  ];

  const logoAnimation = {
    animate: {
      rotate: [0, 360],
      scale: [1, 1.1, 1],
      filter: [
        "drop-shadow(0px 0px 10px gold)",
        "drop-shadow(0px 0px 20px orange)",
        "drop-shadow(0px 0px 20px yellow)",
        "drop-shadow(0px 0px 10px gold)",
      ],
    },
    transition: { repeat: Infinity, duration: 5, ease: "linear" },
  };

  return (
    <Layout page="home">
      <div className="mt-[50px]">
        {/* Hero Section */}
        <section className="relative flex flex-col items-center text-center px-6 bg-gradient-to-b from-black via-gray-900 to-black pt-0 pb-8 -mt-6">
          <motion.h1
            className="mb-1 drop-shadow-lg leading-tight flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="flex items-center gap-3">
              <motion.div {...logoAnimation}>
                <Image src="/images/logo2.png" alt="MLEO Logo Left" width={90} height={90} />
              </motion.div>

              <span className="text-5xl md:text-7xl font-extrabold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                MLEO
              </span>

              <motion.div {...logoAnimation}>
                <Image src="/images/logo2.png" alt="MLEO Logo Right" width={90} height={90} />
              </motion.div>
            </span>

            <span className="block text-2xl md:text-3xl lg:text-3.5xl mt-1 font-semibold bg-gradient-to-r from-yellow-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-md">
              LEO - THE REAL SHIBA INU
            </span>
          </motion.h1>

          {/* Videos */}
          <div className="flex flex-col sm:flex-row gap-6 mt-4 justify-center">
            <motion.video
              autoPlay
              loop
              muted
              playsInline
              onClick={() => setActiveVideo("left")}
              className="w-full sm:w-80 lg:w-96 rounded-xl shadow-lg cursor-pointer"
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <source src="/videos/left.mp4" type="video/mp4" />
            </motion.video>

            <motion.video
              autoPlay
              loop
              muted
              playsInline
              onClick={() => setActiveVideo("right")}
              className="w-full sm:w-80 lg:w-96 rounded-xl shadow-lg cursor-pointer"
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <source src="/videos/right.mp4" type="video/mp4" />
            </motion.video>
          </div>

          <motion.p
            className="text-base md:text-lg text-gray-300 max-w-3xl mt-3 mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            Mine, play, compete, and grow inside the MLEO ecosystem. A Shiba-powered digital
            world built around mining, arcade gameplay, online experiences, rewards, and long-term
            expansion.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-3"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <a
              href="/presale"
              className="bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-5 rounded-full text-lg font-semibold shadow-lg transition"
            >
              🚀 Join Presale
            </a>

            <a
              href="https://mleo-m.vercel.app/?lang=en"
              className="bg-transparent border-2 border-yellow-500 hover:bg-yellow-500 hover:text-black text-yellow-500 py-2 px-5 rounded-full text-lg font-semibold transition"
            >
              Enter Ecosystem
            </a>
          </motion.div>
        </section>

        {/* Active Video Popup */}
        {activeVideo && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={() => setActiveVideo(null)}
          >
            <motion.video
              autoPlay
              loop
              muted
              playsInline
              className="w-[90%] max-w-3xl rounded-xl shadow-2xl"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <source
                src={activeVideo === "left" ? "/videos/left.mp4" : "/videos/right.mp4"}
                type="video/mp4"
              />
            </motion.video>
          </div>
        )}

        {/* Core Ecosystem */}
        <section className="py-16 bg-black text-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl font-bold text-yellow-500 mb-4">⚡ Core Ecosystem</h2>
            <p className="text-gray-300 text-lg max-w-3xl mx-auto mb-10">
              MLEO is more than a token. It is a growing digital ecosystem built around mining,
              arcade gameplay, online competition, community activity, and connected rewards.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
              {ecosystemCards.map((card, i) => (
                <motion.div
                  key={card.title}
                  className="bg-gray-900 border border-yellow-500/20 rounded-2xl p-6 shadow-lg hover:shadow-yellow-500/20 transition-all duration-300 hover:-translate-y-1 flex flex-col h-full"
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: i * 0.15 }}
                >
                  <div className="text-4xl mb-3">{card.icon}</div>
                  <h3 className="text-2xl font-bold text-yellow-400 mb-3">{card.title}</h3>
                  <p className="text-gray-300 text-base leading-relaxed mb-5">{card.text}</p>
                  <a
                    href={card.href}
                    className="inline-block bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-4 rounded-full text-sm font-semibold transition mt-auto self-center"
                  >
                    {card.cta}
                  </a>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* About Section */}
        <section className="py-16 bg-gradient-to-r from-gray-900 to-black text-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl font-bold text-yellow-500 mb-4">🐕 What is MLEO?</h2>
            <p className="text-gray-300 text-lg mb-6 max-w-3xl mx-auto">
              Inspired by LEO, the real Shiba Inu, MLEO combines brand identity, community energy,
              gaming experiences, and a scalable digital ecosystem designed to evolve over time.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-[0.5cm] mt-8">
              {images.map((img, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: i * 0.3 }}
                  whileHover={{ scale: 1.1 }}
                  className="relative cursor-pointer overflow-hidden rounded-2xl shadow-lg hover:shadow-yellow-400"
                  onClick={() => setActiveImage(img.src)}
                >
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="w-full h-auto transition-transform duration-300 scale-90"
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Popup Image */}
        <AnimatePresence>
          {activeImage && (
            <motion.div
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
              onClick={() => setActiveImage(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.img
                key={activeImage}
                src={activeImage}
                alt="Fullscreen LEO"
                className="rounded-2xl max-w-[90%] max-h-[90%] shadow-2xl"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.4 }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tokenomics */}
        <section className="py-16 bg-black text-center">
          <motion.h2
            className="text-4xl font-bold text-yellow-500 mb-5"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            📊 Tokenomics
          </motion.h2>

          <p className="text-gray-300 text-lg mb-3 max-w-3xl mx-auto px-6">
            Transparent token distribution designed to support growth, liquidity, long-term
            development, and community rewards across the MLEO ecosystem.
          </p>

          <p className="text-yellow-400 text-base md:text-lg font-semibold mb-8">
            Total Supply: {TOTAL_SUPPLY_LABEL} MLEO
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 px-6 max-w-6xl mx-auto">
            {TOKENOMICS_ITEMS.map((item, i) => (
              <motion.div
                key={i}
                className="bg-gray-800 rounded-xl p-5 shadow-lg hover:scale-105 transition-transform"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: i * 0.12 }}
              >
                <h3 className="text-3xl font-extrabold text-yellow-500">{item.value}%</h3>
                <p className="text-base md:text-lg text-gray-300">{item.title}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-8">
            <a
              href="/tokenomics"
              className="inline-block bg-transparent border-2 border-yellow-500 hover:bg-yellow-500 hover:text-black text-yellow-500 py-2 px-5 rounded-full text-lg font-semibold transition"
            >
              View Full Tokenomics
            </a>
          </div>
        </section>

        {/* Future Expansion */}
        <section className="py-16 bg-gradient-to-r from-gray-900 via-black to-gray-900 text-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto"
          >
            <h2 className="text-4xl font-bold text-yellow-500 mb-4">🚀 Future Expansion</h2>
            <p className="text-gray-300 text-lg mb-6">
              MLEO starts with mining, arcade gameplay, online experiences, and rewards —
              but the
              broader vision continues to grow. Future development may include additional
              community-focused and family-friendly interactive experiences as part of the
              expanding brand ecosystem.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="https://liosh-website.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-yellow-500 hover:bg-yellow-600 text-black py-2 px-5 rounded-full text-lg font-semibold shadow-lg transition"
              >
                Preview Future Concept
              </a>

              <a
                href="/about"
                className="bg-transparent border-2 border-yellow-500 hover:bg-yellow-500 hover:text-black text-yellow-500 py-2 px-5 rounded-full text-lg font-semibold transition"
              >
                Explore Vision
              </a>
            </div>
          </motion.div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black text-center px-6">
          <motion.h2
            className="text-4xl font-extrabold mb-3"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Be Part of the MLEO Journey 🚀
          </motion.h2>

          <motion.p
            className="text-lg mb-5 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            Join early and be part of a growing ecosystem built around mining, gameplay, rewards,
            community, and long-term expansion.
          </motion.p>

          <a
            href="/presale"
            className="bg-black text-yellow-500 px-8 py-3 rounded-full font-bold text-lg shadow-lg hover:bg-gray-900 transition"
          >
            Join Presale Now
          </a>
        </section>
      </div>
    </Layout>
  );
}
