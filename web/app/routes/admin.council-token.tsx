import { useState } from "react";
import { useLoaderData } from "react-router";
import { useTranslation } from "react-i18next";
import { requireUser } from "~/lib/auth.server";
import { db } from "~/db/index.server";
import { user as userTable } from "~/db/schema";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/admin.council-token";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";

/* ------------------------------------------------------------------ */
/*  Loader                                                             */
/* ------------------------------------------------------------------ */

export async function loader({ request }: Route.LoaderArgs) {
    await requireUser(request, ["admin"]);

    const operators = await db
        .select({
            id: userTable.id,
            name: userTable.name,
            email: userTable.email,
            walletAddress: userTable.walletAddress,
        })
        .from(userTable)
        .where(eq(userTable.role, "operator"));

    return { operators };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminCouncilToken() {
    const { operators } = useLoaderData<typeof loader>();
    const { t } = useTranslation("admin") as any;

    const [selectedId, setSelectedId] = useState<string>("");
    const [amount, setAmount] = useState("1");
    const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [resultMsg, setResultMsg] = useState("");

    const selected = operators.find((o) => o.id === selectedId);

    async function handleIssue() {
        const parsed = parseInt(amount, 10);
        if (!selected?.walletAddress || isNaN(parsed) || parsed < 1) return;
        setStatus("loading");
        setResultMsg("");
        try {
            const res = await fetch("/api/admin/issue-council-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletAddress: selected.walletAddress, amount: parsed }),
            });
            const text = await res.text();
            let data: Record<string, unknown> = {};
            try { data = JSON.parse(text); } catch { throw new Error(text.slice(0, 200)); }
            if (!res.ok) throw new Error((data.error as string) ?? t("rwa.council.error"));
            setStatus("done");
            setResultMsg(t("rwa.council.success", { sig: data.signature }));
            setSelectedId("");
            setAmount("1");
        } catch (e: unknown) {
            setStatus("error");
            setResultMsg(e instanceof Error ? e.message : String(e));
        }
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-[#4a3b2c]">{t("rwa.council.title")}</h1>
                <p className="text-sm text-stone-400 mt-1">{t("rwa.council.desc")}</p>
            </div>

            <Card className="rounded-3xl border-stone-100 shadow-sm max-w-md">
                <CardHeader>
                    <CardTitle className="text-base font-bold text-[#4a3b2c]">{t("rwa.council.cardTitle")}</CardTitle>
                    <CardDescription>{t("rwa.council.cardDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">

                    {/* 운영자 선택 */}
                    <div>
                        <label className="text-xs text-stone-400 font-medium mb-1.5 block">{t("rwa.council.operatorLabel")}</label>
                        <Select
                            value={selectedId}
                            onValueChange={setSelectedId}
                            disabled={status === "loading"}
                        >
                            <SelectTrigger className="rounded-xl border-stone-200 bg-white text-[#4a3b2c] focus:ring-violet-300">
                                {selected ? (
                                    <span className="text-sm font-medium text-[#4a3b2c]">{selected.name}</span>
                                ) : (
                                    <SelectValue placeholder={t("rwa.council.operatorPlaceholder")} />
                                )}
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-stone-100 shadow-md">
                                {operators.length === 0 ? (
                                    <div className="px-4 py-3 text-sm text-stone-400">{t("rwa.council.operatorEmpty")}</div>
                                ) : (
                                    operators.map((op) => (
                                        <SelectItem
                                            key={op.id}
                                            value={op.id}
                                            disabled={!op.walletAddress}
                                            className="rounded-xl cursor-pointer"
                                        >
                                            <div className="flex flex-col gap-0.5 py-0.5">
                                                <span className="font-semibold text-[#4a3b2c]">{op.name}</span>
                                                <span className="text-xs text-stone-400">{op.email}</span>
                                                {!op.walletAddress && (
                                                    <span className="text-[11px] text-amber-500">{t("rwa.council.noWallet")}</span>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        {selected?.walletAddress && (
                            <p className="mt-1.5 text-[11px] font-mono text-stone-400 px-1">
                                {selected.walletAddress.slice(0, 8)}...{selected.walletAddress.slice(-6)}
                            </p>
                        )}
                    </div>

                    {/* 수량 */}
                    <div>
                        <label className="text-xs text-stone-400 font-medium mb-1.5 block">
                            {t("rwa.council.amountLabel")}
                        </label>
                        <Input
                            type="number"
                            min="1"
                            max="100"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="rounded-xl text-sm w-32"
                            disabled={status === "loading"}
                        />
                    </div>

                    <Button
                        onClick={handleIssue}
                        disabled={status === "loading" || !selected?.walletAddress}
                        className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
                    >
                        {status === "loading" ? t("rwa.council.issuing") : t("rwa.council.issue")}
                    </Button>

                    {resultMsg && (
                        <p className={`text-xs font-mono break-all ${status === "done" ? "text-emerald-600" : "text-red-500"}`}>
                            {resultMsg}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
