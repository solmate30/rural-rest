/**
 * listing-constants.ts
 * 숙소 등록/검색 폼에서 공통으로 쓰는 상수 및 헬퍼.
 * 서버(action, loader)와 클라이언트(UI) 양쪽에서 import 가능.
 * env 변수 없음 — Vite 모듈 시스템 제약 없음.
 */

export const REGION_OPTIONS = [
    { value: "경상", label: "경상도" },
    { value: "경기", label: "경기도" },
    { value: "강원", label: "강원도" },
    { value: "충청", label: "충청도" },
    { value: "전라", label: "전라도" },
    { value: "제주", label: "제주도" },
] as const;

export type RegionValue = (typeof REGION_OPTIONS)[number]["value"];

/**
 * 편의시설 목록.
 * 값은 listing-translations.ts의 amenityMapEn 키와 반드시 일치해야 함.
 */
export const AMENITY_OPTIONS = [
    "Wi-Fi",
    "에어컨",
    "온돌 난방",
    "개별 화장실",
    "공용 화장실",
    "공용 샤워실",
    "간이 주방",
    "공용 주방",
    "주방",
    "세탁기",
    "작업 책상",
    "바베큐 그릴",
    "주차",
] as const;

export type AmenityValue = (typeof AMENITY_OPTIONS)[number];

/**
 * 주소 문자열에서 region 값을 자동 추출한다.
 * Daum 우편번호 API가 반환한 주소에서 시/도 이름 기준으로 매핑.
 */
export function deriveRegion(address: string): RegionValue | null {
    if (address.includes("경상") || address.includes("경북") || address.includes("경남")) return "경상";
    if (address.includes("경기")) return "경기";
    if (address.includes("강원")) return "강원";
    if (address.includes("충청") || address.includes("충남") || address.includes("충북")) return "충청";
    if (address.includes("전라") || address.includes("전남") || address.includes("전북")) return "전라";
    if (address.includes("제주")) return "제주";
    return null;
}
