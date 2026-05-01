/**
 * 번역 파일 중앙 관리 모듈
 * root.tsx(SSR)와 entry.client.tsx(hydration) 양쪽에서 import하는 단일 소스
 */

import koCommon from "../../public/locales/ko/common.json";
import enCommon from "../../public/locales/en/common.json";
import koHome from "../../public/locales/ko/home.json";
import enHome from "../../public/locales/en/home.json";
import koAuth from "../../public/locales/ko/auth.json";
import enAuth from "../../public/locales/en/auth.json";
import koProperty from "../../public/locales/ko/property.json";
import enProperty from "../../public/locales/en/property.json";
import koBook from "../../public/locales/ko/book.json";
import enBook from "../../public/locales/en/book.json";
import koInvest from "../../public/locales/ko/invest.json";
import enInvest from "../../public/locales/en/invest.json";
import koKyc from "../../public/locales/ko/kyc.json";
import enKyc from "../../public/locales/en/kyc.json";
import koGovernance from "../../public/locales/ko/governance.json";
import enGovernance from "../../public/locales/en/governance.json";
import koOperator from "../../public/locales/ko/operator.json";
import enOperator from "../../public/locales/en/operator.json";
import koAdmin from "../../public/locales/ko/admin.json";
import enAdmin from "../../public/locales/en/admin.json";
import koHost from "../../public/locales/ko/host.json";
import enHost from "../../public/locales/en/host.json";
import koMyBookings from "../../public/locales/ko/myBookings.json";
import enMyBookings from "../../public/locales/en/myBookings.json";
import koMyPage from "../../public/locales/ko/myPage.json";
import enMyPage from "../../public/locales/en/myPage.json";
import koConcierge from "../../public/locales/ko/concierge.json";
import enConcierge from "../../public/locales/en/concierge.json";

export const allTranslations = {
    ko: {
        common: koCommon,
        home: koHome,
        auth: koAuth,
        property: koProperty,
        book: koBook,
        invest: koInvest,
        kyc: koKyc,
        governance: koGovernance,
        operator: koOperator,
        admin: koAdmin,
        host: koHost,
        myBookings: koMyBookings,
        myPage: koMyPage,
        concierge: koConcierge,
    },
    en: {
        common: enCommon,
        home: enHome,
        auth: enAuth,
        property: enProperty,
        book: enBook,
        invest: enInvest,
        kyc: enKyc,
        governance: enGovernance,
        operator: enOperator,
        admin: enAdmin,
        host: enHost,
        myBookings: enMyBookings,
        myPage: enMyPage,
        concierge: enConcierge,
    },
} as const;

export type AllTranslations = typeof allTranslations;
