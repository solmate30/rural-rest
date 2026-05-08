import { useEffect, useState } from "react";
import { Blink, useBlink } from "@dialectlabs/blinks";
import { useActionSolanaWalletAdapter } from "@dialectlabs/blinks/hooks/solana";
import "@dialectlabs/blinks/index.css";
import { db } from "~/db/index.server";
import { listings, rwaTokens } from "~/db/schema";
import { eq, ne, and, isNotNull, desc } from "drizzle-orm";
import type { Route } from "./+types/blink.invest.$listingId";

const PUBLIC_HOST = "rural-rest.vercel.app";

type FeedItem = {
    listingId: string;
    nodeNumber: number;
    title: string;
    location: string;
    cover: string | null;
    actionUrl: string;
    tweetCopy: string;
    timestamp: string;
    views: string;
    replies: string;
    retweets: string;
    likes: string;
};

const TWEET_VARIANTS = [
    {
        copy: "Tokenized rural Korean homes — now investable in one click.\nEarn monthly rental dividends, vote on operations.\nSolana-powered RWA, brought to your timeline.",
        timestamp: "4:32 PM · May 5, 2026",
        views: "12.4K", replies: "342", retweets: "1.2K", likes: "5.8K",
    },
    {
        copy: "New listing live 🌾\nA 100-year hanok renovated into a stay you can co-own.\nFractional RWA — buy as little as 1 token.",
        timestamp: "1:08 PM · May 5, 2026",
        views: "8.7K", replies: "188", retweets: "843", likes: "3.1K",
    },
    {
        copy: "Why touch a Korean countryside listing? Because the dividends are paid in USDC, on-chain, every month.\nRural Rest = real yield from real homes.",
        timestamp: "10:14 AM · May 5, 2026",
        views: "5.2K", replies: "94", retweets: "402", likes: "1.9K",
    },
];

