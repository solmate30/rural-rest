import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { Toaster } from "./components/ui/toaster";
import { Header, Button, Card } from "./components/ui-mockup";

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
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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

import { AiConcierge } from "./components/AiConcierge";
export default function App() {
  return (
    <>
      <Outlet />
      <Toaster />
      <AiConcierge />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let status = 500;
  let message = "오류가 발생했습니다";
  let details = "예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    if (error.status === 404) {
      message = "404 - 페이지를 찾을 수 없습니다";
      details = "요청하신 페이지가 존재하지 않습니다. URL을 확인해주세요.";
    } else if (error.status === 403) {
      message = "접근 권한이 없습니다";
      details = "이 페이지에 접근할 권한이 없습니다.";
    } else if (error.status === 500) {
      message = "서버 오류";
      details = "서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    } else {
      message = `오류 ${error.status}`;
      details = error.statusText || details;
    }
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
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
              홈으로 돌아가기
            </Button>
            <Button
              variant="outline"
              onClick={() => window.history.back()}
            >
              이전 페이지로
            </Button>
          </div>
          {stack && import.meta.env.DEV && (
            <div className="mt-8 text-left">
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  개발자 정보 보기
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
  );
}
