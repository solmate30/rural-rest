import { Buffer } from "buffer";
globalThis.Buffer = Buffer;

import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { initClientI18n } from "~/lib/i18n.client";
import { allTranslations } from "~/lib/translations";

const locale = (document.documentElement.lang || "en") as "ko" | "en";

// i18next를 hydration 이전에 초기화 → 키("nav.findStay") 노출 방지
initClientI18n(locale, allTranslations).then(() => {
    startTransition(() => {
        hydrateRoot(
            document,
            <StrictMode>
                <HydratedRouter />
            </StrictMode>
        );
    });
});
