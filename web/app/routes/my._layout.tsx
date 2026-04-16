import { NavLink, Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import { Header, Footer } from "~/components/ui-mockup";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/my._layout";
import { cn } from "~/lib/utils";

export async function loader({ request }: Route.LoaderArgs) {
    await requireUser(request);
    return null;
}

const NAV_ITEMS = [
    { to: "/my/bookings",  labelKey: "nav.bookings",  icon: "calendar_today" },
    { to: "/my/payments",  labelKey: "nav.payments",  icon: "receipt_long"   },
    { to: "/my/portfolio", labelKey: "nav.portfolio", icon: "trending_up"    },
] as const;

export default function MyLayout() {
    const { t } = useTranslation("myPage");

    return (
        <div className="min-h-screen bg-[#fcfaf7] font-sans">
            <Header />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
                {/* 모바일: 상단 탭 */}
                <nav className="md:hidden flex gap-1 mb-6 bg-white rounded-2xl p-1 border border-stone-100 shadow-sm">
                    {NAV_ITEMS.map(({ to, labelKey, icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end
                            className={({ isActive }) =>
                                cn(
                                    "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-[#17cf54] text-white shadow-sm"
                                        : "text-stone-500 hover:text-[#4a3b2c] hover:bg-stone-50"
                                )
                            }
                        >
                            <span className="material-symbols-outlined text-[16px]">{icon}</span>
                            <span className="hidden sm:inline">{t(labelKey)}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="flex gap-8">
                    {/* 데스크탑: 사이드바 */}
                    <aside className="hidden md:block w-48 shrink-0">
                        <div className="sticky top-8">
                            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 px-3">
                                {t("sidebarTitle")}
                            </p>
                            <nav className="space-y-0.5">
                                {NAV_ITEMS.map(({ to, labelKey, icon }) => (
                                    <NavLink
                                        key={to}
                                        to={to}
                                        end
                                        className={({ isActive }) =>
                                            cn(
                                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                                                isActive
                                                    ? "bg-[#17cf54]/10 text-[#17cf54]"
                                                    : "text-stone-500 hover:text-[#4a3b2c] hover:bg-stone-100"
                                            )
                                        }
                                    >
                                        {({ isActive }) => (
                                            <>
                                                <span className={cn(
                                                    "material-symbols-outlined text-[18px]",
                                                    isActive ? "text-[#17cf54]" : "text-stone-400"
                                                )}>
                                                    {icon}
                                                </span>
                                                {t(labelKey)}
                                            </>
                                        )}
                                    </NavLink>
                                ))}
                            </nav>
                        </div>
                    </aside>

                    {/* 콘텐츠 영역 */}
                    <main className="flex-1 min-w-0">
                        <Outlet />
                    </main>
                </div>
            </div>

            <Footer />
        </div>
    );
}
