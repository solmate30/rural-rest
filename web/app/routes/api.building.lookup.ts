/**
 * api.building.lookup.ts
 * 건축물 정보 조회 프록시 엔드포인트.
 *
 * 1) 건축HUB API (건축물대장): 건물명, 면적, 층수, 용도
 *    - /getBrTitleInfo (sigunguCd + bjdongCd 기반)
 * 2) vworld WFS API (개별주택가격): 단독주택 공시가격
 *    - getIndvdHousingPriceWFS (PNU 코드 기반)
 *    - PNU = bcode(10자리) + 토지구분(1) + 본번(4자리) + 부번(4자리)
 *    - bcode, jibunAddress는 Daum 우편번호 결과에서 추출
 *    - 공동주택(빌라·아파트)은 대상 아님
 *
 * 서버 전용 키: BUILDING_HUB_API_KEY, VWORLD_API_KEY
 */

import type { Route } from "./+types/api.building.lookup";
import { requireUser } from "~/lib/auth.server";

const API_BASE = "https://apis.data.go.kr/1613000/BldRgstHubService";

interface BrTitleRow {
    bldNm?: string;       // 건물명
    totArea?: string;     // 연면적 (m²)
    grndFlrCnt?: string;  // 지상 층수
    ugrndFlrCnt?: string; // 지하 층수
    useAprDay?: string;   // 사용승인일 (YYYYMMDD)
    mainPurpsCdNm?: string; // 주용도
}

// PNU 구성: bcode(10자리) + 토지구분(1) + 본번(4자리) + 부번(4자리)
// jibunAddress 예: "경상북도 경주시 황오동 100-5" → 본번=100, 부번=5
function buildPnu(bcode: string, jibunAddress: string): string | null {
    if (bcode.length !== 10) return null;
    // 지번 파싱: 주소 마지막 토큰에서 숫자 추출
    const tokens = jibunAddress.trim().split(/\s+/);
    const jibun = tokens[tokens.length - 1]; // 예: "100-5", "356", "100"
    const match = jibun.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) return null;
    const bon = parseInt(match[1], 10);
    const bu = match[2] ? parseInt(match[2], 10) : 0;
    return bcode + "1" + String(bon).padStart(4, "0") + String(bu).padStart(4, "0");
}

async function fetchIndvHousingPrice(bcode: string, jibunAddress: string, apiKey: string): Promise<number | null> {
    const pnu = buildPnu(bcode, jibunAddress);
    if (!pnu) return null;

    // output 슬래시 인코딩 방지를 위해 URLSearchParams 대신 수동 조합
    // stdrYear 미지정 시 최신 연도 자동 조회
    const url = `https://api.vworld.kr/ned/wfs/getIndvdHousingPriceWFS?key=${apiKey}&pnu=${pnu}&output=application/json`;
    const res = await fetch(url, {
        headers: { Referer: "https://rural-rest.vercel.app" },
    });
    const text = await res.text();
    if (!res.ok) return null;

    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        return null;
    }
    // GeoJSON FeatureCollection 형식
    const features = (json as { features?: unknown[] })?.features;
    if (!Array.isArray(features) || features.length === 0) return null;

    // 가장 최신 연도 데이터 사용 (stdrYear 기준 내림차순)
    type VworldFeature = { properties: { stdr_year?: string; house_pc?: string | number } };
    const sorted = (features as VworldFeature[]).sort((a, b) =>
        (b.properties?.stdr_year ?? "0").localeCompare(a.properties?.stdr_year ?? "0")
    );
    const price = sorted[0]?.properties?.house_pc;
    return price ? parseInt(String(price).replace(/[^0-9]/g, ""), 10) || null : null;
}

async function fetchBuildingTitle(sigunguCd: string, bjdongCd: string, apiKey: string): Promise<BrTitleRow | null> {
    const params = new URLSearchParams({
        serviceKey: apiKey,
        sigunguCd,
        bjdongCd,
        bun: "",
        ji: "",
        startDate: "",
        endDate: "",
        numOfRows: "1",
        pageNo: "1",
        _type: "json",
    });

    const res = await fetch(`${API_BASE}/getBrTitleInfo?${params}`);
    if (!res.ok) return null;

    const json = await res.json();
    const items = json?.response?.body?.items?.item;
    if (!items) return null;

    return Array.isArray(items) ? items[0] : items;
}

export async function action({ request }: Route.ActionArgs) {
    // admin만 호출 가능
    await requireUser(request, ["admin"]);

    const apiKey = process.env.BUILDING_HUB_API_KEY;
    if (!apiKey) {
        return Response.json(
            { error: "건축물대장 API 키가 설정되지 않았습니다 (BUILDING_HUB_API_KEY)" },
            { status: 503 }
        );
    }

    let sigunguCd: string;
    let bjdongCd: string;
    let bcode: string;
    let jibunAddress: string;
    try {
        const body = await request.json();
        sigunguCd = (body.sigunguCd ?? "").trim();
        bjdongCd = (body.bjdongCd ?? "").trim();
        bcode = (body.bcode ?? "").trim();
        jibunAddress = (body.jibunAddress ?? "").trim();
    } catch {
        return Response.json({ error: "요청 형식이 올바르지 않습니다" }, { status: 400 });
    }

    if (!sigunguCd || !bjdongCd) {
        return Response.json({ error: "sigunguCd, bjdongCd 가 필요합니다" }, { status: 400 });
    }

    const vworldApiKey = process.env.VWORLD_API_KEY;

    // 두 API 병렬 호출 — 한쪽 실패해도 다른 쪽 결과는 반환
    const [titleRow, vworldPrice] = await Promise.all([
        fetchBuildingTitle(sigunguCd, bjdongCd, apiKey).catch(() => null),
        vworldApiKey && bcode && jibunAddress
            ? fetchIndvHousingPrice(bcode, jibunAddress, vworldApiKey).catch(() => null)
            : Promise.resolve(null),
    ]);

    if (!titleRow && vworldPrice === null) {
        return Response.json(
            { error: "해당 주소의 건축물 정보를 찾을 수 없습니다" },
            { status: 404 }
        );
    }

    // 사용승인일 → 건축연도 추출 (YYYYMMDD → YYYY)
    const builtYear = titleRow?.useAprDay
        ? parseInt(titleRow.useAprDay.slice(0, 4), 10) || null
        : null;

    const area = titleRow?.totArea
        ? parseFloat(titleRow.totArea) || null
        : null;

    return Response.json({
        buildingName: titleRow?.bldNm ?? null,
        area,
        builtYear,
        floors: titleRow?.grndFlrCnt ? parseInt(titleRow.grndFlrCnt, 10) || null : null,
        purpose: titleRow?.mainPurpsCdNm ?? null,
        valuationKrw: vworldPrice,
    });
}
