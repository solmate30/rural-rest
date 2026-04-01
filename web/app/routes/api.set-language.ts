import type { Route } from "./+types/api.set-language";
import { getSession } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { user as userTable } from "~/db/schema";
import { eq } from "drizzle-orm";
import { SUPPORTED_LOCALES, LOCALE_COOKIE } from "~/lib/i18n";

export async function action({ request }: Route.ActionArgs) {
    if (request.method !== "POST") {
        return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    let locale: string;
    try {
        const body = await request.json();
        locale = body.locale;
    } catch {
        return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }

    if (!SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
        return Response.json({ ok: false, error: "Unsupported locale" }, { status: 400 });
    }

    // 로그인 사용자라면 DB에 저장 (다기기 동기화)
    const session = await getSession(request);
    if (session?.user?.id) {
        await db
            .update(userTable)
            .set({ preferredLang: locale })
            .where(eq(userTable.id, session.user.id));
    }

    return Response.json(
        { ok: true, locale },
        {
            headers: {
                "Set-Cookie": `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`,
            },
        }
    );
}
