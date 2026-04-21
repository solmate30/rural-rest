/**
 * 영문 데모용 테스트 매물 시드 스크립트
 * 기존 레코드가 있으면 덮어씀 (onConflictDoUpdate)
 * 실행: cd web && npx tsx scripts/seed-test-listing-en.ts
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";
process.env.TURSO_AUTH_TOKEN = "";

import { randomUUID } from "crypto";

const LISTINGS = [
    {
        id: "3000",
        title: "Hwango Heritage House",
        description: "A 1960s hanok reimagined with modern comfort. Just an 8-minute walk from Hwangridangil street, with a courtyard perfect for afternoon tea and traditional snacks.",
        location: "Hwango-dong, Gyeongju, North Gyeongsang",
        region: "경상",
        pricePerNight: 70_000,
        valuationKrw: 150_000_000,
        maxGuests: 4,
        lat: 35.8320,
        lng: 129.2150,
        amenities: ["Wi-Fi", "Air Conditioning", "Ondol Heating", "Private Bathroom", "Kitchenette", "Parking (1 car)"],
        images: ["/hwango.png"],
        renovationHistory: [
            { date: "2024.03", desc: "Roof tile replacement and waterproofing" },
            { date: "2024.06", desc: "Ondol heating system modernization" },
            { date: "2024.09", desc: "Interior remodel with retro-modern aesthetic" },
            { date: "2025.01", desc: "Courtyard landscaping and exterior lighting" },
        ],
    },
    {
        id: "3001",
        title: "Seonggon Traditional Manor",
        description: "A 100-year-old clan house lovingly restored. Includes a traditional tea ceremony and hanbok rental. A 5-minute walk to Cheomseongdae Observatory.",
        location: "Seonggon-dong, Gyeongju, North Gyeongsang",
        region: "경상",
        pricePerNight: 90_000,
        valuationKrw: 200_000_000,
        maxGuests: 4,
        lat: 35.8360,
        lng: 129.2270,
        amenities: ["Wi-Fi", "Air Conditioning", "Ondol Heating", "Shared Bathroom", "Parking (1 car)"],
        images: ["/seonggon.png"],
        renovationHistory: [
            { date: "2023.11", desc: "Structural safety inspection and reinforcement" },
            { date: "2024.02", desc: "Traditional hanok exterior restoration" },
            { date: "2024.05", desc: "Tea room and hanbok experience space created" },
            { date: "2024.10", desc: "Bathroom modernization and amenity upgrades" },
        ],
    },
    {
        id: "3002",
        title: "Silla Forest Hostel",
        description: "A budget-friendly dorm for backpackers and young travelers. Shared kitchen, campfire lounge, and free bicycle rental included.",
        location: "Dongcheon-dong, Gyeongju, North Gyeongsang",
        region: "경상",
        pricePerNight: 25_000,
        valuationKrw: 120_000_000,
        maxGuests: 4,
        lat: 35.8550,
        lng: 129.2100,
        amenities: ["Wi-Fi", "Air Conditioning", "Shared Shower", "Shared Kitchen", "Laundry", "Parking (3 cars)"],
        images: ["/dongcheon.png"],
        renovationHistory: [
            { date: "2024.04", desc: "Abandoned house demolished and dorm built" },
            { date: "2024.07", desc: "Shared kitchen and campfire lounge installed" },
            { date: "2024.11", desc: "Bicycle storage and laundry room added" },
        ],
    },
    {
        id: "3003",
        title: "Wolseong Farmhouse",
        description: "A renovated farmhouse for digital nomads and slow travelers. Includes a vegetable garden experience and a dedicated workcation desk.",
        location: "Geoncheon-eup, Gyeongju, North Gyeongsang",
        region: "경상",
        pricePerNight: 55_000,
        valuationKrw: 100_000_000,
        maxGuests: 4,
        lat: 35.9250,
        lng: 129.1980,
        amenities: ["Wi-Fi", "Air Conditioning", "Ondol Heating", "Private Bathroom", "Kitchen", "Work Desk", "Parking (2 cars)"],
        images: ["/geoncheon.png"],
        renovationHistory: [
            { date: "2024.01", desc: "Structural reinforcement and insulation work" },
            { date: "2024.05", desc: "Workcation workspace created" },
            { date: "2024.08", desc: "Vegetable garden experience area set up" },
            { date: "2025.02", desc: "Ondol heating and air conditioning installed" },
        ],
    },
    {
        id: "3004",
        title: "Angang Country Retreat",
        description: "A rural healing stay for families and seniors. Seasonal harvest experiences, a homemade countryside breakfast, and a backyard BBQ await you.",
        location: "Angang-eup, Gyeongju, North Gyeongsang",
        region: "경상",
        pricePerNight: 65_000,
        valuationKrw: 130_000_000,
        maxGuests: 6,
        lat: 35.9500,
        lng: 129.1850,
        amenities: ["Wi-Fi", "Air Conditioning", "Ondol Heating", "Private Bathroom", "Kitchen", "BBQ Grill", "Parking (3 cars)"],
        images: ["/angang.png"],
        renovationHistory: [
            { date: "2024.02", desc: "Farmhouse renovation commenced" },
            { date: "2024.06", desc: "Courtyard BBQ facility and landscaping" },
            { date: "2024.09", desc: "Guest room interior finishing and furnishing" },
            { date: "2025.01", desc: "Breakfast kitchen and harvest area completed" },
        ],
    },
];

async function main() {
    const { db } = await import("../app/db/index.server");
    const { listings, user } = await import("../app/db/schema");

    const allUsers = await db.select({ id: user.id, name: user.name, role: user.role }).from(user);
    if (allUsers.length === 0) {
        console.error("No users found. Please log in first.");
        process.exit(1);
    }

    const admin = allUsers.find(u => u.role === "admin") ?? allUsers[0];
    console.log(`hostId: ${admin.name} (${admin.id})\n`);

    for (const listing of LISTINGS) {
        await db.insert(listings).values({
            id: listing.id,
            hostId: admin.id,
            title: listing.title,
            description: listing.description,
            location: listing.location,
            region: listing.region,
            pricePerNight: listing.pricePerNight,
            valuationKrw: listing.valuationKrw,
            maxGuests: listing.maxGuests,
            lat: listing.lat,
            lng: listing.lng,
            amenities: listing.amenities,
            images: listing.images,
            renovationHistory: listing.renovationHistory,
        }).onConflictDoUpdate({
            target: listings.id,
            set: {
                title: listing.title,
                description: listing.description,
                location: listing.location,
                amenities: listing.amenities,
                renovationHistory: listing.renovationHistory,
            },
        });
        console.log(`  Updated: ${listing.title} (${listing.id})`);
    }

    console.log(`\n${LISTINGS.length} listings seeded in English.`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
