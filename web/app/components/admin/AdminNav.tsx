import { Link, useLocation } from "react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

const NAV_ITEMS = [
    { label: "대시보드", to: "/admin" },
    { label: "정산 관리", to: "/admin/settlements" },
];

export function AdminNav() {
    const { pathname } = useLocation();
    const { connected, publicKey, disconnect } = useWallet();
    const { setVisible } = useWalletModal();

    return (
        <div className="flex items-center justify-between border-b border-stone-200 mb-8">
            <div className="flex gap-1">
                {NAV_ITEMS.map((item) => {
                    const active = pathname === item.to || (item.to !== "/admin" && pathname.startsWith(item.to));
                    return (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                active
                                    ? "border-[#17cf54] text-[#17cf54]"
                                    : "border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-200"
                            }`}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </div>
            <div className="pb-2">
                {connected && publicKey ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-400 font-mono">
                            {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                        </span>
                        <button
                            onClick={() => disconnect()}
                            className="text-xs px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors"
                        >
                            연결 해제
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setVisible(true)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[#17cf54]/10 hover:bg-[#17cf54]/20 text-[#17cf54] font-medium transition-colors border border-[#17cf54]/20"
                    >
                        지갑 연결
                    </button>
                )}
            </div>
        </div>
    );
}
