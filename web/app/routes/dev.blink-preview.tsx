import { useEffect, useState } from "react";
import { Blink, useBlink } from "@dialectlabs/blinks";
import { useActionSolanaWalletAdapter } from "@dialectlabs/blinks/hooks/solana";
import "@dialectlabs/blinks/index.css";
import type { Route } from "./+types/dev.blink-preview";

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const actionUrl =
        url.searchParams.get("url") ??
        `${url.protocol}//${url.host}/api/actions/invest/3003`;
    return { actionUrl };
}

function BlinkCard({ actionUrl }: { actionUrl: string }) {
    const rpcUrl = import.meta.env.VITE_SOLANA_RPC ?? "http://127.0.0.1:8899";
    const { adapter } = useActionSolanaWalletAdapter(rpcUrl);
    const { blink, isLoading } = useBlink({ url: actionUrl });

    if (isLoading || !blink) {
        return (
            <div className="w-full aspect-[3/4] rounded-3xl bg-white/60 backdrop-blur animate-pulse flex items-center justify-center text-[#4a3b2c]/50">
                Loading blink...
            </div>
        );
    }

    return (
        <Blink
            blink={blink}
            adapter={adapter}
            securityLevel="all"
            websiteText="rural-rest.vercel.app"
            websiteUrl="https://rural-rest.vercel.app"
            stylePreset="custom"
        />
    );
}

const RURAL_REST_THEME = `
    /* 미등록 경고 박스 숨김 */
    .rr-blink [class*="disclaimer" i],
    .rr-blink [class*="Disclaimer" i],
    .rr-blink [class*="warning-banner" i] { display: none !important; }

    /* Rural Rest 브랜드 컬러 */
    .rr-blink .custom {
        --blink-bg-primary: #ffffff;
        --blink-bg-secondary: #f5f0e8;
        --blink-button: #17cf54;
        --blink-button-hover: #13b548;
        --blink-button-disabled: #e8e2d4;
        --blink-button-success: #17cf54;
        --blink-text-button: #ffffff;
        --blink-text-button-disabled: #a89b85;
        --blink-text-button-success: #ffffff;
        --blink-text-primary: #4a3b2c;
        --blink-text-secondary: #6b5a45;
        --blink-text-link: #17cf54;
        --blink-text-link-hover: #13b548;
        --blink-text-brand: #17cf54;
        --blink-text-input: #4a3b2c;
        --blink-text-input-placeholder: #a89b85;
        --blink-stroke-primary: #e8e2d4;
        --blink-stroke-secondary: #d4cab5;
        --blink-icon-primary: #4a3b2c;
        --blink-icon-primary-hover: #17cf54;
        --blink-input-bg: #ffffff;
        --blink-input-bg-selected: #f5f0e8;
        --blink-input-stroke: #e8e2d4;
        --blink-input-stroke-selected: #17cf54;
        --blink-input-stroke-hover: #d4cab5;
        --blink-shadow-container: 0 12px 40px -8px rgba(74, 59, 44, 0.18), 0 2px 8px rgba(74, 59, 44, 0.06);
        --blink-border-radius-rounded-button: 12px;
        --blink-border-radius-rounded-input: 12px;
        --blink-border-radius-rounded-lg: 16px;
        --blink-border-radius-rounded-xl: 24px;
        font-family: "Plus Jakarta Sans", sans-serif !important;
    }
`;

export default function BlinkPreview({ loaderData }: Route.ComponentProps) {
    const { actionUrl } = loaderData;
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center p-6 gap-8 relative overflow-hidden"
            style={{
                background: "radial-gradient(ellipse at top left, #f0e6d2 0%, #fcfaf7 35%, #e8f5ec 100%)",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
        >
            <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30 blur-3xl pointer-events-none"
                 style={{ background: "radial-gradient(circle, #17cf54 0%, transparent 70%)" }} />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
                 style={{ background: "radial-gradient(circle, #d4a373 0%, transparent 70%)" }} />

            <style dangerouslySetInnerHTML={{ __html: RURAL_REST_THEME }} />

            {/* Header */}
            <div className="relative z-10 text-center max-w-md">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur-sm border border-[#e8e2d4] mb-4 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-[#17cf54] animate-pulse" />
                    <span className="text-xs font-semibold text-[#4a3b2c] tracking-wider">SOLANA BLINKS</span>
                </div>
                <h1 className="text-4xl font-bold text-[#4a3b2c] mb-2 tracking-tight">
                    Invest in Rural Korea
                </h1>
                <p className="text-[#6b5a45] text-sm">
                    Tokenized rural homes — bookable & investable in one click
                </p>
            </div>

            {/* Blink card */}
            <div className="rr-blink relative z-10 w-full max-w-[420px]">
                {mounted ? <BlinkCard actionUrl={actionUrl} /> : null}
            </div>

            {/* Footer */}
            <p className="relative z-10 text-[#6b5a45]/60 text-xs">
                Share anywhere — Twitter, Discord, Telegram
            </p>
        </div>
    );
}
