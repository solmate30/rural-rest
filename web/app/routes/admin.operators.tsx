/**
 * admin.operators.tsx
 * 운영자 계정 목록 / 이름 수정 / 삭제
 */

import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { requireUser } from "~/lib/auth.server";
import { privyClient } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { user as userTable } from "~/db/schema";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/admin.operators";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "~/components/ui/sheet";
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from "~/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { DateTime } from "luxon";

/* ------------------------------------------------------------------ */
/* Loader                                                               */
/* ------------------------------------------------------------------ */

export async function loader({ request }: Route.LoaderArgs) {
    await requireUser(request, ["admin"]);

    const operators = await db
        .select({
            id: userTable.id,
            name: userTable.name,
            email: userTable.email,
            walletAddress: userTable.walletAddress,
            privyDid: userTable.privyDid,
            createdAt: userTable.createdAt,
        })
        .from(userTable)
        .where(eq(userTable.role, "operator"))
        .orderBy(userTable.createdAt);

    return { operators };
}

/* ------------------------------------------------------------------ */
/* Action                                                               */
/* ------------------------------------------------------------------ */

export async function action({ request }: Route.ActionArgs) {
    await requireUser(request, ["admin"]);

    let body: { intent?: string; id?: string; name?: string; privyDid?: string };
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "요청 형식이 올바르지 않습니다" }, { status: 400 });
    }

    const { intent, id } = body;

    if (!id) {
        return Response.json({ error: "id가 필요합니다" }, { status: 400 });
    }

    // 이름 수정
    if (intent === "rename") {
        const name = String(body.name ?? "").trim();
        if (!name) return Response.json({ error: "이름을 입력해주세요" }, { status: 400 });

        await db
            .update(userTable)
            .set({ name, updatedAt: new Date() })
            .where(eq(userTable.id, id));

        return Response.json({ ok: true });
    }

    // 삭제
    if (intent === "delete") {
        // DB 먼저 삭제 (이것만으로 로그인 차단됨)
        await db.delete(userTable).where(eq(userTable.id, id));

        // Privy 삭제는 백그라운드에서 — 응답을 기다리지 않음
        const privyDid = String(body.privyDid ?? "");
        if (privyDid) {
            privyClient.deleteUser(privyDid).catch(() => {
                // Privy에 계정이 없거나 실패해도 무시
            });
        }

        return Response.json({ ok: true });
    }

    return Response.json({ error: "알 수 없는 요청입니다" }, { status: 400 });
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

type Operator = Awaited<ReturnType<typeof loader>>["operators"][number];

