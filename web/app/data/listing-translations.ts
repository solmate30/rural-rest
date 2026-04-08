/**
 * 숙소 영어 콘텐츠 정적 번역맵
 * DB 컬럼 추가 없이 locale 기반으로 오버라이드
 */
export const listingTranslationsEn: Record<string, {
    title: string;
    description: string;
    cityLabel: string;
}> = {
    "3000": {
        title: "Hwango Cheongsongjae",
        description: "A restored 1960s hanok with a retro-modern sensibility. Just 8 minutes on foot from Hwangnidan-gil, with a traditional courtyard perfect for afternoon tea.",
        cityLabel: "Near Gyeongju",
    },
    "3001": {
        title: "Sunggeon Chungjae Manor",
        description: "A century-old clan house lovingly restored. Traditional tea ceremony and hanbok rental included, just a 5-minute walk from Cheomseongdae Observatory.",
        cityLabel: "Near Gyeongju",
    },
    "3002": {
        title: "Dongcheon Silla Forest Hostel",
        description: "Budget-friendly dormitory for backpackers and young explorers. Shared kitchen, bonfire corner, and complimentary bicycle rental included.",
        cityLabel: "Near Gyeongju",
    },
    "3003": {
        title: "Geoncheon Wolseong Farm Stay",
        description: "A renovated farmhouse with a kitchen garden and dedicated workation desk. The perfect retreat for digital nomads seeking slow living.",
        cityLabel: "Near Gyeongju",
    },
    "3004": {
        title: "Angang Seokguljae Country House",
        description: "A rural healing escape for families and seniors. Seasonal harvest activities, wholesome country breakfast, and backyard barbecue await.",
        cityLabel: "Near Gyeongju",
    },
    "ui-test-001": {
        title: "UI Test Property",
        description: "Test property for UI development and governance verification.",
        cityLabel: "Near Gangneung",
    },
};

/** 편의시설 한→영 번역맵 */
const amenityMapEn: Record<string, string> = {
    "Wi-Fi": "Wi-Fi",
    "wifi": "Wi-Fi",
    "에어컨": "Air Conditioning",
    "온돌 난방": "Ondol Floor Heating",
    "개별 화장실": "Private Bathroom",
    "공용 화장실": "Shared Bathroom",
    "공용 샤워실": "Shared Shower",
    "간이 주방": "Kitchenette",
    "공용 주방": "Shared Kitchen",
    "주방": "Full Kitchen",
    "세탁기": "Washing Machine",
    "작업 책상": "Work Desk",
    "바베큐 그릴": "BBQ Grill",
    "주차": "Parking",
    "주차 1대": "Parking (1 car)",
    "주차 2대": "Parking (2 cars)",
    "주차 3대": "Parking (3 cars)",
    "parking": "Parking",
};

export function translateAmenities(amenities: string[], locale: string): string[] {
    if (locale !== "en") return amenities;
    return amenities.map((a) => amenityMapEn[a] ?? a);
}

export function applyListingLocale<T extends {
    id: string;
    title: string;
    description: string;
    cityLabel?: string;
}>(listing: T, locale: string): T {
    if (locale !== "en") return listing;
    const en = listingTranslationsEn[listing.id];
    if (!en) return listing;
    return {
        ...listing,
        title: en.title,
        description: en.description,
        ...(listing.cityLabel !== undefined ? { cityLabel: en.cityLabel } : {}),
    };
}
