/**
 * reset-rwa.ts — RWA 토큰 데이터 초기화 (데모 재촬영용)
 *
 * 실행: cd web && npx tsx scripts/reset-rwa.ts
 */
process.env.TURSO_DATABASE_URL = "file:./local.db";

async function main() {
    const { db } = await import("../app/db/index.server.js");
    const { rwaTokens, rwaInvestments, rwaDividends, localGovSettlements, operatorSettlements } = await import("../app/db/schema.js");

    // 관련 테이블 전부 초기화
    await db.delete(rwaDividends);
    console.log("rwaDividends 삭제");

    await db.delete(localGovSettlements);
    console.log("localGovSettlements 삭제");

    await db.delete(operatorSettlements);
    console.log("operatorSettlements 삭제");

    await db.delete(rwaInvestments);
    console.log("rwaInvestments 삭제");

    await db.delete(rwaTokens);
    console.log("rwaTokens 삭제");

    console.log("\n완료! 모든 RWA 데이터 초기화됨.");
    console.log("admin 대시보드에서 다시 Issue Tokens → 온체인 배포 순서로 진행하세요.");
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
