import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteLoaderData,
} from "react-router";
import { I18nextProvider } from "react-i18next";
import i18next from "i18next";

import type { Route } from "./+types/root";
import "./app.css";
import { Toaster } from "./components/ui/toaster";
import { Header, Button, Card } from "./components/ui-mockup";
import { detectLocale } from "./lib/i18n.server";
import { initReactI18next } from "react-i18next";
import { i18nConfig } from "./lib/i18n";

// 번역 파일 정적 import (서버사이드 SSR용, 빌드 타임 번들링)
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

const allTranslations = {
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

// --- Loader ---

export async function loader({ request }: Route.LoaderArgs) {
  const locale = await detectLocale(request);
  const initialI18nStore = allTranslations;

  // 쿠키가 현재 감지된 언어와 다를 경우만 Set-Cookie
  const cookie = request.headers.get("cookie") ?? "";
  const currentCookie = cookie.match(/rr_lang=([^;]+)/)?.[1];
  const headers = new Headers();
  if (currentCookie !== locale) {
    headers.set(
      "Set-Cookie",
      `rr_lang=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`
    );
  }

  // React Router 7: data() 유틸리티로 헤더 설정 + 타입 추론 동시 처리
  return data({ locale, initialI18nStore }, { headers });
}

// --- Links ---

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200",
  },
];

// --- Layout (HTML shell) ---

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  const locale = data?.locale ?? "en";
  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// --- App ---

import { AiConcierge } from "./components/AiConcierge";
import RwaWalletProvider from "./components/RwaWalletProvider";
import { KycProvider } from "./components/KycProvider";
import { PrivyProvider, usePrivy, useLogin } from "@privy-io/react-auth";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { useEffect } from "react";

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string;

/**
 * SessionCreator — 로그인 완료(+지갑 생성 완료) 후 서버 세션을 생성한다.
 * useLogin의 onComplete는 createOnLogin 설정 시 인증 AND 지갑 생성이 모두 끝난 뒤 호출됨.
 * Header, auth 페이지 등 어디서 login()을 트리거해도 항상 이 콜백이 실행된다.
 */
function SessionCreator() {
    const { getAccessToken } = usePrivy();
    useLogin({
        onComplete: async ({ user }) => {
            try {
                const token = await getAccessToken();
                if (!token) return;

                const embedded = user.linkedAccounts?.find(
                    (a: any) => a.type === "wallet" && a.chainType === "solana" && a.walletClientType === "privy",
                ) as { address: string } | undefined;
                const walletAddress = embedded?.address ?? null;

                const res = await fetch("/api/auth/session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token, walletAddress }),
                });
                if (!res.ok) {
                    console.warn("[SessionCreator] 세션 생성 실패:", res.status);
                    return;
                }
                // /auth 페이지에서 로그인한 경우 홈으로 이동
                if (window.location.pathname === "/auth") {
                    window.location.href = "/";
                }
            } catch (e) {
                console.warn("[SessionCreator] 오류:", e);
            }
        },
    });
    return null;
}

export default function App() {
  const { locale, initialI18nStore } = useLoaderData<typeof loader>();

  // SSR 및 클라이언트 첫 렌더 전 동기 초기화
  if (!i18next.isInitialized) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    i18next.use(initReactI18next).init({
      ...i18nConfig,
      lng: locale,
      initImmediate: false,
      resources: initialI18nStore,
    } as any);
  } else {
    // 이미 초기화된 경우: 리소스 보충 + 언어 동기화
    const store = initialI18nStore as Record<string, Record<string, unknown>>;
    Object.entries(store).forEach(([lang, namespaces]) => {
      Object.entries(namespaces as Record<string, unknown>).forEach(([ns, data]) => {
        if (!i18next.hasResourceBundle(lang, ns)) {
          i18next.addResourceBundle(lang, ns, data);
        }
      });
    });
    if (i18next.language !== locale) {
      i18next.changeLanguage(locale);
    }
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "google", "custom:Kakao" as any],
        appearance: {
          theme: "#fcfaf7",
          accentColor: "#17cf54",
          logo: "/house.png", // TODO: replace with actual logo URL
          landingHeader: "Welcome to Rural Rest",
          loginMessage: "한국의 고요한 시골집, 특별한 경험을 시작하세요",
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
          ethereum: { createOnLogin: "off" },
        },
        solana: {
          rpcs: {
            "solana:devnet": {
              rpc: createSolanaRpc(import.meta.env.VITE_SOLANA_RPC || "https://api.devnet.solana.com") as any,
              rpcSubscriptions: createSolanaRpcSubscriptions(
                (import.meta.env.VITE_SOLANA_RPC || "https://api.devnet.solana.com").replace(/^http:\/\//, "ws://").replace(/^https:\/\//, "wss://"),
              ),
            },
          },
        },
      }}
    >
      <I18nextProvider i18n={i18next}>
        <KycProvider>
          <RwaWalletProvider>
            <SessionCreator />
            <Outlet />
            <Toaster />
            <AiConcierge />
          </RwaWalletProvider>
        </KycProvider>
      </I18nextProvider>
    </PrivyProvider>
  );
}

// --- ErrorBoundary ---
// I18nextProvider 외부이므로 번역 파일을 직접 참조

function getErrorMessages(
  status: number,
  locale: string,
  statusText?: string
): { message: string; details: string } {
  const t = locale === "ko" ? koCommon : enCommon;
  if (status === 404) return { message: t.error["404"], details: t.error["404Details"] };
  if (status === 403) return { message: t.error["403"], details: t.error["403Details"] };
  if (status === 500) return { message: t.error["500"], details: t.error["500Details"] };
  return {
    message: t.error.code.replace("{{code}}", String(status)),
    details: statusText || t.error.details,
  };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // 쿠키에서 locale 읽기 (Provider 없으므로 직접 파싱)
  const locale =
    typeof document !== "undefined"
      ? (document.cookie.match(/rr_lang=([^;]+)/)?.[1] ?? "en")
      : "en";
  const t = locale === "ko" ? koCommon : enCommon;

  let status = 500;
  let message = t.error.title;
  let details = t.error.details;
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    const msgs = getErrorMessages(status, locale, error.statusText);
    message = msgs.message;
    details = msgs.details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <KycProvider>
      <RwaWalletProvider>
        <div className="min-h-screen bg-background font-sans">
          <Header />
          <main className="container mx-auto flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12">
            <Card className="w-full max-w-md p-8 text-center space-y-6">
              <div className="space-y-2">
                <h1 className="text-6xl font-bold text-primary">{status}</h1>
                <h2 className="text-2xl font-bold text-foreground">{message}</h2>
                <p className="text-muted-foreground">{details}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="primary"
                  onClick={() => (window.location.href = "/")}
                >
                  {t.button.backHome}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.history.back()}
                >
                  {t.button.backPrev}
                </Button>
              </div>
              {stack && import.meta.env.DEV && (
                <div className="mt-8 text-left">
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      {t.error.devInfo}
                    </summary>
                    <pre className="mt-4 p-4 bg-muted rounded-md overflow-x-auto">
                      <code>{stack}</code>
                    </pre>
                  </details>
                </div>
              )}
            </Card>
          </main>
        </div>
      </RwaWalletProvider>
    </KycProvider>
  );
}
