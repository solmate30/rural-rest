/**
 * GET /actions.json — Solana Actions 레지스트리
 *
 * Blinks 클라이언트는 이 파일을 먼저 요청해 도메인이 Solana Actions를
 * 지원하는지 확인한다. 스펙에 따라 CORS 헤더가 반드시 포함되어야 한다.
 *
 * Spec: https://solana.com/developers/guides/advanced/actions#actionsspec
 */

const BLINKS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Content-Encoding, Accept-Encoding",
    "Content-Type": "application/json",
};

export async function loader() {
    return new Response(
        JSON.stringify({
            rules: [
                {
                    pathPattern: "/*",
                    apiPath: "/api/actions/*",
                },
                {
                    pathPattern: "/api/actions/**",
                    apiPath: "/api/actions/**",
                },
            ],
        }),
        { status: 200, headers: BLINKS_HEADERS }
    );
}
