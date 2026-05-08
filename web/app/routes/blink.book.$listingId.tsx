import { useEffect, useState } from "react";
import { Blink, useBlink } from "@dialectlabs/blinks";
import { useActionSolanaWalletAdapter } from "@dialectlabs/blinks/hooks/solana";
import "@dialectlabs/blinks/index.css";
import { db } from "~/db/index.server";
import { listings } from "~/db/schema";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/blink.book.$listingId";

const PUBLIC_HOST = "rural-rest.vercel.app";

export async function loader({ params, request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const actionUrl = `${url.protocol}//${url.host}/api/actions/book/${params.listingId}?lang=en`;

    const isNumeric = /^\d+$/.test(params.listingId);
    const rows = await db
        .select({
            title: listings.title,
            location: listings.location,
            images: listings.images,
            description: listings.description,
        })
        .from(listings)
        .where(isNumeric ? eq(listings.nodeNumber, Number(params.listingId)) : eq(listings.id, params.listingId))
        .limit(1);

    const listing = rows[0] ?? null;
    const images = (listing?.images ?? []) as string[];
    const cover = images[0] ?? null;

    return { actionUrl, listing, cover };
}

export function meta({ data }: Route.MetaArgs) {
    if (!data?.listing) return [{ title: "Rural Rest — Book" }];
    const { listing, cover } = data;
    const title = `Book ${listing.title} · Rural Rest`;
    const description = `Book a stay at ${listing.title} (${listing.location}) — pay in USDC on Solana.`;
    return [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        ...(cover ? [{ property: "og:image", content: cover }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(cover ? [{ name: "twitter:image", content: cover }] : []),
    ];
}

function BlinkCard({ actionUrl }: { actionUrl: string }) {
    const rpcUrl = import.meta.env.VITE_SOLANA_RPC ?? "http://127.0.0.1:8899";
    const { adapter } = useActionSolanaWalletAdapter(rpcUrl);
    const { blink, isLoading } = useBlink({ url: actionUrl });

    if (isLoading || !blink) {
        return (
            <div className="w-full aspect-[3/4] rounded-2xl bg-[#16181c] animate-pulse flex items-center justify-center text-[#71767b]">
                Loading...
            </div>
        );
    }

    return (
        <Blink
            blink={blink}
            adapter={adapter}
            securityLevel="all"
            websiteText={PUBLIC_HOST}
            websiteUrl={`https://${PUBLIC_HOST}`}
            stylePreset="x-dark"
        />
    );
}

const HIDE_DISCLAIMER = `
    [class*="disclaimer" i],
    [class*="Disclaimer" i],
    [class*="warning-banner" i] { display: none !important; }

    /* 날짜 피커 아이콘 복원 (SDK 기본은 opacity: 0) */
    .blink input[type=date]::-webkit-calendar-picker-indicator,
    .blink input[type=datetime-local]::-webkit-calendar-picker-indicator {
        opacity: 1 !important;
        position: static !important;
        left: auto !important;
        cursor: pointer;
        filter: invert(0.6);
    }
    .blink input[type=date],
    .blink input[type=datetime-local] {
        cursor: pointer;
    }
`;

export default function BlinkBookPage({ loaderData }: Route.ComponentProps) {
    const { actionUrl } = loaderData;
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-black">
            <style dangerouslySetInnerHTML={{ __html: HIDE_DISCLAIMER }} />
            <div className="w-full max-w-[420px]">
                {mounted ? <BlinkCard actionUrl={actionUrl} /> : null}
            </div>
        </div>
    );
}
