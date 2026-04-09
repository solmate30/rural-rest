import { getSession } from "./auth.server";
import { LOCALE_COOKIE, DEFAULT_LOCALE, type SupportedLocale } from "./i18n";

/**
 * 언어 감지 우선순위:
 * 1. 로그인 유저의 preferredLang (DB)
 * 2. 쿠키 rr_lang
 * 3. Accept-Language 헤더
 * 4. 기본값 "en"
 */
export async function detectLocale(request: Request): Promise<SupportedLocale> {
    const session = await getSession(request);
    const pref = (session?.user as Record<string, unknown> | undefined)?.preferredLang as string | undefined;
    if (pref === "ko" || pref === "en") return pref;

    const cookie = request.headers.get("cookie") ?? "";
    const match = cookie.match(new RegExp(`${LOCALE_COOKIE}=([^;]+)`));
    const cookieLang = match?.[1];
    if (cookieLang === "ko" || cookieLang === "en") return cookieLang;

    // Accept-Language 헤더 파싱 (예: "ko-KR,ko;q=0.9,en;q=0.8")
    const acceptLang = request.headers.get("accept-language") ?? "";
    const preferred = acceptLang
        .split(",")
        .map((s) => s.trim().split(";")[0].split("-")[0].toLowerCase())
        .find((lang) => lang === "ko" || lang === "en");
    if (preferred === "ko" || preferred === "en") return preferred;

    return DEFAULT_LOCALE;
}
