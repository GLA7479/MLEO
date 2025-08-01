import Layout from "../components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useState } from "react";

export default function Home() {
  const [activeVideo, setActiveVideo] = useState(null);
  const [activeImage, setActiveImage] = useState(null);

  const images = [
    { src: "/images/shiba1.jpg", alt: "Lio Shiba 1" },
    { src: "/images/shiba2.jpg", alt: "Lio Shiba 2" },
    { src: "/images/shiba3.jpg", alt: "Lio Shiba 3" },
    { src: "/images/shiba4.jpg", alt: "Lio Shiba 4" },
  ];

  const tokenomics = [
    { percent: "40%", label: "Presale" },
    { percent: "30%", label: "Team & Advisors" },
    { percent: "20%", label: "Staking Rewards" },
    { percent: "10%", label: "Reserve" },
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
        <section className="relative flex flex-col items-center text-center px-6 bg-gradient-to-b from-black via-gray-900 to-black pt-0 pb-6 -mt-6">
          <motion.h1
            className="mb-1 drop-shadow-lg leading-tight flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="flex items-center gap-3">
              <motion.div {...logoAnimation}>
                <Image src="/images/logo2.png" alt="Liosh Logo Left" width={90} height={90} />
              </motion.div>
              <span className="text-5xl md:text-7xl font-extrabold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                LIOSH
              </span>
              <motion.div {...logoAnimation}>
                <Image src="/images/logo2.png" alt="Liosh Logo Right" width={90} height={90} />
              </motion.div>
            </span>
            <span className="block text-2xl md:text-3xl lg:text-3.5xl mt-1 font-semibold bg-gradient-to-r from-yellow-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-md">
              LIO - THE REAL SHIBA INU
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
            className="text-base md:text-lg text-gray-300 max-w-2xl mt-2 mb-3"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            Join the revolution of meme coins with real utility and real community.
            Be an early part of the LIOSH movement!
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-2"
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
              href="/about"
              className="bg-transparent border-2 border-yellow-500 hover:bg-yellow-500 hover:text-black text-yellow-500 py-2 px-5 rounded-full text-lg font-semibold transition"
            >
              Learn More
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

        {/* About Section */}
        <section className="py-16 bg-gradient-to-r from-gray-900 to-black text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl font-bold text-yellow-500 mb-4">🐕 What is LIOSH?</h2>
            <p className="text-gray-300 text-lg mb-6">
              LIOSH is a next-gen meme coin inspired by Lio, the real Shiba Inu.
              We combine fun, community, and real-world utility to create a token that’s here to stay.
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
                alt="Fullscreen Lio"
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
          <p className="text-gray-300 text-lg mb-8 max-w-3xl mx-auto">
            A sustainable and fair token distribution designed to reward early supporters and long-term holders.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 px-6 max-w-6xl mx-auto">
            {tokenomics.map((item, i) => (
              <motion.div
                key={i}
                className="bg-gray-800 rounded-xl p-5 shadow-lg hover:scale-105 transition-transform"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: i * 0.2 }}
              >
                <h3 className="text-3xl font-extrabold text-yellow-500">{item.percent}</h3>
                <p className="text-xl text-gray-300">{item.label}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black text-center">
          <motion.h2
            className="text-4xl font-extrabold mb-3"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Be Part of the LIOSH Journey 🚀
          </motion.h2>
          <motion.p
            className="text-lg mb-5 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            Secure your place in the future of meme coins with real value and strong community support.
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
