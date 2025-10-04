import Layout from "../components/Layout";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export default function About() {
  return (
    <Layout page="about">
      {/* 🎥 וידאו ברקע */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src="/videos/about-bg.mp4" type="video/mp4" />
      </video>

      <motion.main
        className="relative min-h-screen flex flex-col items-center text-white p-0 m-0 overflow-hidden pt-0 mt-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="absolute inset-0 bg-black/50 z-10"></div>

        <div className="relative z-20 w-full max-w-6xl p-6 rounded-xl">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-12">
            <div className="flex-shrink-0">
              <Image
                src="/images/lio.png"
                alt="LEO the Shiba Inu"
                width={300}
                height={300}
                className="rounded-2xl border-2 border-cyan-300 shadow-lg"
              />
            </div>

            <div className="text-center md:text-left max-w-xl">
              <motion.h1
                className="text-4xl md:text-5xl font-extrabold mb-6 bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1 }}
              >
                Meet LEO – The Real Shiba Inu Behind MLEO
              </motion.h1>

              <p className="text-lg md:text-xl mb-4 text-cyan-100">
                LEO is our playful and loyal 3-year-old Shiba Inu – the heart and soul of MLEO Token.
                His charm and energy inspired the creation of a meme coin that combines fun, community power,
                and real crypto utility.
              </p>

              <p className="text-lg md:text-xl text-cyan-100">
                MLEO is the only meme coin truly backed by a real Shiba Inu mascot, making it unique,
                authentic, and full of personality!
              </p>
            </div>
          </div>

          {/* Mission Section */}
          <section className="mb-12 text-center">
            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              🌟 Our Mission & Vision
            </h2>
            <p className="text-lg md:text-xl text-cyan-100 max-w-3xl mx-auto mb-4">
              Our mission is to build a fun, strong, and rewarding crypto community inspired by LEO.
              We aim to combine entertainment, utility, and community-driven growth.
            </p>
            <p className="text-lg md:text-xl text-cyan-100 max-w-3xl mx-auto">
              Our vision is to make MLEO Token the next big meme coin with staking, partnerships,
              NFTs, and metaverse integration.
            </p>
          </section>

          {/* Why Choose Section */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-300 to-cyan-400 bg-clip-text text-transparent">
              🚀 Why Choose MLEO?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              {[
                { title: "Strong Community", text: "A loyal and growing community driven by the spirit of LEO." },
                { title: "Real Utility", text: "Staking rewards, presale benefits, and future NFT integrations." },
                { title: "Fun & Value", text: "A meme coin that is both fun and built for long-term growth." }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.05 }}
                  className="bg-gray-900/60 p-6 rounded-xl shadow-md"
                >
                  <h3 className="text-xl font-bold text-purple-300 mb-2">{item.title}</h3>
                  <p className="text-cyan-100">{item.text}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Roadmap Section */}
          <section>
            <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              📅 Mini Roadmap
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center mb-8">
              {[
                { phase: "Phase 1", text: "Token Launch, Website, Community Building" },
                { phase: "Phase 2", text: "Presale, Marketing Campaigns, Early Partnerships" },
                { phase: "Phase 3", text: "Exchange Listings, Staking Launch" },
                { phase: "Phase 4", text: "NFTs, Metaverse, Major Partnerships" }
              ].map((phase, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.05 }}
                  className="p-6 bg-gray-900/60 rounded-xl shadow-md"
                >
                  <h3 className="text-xl font-bold text-yellow-300 mb-2">{phase.phase}</h3>
                  <p className="text-cyan-100">{phase.text}</p>
                </motion.div>
              ))}
            </div>

            <div className="text-center">
              <Link href="/presale">
                <button className="bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 px-8 py-4 rounded-xl text-lg font-bold text-black hover:scale-105 transition">
                  🚀 Join Presale
                </button>
              </Link>
            </div>
          </section>
        </div>
      </motion.main>
    </Layout>
  );
}
