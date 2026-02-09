import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "~/db/index.server";
import { listings, bookings } from "~/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Tool: Get Listing Details (Real DB)
 * hostId 등 민감 필드를 제외하고 반환
 */
export const getListingDetails = tool(
    async ({ id }) => {
        const result = await db.query.listings.findFirst({
            where: eq(listings.id, id),
        });
        if (!result) return "Listing not found.";
        const { hostId, ...safeData } = result;
        return JSON.stringify(safeData);
    },
    {
        name: "get_listing_details",
        description: "Retrieves detailed information about a specific stay listing from the database.",
        schema: z.object({
            id: z.string().describe("The UUID of the listing"),
        }),
    }
);

/**
 * Tool: Check Shuttle Availability (Real DB Logic + Simulation)
 */
export const checkShuttleStatus = tool(
    async ({ listingId, date }) => {
        const listing = await db.query.listings.findFirst({
            where: eq(listings.id, listingId),
        });

        if (!listing || !listing.transportSupport) {
            return "This stay does not support shuttle services.";
        }

        // Simulation: Randomize availability for the given date
        const isAvailable = Math.random() > 0.3;
        const waitTime = isAvailable ? "10-20 minutes" : "Currently fully booked";

        return `Shuttle status for ${listing.title} on ${date}: ${waitTime}.`;
    },
    {
        name: "check_shuttle_status",
        description: "Checks if a shuttle service is available for a listing on a specific date.",
        schema: z.object({
            listingId: z.string().describe("The UUID of the listing"),
            date: z.string().describe("The date to check (YYYY-MM-DD)"),
        }),
    }
);

/**
 * Tool: FAQ Lookup
 * 서비스 정책 FAQ 조회 (취소, 체크인/아웃, 이용수칙, 보증금)
 */
export const faqLookup = tool(
    async ({ topic }) => {
        const faqData: Record<string, string> = {
            cancellation: "체크인 7일 전까지 전액 환불, 3일 전까지 50% 환불, 이후 환불 불가입니다.",
            checkin: "체크인: 오후 3시, 체크아웃: 오전 11시입니다. Late check-out은 호스트에게 문의해주세요.",
            rules: "실내 금연, 반려동물은 사전 문의 필요, 22시 이후 소음 자제 부탁드립니다.",
            deposit: "보증금 5만원이 체크인 시 결제되며, 퇴실 후 24시간 이내 시설 점검 후 반환됩니다.",
        };
        return faqData[topic] || "해당 주제의 FAQ가 없습니다. 호스트에게 직접 문의해주세요.";
    },
    {
        name: "faq_lookup",
        description: "서비스 정책 FAQ 조회 (취소, 체크인/아웃, 이용수칙, 보증금)",
        schema: z.object({
            topic: z.enum(["cancellation", "checkin", "rules", "deposit"])
                .describe("FAQ 주제"),
        }),
    }
);

/**
 * Tool: Calculate Route Simulator (Simulated Kakao API)
 */
export const calculateRouteSimulator = tool(
    async ({ origin, destination }) => {
        // Simulated logic: Based on typical rural travel times in Korea
        const durationMin = Math.floor(Math.random() * 30) + 15;
        const taxiFare = (durationMin * 1200).toLocaleString();

        return `Simulated Route from [${origin}] to [${destination}]: Approximately ${durationMin} minutes by car. Estimated taxi fare: ₩${taxiFare}. (Traffic: Normal)`;
    },
    {
        name: "calculate_route_simulator",
        description: "Simulates route calculation between two points using Kakao Mobility logic.",
        schema: z.object({
            origin: z.string().describe("Departure point (e.g. Incheon Airport, Seoul Station)"),
            destination: z.string().describe("Arrival point (usually the stay name or address)"),
        }),
    }
);

/**
 * Tool: Search Tourism Simulator (Simulated KTO API)
 */
export const searchTourismSimulator = tool(
    async ({ location, category }) => {
        const mockData: Record<string, any[]> = {
            food: [
                { name: "Rural Sanchae Bibimbap", description: "Wild vegetables gathered from the local mountains." },
                { name: "Grandma's Hand-made Tofu", description: "Traditional slow-cooked tofu." }
            ],
            sight: [
                { name: "Evergreen Forest Trail", description: "A healing walk through 100-year-old pine trees." },
                { name: "Ancient Stone Pagoda", description: "A national treasure located 10 mins from the village centre." }
            ]
        };

        const results = mockData[category as keyof typeof mockData] || mockData.sight;
        return `Tourism info for [${location}] (${category}): ${JSON.stringify(results)}`;
    },
    {
        name: "search_tourism_simulator",
        description: "Simulates searching for local tourism information (food, sights) using KTO API data.",
        schema: z.object({
            location: z.string().describe("The name of the region or village"),
            category: z.enum(["food", "sight", "culture"]).describe("Type of information to search"),
        }),
    }
);

// 전문가별 도구 그룹
export const appLogicTools = [getListingDetails, checkShuttleStatus, faqLookup];
export const transportTools = [calculateRouteSimulator];
export const travelTools = [searchTourismSimulator];

// 전체 도구 (하위호환)
export const conciergeTools = [...appLogicTools, ...transportTools, ...travelTools];
