/**
 * admin._layout.tsx
 * 어드민 공통 레이아웃 — 메인 Header 공유, 콘텐츠 영역만 래핑
 */

import { Outlet } from "react-router";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/admin._layout";
import { Header } from "~/components/ui-mockup";

export async function loader({ request }: Route.LoaderArgs) {
    await requireUser(request, ["admin"]);
    return null;
}

export default function AdminLayout() {
    return (
        <div className="min-h-screen bg-[#f5f2ee] font-sans">
            <Header />
            <Outlet />
        </div>
    );
}
