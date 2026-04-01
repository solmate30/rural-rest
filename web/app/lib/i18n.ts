export const SUPPORTED_LOCALES = ["en", "ko"] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];
export const DEFAULT_LOCALE: SupportedLocale = "en";
export const LOCALE_COOKIE = "rr_lang";

export const i18nConfig = {
    supportedLngs: [...SUPPORTED_LOCALES],
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: "common",
    interpolation: { escapeValue: false },
};
