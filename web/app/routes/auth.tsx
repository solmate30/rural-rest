import { Header, Button, Card, Footer } from "../components/ui-mockup";
import { usePrivy } from "@privy-io/react-auth";
import { getSession } from "../lib/auth.server";
import { redirect } from "react-router";
import type { Route } from "./+types/auth";
import { useTranslation } from "react-i18next";

export async function loader({ request }: Route.LoaderArgs) {
    const session = await getSession(request);
    if (session) {
        return redirect("/");
    }
    return null;
}

export default function Auth() {
    const { ready, login } = usePrivy();
    const { t } = useTranslation("auth");
    // 세션 생성은 root.tsx의 SessionCreator(useLogin onComplete)가 처리
    // 카카오는 root.tsx loginMethods에 "custom:kakao" 추가 → Privy 모달 내에 자동 표시

    return (
        <div className="min-h-screen bg-background font-sans">
            <Header />
            <main className="container mx-auto flex flex-col md:flex-row items-center justify-center py-12 md:py-20 px-4 gap-12">
                {/* Brand Story Section */}
                <div className="flex-1 max-w-lg space-y-6 hidden md:block">
                    <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.1]">
                        {t("tagline1")} <br />
                        <span className="text-primary font-bold">{t("tagline2")}</span>
                    </h2>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        {t("taglineDesc")}
                    </p>
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <span className="font-medium text-foreground/80">{t("feature")}</span>
                    </div>
                </div>

                <Card className="w-full max-w-md p-8 shadow-[0_10px_30px_rgba(0,0,0,0.04)] border-none bg-white">
                    <div className="text-center space-y-2 mb-8">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("loginTitle")}</h1>
                        <p className="text-muted-foreground">{t("loginDesc")}</p>
                    </div>

                    <Button
                        className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20 rounded-xl"
                        onClick={login}
                        disabled={!ready}
                    >
                        {t("submitLogin")}
                    </Button>
                </Card>
            </main>
            <Footer />
        </div>
    );
}
