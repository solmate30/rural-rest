/**
 * rate-limit.server.ts
 *
 * 인메모리 rate limiter (단일 인스턴스 서버 환경용).
 * 외부 Redis 없이 동작하며, 서버 재시작 시 카운터가 초기화됩니다.
 *
 * 사용법:
 *   const result = checkRateLimit(`concierge:${userId}`, 10, 60_000);
 *   if (!result.allowed) return Response.json({ error: "요청이 너무 많습니다" }, { status: 429 });
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// 만료된 엔트리 주기적 정리 (메모리 누수 방지)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        if (entry.resetAt < now) store.delete(key);
    }
}, 60_000);

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number; // unix ms
}

/**
 * @param key      식별자 (예: `concierge:userId`, `nonce:ip`)
 * @param limit    windowMs 내 허용 최대 요청 수
 * @param windowMs 윈도우 크기 (밀리초)
 */
export function checkRateLimit(
    key: string,
    limit: number,
    windowMs: number,
): RateLimitResult {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    if (entry.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/** 429 응답 헬퍼 */
export function rateLimitResponse(resetAt: number): Response {
    const retryAfterSecs = Math.ceil((resetAt - Date.now()) / 1000);
    return Response.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        {
            status: 429,
            headers: {
                "Retry-After": String(retryAfterSecs),
                "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
            },
        },
    );
}

/** 요청에서 클라이언트 IP를 추출 (Cloudflare / 일반 헤더 순서로 확인) */
export function getClientIp(request: Request): string {
    return (
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        "unknown"
    );
}
