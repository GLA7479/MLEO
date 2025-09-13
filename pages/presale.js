// pages/presale.js
import { useState, useEffect } from "react";
import Head from "next/head";
import { motion } from "framer-motion";
import Layout from "../components/Layout";

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { useConnectModal } from "@rainbow-me/rainbowkit";

const PRESALE_ADDRESS = process.env.NEXT_PUBLIC_PRESALE_ADDRESS;
const PRESALE_CHAIN_ID = Number(process.env.NEXT_PUBLIC_PRESALE_CHAIN_ID || 97); // BSC Testnet
const PRESALE_ABI = [
  { type: "function", name: "buy", stateMutability: "payable", inputs: [], outputs: [] }
];

export default function Presale() {
  // ----- existing state/values (kept as-is) -----
  const [amount, setAmount] = useState("");
  const price = 0.0105;
  const nextPrice = 0.011;
  const progress = 35.047976;
  const totalSupply = 100;

  const [timeLeft, setTimeLeft] = useState({
    days: 30,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 30);
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = targetDate.getTime() - now;
      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / (1000 * 60)) % 60),
          seconds: Math.floor((diff / 1000) % 60),
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ----- new web3 bits (BSC Testnet) -----
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // keep the same tokens preview UX
  const tokensToReceive = amount ? (amount / price).toFixed(2) : 0;

  async function onBuy() {
    if (!PRESALE_ADDRESS) {
      alert("Missing PRESALE address (env).");
      return;
    }
    const value = parseEther(String(amount || "0"));
    if (value <= 0n) {
      alert("Enter amount in BNB (e.g., 0.01).");
      return;
    }
    try {
      writeContract({
        address: PRESALE_ADDRESS,
        abi: PRESALE_ABI,
        functionName: "buy",
        chainId: PRESALE_CHAIN_ID,
        value,
      });
    } catch (e) {
      console.error(e);
      alert("Buy failed");
    }
  }

  return (
    <Layout page="presale">
      <Head>
        <title>LIOSH Presale</title>
      </Head>

      {/* 🎥 background video (kept) */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src="/videos/presale-bg.mp4" type="video/mp4" />
      </video>

      <motion.main
        className="relative min-h-screen flex flex-col items-center text-white p-4 pt-8 sm:pt-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="absolute inset-0 bg-black/50 z-10"></div>

        <motion.h1
          className="text-5xl font-extrabold mb-4 bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          BUY LIOSH
        </motion.h1>

        <motion.p
          className="text-2xl font-bold text-yellow-400 mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Presale starts in:
        </motion.p>

        <motion.p
          className="text-3xl font-bold mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
        </motion.p>

        <motion.p
          className="text-2xl font-bold text-green-400 mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          ${(progress * price * 1_000_000).toLocaleString()} RAISED
        </motion.p>

        <div className="bg-gray-700 h-4 rounded-full mb-2 w-full max-w-md overflow-hidden">
          <div
            className="h-4 bg-gradient-to-r from-purple-500 to-pink-500"
            style={{ width: `${(progress / totalSupply) * 100}%` }}
          ></div>
        </div>

        <p className="text-base mb-6">
          {progress.toLocaleString()}M / {totalSupply.toLocaleString()}M Sold
        </p>

        <p className="text-lg mb-6 text-gray-200">
          CURRENT PRICE = ${price} | NEXT PRICE = ${nextPrice}
        </p>

        <motion.div
          className="bg-black/50 backdrop-blur-md p-4 rounded-lg border border-gray-700 mb-4 w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex justify-between mb-2 text-lg">
            <span>BUY LIOSH</span>
            <span>${amount || 0}</span>
          </div>

          {/* amount input (kept) */}
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full p-2 bg-gray-800 rounded-md text-white mb-2 text-lg"
          />

          <p className="text-base mb-2">≈ {tokensToReceive} LIOSH</p>

          {/* selector kept visually; no logic change needed for BSC test */}
          <select className="w-full p-2 bg-gray-800 rounded-md text-white mb-4 text-lg" defaultValue="BNB">
            <option value="SOL">SOL</option>
            <option value="BNB">BNB</option>
            <option value="ETH">ETH</option>
          </select>

          {/* SAME button style/text; now wired to connect/buy */}
          <button
            className="bg-gradient-to-r from-blue-400 to-cyan-400 w-full py-3 rounded-md font-bold text-lg hover:scale-105 transition"
            onClick={() => {
              if (!isConnected) {
                // open RainbowKit modal if wallet not connected
                return openConnectModal?.();
              }
              onBuy();
            }}
            disabled={isPending || isMining}
          >
            CONNECT WALLET
          </button>
        </motion.div>

        <p className="text-pink-400 font-bold text-lg mt-4">
          PRESALE IS COMING SOON
        </p>
      </motion.main>
    </Layout>
  );
}
