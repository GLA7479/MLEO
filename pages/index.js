import Layout from "../components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useState } from "react";

export default function Home() {
  const [activeVideo, setActiveVideo] = useState(null);
  const [activeImage, setActiveImage] = useState(null);

  const images = [
    { src: "/images/shiba1.jpg", alt: "LEO Shiba 1" },
    { src: "/images/shiba2.jpg", alt: "LEO Shiba 2" },
    { src: "/images/shiba3.jpg", alt: "LEO Shiba 3" },
    { src: "/images/shiba4.jpg", alt: "LEO Shiba 4" },
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
        {/* Dynamic Background */}
        <div className="fixed inset-0 z-0">
          {/* Animated Background Image */}
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: "url('/images/shiba-bg.jpg')",
              animation: "backgroundMove 30s ease-in-out infinite"
            }}
          />
          
          {/* Animated Gradient Overlay */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-purple-900/50 via-blue-900/30 to-yellow-900/50"
            style={{
              animation: "gradientShift 25s ease-in-out infinite"
            }}
          />
          
          {/* Floating Particles */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(25)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-yellow-400/60 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -120, 0],
                  x: [0, Math.random() * 40 - 20, 0],
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0],
                }}
                transition={{
                  duration: Math.random() * 12 + 8,
                  repeat: Infinity,
                  delay: Math.random() * 10,
                }}
              />
            ))}
          </div>
          
          {/* Animated Geometric Shapes */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute top-20 left-10 w-40 h-40 border-2 border-yellow-400/40 rounded-full"
              animate={{
                rotate: 360,
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 30,
                repeat: Infinity,
                ease: "linear"
              }}
            />
            <motion.div
              className="absolute top-40 right-20 w-32 h-32 border-2 border-blue-400/40 rounded-lg"
              animate={{
                rotate: -360,
                scale: [1, 0.8, 1],
              }}
              transition={{
                duration: 25,
                repeat: Infinity,
                ease: "linear"
              }}
            />
            <motion.div
              className="absolute bottom-40 left-20 w-24 h-24 border-2 border-purple-400/40 rounded-full"
              animate={{
                rotate: 180,
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear"
              }}
            />
            <motion.div
              className="absolute top-60 right-1/3 w-16 h-16 border-2 border-green-400/40 rounded-lg"
              animate={{
                rotate: 90,
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          </div>
        </div>

        {/* Hero Section */}
        <section className="relative flex flex-col items-center text-center px-6 pt-0 pb-6 -mt-6 z-10">
          <motion.h1
            className="mb-6 drop-shadow-lg leading-tight flex flex-col items-center relative"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            style={{
              textShadow: "0 0 40px rgba(255, 255, 0, 0.8), 0 0 80px rgba(255, 165, 0, 0.6), 0 0 120px rgba(255, 69, 0, 0.4)"
            }}
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
            className="text-xl md:text-2xl text-gray-100 max-w-4xl mt-6 mb-8 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            style={{
              textShadow: "0 0 20px rgba(255, 255, 255, 0.3)"
            }}
          >
            Join the revolution of meme coins with real utility and real community.
            Be an early part of the MLEO movement!
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <motion.a
              href="/presale"
              className="bg-yellow-500 hover:bg-yellow-600 text-black py-4 px-8 rounded-full text-xl font-bold shadow-2xl transition-all duration-300 relative overflow-hidden"
              whileHover={{ 
                scale: 1.1,
                boxShadow: "0 0 40px rgba(255, 193, 7, 0.8)"
              }}
              whileTap={{ scale: 0.95 }}
              style={{
                background: "linear-gradient(45deg, #fbbf24, #f59e0b, #d97706, #b45309)",
                backgroundSize: "300% 300%",
                animation: "gradientShift 4s ease infinite"
              }}
            >
              <span className="relative z-10">🚀 Join Presale</span>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0"
                whileHover={{
                  opacity: 1,
                  x: ["-100%", "100%"]
                }}
                transition={{ duration: 0.8 }}
              />
            </motion.a>
            <motion.a
              href="/about"
              className="bg-transparent border-2 border-yellow-500 hover:bg-yellow-500 hover:text-black text-yellow-500 py-4 px-8 rounded-full text-xl font-bold transition-all duration-300 relative overflow-hidden"
              whileHover={{ 
                scale: 1.1,
                boxShadow: "0 0 30px rgba(255, 193, 7, 0.6)"
              }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="relative z-10">Learn More</span>
              <motion.div
                className="absolute inset-0 bg-yellow-500 opacity-0"
                whileHover={{
                  opacity: 1
                }}
                transition={{ duration: 0.3 }}
              />
            </motion.a>
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
        <section className="py-20 bg-gradient-to-r from-gray-900 to-black text-center">
          <motion.h2 
            className="text-5xl font-bold text-yellow-500 mb-8"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2 }}
            viewport={{ once: false }}
          >
            🐕 What is MLEO?
          </motion.h2>
          <motion.p 
            className="text-gray-100 text-xl mb-8 leading-relaxed max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.3 }}
            viewport={{ once: false }}
          >
            MLEO is a next-gen meme coin inspired by LEO, the real Shiba Inu.
            We combine fun, community, and real-world utility to create a token that's here to stay.
          </motion.p>

          <motion.div 
            className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-8 max-w-5xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.6 }}
            viewport={{ once: false }}
          >
            {images.map((img, i) => (
              <motion.div
                key={i}
                className="relative cursor-pointer overflow-hidden rounded-lg shadow-lg hover:shadow-yellow-400 hover:scale-105 transition-all duration-300"
                onClick={() => setActiveImage(img.src)}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.0, delay: i * 0.2 }}
                viewport={{ once: false }}
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-auto"
                />
              </motion.div>
            ))}
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
        <section className="py-20 bg-black text-center">
          <motion.h2 
            className="text-5xl font-bold text-yellow-500 mb-8"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2 }}
            viewport={{ once: false }}
          >
            📊 Tokenomics
          </motion.h2>
          <motion.p 
            className="text-gray-100 text-xl mb-12 max-w-4xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.3 }}
            viewport={{ once: false }}
          >
            A sustainable and fair token distribution designed to reward early supporters and long-term holders.
          </motion.p>
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-6 max-w-6xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.6 }}
            viewport={{ once: false }}
          >
            {tokenomics.map((item, i) => (
              <motion.div
                key={i}
                className="bg-gray-800 rounded-xl p-6 shadow-lg hover:scale-105 transition-all duration-300 border border-gray-700"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.0, delay: i * 0.2 }}
                viewport={{ once: false }}
              >
                <h3 className="text-4xl font-bold text-yellow-500 mb-3">
                  {item.percent}
                </h3>
                <p className="text-lg text-gray-200 font-medium">{item.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black text-center">
          <motion.h2 
            className="text-5xl font-bold mb-6"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2 }}
            viewport={{ once: false }}
          >
            Be Part of the MLEO Journey 🚀
          </motion.h2>
          <motion.p 
            className="text-xl mb-8 max-w-4xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.3 }}
            viewport={{ once: false }}
          >
            Secure your place in the future of meme coins with real value and strong community support.
          </motion.p>
          <motion.a
            href="/presale"
            className="bg-black text-yellow-500 px-12 py-4 rounded-full font-bold text-2xl shadow-lg hover:bg-gray-900 transition-all duration-300 inline-block hover:scale-105"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.6 }}
            viewport={{ once: false }}
          >
            🚀 Join Presale Now
          </motion.a>
        </section>
      </div>
    </Layout>
  );
}
