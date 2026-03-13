import { useState } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { motion } from "framer-motion";
import { FaUsers, FaLock, FaGift, FaChartLine, FaBullhorn } from "react-icons/fa";
import Layout from "../components/Layout";
import { TOTAL_SUPPLY, TOKENOMICS_ITEMS } from "../data/tokenomics";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Tokenomics() {
  const [activeIndex, setActiveIndex] = useState(null);

  const labels = TOKENOMICS_ITEMS.map((item) => {
    let icon = <FaLock />;

    if (item.title === "Presale") icon = <FaChartLine />;
    if (item.title === "Marketing") icon = <FaBullhorn />;
    if (item.title === "Team") icon = <FaUsers />;
    if (item.title === "Game Rewards") icon = <FaGift />;
    if (item.title === "Locks & Community") icon = <FaUsers />;

    return {
      ...item,
      icon,
    };
  });

  const data = {
    labels: labels.map((l) => l.title),
    datasets: [
      {
        data: labels.map((l) => l.value),
        backgroundColor: labels.map((l) => l.color),
        borderColor: "#000",
        borderWidth: 2,
      },
    ],
  };

  const options = {
    plugins: {
      legend: {
        labels: { color: "white", font: { size: 14, weight: "bold" } },
      },
    },
  };

  return (
    <Layout page="tokenomics">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src="/videos/tokenomics-bg.mp4" type="video/mp4" />
      </video>

      <motion.main
        className="relative min-h-screen flex flex-col items-center text-white overflow-hidden pt-6 md:pt-8 mt-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80 z-10"></div>

        <motion.h1 className="text-4xl md:text-5xl font-extrabold flex items-center justify-center gap-2 z-20 mb-0">
          <span>📊</span>
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent">
            Tokenomics
          </span>
        </motion.h1>

        <motion.p className="text-base md:text-lg text-gray-300 mt-0 mb-1 max-w-lg mx-auto z-20 text-center px-4">
          Transparent distribution of MLEO Token designed for growth, stability, liquidity,
          long-term development, and rewarding the community.
        </motion.p>

        <motion.p className="text-yellow-400 text-sm md:text-lg font-semibold mt-2 mb-3 z-20">
          Total Supply: {TOTAL_SUPPLY.toLocaleString()} MLEO
        </motion.p>

        <div className="flex flex-col md:flex-row items-center justify-center gap-8 px-3 z-20 mt-20">
          <div className="relative w-[320px] md:w-[500px] lg:w-[450px] mt-[-40px] md:mt-[-50px] md:translate-x-[-150px]">
            <Pie data={data} options={options} />
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-md w-full">
            {labels.map((item, i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.03 }}
                className="flex gap-2 p-2 rounded-lg shadow border border-gray-700 text-xs text-left bg-black/40"
                style={{ background: `linear-gradient(90deg, ${item.color}33, rgba(20,20,20,0.7))` }}
                onClick={() => setActiveIndex(i)}
              >
                <div className="text-base" style={{ color: item.color }}>
                  {item.icon}
                </div>
                <div>
                  <h3 className="text-xs font-bold" style={{ color: item.color }}>
                    {item.title} – {item.value}%
                  </h3>
                  <p className="text-gray-300 text-[10px] mt-1">{item.desc}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Modal */}
        {activeIndex !== null && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
            <div className="relative w-[90vw] max-w-[400px] aspect-square rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
              <div className="absolute inset-0 z-0">
                <img
                  src="/images/modal-bg.png"
                  alt="Background"
                  className="w-full h-full object-cover brightness-110 contrast-125"
                />
              </div>

              <div className="absolute inset-0 bg-black/30 z-10"></div>

              <div className="relative z-20 h-full flex flex-col justify-between p-4">
                <button
                  onClick={() => setActiveIndex(null)}
                  className="absolute top-2 right-4 text-white text-xl hover:text-red-400"
                >
                  ✖
                </button>

                <div className="mt-4">
                  <h2
                    className="text-2xl font-extrabold text-center"
                    style={{ color: labels[activeIndex].color }}
                  >
                    {labels[activeIndex].title} – {labels[activeIndex].value}%
                  </h2>
                </div>

                <div className="mt-auto">
                  <p
                    className="text-center px-3 py-2"
                    style={{
                      color: "#F87171",
                      fontWeight: "bold",
                      fontSize: "16px",
                      backgroundColor: "rgba(0, 0, 0, 0.5)",
                      borderRadius: "10px",
                      lineHeight: "1.6",
                    }}
                  >
                    {labels[activeIndex].details}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="max-w-4xl mx-auto mt-10 px-3 pb-16 z-20">
          <h2 className="text-2xl font-bold text-center mb-5 text-yellow-400">📄 Token Details</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-gray-700 text-sm md:text-base">
              <thead>
                <tr className="bg-gray-800 text-yellow-400 text-lg">
                  <th className="p-4 border border-gray-700">Parameter</th>
                  <th className="p-4 border border-gray-700">Value</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((item, i) => (
                  <tr key={i}>
                    <td className="p-4 border border-gray-700 font-bold" style={{ color: item.color }}>
                      {item.title}
                    </td>
                    <td className="p-4 border border-gray-700">
                      {item.value}% ({((TOTAL_SUPPLY * item.value) / 100).toLocaleString()} MLEO)
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="p-4 border border-gray-700 font-bold text-white">Total Supply</td>
                  <td className="p-4 border border-gray-700">{TOTAL_SUPPLY.toLocaleString()} MLEO</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </motion.main>
    </Layout>
  );
}
