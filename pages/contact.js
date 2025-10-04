import Layout from "../components/Layout";
import { motion } from "framer-motion";
import { useState } from "react";

export default function Contact() {
  const contactButtons = [
    { text: "📧 Email", color: "bg-yellow-400 hover:bg-yellow-500" },
    { text: "📷 Instagram", color: "bg-pink-500 hover:bg-pink-600" },
    { text: "🌐 Facebook", color: "bg-blue-500 hover:bg-blue-600" },
    { text: "🐦 Twitter", color: "bg-sky-500 hover:bg-sky-600" },
    { text: "💬 Discord", color: "bg-indigo-500 hover:bg-indigo-600" },
    { text: "📲 Telegram", color: "bg-green-500 hover:bg-green-600" },
  ];

  const faqs = [
    { q: "What is MLEO Token?", a: "MLEO is a meme coin inspired by LEO the Shiba Inu, combining fun, community, and utility." },
    { q: "How can I buy MLEO?", a: "You can join the presale on our website and purchase MLEO using BNB, ETH, or SOL." },
    { q: "Is there a staking option?", a: "Yes! After the presale ends, you will be able to stake MLEO tokens and earn rewards." },
    { q: "What is the total supply?", a: "The total supply is 1 trillion MLEO tokens, with allocations for presale, staking rewards, and liquidity." },
    { q: "Where can I find the roadmap?", a: "The roadmap is available in the whitepaper and includes future exchange listings and utilities." },
    { q: "When will MLEO be listed on exchanges?", a: "After the presale and token distribution, MLEO aims to be listed on major decentralized and centralized exchanges." }
  ];

  const [activeAnswer, setActiveAnswer] = useState(null);

  const handleClose = () => setActiveAnswer(null);

  return (
    <Layout page="contact">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover -z-10"
      >
        <source src="/videos/contact-bg.mp4" type="video/mp4" />
      </video>

      <motion.main
        className="relative min-h-screen flex flex-col items-center text-white p-6 pt-[70px] overflow-hidden"
        onClick={handleClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80 -z-10"></div>

        <motion.h1
          className="text-5xl sm:text-6xl font-extrabold mb-4 flex items-center gap-3 text-center drop-shadow-lg"
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.8 }}
        >
          <span>📩</span>
          <span className="bg-gradient-to-r from-yellow-300 via-yellow-500 to-orange-500 bg-clip-text text-transparent">
            Contact Us
          </span>
        </motion.h1>

        <motion.p
          className="text-lg text-gray-300 max-w-2xl text-center mb-8"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          Have questions about MLEO Token? Reach out to us or check our FAQs below!
        </motion.p>

        <div className="flex flex-wrap justify-center gap-3 text-sm font-semibold z-20 mb-10">
          {contactButtons.map((btn, i) => (
            <motion.a
              key={i}
              href="https://www.instagram.com/leotheshiba21"
              target="_blank"
              rel="noopener noreferrer"
              className={`${btn.color} text-black px-4 py-2 rounded-md transition text-center`}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false, amount: 0.2 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              whileHover={{ scale: 1.05 }}
            >
              {btn.text}
            </motion.a>
          ))}
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
