import { motion } from "framer-motion";
import { useState } from "react";
import Layout from "../components/Layout";


export default function Staking() {
  const [amount, setAmount] = useState("");

  return (
    <Layout page="staking">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src="/videos/staking-bg.mp4" type="video/mp4" />
      </video>
    <>
      <motion.main
        className="relative min-h-screen flex flex-col items-center justify-start p-4 pt-14 text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover -z-10"
          src="/videos/staking-bg.mp4"
        />
        <div className="absolute inset-0 bg-black/50 -z-10"></div>

        {/* ✅ כותרת עם גרדיאנט חדש */}
        <motion.h1
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-center flex items-center justify-center gap-2 drop-shadow-lg mb-2"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <span>🔒</span>
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent">
            LIOSH Staking
          </span>
        </motion.h1>

        <p className="text-center max-w-2xl mb-6 text-sm sm:text-base text-gray-200 px-2">
          Stake your LIOSH tokens to earn{" "}
          <span className="text-yellow-300 font-medium">passive rewards</span>!  
          The longer you stake, the more you earn. Rewards will be claimable after the presale ends.
        </p>

        {/* 🔹 שאר הקוד המקורי */}
        <div className="flex flex-col lg:flex-row gap-6 w-full max-w-5xl">
          {/* 📊 צד שמאל – סטטוס */}
          <div className="flex-1 space-y-4">
            <div className="bg-gray-900 rounded-xl p-4 sm:p-5 shadow-lg border border-yellow-500/20">
              <h2 className="text-base sm:text-lg font-semibold mb-2 text-yellow-300">Pool Status</h2>
              <div className="bg-gray-700 rounded-full h-3 w-full mb-2">
                <div
                  className="bg-gradient-to-r from-yellow-300 to-orange-400 h-3 rounded-full"
                  style={{ width: "25%" }}
                ></div>
              </div>
              <p className="text-xs sm:text-sm text-gray-300">25% of pool staked</p>
            </div>

            {[
              { label: "Your Staked Balance", value: "0 LIOSH" },
              { label: "Available to Stake", value: "0 LIOSH" },
              { label: "Total Staked", value: "1,250,000 LIOSH" },
              { label: "Current APR", value: "120% / Year" },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="bg-gray-900 p-3 rounded-lg flex justify-between items-center shadow-md border border-gray-700/50"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
              >
                <span className="text-xs sm:text-sm font-medium">{item.label}</span>
                <span className="text-yellow-300 font-semibold text-xs sm:text-sm">{item.value}</span>
              </motion.div>
            ))}

            <motion.div
              className="bg-gradient-to-r from-yellow-300 to-orange-400 text-black p-3 sm:p-4 rounded-lg shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h3 className="text-sm sm:text-base font-semibold mb-1">Estimated Rewards</h3>
              <p className="text-lg sm:text-xl font-bold">0 LIOSH / year</p>
              <p className="text-xs mt-1">Rewards update dynamically based on pool size.</p>
            </motion.div>
          </div>

          {/* 📥 צד ימין – טופס סטייקינג */}
          <motion.div
            className="flex-1 bg-gray-900 p-4 sm:p-5 rounded-lg shadow-xl border border-gray-700/40 backdrop-blur-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-lg sm:text-xl font-semibold mb-3 bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">
              Stake Your Tokens
            </h2>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount to stake"
              className="w-full px-3 py-2 text-black rounded-lg mb-3 text-sm focus:outline-none"
            />

            {[
              { text: "🚀 Stake Tokens", color: "bg-yellow-400 hover:bg-yellow-500", textColor: "text-black" },
              { text: "💰 Claim Rewards", color: "bg-green-500 hover:bg-green-600", textColor: "text-white" },
              { text: "🔓 Withdraw Tokens", color: "bg-red-500 hover:bg-red-600", textColor: "text-white" },
            ].map((btn, i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.05 }}
                className={`w-full mt-${i === 0 ? 0 : 3} ${btn.color} ${btn.textColor} font-medium py-2 sm:py-3 rounded-lg text-xs sm:text-sm transition`}
              >
                {btn.text}
              </motion.button>
            ))}
          </motion.div>
        </div>
      </motion.main>
    </>
    </Layout>
  );
}
