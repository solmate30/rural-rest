/**
 * i18next 전역 타입 선언
 *
 * CustomTypeOptions.resources 에 ko 번역 구조를 매핑하면:
 *  - t("admin.edit.save") 등 리터럴 키 → 자동완성 + 오타 컴파일 에러
 *  - 동적 키(서버 반환 에러 키 등)는 여전히 `as any` 또는 캐스트 필요
 *
 * 참조: https://www.i18next.com/overview/typescript
 */

import type { AllTranslations } from "~/lib/translations";

declare module "i18next" {
    interface CustomTypeOptions {
        defaultNS: "common";
        resources: AllTranslations["ko"];
    }
}
