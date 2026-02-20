import { useMemo, useState, useEffect } from 'react';
import { ConnectionProvider, WalletProvider, WalletContext, useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

import '@solana/wallet-adapter-react-ui/styles.css';

function WalletDeduplicator({ children }: { children: React.ReactNode }) {
    const ctx = useWallet();
    const dedupedCtx = useMemo(() => {
        const seen = new Set<string>();
        const wallets = ctx.wallets.filter((w) => {
            const key = w.adapter.name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        return { ...ctx, wallets };
    }, [ctx]);

    return (
        <WalletContext.Provider value={dedupedCtx}>
            {children}
        </WalletContext.Provider>
    );
}

export default function RwaWalletProvider({ children }: { children: React.ReactNode }) {
    const [isClient, setIsClient] = useState(false);
    useEffect(() => setIsClient(true), []);

    const network = (import.meta.env.VITE_SOLANA_NETWORK as WalletAdapterNetwork)
        ?? WalletAdapterNetwork.Devnet;

    const endpoint = useMemo(() => clusterApiUrl(network), [network]);

    const wallets = useMemo(() => [new SolflareWalletAdapter()], []);

    if (!isClient) {
        return <>{children}</>;
    }

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletDeduplicator>
                    <WalletModalProvider>
                        {children}
                    </WalletModalProvider>
                </WalletDeduplicator>
            </WalletProvider>
        </ConnectionProvider>
    );
}
