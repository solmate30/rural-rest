import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

import { PROGRAM_ID } from "~/lib/constants";
import { getProgram, derivePdas, parseAnchorError } from "~/lib/anchor-client";
import { Button } from "~/components/ui/button";

interface Props {
    rwaTokenId: string;
    listingId: string;
    tokenMint: string;
}

export function ActivateButton({ rwaTokenId, listingId, tokenMint }: Props) {
    const { connection } = useConnection();
    const wallet = useWallet();
    const { setVisible } = useWalletModal();
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    async function handleActivate() {
        if (!wallet.connected || !wallet.publicKey) {
            setVisible(true);
            return;
        }
        setStatus("loading");
        setErrorMsg("");
        try {
            const { PublicKey } = await import("@solana/web3.js");
            const { TOKEN_2022_PROGRAM_ID } = await import("@solana/spl-token");

            const program = await getProgram(connection, wallet);
            const { propertyToken } = await derivePdas(listingId);

            const sig = await program.methods
                .activateProperty(listingId)
                .accounts({
                    propertyToken,
                    authority: wallet.publicKey,
                    tokenMint: new PublicKey(tokenMint),
                    tokenProgram: TOKEN_2022_PROGRAM_ID,
                })
                .rpc();

            const res = await fetch("/api/rwa/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rwaTokenId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "DB 활성화 실패");

            setStatus("done");
            setTimeout(() => window.location.reload(), 1000);
        } catch (e: any) {
            setErrorMsg(parseAnchorError(e));
            setStatus("error");
        }
    }

    if (status === "done") {
        return (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#17cf54]/10 text-[#17cf54] font-bold text-sm border border-[#17cf54]/20">
                활성화 완료
            </span>
        );
    }

    return (
        <div className="space-y-2">
            <Button
                onClick={handleActivate}
                disabled={status === "loading"}
                variant="success"
                className="w-full py-3"
            >
                {status === "loading" ? "활성화 중..." : !wallet.connected ? "지갑 연결 후 활성화" : "운영 시작 (Active)"}
            </Button>
            {status === "error" && (
                <p className="text-sm text-red-500 text-center">{errorMsg}</p>
            )}
        </div>
    );
}
