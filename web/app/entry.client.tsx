import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { initClientI18n } from "~/lib/i18n.client";
import koCommon from "../public/locales/ko/common.json";
import enCommon from "../public/locales/en/common.json";
import koHome from "../public/locales/ko/home.json";
import enHome from "../public/locales/en/home.json";
import koAuth from "../public/locales/ko/auth.json";
import enAuth from "../public/locales/en/auth.json";
import koProperty from "../public/locales/ko/property.json";
import enProperty from "../public/locales/en/property.json";
import koBook from "../public/locales/ko/book.json";
import enBook from "../public/locales/en/book.json";
import koInvest from "../public/locales/ko/invest.json";
import enInvest from "../public/locales/en/invest.json";
import koKyc from "../public/locales/ko/kyc.json";
import enKyc from "../public/locales/en/kyc.json";
import koGovernance from "../public/locales/ko/governance.json";
import enGovernance from "../public/locales/en/governance.json";
import koOperator from "../public/locales/ko/operator.json";
import enOperator from "../public/locales/en/operator.json";
import koAdmin from "../public/locales/ko/admin.json";
import enAdmin from "../public/locales/en/admin.json";

const locale = (document.documentElement.lang || "en") as "ko" | "en";

const translations = {
    ko: {
        common: koCommon, home: koHome, auth: koAuth, property: koProperty,
        book: koBook, invest: koInvest, kyc: koKyc, governance: koGovernance,
        operator: koOperator, admin: koAdmin,
    },
    en: {
        common: enCommon, home: enHome, auth: enAuth, property: enProperty,
        book: enBook, invest: enInvest, kyc: enKyc, governance: enGovernance,
        operator: enOperator, admin: enAdmin,
    },
};

// i18next를 hydration 이전에 초기화 → 키("nav.findStay") 노출 방지
initClientI18n(locale, translations).then(() => {
    startTransition(() => {
        hydrateRoot(
            document,
            <StrictMode>
                <HydratedRouter />
            </StrictMode>
        );
    });
});
