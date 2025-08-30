// pages/_app.js
import "../styles/globals.css"; // או "../globals.css" אם זה הנתיב אצלך
import "@rainbow-me/rainbowkit/styles.css";

import { WagmiConfig } from "wagmi";
import { bscTestnet } from "wagmi/chains";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { SettingsProvider } from "../components/SettingsContext";

const wagmiConfig = getDefaultConfig({
  appName: "MLEO Miners",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  chains: [bscTestnet],
  ssr: true,
});

function MyApp({ Component, pageProps }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact">
          <SettingsProvider>
            <Component {...pageProps} />
          </SettingsProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
}

export default MyApp;
