import { requireUser } from "~/lib/auth.server";
import { activateRwaToken } from "~/lib/rwa.server";

export async function action({ request }: { request: Request }) {
    await requireUser(request, ["spv", "admin"]);

    const { rwaTokenId } = await request.json() as { rwaTokenId: string };
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
