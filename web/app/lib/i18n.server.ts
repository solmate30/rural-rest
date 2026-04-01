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

    return DEFAULT_LOCALE;
}
