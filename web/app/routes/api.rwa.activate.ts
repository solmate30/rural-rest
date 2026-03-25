import type { Route } from "./+types/api.rwa.activate";
import { requireUser } from "~/lib/auth.server";
import { activateRwaToken } from "~/lib/rwa.server";

export async function action({ request }: Route.ActionArgs) {
    await requireUser(request, ["host", "admin"]);

    const { rwaTokenId } = await request.json();
    if (!rwaTokenId) {
        return Response.json({ error: "rwaTokenId required" }, { status: 400 });
    }

    try {
        await activateRwaToken(rwaTokenId);
        return Response.json({ ok: true });
    } catch (e: any) {
        return Response.json({ error: e.message }, { status: 400 });
    }
}
