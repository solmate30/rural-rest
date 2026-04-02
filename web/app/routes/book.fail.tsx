import { Link, useLoaderData } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/book.fail";
import { Header, Footer, Button } from "~/components/ui-mockup";

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url);
    const message = url.searchParams.get("message") ?? "알 수 없는 오류가 발생했습니다.";
    const code = url.searchParams.get("code") ?? "";
    return { message, code };
}

export default function BookFail() {
    const { message, code } = useLoaderData<typeof loader>();
    const { t } = useTranslation("book");

    return (
        <div className="min-h-screen bg-background font-sans">
            <Header />
            <main className="container mx-auto py-12 px-4 max-w-2xl">
                <div className="bg-red-50 rounded-3xl p-8 md:p-12 text-center space-y-6">
                    <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-red-700">{t("payment.failTitle")}</h1>
                    <p className="text-red-600 text-sm">{message}</p>
                    {code && <p className="text-xs text-red-400 font-mono">{code}</p>}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link to="/"><Button variant="outline" className="w-full sm:w-auto px-8">{t("confirm.backHome")}</Button></Link>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
