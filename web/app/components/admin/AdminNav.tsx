import { Link, useLocation } from "react-router";

const NAV_ITEMS = [
    { label: "대시보드", to: "/admin" },
    { label: "정산 관리", to: "/admin/settlements" },
];

export function AdminNav() {
    const { pathname } = useLocation();

    return (
        <div className="flex gap-1 border-b border-stone-200 mb-8">
            {NAV_ITEMS.map((item) => {
                const active = pathname === item.to || (item.to !== "/admin" && pathname.startsWith(item.to));
                return (
                    <Link
                        key={item.to}
                        to={item.to}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            active
                                ? "border-[#17cf54] text-[#17cf54]"
                                : "border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-200"
                        }`}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </div>
    );
}
