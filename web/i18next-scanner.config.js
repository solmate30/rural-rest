module.exports = {
    input: [
        "app/**/*.{ts,tsx}",
        "!app/**/*.d.ts",
        "!app/types/**",
    ],
    output: ".",
    options: {
        lngs: ["ko", "en"],
        defaultLng: "ko",
        ns: [
            "common",
            "home",
            "book",
            "property",
            "invest",
            "auth",
            "kyc",
            "governance",
            "admin",
            "operator",
        ],
        defaultNS: "common",
        // 미번역 키에 __MISSING__ 마킹 → 빈 문자열 대신 식별 용이
        defaultValue: (lng, ns, key) => {
            if (lng === "ko") return key; // 한국어는 키 자체가 번역값
            return "__MISSING__";
        },
        resource: {
            loadPath: "public/locales/{{lng}}/{{ns}}.json",
            savePath: "public/locales/{{lng}}/{{ns}}.json",
            jsonIndent: 2,
        },
        // t('home:hero.title') 형태 지원
        nsSeparator: ":",
        keySeparator: ".",
        interpolation: {
            prefix: "{{",
            suffix: "}}",
        },
    },
};
