import Layout from "../components/Layout";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { TOTAL_SUPPLY, TOKENOMICS_ITEMS } from "../data/tokenomics";

export default function About() {
  const highlights = [
    {
      title: "Mining Ecosystem",
      text: "MLEO is built around interactive mining systems that keep users engaged through progression, activity, and long-term participation.",
    },
    {
      title: "Arcade & Online",
      text: "Beyond the token itself, MLEO is connected to arcade gameplay, online experiences, and a broader digital environment designed to evolve over time.",
    },
    {
      title: "Community Growth",
      text: "The project is designed to grow through community participation, ecosystem rewards, new features, and future expansion under the MLEO brand.",
    },
  ];

  const roadmap = [
    {
      phase: "Phase 1",
      text: "Core brand, website foundation, token structure, and community building.",
    },
    {
      phase: "Phase 2",
      text: "Presale growth, ecosystem visibility, marketing expansion, and early momentum.",
    },
    {
      phase: "Phase 3",
      text: "Mining, arcade experiences, online features, and stronger reward mechanics.",
    },
    {
      phase: "Phase 4",
      text: "Community expansion, ecosystem depth, and future interactive brand experiences.",
    },
  ];

  const topTokenomics = TOKENOMICS_ITEMS.slice(0, 4);

  return (
    <Layout page="about">
      {/* Background Video */}
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
          {/* Hero / Brand Story */}
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
                LEO is the real Shiba Inu behind the MLEO brand — the personality, spirit, and
                identity that inspired the project from day one.
              </p>

              <p className="text-lg md:text-xl text-cyan-100">
                MLEO is more than a token concept. It is a growing digital ecosystem built around
                mining, arcade gameplay, online experiences, rewards, and long-term brand expansion
                powered by community energy.
              </p>
            </div>
          </div>

          {/* Mission Section */}
          <section className="mb-12 text-center">
            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              🌟 Our Mission & Vision
            </h2>

            <p className="text-lg md:text-xl text-cyan-100 max-w-3xl mx-auto mb-4">
              Our mission is to build a fun, active, and rewarding ecosystem where
              users can do more than just hold a token — they can mine, play, compete,
              and participate in a growing digital environment.
            </p>

            <p className="text-lg md:text-xl text-cyan-100 max-w-3xl mx-auto">
              Our vision is to grow MLEO into a broader ecosystem brand with strong community
              identity, interactive experiences, ongoing development, and future expansion beyond
              the core platform.
            </p>
          </section>

          {/* Why MLEO */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-blue-300 to-cyan-400 bg-clip-text text-transparent">
              🚀 Why MLEO?
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              {highlights.map((item, i) => (
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

          {/* Token Snapshot */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">
              📊 Token Snapshot
            </h2>

            <p className="text-lg md:text-xl text-cyan-100 max-w-3xl mx-auto text-center mb-3">
              MLEO uses a structured token model designed to support ecosystem growth, liquidity,
              development, staking, and gameplay rewards.
            </p>

            <p className="text-center text-yellow-300 text-lg font-bold mb-6">
              Total Supply: {TOTAL_SUPPLY.toLocaleString()} MLEO
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {topTokenomics.map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.05 }}
                  className="bg-gray-900/60 p-5 rounded-xl shadow-md"
                >
                  <h3 className="text-2xl font-extrabold text-yellow-300 mb-2">{item.value}%</h3>
                  <p className="text-cyan-100 font-semibold">{item.title}</p>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-6">
              <Link href="/tokenomics">
                <button className="bg-transparent border-2 border-yellow-400 text-yellow-300 px-6 py-3 rounded-xl text-base font-bold hover:bg-yellow-400 hover:text-black transition">
                  View Full Tokenomics
                </button>
              </Link>
            </div>
          </section>

          {/* Future Expansion */}
          <section className="mb-12 text-center">
            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              🚀 Future Expansion
            </h2>

            <p className="text-lg md:text-xl text-cyan-100 max-w-3xl mx-auto mb-4">
              MLEO begins with its core ecosystem of mining, gameplay, rewards, and community
              participation — but the broader brand is designed to
              keep growing over time.
            </p>

            <p className="text-lg md:text-xl text-cyan-100 max-w-3xl mx-auto mb-6">
              Future development may include additional interactive experiences, community-focused
              projects, and family-friendly digital concepts as part of the long-term ecosystem
              vision.
            </p>

            <a
              href="https://liosh-website.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 px-6 py-3 rounded-xl text-base md:text-lg font-bold text-black hover:scale-105 transition"
            >
              Preview Future Concept
            </a>
          </section>

          {/* Roadmap Section */}
          <section>
            <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              📅 Mini Roadmap
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center mb-8">
              {roadmap.map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.05 }}
                  className="p-6 bg-gray-900/60 rounded-xl shadow-md"
                >
                  <h3 className="text-xl font-bold text-yellow-300 mb-2">{item.phase}</h3>
                  <p className="text-cyan-100">{item.text}</p>
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
