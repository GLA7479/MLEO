// lib/wagmi.js
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { bscTestnet } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  throw new Error(
    "WalletConnect projectId missing. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env.local (RainbowKit v2 requirement)."
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: "MLEO Full Site",
  projectId, // חובה
  chains: [bscTestnet],
  transports: {
    [bscTestnet.id]: http(process.env.NEXT_PUBLIC_BSC_TESTNET_RPC),
  },
  ssr: true,
});
