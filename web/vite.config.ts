import { reactRouter } from "@react-router/dev/vite";

import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  ssr: {
    noExternal: ["better-auth", "tailwind-merge", "clsx", "@privy-io/react-auth", "@privy-io/js-sdk-core"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Privy + Solana — 상호 의존성으로 단일 Web3 청크
          if (
            id.includes("@privy-io") ||
            id.includes("@solana") ||
            id.includes("@coral-xyz") ||
            id.includes("wagmi") ||
            id.includes("viem") ||
            id.includes("bn.js")
          ) return "vendor-web3";
          // React 코어 — 별도 캐시 청크
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) return "vendor-react";
        },
      },
    },
  },
});