function CreateOperatorSheet({ open, onOpenChange, onCreated }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onCreated: () => void;
}) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [msg, setMsg] = useState("");

    function reset() { setName(""); setEmail(""); setStatus("idle"); setMsg(""); }

    async function handleCreate() {
        if (!name.trim() || !email.trim()) return;
        setStatus("loading");
        try {
            const res = await fetch("/api/admin/create-operator", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), email: email.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "계정을 만들지 못했어요");
            setStatus("done");
            setMsg(`생성 완료. ${email}로 /auth에서 로그인하도록 안내해주세요.`);
            onCreated();
        } catch (e: any) {
            setStatus("error");
            setMsg(e.message);
        }
    }

    return (
        <Sheet open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
            <SheetContent side="right" className="w-full sm:max-w-md bg-[#fcfaf7]">
                <SheetHeader className="mb-6">
                    <SheetTitle className="text-base font-bold text-[#4a3b2c]">운영자 계정 생성</SheetTitle>
                    <SheetDescription>이메일로 Privy 계정을 생성하고 운영자 권한을 부여합니다.</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="text-xs text-[#a0856c] font-medium mb-1.5 block">이름</label>
                        <Input placeholder="예: 홍길동" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs text-[#a0856c] font-medium mb-1.5 block">이메일</label>
                        <Input type="email" placeholder="예: operator@village.kr" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    {msg && (
                        <p className={`text-sm ${status === "error" ? "text-red-500" : "text-emerald-600"}`}>{msg}</p>
                    )}
                    <Button
                        onClick={handleCreate}
                        disabled={status === "loading" || !name.trim() || !email.trim()}
                        className="bg-[#4a3b2c] hover:bg-[#3a2d20] text-white"
                    >
                        {status === "loading" ? "생성 중…" : "계정 생성"}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}

export default function AdminOperators() {
    const { operators } = useLoaderData<typeof loader>();
    const { revalidate } = useRevalidator();

    const [createSheetOpen, setCreateSheetOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Operator | null>(null);
    const [editName, setEditName] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<Operator | null>(null);
    const [busy, setBusy] = useState(false);

    async function submitAction(body: Record<string, string | null | undefined>) {
        setBusy(true);
        await fetch("/admin/operators", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        revalidate();
        setBusy(false);
    }

    function handleRename() {
        if (!editTarget || !editName.trim()) return;
        setEditTarget(null);
        submitAction({ intent: "rename", id: editTarget.id, name: editName.trim() });
    }

    function handleDelete() {
        if (!deleteTarget) return;
        setDeleteTarget(null);
        submitAction({ intent: "delete", id: deleteTarget.id, privyDid: deleteTarget.privyDid ?? undefined });
    }

    return (
        <div>
            <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
                {/* 헤더 */}
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-[#4a3b2c]">운영자 관리</h1>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-[#a0856c]">총 {operators.length}명</span>
                        <Button
                            size="sm"
                            onClick={() => setCreateSheetOpen(true)}
                            className="bg-[#4a3b2c] hover:bg-[#3a2d20] text-white"
                        >
                            + 계정 생성
                        </Button>
                    </div>
                </div>

                {/* 테이블 */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base text-[#4a3b2c]">운영자 목록</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {operators.length === 0 ? (
                            <p className="text-center text-sm text-[#a0856c] py-12">
                                등록된 운영자가 없습니다
                            </p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>이름</TableHead>
                                        <TableHead>이메일</TableHead>
                                        <TableHead>지갑</TableHead>
                                        <TableHead>등록일</TableHead>
                                        <TableHead className="text-right">관리</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {operators.map((op) => (
                                        <TableRow key={op.id}>
                                            <TableCell className="font-medium text-[#4a3b2c]">
                                                {op.name}
                                            </TableCell>
                                            <TableCell className="text-sm text-[#6b5744]">
                                                {op.email}
                                            </TableCell>
                                            <TableCell className="text-xs text-[#a0856c] font-mono">
                                                {op.walletAddress
                                                    ? `${op.walletAddress.slice(0, 6)}…${op.walletAddress.slice(-4)}`
                                                    : <span className="text-gray-400">없음</span>}
                                            </TableCell>
                                            <TableCell className="text-sm text-[#a0856c]">
                                                {op.createdAt
                                                    ? DateTime.fromJSDate(new Date(op.createdAt)).toFormat("yyyy.MM.dd")
                                                    : "-"}
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setEditTarget(op);
                                                        setEditName(op.name);
                                                    }}
                                                >
                                                    이름 수정
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => setDeleteTarget(op)}
                                                >
                                                    삭제
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 이름 수정 다이얼로그 */}
            <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>이름 수정</DialogTitle>
                        <DialogDescription>{editTarget?.email}</DialogDescription>
                    </DialogHeader>
                    <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="새 이름"
                        onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditTarget(null)}>취소</Button>
                        <Button
                            onClick={handleRename}
                            disabled={busy || !editName.trim()}
                        >
                            {busy ? "저장 중…" : "저장"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 삭제 확인 다이얼로그 */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>운영자 삭제</DialogTitle>
                        <DialogDescription>
                            <span className="font-semibold text-[#4a3b2c]">{deleteTarget?.name}</span>
                            ({deleteTarget?.email}) 계정을 삭제합니다.
                            <br />
                            해당 운영자가 관리하던 숙소 데이터는 그대로 유지됩니다.
                            <br />
                            <span className="text-red-500 font-medium">이 작업은 되돌릴 수 없습니다.</span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>취소</Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={busy}
                        >
                            {busy ? "삭제 중…" : "삭제 확인"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CreateOperatorSheet
                open={createSheetOpen}
                onOpenChange={setCreateSheetOpen}
                onCreated={revalidate}
            />
        </div>
    );
}