export async function loader({ params, request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const origin = `${url.protocol}//${url.host}`;

    const isNumeric = /^\d+$/.test(params.listingId);

    // 메인 매물
    const [primary] = await db
        .select({
            id: listings.id,
            nodeNumber: listings.nodeNumber,
            title: listings.title,
            location: listings.location,
            images: listings.images,
        })
        .from(listings)
        .innerJoin(rwaTokens, eq(rwaTokens.listingId, listings.id))
        .where(isNumeric ? eq(listings.nodeNumber, Number(params.listingId)) : eq(listings.id, params.listingId))
        .limit(1);

    // 다른 매물들 (토큰 발행된 것 중)
    const others = primary
        ? await db
              .select({
                  id: listings.id,
                  nodeNumber: listings.nodeNumber,
                  title: listings.title,
                  location: listings.location,
                  images: listings.images,
              })
              .from(listings)
              .innerJoin(rwaTokens, eq(rwaTokens.listingId, listings.id))
              .where(and(ne(listings.id, primary.id), isNotNull(listings.nodeNumber)))
              .orderBy(desc(listings.nodeNumber))
              .limit(2)
        : [];

    const ordered = primary ? [primary, ...others] : [];
    const feed: FeedItem[] = ordered.map((row, i) => {
        const imgs = (row.images ?? []) as string[];
        const v = TWEET_VARIANTS[i % TWEET_VARIANTS.length];
        return {
            listingId: row.id,
            nodeNumber: row.nodeNumber ?? 0,
            title: row.title,
            location: row.location,
            cover: imgs[0] ?? null,
            actionUrl: `${origin}/api/actions/invest/${row.nodeNumber ?? row.id}?lang=en`,
            tweetCopy: v.copy,
            timestamp: v.timestamp,
            views: v.views,
            replies: v.replies,
            retweets: v.retweets,
            likes: v.likes,
        };
    });

    return { feed, primaryCover: feed[0]?.cover ?? null, primaryTitle: feed[0]?.title ?? "Rural Rest" };
}

export function meta({ data }: Route.MetaArgs) {
    if (!data?.feed?.length) return [{ title: "Rural Rest — Invest" }];
    const title = `${data.primaryTitle} · Rural Rest`;
    const cover = data.primaryCover;
    return [
        { title },
        { property: "og:title", content: title },
        { property: "og:type", content: "website" },
        ...(cover ? [{ property: "og:image", content: cover }] : []),
        { name: "twitter:card", content: "summary_large_image" },
    ];
}

function VerifiedBadge() {
    return (
        <svg viewBox="0 0 22 22" className="w-[18px] h-[18px] inline-block ml-1 align-middle fill-[#1d9bf0]">
            <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/>
        </svg>
    );
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
`;

const ENGAGEMENT_ICONS = [
    { d: "M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 7.501 4.435 5.43 8.408l-1.511 2.872a.75.75 0 01-.662.4H7.5a.75.75 0 010-1.5h9.379l1.31-2.484C19.806 6.848 18.07 4 15.117 4H9.756C6.23 4 3.251 6.924 3.251 10v7.5c0 .414.336.75.75.75H16.5a.75.75 0 010 1.5H4.001a2.25 2.25 0 01-2.25-2.25V10z", color: "hover:text-[#1d9bf0]", key: "replies" },
    { d: "M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46L19.5 20.12l-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z", color: "hover:text-[#00ba7c]", key: "retweets" },
    { d: "M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z", color: "hover:text-[#f91880]", key: "likes" },
    { d: "M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z", color: "hover:text-[#1d9bf0]", key: "views" },
] as const;

function TweetPost({ item, mounted, isFirst }: { item: FeedItem; mounted: boolean; isFirst: boolean }) {
    return (
        <article className="px-3 pt-2.5 pb-1.5 border-b border-[#2f3336]">
            <div className="flex items-start justify-between">
                <div className="flex gap-2 items-center">
                    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-white">
                        <img src="/ruralrest-logo-icon.png" alt="Rural Rest" className="w-full h-full object-cover" />
                    </div>
                    <div className="leading-tight">
                        <div className="flex items-center text-[13px] font-bold">
                            Rural Rest
                            <svg viewBox="0 0 22 22" className="w-[14px] h-[14px] inline-block ml-0.5 align-middle fill-[#1d9bf0]">
                                <path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/>
                            </svg>
                        </div>
                        <div className="text-[12px] text-[#71767b]">@ruralrest_sol</div>
                    </div>
                </div>
                <button className="text-[#71767b] hover:bg-white/10 rounded-full w-7 h-7 flex items-center justify-center transition">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                </button>
            </div>

            <div className="mt-2 text-[14px] leading-[1.35] whitespace-pre-line">{item.tweetCopy}</div>

            <div className="mt-2">
                {mounted ? <BlinkCard actionUrl={item.actionUrl} /> : (
                    <div className="w-full aspect-[3/4] rounded-2xl bg-[#16181c] animate-pulse" />
                )}
            </div>

            <div className="mt-2 text-[#71767b] text-[12px]">
                <time>{item.timestamp}</time>
                <span className="mx-1">·</span>
                <span><span className="font-bold text-white">{item.views}</span> Views</span>
            </div>

            <div className="mt-1.5 flex justify-between text-[#71767b]">
                {ENGAGEMENT_ICONS.map((icon) => (
                    <button key={icon.key} className={`flex items-center gap-1 transition ${icon.color}`}>
                        <svg viewBox="0 0 24 24" className="w-[16px] h-[16px] fill-current"><path d={icon.d}/></svg>
                        <span className="text-[12px]">{(item as any)[icon.key]}</span>
                    </button>
                ))}
            </div>
        </article>
    );
}

export default function BlinkInvestPage({ loaderData }: Route.ComponentProps) {
    const { feed } = loaderData;
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    return (
        <div className="min-h-screen bg-black text-white" style={{ fontFamily: "TwitterChirp, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
            <style dangerouslySetInnerHTML={{ __html: HIDE_DISCLAIMER }} />

            <div className="max-w-[480px] mx-auto border-x border-[#2f3336] min-h-screen">
                <header className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-[#2f3336] px-3 py-2 flex items-center gap-4">
                    <button className="text-white hover:bg-white/10 rounded-full w-8 h-8 flex items-center justify-center transition">
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z"/></svg>
                    </button>
                    <h1 className="text-base font-bold">Rural Rest</h1>
                </header>

                {feed.map((item, i) => (
                    <TweetPost key={item.listingId} item={item} mounted={mounted} isFirst={i === 0} />
                ))}

                {feed.length === 0 && (
                    <div className="p-8 text-center text-[#71767b]">No active properties found</div>
                )}
            </div>
        </div>
    );
}
