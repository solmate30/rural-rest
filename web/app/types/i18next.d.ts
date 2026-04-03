import type enCommon from "../../public/locales/en/common.json";
import type enHome from "../../public/locales/en/home.json";
import type enAuth from "../../public/locales/en/auth.json";
import type enProperty from "../../public/locales/en/property.json";
import type enBook from "../../public/locales/en/book.json";
import type enInvest from "../../public/locales/en/invest.json";
import type enKyc from "../../public/locales/en/kyc.json";
import type enGovernance from "../../public/locales/en/governance.json";
import type enOperator from "../../public/locales/en/operator.json";
import type enAdmin from "../../public/locales/en/admin.json";
import type enHost from "../../public/locales/en/host.json";
import type enMyBookings from "../../public/locales/en/myBookings.json";
import type enOperator from "../../public/locales/en/operator.json";

declare module "i18next" {
    interface CustomTypeOptions {
        defaultNS: "common";
        resources: {
            common: typeof enCommon;
            home: typeof enHome;
            auth: typeof enAuth;
            property: typeof enProperty;
            book: typeof enBook;
            invest: typeof enInvest;
            kyc: typeof enKyc;
            governance: typeof enGovernance;
            operator: typeof enOperator;
            admin: typeof enAdmin;
            host: typeof enHost;
            myBookings: typeof enMyBookings;
            operator: typeof enOperator;
        };
    }
}
