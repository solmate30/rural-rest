// 이 라우트는 더 이상 사용되지 않습니다.
// 운영자 정산은 월 정산 시 어드민이 직접 push 방식으로 자동 전송됩니다.
// (operatorSettlements.payoutTx, paidAt 자동 기록)
// 하위 호환성을 위해 파일을 유지합니다.

import { requireUser } from "../lib/auth.server";
import { db } from "../db/index.server";
import { operatorSettlements } from "../db/schema";
import { and, eq, isNull } from "drizzle-orm";

export async function action({ request }: { request: Request }) {
    const user = await requireUser(request, ["operator", "admin"]);
    const { settlementId, payoutTx } = await request.json();

    const [settlement] = await db
        .select({ id: operatorSettlements.id, operatorId: operatorSettlements.operatorId })
        .from(operatorSettlements)
        .where(and(eq(operatorSettlements.id, settlementId), isNull(operatorSettlements.payoutTx)));

    if (!settlement) {
        return Response.json({ error: "정산 내역을 찾을 수 없거나 이미 지급됨" }, { status: 404 });
    }
    if (settlement.operatorId !== user.id && user.role !== "admin") {
        return Response.json({ error: "권한 없음" }, { status: 403 });
    }

    await db
        .update(operatorSettlements)
        .set({ payoutTx, paidAt: new Date() })
        .where(eq(operatorSettlements.id, settlementId));

    return Response.json({ ok: true });
}
