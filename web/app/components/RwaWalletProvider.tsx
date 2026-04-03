/**
 * Solana RPC 연결 컨텍스트 제공.
 * Privy 임베디드 지갑으로 전환 후 외부 지갑 어댑터(Phantom, Solflare)는 사용하지 않음.
 * useConnection()이 필요한 컴포넌트를 위해 ConnectionProvider만 유지.
 */
import { useMemo } from "react";
import { ConnectionProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";

export default function RwaWalletProvider({ children }: { children: React.ReactNode }) {
    const network = (import.meta.env.VITE_SOLANA_NETWORK as WalletAdapterNetwork)
        ?? WalletAdapterNetwork.Devnet;

    const endpoint = useMemo(
        () => import.meta.env.VITE_SOLANA_RPC ?? clusterApiUrl(network),
        [network],
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            {children}
        </ConnectionProvider>
    );
}
