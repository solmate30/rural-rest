const DEEPL_API_URL = "https://api-free.deepl.com/v2/translate";

// DeepL language code mapping (uppercase)
const LANG_CODES: Record<string, string> = {
    ko: "KO",
    en: "EN-US",
    ja: "JA",
    zh: "ZH-HANS",
    fr: "FR",
    de: "DE",
    es: "ES",
};

/**
 * Translates text to the target language using DeepL Free API.
 * On failure, returns the original text with success: false (Rule 4).
 */
export async function translateText(
    text: string,
    targetLang: string,
): Promise<{ translated: string; success: boolean }> {
    if (!process.env.DEEPL_API_KEY) {
        console.error("[translation] DEEPL_API_KEY 환경변수 미설정 — 번역 비활성화");
        return { translated: text, success: false };
    }

    const targetCode = LANG_CODES[targetLang] ?? targetLang.toUpperCase();

    try {
        const res = await fetch(DEEPL_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                text: [text],
                target_lang: targetCode,
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            console.error("[translation] DeepL error:", res.status, err);
            return { translated: text, success: false };
        }

        const data = await res.json() as { translations: { text: string }[] };
        const translated = data.translations[0]?.text?.trim();

        if (!translated) {
            return { translated: text, success: false };
        }

        return { translated, success: true };
    } catch (e) {
        console.error("[translation] DeepL request failed:", e);
        return { translated: text, success: false };
    }
}
