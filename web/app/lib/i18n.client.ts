import i18next, { type InitOptions } from "i18next";
import { initReactI18next } from "react-i18next";
import { i18nConfig } from "./i18n";

let initialized = false;

export async function initClientI18n(
    locale: string,
    initialStore: Record<string, Record<string, unknown>>
) {
    if (initialized) {
        if (i18next.language !== locale) {
            await i18next.changeLanguage(locale);
        }
        return i18next;
    }
    initialized = true;

    // Backend는 동적 import (i18next-http-backend는 브라우저 전용)
    const { default: Backend } = await import("i18next-http-backend");

    i18next.use(Backend);
    i18next.use(initReactI18next);
    await i18next.init({
        ...i18nConfig,
        lng: locale,
        initImmediate: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resources: initialStore as any,
        backend: { loadPath: "/locales/{{lng}}/{{ns}}.json" },
    } as InitOptions);

    return i18next;
}

export default i18next;
