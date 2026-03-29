import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { operatorSettlements } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function action({ request }: { request: Request }) {
    await requireUser(request, ["admin"]);

    const { listingId, operatorId, month, grossRevenueKrw, operatingCostKrw, operatingProfitKrw, settlementUsdc } =
        await request.json();

    if (!listingId || !operatorId || !month || settlementUsdc <= 0) {
        return Response.json({ error: "필수 항목 누락" }, { status: 400 });
    }

    // 동일 월/매물 중복 방지
    const [existing] = await db
        .select({ id: operatorSettlements.id })
        .from(operatorSettlements)
        .where(and(eq(operatorSettlements.listingId, listingId), eq(operatorSettlements.month, month)));

    if (existing) {
        return Response.json({ error: `${month} 정산이 이미 존재합니다` }, { status: 409 });
    }

    await db.insert(operatorSettlements).values({
        id: uuidv4(),
        operatorId,
        listingId,
        month,
        grossRevenueKrw,
        operatingCostKrw,
        operatingProfitKrw,
        settlementUsdc,
    });

    return Response.json({ ok: true });
}
