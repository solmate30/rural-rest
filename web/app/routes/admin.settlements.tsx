import { redirect } from "react-router";
import type { Route } from "./+types/admin.settlements";

export function loader({ request }: Route.LoaderArgs) {
    return redirect("/admin");
}

export default function AdminSettlements() {
    return null;
}
