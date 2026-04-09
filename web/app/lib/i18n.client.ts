import i18next from "i18next";
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

    i18next.use(initReactI18next);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await i18next.init({
        ...i18nConfig,
        lng: locale,
        initImmediate: false,
        resources: initialStore,
    } as any);

    return i18next;
}

export default i18next;
