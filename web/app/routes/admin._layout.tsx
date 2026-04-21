import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/admin._layout";
import { Header } from "~/components/ui-mockup";
import { Sheet, SheetContent } from "~/components/ui/sheet";
import { cn } from "~/lib/utils";

export async function loader({ request }: Route.LoaderArgs) {
    await requireUser(request, ["admin"]);
    return null;
}

const NAV_ITEM_DEFS = [
    { to: "/admin",               key: "dashboard",    icon: "dashboard",       end: true  },
    { to: "/admin/bookings",      key: "bookings",     icon: "calendar_month",  end: false },
    { to: "/admin/listing/new",   key: "newListing",   icon: "add_home",        end: false },
    { to: "/admin/operators",     key: "operators",    icon: "manage_accounts", end: false },
    { to: "/admin/settlements",   key: "settlements",  icon: "account_balance", end: false },
    { to: "/admin/council-token", key: "councilToken", icon: "token",           end: false },
    { to: "/admin/treasury",      key: "treasury",     icon: "savings",         end: false },
    { to: "/governance",          key: "community",    icon: "forum",           end: false },
] as const;

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
    const { t } = useTranslation("admin");
    const navItems = NAV_ITEM_DEFS.map((item) => ({
        ...item,
        label: t(`nav.${item.key}`),
    }));
    return (
        <nav className="space-y-0.5">
            {navItems.map(({ to, label, icon, end }) => (
                <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                        cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                            isActive
                                ? "bg-[#4a3b2c]/10 text-[#4a3b2c]"
                                : "text-stone-500 hover:text-[#4a3b2c] hover:bg-stone-100"
                        )
                    }
                >
                    {({ isActive }) => (
                        <>
                            <span className={cn(
                                "material-symbols-outlined text-[18px]",
                                isActive ? "text-[#4a3b2c]" : "text-stone-400"
                            )}>
                                {icon}
                            </span>
                            {label}
                        </>
                    )}
                </NavLink>
            ))}
        </nav>
    );
}

export default function AdminLayout() {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const { t } = useTranslation("admin");

    return (
        <div className="min-h-screen bg-[#f5f2ee] font-sans">
            <Header onMenuOpen={() => setDrawerOpen(true)} />

            {/* 모바일 드로어 */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetContent side="left" className="w-64 p-6 bg-[#f5f2ee] border-stone-200">
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 px-3">
                        {t("dashboard.title")}
                    </p>
                    <SidebarNav onNavigate={() => setDrawerOpen(false)} />
                </SheetContent>
            </Sheet>

            <div className="container mx-auto px-4 sm:px-8 py-6">
                <div className="flex gap-8">
                    {/* 데스크탑 사이드바 */}
                    <aside className="hidden md:block w-52 shrink-0">
                        <div className="sticky top-8">
                            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3 px-3">
                                {t("dashboard.title")}
                            </p>
                            <SidebarNav />
                        </div>
                    </aside>

                    {/* 콘텐츠 */}
                    <main className="flex-1 min-w-0">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
}
