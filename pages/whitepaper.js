import Layout from "../components/Layout";
import { motion } from "framer-motion";
import { useState } from "react";

export default function Whitepaper() {
  const faqs = [
    { q: "What is included in the whitepaper?", a: "The whitepaper covers tokenomics, roadmap, utilities, and the project's vision." },
    { q: "How can I download the whitepaper?", a: "Simply click the Download PDF button to get the full whitepaper." },
    { q: "Does the whitepaper include staking details?", a: "Yes, the whitepaper provides information about staking rewards and lock-up options." },
    { q: "Is there a roadmap in the whitepaper?", a: "Yes, it includes milestones for presale, listings, and future developments." },
    { q: "Will the whitepaper be updated?", a: "The whitepaper will be updated regularly as the project progresses." },
    { q: "When will new features be added?", a: "Future features and utilities will be announced in updated versions of the whitepaper." }
  ];

  const [activeAnswer, setActiveAnswer] = useState(null);

  const handleClose = () => setActiveAnswer(null);

  return (
    <Layout page="whitepaper">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src="/videos/whitepaper-bg.mp4" type="video/mp4" />
      </video>

      <motion.main
        className="relative min-h-screen text-white flex flex-col items-center p-6 pt-[40px] overflow-hidden"
        onClick={handleClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="absolute inset-0 bg-black/70 z-0"></div>

        <div className="relative z-10 text-center max-w-xl mb-10">
          <h1 className="text-5xl font-extrabold mb-6 flex items-center justify-center gap-2">
            <span>📄</span>
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent">
              LIOSH Whitepaper
            </span>
          </h1>

          <p className="mb-6 text-lg">
            Discover everything about LIOSH Token – tokenomics, roadmap, and the vision behind the project.
          </p>

          <button className="bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold text-lg hover:bg-yellow-500 transition transform hover:scale-105">
            Download PDF
          </button>
        </div>

        <motion.h2
          className="text-4xl font-bold mb-6 text-yellow-400"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.7 }}
        >
          ❓ Frequently Asked Questions
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl w-full">
          {faqs.map((faq, i) => (
            <motion.button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setActiveAnswer(faq.a);
              }}
              className="px-4 py-3 bg-gradient-to-r from-gray-800/60 to-gray-700/60 backdrop-blur-sm border border-yellow-400/40 rounded-lg text-yellow-300 font-semibold text-base hover:scale-105 transition"
              style={{ boxShadow: "none" }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            >
              {faq.q}
            </motion.button>
          ))}
        </div>

        {activeAnswer && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={handleClose}>
            <motion.div
              className="relative p-6 rounded-lg w-[450px] h-[450px] max-w-full max-h-full text-center border border-yellow-400"
              style={{ backgroundImage: "url('/images/faq.png')", backgroundSize: "cover", backgroundPosition: "center", boxShadow: "none" }}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleClose}
                className="absolute top-2 right-2 bg-yellow-400 hover:bg-yellow-500 text-black px-2 py-1 text-xs rounded-md font-semibold"
              >
                Close
              </button>
              <div className="bg-black/0 p-4 rounded-lg flex flex-col justify-end items-center h-full">
                <p className="text-lg text-gray-200 mb-4 font-semibold">{activeAnswer}</p>
              </div>
            </motion.div>
          </div>
        )}
      </motion.main>
    </Layout>
  );
}
