// lib/wagmi.js
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { bscTestnet } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "MLEO Full Site",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, // חובה ב-.env.local
  chains: [bscTestnet],
  transports: {
    [bscTestnet.id]: http(process.env.NEXT_PUBLIC_BSC_TESTNET_RPC), // אופציונלי
  },
  ssr: true,
});
