import { Link, useLocation } from "react-router";
import { usePrivyPublicKey } from "~/lib/privy-wallet";

const NAV_ITEMS = [
    { label: "대시보드", to: "/admin" },
    { label: "정산 관리", to: "/admin/settlements" },
];

export function AdminNav() {
    const { pathname } = useLocation();
    const walletAddress = usePrivyPublicKey();

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
                {walletAddress ? (
                    <span className="text-xs text-stone-400 font-mono">
                        {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                    </span>
                ) : (
                    <span className="text-xs text-stone-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                        지갑 준비 중
                    </span>
                )}
            </div>
        </div>
    );
}
