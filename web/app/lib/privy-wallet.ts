/**
 * Privy v3 임베디드 Solana 지갑 → Anchor AnchorWallet 브릿지
 *
 * 핵심: @privy-io/react-auth 의 useWallets()는 Ethereum 지갑만 반환한다.
 * Solana 지갑은 @privy-io/react-auth/solana 의 useWallets()를 써야 한다.
 *
 * 반환 타입: ConnectedStandardSolanaWallet (Wallet Standard)
 * signTransaction({ transaction: Uint8Array, chain }) → { signedTransaction: Uint8Array }
 *
 * 회원이 구매할 때: Anchor가 wallet.signTransaction(tx)를 호출 →
 * Privy 내부 팝업/승인 화면이 뜸 → 사용자가 승인 → 서명된 tx 반환.
 * 외부 지갑(Phantom 등) 없이 웹에서 바로 처리된다.
 */
import { useMemo } from "react";
import { useWallets } from "@privy-io/react-auth/solana";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

// Vite 환경변수는 서버에서는 undefined일 수 있으므로 클라이언트에서만 사용
const SOLANA_CHAIN = `solana:${typeof import.meta !== "undefined" ? (import.meta.env.VITE_SOLANA_NETWORK ?? "devnet") : "devnet"}` as const;

export interface PrivyAnchorWallet {
    publicKey: PublicKey;
    connected: true;
    signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
    signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>;
}

/**
 * Privy 임베디드 Solana 지갑을 Anchor 호환 객체로 반환.
 * 지갑이 아직 준비 안 됐으면 null 반환.
 */
export function usePrivyAnchorWallet(): PrivyAnchorWallet | null {
    const { wallets, ready } = useWallets();

    return useMemo(() => {
        if (!ready || wallets.length === 0) return null;

        // Privy 임베디드 Solana 지갑 (첫 번째 것 사용)
        const embedded = wallets[0];
        if (!embedded) return null;

        const publicKey = new PublicKey(embedded.address);

        // Anchor → Wallet Standard 직렬화 브릿지
        async function signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
            let txBytes: Uint8Array;
            const isVersioned = (tx as any).version !== undefined;

            if (isVersioned) {
                txBytes = (tx as VersionedTransaction).serialize();
            } else {
                txBytes = (tx as Transaction).serialize({ requireAllSignatures: false });
            }

            const result = await embedded.signTransaction({
                transaction: txBytes,
                chain: SOLANA_CHAIN as any,
            });

            if (isVersioned) {
                return VersionedTransaction.deserialize(result.signedTransaction) as T;
            }
            return Transaction.from(result.signedTransaction) as T;
        }

        async function signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
            return Promise.all(txs.map((tx) => signTransaction(tx)));
        }

        return { publicKey, connected: true as const, signTransaction, signAllTransactions };
    }, [wallets, ready]);
}

/**
 * 임베디드 지갑 publicKey (base58 string). 아직 준비 안 됐으면 null.
 */
export function usePrivyPublicKey(): string | null {
    const { wallets, ready } = useWallets();
    if (!ready || wallets.length === 0) return null;
    return wallets[0]?.address ?? null;
}
