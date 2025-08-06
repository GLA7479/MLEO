import { useState } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { motion } from "framer-motion";
import { FaUsers, FaLock, FaGift, FaChartLine, FaBullhorn } from "react-icons/fa";
import Layout from "../components/Layout";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Tokenomics() {
  const [activeIndex, setActiveIndex] = useState(null);

  const labels = [
    {
      title: "Presale",
      value: 25,
      icon: <FaChartLine />,
      color: "#FACC15",
      desc: "25% of the total supply allocated to early investors during the presale phase.",
      details: "Tokens in the presale are distributed to early supporters before public launch. These are unlocked at launch to ensure wide distribution and liquidity injection."
    },
    {
      title: "Marketing",
      value: 15,
      icon: <FaBullhorn />,
      color: "#A78BFA",
      desc: "15% dedicated to marketing, partnerships, and community growth.",
      details: "Used for influencer partnerships, social media campaigns, community giveaways, and ongoing promotional efforts across platforms."
    },
    {
      title: "Liquidity",
      value: 15,
      icon: <FaLock />,
      color: "#22D3EE",
      desc: "15% of tokens allocated to ensure stable and secure trading.",
      details: "These tokens are paired with native coin (e.g., BNB) to create liquidity pools, ensuring buy/sell availability on DEXs."
    },
    {
      title: "Team",
      value: 10,
      icon: <FaUsers />,
      color: "#F472B6",
      desc: "10% allocated to the team with vesting for long-term commitment.",
      details: "Locked with a 12-month cliff and 24-month vesting to ensure long-term alignment with project success."
    },
    {
      title: "Game Rewards",
      value: 5,
      icon: <FaGift />,
      color: "#4ADE80",
      desc: "5% reserved as in-game rewards or community incentives.",
      details: "Distributed to users who participate in competitions or achieve high scores in official LIOSH games."
    },
    {
      title: "Staking",
      value: 5,
      icon: <FaLock />,
      color: "#FB923C",
      desc: "5% reserved for staking incentives to reward long-term holders.",
      details: "Available for users who stake LIOSH in eligible contracts, offering real yield and benefits."
    },
    {
      title: "Reserve",
      value: 10,
      icon: <FaLock />,
      color: "#60A5FA",
      desc: "10% held in reserve for future use cases or emergencies.",
      details: "Kept aside for unexpected costs, partnerships, upgrades, or strategic moves as the project evolves."
    },
    {
      title: "Locks & Community",
      value: 15,
      icon: <FaUsers />,
      color: "#F87171",
      desc: "15% allocated for token locks, competitions, and community incentives.",
      details: "Used for competitions, token locks, governance bonuses, or loyalty programs that reward engagement."
    },
  ];

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
      <video autoPlay muted loop playsInline preload="auto" className="absolute inset-0 w-full h-full object-cover z-0">
        <source src="/videos/tokenomics-bg.mp4" type="video/mp4" />
      </video>

<motion.main
  className="relative min-h-screen flex flex-col items-center text-white overflow-hidden pt-2 md:pt-0 mt-[-40px]"


        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        - <div className="absolute inset-0 bg-black/50 z-10"></div>
+ <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-black/80 z-10"></div>


<motion.h1 className="text-4xl md:text-5xl font-extrabold flex items-center justify-center gap-2 z-20 mb-0">

          <span>📊</span>
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent">
            Tokenomics
          </span>
        </motion.h1>

<motion.p className="text-base md:text-lg text-gray-300 mt-[-0px] mb-1 max-w-lg mx-auto z-20">

          Transparent distribution of LIOSH Token designed for growth, stability, and rewarding the community.
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

      {/* תמונת רקע */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/modal-bg.png"
          alt="Background"
          className="w-full h-full object-cover brightness-110 contrast-125"
        />
      </div>

      {/* שכבת כהות קלה */}
      <div className="absolute inset-0 bg-black/30 z-10"></div>

      {/* תוכן */}
      <div className="relative z-20 h-full flex flex-col justify-between p-4">
        {/* כפתור סגירה */}
        <button
          onClick={() => setActiveIndex(null)}
          className="absolute top-2 right-4 text-white text-xl hover:text-red-400"
        >
          ✖
        </button>

        {/* כותרת מוגדלת */}
        <div className="mt-4">
          <h2
            className="text-2xl font-extrabold text-center"
            style={{ color: "#22D3EE" }}
          >
            {labels[activeIndex].title} – {labels[activeIndex].value}%
          </h2>
        </div>

        {/* טקסט תחתון מוגדל */}
<div className="mt-auto">
  <p
    className="text-center px-3 py-2"
    style={{
      color: "#F87171", // לבן
      fontWeight: "bold",
      fontSize: "16px",
     backgroundColor: "rgba(0, 0, 0, 0.5)", // רקע כהה שקוף
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
                    <td className="p-4 border border-gray-700 font-bold" style={{ color: item.color }}>{item.title}</td>
                    <td className="p-4 border border-gray-700">
                      {item.value}% ({(1000000000000 * item.value) / 100} LIOSH)
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="p-4 border border-gray-700 font-bold text-white">Total Supply</td>
                  <td className="p-4 border border-gray-700">1,000,000,000,000 LIOSH</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </motion.main>
    </Layout>
  );
}
